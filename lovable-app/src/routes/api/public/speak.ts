import { createFileRoute } from "@tanstack/react-router";
import { CORS, fail, preflight } from "@/server/ai";

export const Route = createFileRoute("/api/public/speak")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      POST: async ({ request }) => {
        try {
          const key = process.env['ELEVENLABS_API_KEY'];
          if (!key) return fail("ELEVENLABS_API_KEY is not set", 500);
          const { text } = await request.json();
          if (typeof text !== "string" || !text.trim()) return fail("Text is empty", 400);
          if (text.length > 5000) return fail("Text too long", 400);
          const res = await fetch(
            "https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb?output_format=mp3_44100_128",
            {
              method: "POST",
              headers: { "xi-api-key": key, "content-type": "application/json" },
              body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
            },
          );
          if (!res.ok) return fail(`Voice failed [${res.status}]: ${await res.text()}`, 502);
          return new Response(await res.arrayBuffer(), { headers: { ...CORS, "content-type": "audio/mpeg" } });
        } catch (e) {
          return fail(e);
        }
      },
    },
  },
});
