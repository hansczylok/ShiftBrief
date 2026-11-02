import { createFileRoute } from "@tanstack/react-router";
import { fail, json, preflight, requireDemoCode, takeQuota } from "@/server/ai";

const BUCKET = "brief-audio";
const MAX_CHARS = 2500;
const URL_TTL = 60 * 60 * 24 * 7; // signed URL valid 7 days (bucket is private)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/api/public/speak")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      POST: async ({ request }) => {
        try {
          const { briefId } = await request.json().catch(() => ({}));
          if (typeof briefId !== "string" || !UUID.test(briefId))
            return fail("Missing briefId", 400);

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: brief, error } = await supabaseAdmin
            .from("briefs")
            .select("id, script")
            .eq("id", briefId)
            .maybeSingle();
          if (error) return fail(error.message, 500);
          if (!brief) return fail("Brief not found", 404);
          const text = String(brief.script ?? "");
          if (!text.trim()) return fail("Brief has no script", 400);
          if (text.length > MAX_CHARS)
            return fail(`Script too long (max ${MAX_CHARS} characters)`, 400);

          const path = `${briefId}.mp3`;
          const store = supabaseAdmin.storage.from(BUCKET);
          const signed = async () => {
            const { data, error: e } = await store.createSignedUrl(path, URL_TTL);
            if (e || !data) throw new Error(e?.message ?? "Could not sign audio URL");
            return data.signedUrl;
          };

          // Cached audio is free to serve, so it needs no access code.
          const { data: existing } = await store.list("", { search: path, limit: 1 });
          if (existing?.some((f) => f.name === path))
            return json({ url: await signed(), cached: true });

          // Generating audio costs ElevenLabs credits: access code and daily quota apply.
          const denied = requireDemoCode(request);
          if (denied) return denied;
          const key = process.env["ELEVENLABS_API_KEY"];
          if (!key) return fail("ELEVENLABS_API_KEY is not set", 500);
          const limited = await takeQuota("speak");
          if (limited) return limited;

          const res = await fetch(
            "https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb?output_format=mp3_44100_128",
            {
              method: "POST",
              headers: { "xi-api-key": key, "content-type": "application/json" },
              body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
            },
          );
          if (!res.ok) return fail(`Voice failed [${res.status}]: ${await res.text()}`, 502);
          const mp3 = await res.arrayBuffer();
          const up = await store.upload(path, mp3, { contentType: "audio/mpeg", upsert: true });
          if (up.error) return fail(`Saving audio failed: ${up.error.message}`, 500);
          return json({ url: await signed(), cached: false });
        } catch (e) {
          return fail(e);
        }
      },
    },
  },
});
