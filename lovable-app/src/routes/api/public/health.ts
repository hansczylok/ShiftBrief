import { createFileRoute } from "@tanstack/react-router";
import { json, preflight } from "@/server/ai";

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      GET: async () =>
        json({ elevenlabs: !!process.env['ELEVENLABS_API_KEY'], gemini: !!process.env['GEMINI_API_KEY'] }),
    },
  },
});
