import { createFileRoute } from "@tanstack/react-router";
import { fail, geminiJson, json, preflight } from "@/server/ai";
import { BRIEF_SYSTEM, briefUser, shortenUser } from "@/server/prompts";

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export const Route = createFileRoute("/api/public/brief")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      POST: async ({ request }) => {
        try {
          const key = process.env["GEMINI_API_KEY"];
          if (!key) return fail("GEMINI_API_KEY is not set", 500);
          const { handover, author, recipient } = await request.json();
          if (!handover || !recipient?.language) return fail("Missing handover or recipient", 400);

          const out = await geminiJson(key, BRIEF_SYSTEM, briefUser(handover, author ?? {}, recipient));
          let script = String(out.script ?? "");

          if (words(script) > 220) {
            try {
              const short = await geminiJson(key, BRIEF_SYSTEM, shortenUser(script, recipient.language));
              if (typeof short.script === "string" && short.script.trim()) script = short.script;
            } catch {
              /* keep the long script */
            }
          }

          const tasks: { id: string; title: string }[] = Array.isArray(handover.tasks) ? handover.tasks : [];
          const raw: any[] = Array.isArray(out.checklist) ? out.checklist : [];
          const taskIds = tasks.map((t) => String(t.id)).sort().join("|");
          const gotIds = raw.map((c) => String(c?.id)).sort().join("|");
          const checklist =
            taskIds === gotIds && raw.every((c) => typeof c.title === "string" && c.title.trim())
              ? raw.map((c) => ({ id: String(c.id), title: String(c.title) }))
              : tasks.map((t) => ({ id: String(t.id), title: String(t.title) }));

          return json({ script, language: recipient.language, checklist });
        } catch (e) {
          return fail(e);
        }
      },
    },
  },
});
