// Pure helpers for API routes. Secrets are passed in from route handlers.

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export const fail = (e: unknown, status = 500) =>
  json({ error: e instanceof Error ? e.message : String(e) }, status);

export const preflight = () => new Response(null, { status: 204 });

// Returns a 401 Response when the x-demo-code header does not match DEMO_ACCESS_CODE.
export function requireDemoCode(request: Request): Response | null {
  const expected = process.env["DEMO_ACCESS_CODE"];
  const got = request.headers.get("x-demo-code");
  if (!expected || !got || got !== expected) return json({ error: "Access code required" }, 401);
  return null;
}

export const DAILY_LIMITS = { transcribe: 20, handover: 20, brief: 40, speak: 40 } as const;

// Increments today's counter; returns a 429 Response when the limit is exceeded.
export async function takeQuota(route: keyof typeof DAILY_LIMITS): Promise<Response | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("bump_api_usage", { _route: route, _limit: DAILY_LIMITS[route] });
  if (error) return fail(`Usage check failed: ${error.message}`, 500);
  if (data !== true) return json({ error: "Daily limit reached, try again tomorrow" }, 429);
  return null;
}

const MODEL = "gemma-4-26b-a4b-it";

export function extractJson(s: string) {
  const t = s.replace(/```(?:json)?/gi, "");
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("Model did not return valid JSON");
  return JSON.parse(t.slice(a, b + 1));
}

// Remembered per worker instance once the API rejects a feature.
let useSystemInstruction = true;
let useThinking = true;

async function callGemini(apiKey: string, system: string, user: string): Promise<string> {
  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: useSystemInstruction ? user : `${system}\n\n${user}` }] }],
    generationConfig: {
      temperature: 0.3,
      ...(useThinking ? { thinkingConfig: { thinkingLevel: "minimal" } } : {}),
    },
  };
  if (useSystemInstruction) body["system_instruction"] = { parts: [{ text: system }] };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 400 && useThinking && /think/i.test(text)) {
      useThinking = false;
      return callGemini(apiKey, system, user);
    }
    if (res.status === 400 && useSystemInstruction && /system.?instruction|developer instruction/i.test(text)) {
      useSystemInstruction = false;
      return callGemini(apiKey, system, user);
    }
    throw new Error(`Gemini error [${res.status}]: ${text}`);
  }
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.filter((p: any) => !p.thought).map((p: any) => p.text ?? "").join("");
  if (!text) throw new Error("Empty response from Gemini");
  return text;
}

export async function geminiJson(apiKey: string, system: string, user: string) {
  const first = await callGemini(apiKey, system, user);
  try {
    return extractJson(first);
  } catch {
    const second = await callGemini(apiKey, system, `${user}\n\nReturn only valid JSON.`);
    return extractJson(second);
  }
}
