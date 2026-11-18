import { createFileRoute } from "@tanstack/react-router";
import { fail, requireDemoCode, takeQuota, geminiJson, json, preflight } from "@/server/ai";
import { BRIEF_SYSTEM, briefUser, shortenUser } from "@/server/prompts";
import { UUID, briefRefusal } from "@/server/records";

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export const Route = createFileRoute("/api/public/brief")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      POST: async ({ request }) => {
        try {
          const { handoverId, recipientId } = await request.json().catch(() => ({}));
          if (typeof handoverId !== "string" || !UUID.test(handoverId) || typeof recipientId !== "string")
            return fail("Missing handover or recipient", 400);

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const [{ data: handover, error: he }, { data: recipient, error: re }] = await Promise.all([
            supabaseAdmin.from("handovers").select("*").eq("id", handoverId).maybeSingle(),
            supabaseAdmin.from("personas").select("*").eq("id", recipientId).maybeSingle(),
          ]);
          if (he || re) return fail((he ?? re)!.message, 500);
          if (!handover || !recipient) return fail("Handover or recipient not found", 404);
          const refused = briefRefusal(handover, recipient);
          if (refused) return fail(refused, 403);

          // A brief that already exists is free to serve, so it needs no access code.
          const { data: cached, error: ce } = await supabaseAdmin
            .from("briefs")
            .select("*")
            .eq("handover_id", handoverId)
            .eq("recipient_id", recipientId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (ce) return fail(ce.message, 500);
          if (cached) return json(cached);

          const denied = requireDemoCode(request);
          if (denied) return denied;
          const key = process.env["GEMINI_API_KEY"];
          if (!key) return fail("GEMINI_API_KEY is not set", 500);
          const limited = await takeQuota("brief");
          if (limited) return limited;

          const { data: author } = await supabaseAdmin
            .from("personas")
            .select("name, role")
            .eq("id", handover.author_id)
            .maybeSingle();
          const data = (handover.data ?? {}) as Record<string, any>;
          const input = { summary: handover.summary, ...data };
          const out = await geminiJson(
            key,
            BRIEF_SYSTEM,
            briefUser(input, author ?? { name: handover.author_id, role: "" }, recipient),
          );
          let script = String(out.script ?? "");

          if (words(script) > 220) {
            try {
              const short = await geminiJson(key, BRIEF_SYSTEM, shortenUser(script, recipient.language));
              if (typeof short.script === "string" && short.script.trim()) script = short.script;
            } catch {
              /* keep the long script */
            }
          }

          const tasks: { id: string; title: string }[] = Array.isArray(data["tasks"]) ? data["tasks"] : [];
          const raw: any[] = Array.isArray(out.checklist) ? out.checklist : [];
          const taskIds = tasks.map((t) => String(t.id)).sort().join("|");
          const gotIds = raw.map((c) => String(c?.id)).sort().join("|");
          const checklist =
            taskIds === gotIds && raw.every((c) => typeof c.title === "string" && c.title.trim())
              ? raw.map((c) => ({ id: String(c.id), title: String(c.title) }))
              : tasks.map((t) => ({ id: String(t.id), title: String(t.title) }));

          const { data: brief, error: ie } = await supabaseAdmin
            .from("briefs")
            .insert({
              handover_id: handoverId,
              recipient_id: recipientId,
              language: recipient.language,
              script,
              checklist,
            })
            .select()
            .single();
          if (ie) return fail(ie.message, 500);
          return json(brief);
        } catch (e) {
          return fail(e);
        }
      },
    },
  },
});
