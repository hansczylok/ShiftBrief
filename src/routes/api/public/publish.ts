import { createFileRoute } from "@tanstack/react-router";
import { fail, json, preflight, requireDemoCode } from "@/server/ai";
import { handoverRow } from "@/server/records";

export const Route = createFileRoute("/api/public/publish")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      POST: async ({ request }) => {
        try {
          const denied = requireDemoCode(request);
          if (denied) return denied;
          const body = await request.json().catch(() => ({}));
          if (typeof body.authorId !== "string") return fail("Missing author", 400);

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: author, error } = await supabaseAdmin
            .from("personas")
            .select("id, team")
            .eq("id", body.authorId)
            .maybeSingle();
          if (error) return fail(error.message, 500);
          if (!author) return fail("Unknown author", 400);

          const row = handoverRow(body, author);
          if (typeof row === "string") return fail(row, 400);
          const { data, error: e } = await supabaseAdmin
            .from("handovers")
            .insert({ ...row, data: row.data as never })
            .select("id")
            .single();
          if (e) return fail(e.message, 500);
          return json({ id: data.id });
        } catch (e) {
          return fail(e);
        }
      },
    },
  },
});
