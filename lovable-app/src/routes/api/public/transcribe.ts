import { createFileRoute } from "@tanstack/react-router";
import { fail, json, preflight } from "@/server/ai";

export const Route = createFileRoute("/api/public/transcribe")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      POST: async ({ request }) => {
        try {
          const key = process.env['ELEVENLABS_API_KEY'];
          if (!key) return fail("ELEVENLABS_API_KEY is not set", 500);
          const form = await request.formData();
          const audio = form.get("audio");
          if (!(audio instanceof Blob) || audio.size === 0) return fail("Missing audio", 400);
          if (audio.size > 25 * 1024 * 1024) return fail("Audio too large", 400);
          const ct = audio.type || "audio/webm";
          console.log(`[transcribe] audio size=${audio.size} bytes type=${ct}`);
          const ext = ct.includes("mp4") ? "mp4" : ct.includes("ogg") ? "ogg" : "webm";
          const fd = new FormData();
          fd.append("file", audio, `handover.${ext}`);
          fd.append("model_id", "scribe_v1");
          const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
            method: "POST",
            headers: { "xi-api-key": key },
            body: fd,
          });
          if (!res.ok) return fail(`Transcription failed [${res.status}]: ${await res.text()}`, 502);
          const data = await res.json();
          return json({ text: data.text ?? "", language: data.language_code ?? null });
        } catch (e) {
          return fail(e);
        }
      },
    },
  },
});
