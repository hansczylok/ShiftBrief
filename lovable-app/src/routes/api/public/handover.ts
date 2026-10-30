import { createFileRoute } from "@tanstack/react-router";
import { fail, geminiJson, json, preflight } from "@/server/ai";
import { HANDOVER_SYSTEM, handoverUser } from "@/server/prompts";

export const Route = createFileRoute("/api/public/handover")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      POST: async ({ request }) => {
        try {
          const key = process.env['GEMINI_API_KEY'];
          if (!key) return fail("GEMINI_API_KEY is not set", 500);
          const { transcript, author } = await request.json();
          if (typeof transcript !== "string" || !transcript.trim()) return fail("Transcript is empty", 400);
          if (transcript.length > 20000) return fail("Transcript too long", 400);
          const out = await geminiJson(key, HANDOVER_SYSTEM, handoverUser(transcript, author ?? {}));
          const tasks = (Array.isArray(out.tasks) ? out.tasks : []).map((t: any, i: number) => ({
            id: String(t.id ?? `t${i + 1}`),
            title: String(t.title ?? ""),
            priority: ["high", "medium", "low"].includes(t.priority) ? t.priority : "medium",
            due: t.due ?? null,
            location: t.location ?? null,
          }));
          return json({
            summary: String(out.summary ?? ""),
            source_language: out.source_language ?? author?.language ?? null,
            tasks,
            safety_flags: Array.isArray(out.safety_flags) ? out.safety_flags : [],
            open_questions: Array.isArray(out.open_questions) ? out.open_questions : [],
            people_or_assets: Array.isArray(out.people_or_assets) ? out.people_or_assets : [],
          });
        } catch (e) {
          return fail(e);
        }
      },
    },
  },
});
