import { describe, expect, it } from "vitest";
import { DAILY_LIMITS, requireDemoCode } from "@/server/ai";

describe("cost guards", () => {
  it("daily limits match spec", () => {
    expect(DAILY_LIMITS).toEqual({ transcribe: 20, handover: 20, brief: 40, speak: 40 });
  });
  it("rejects missing or wrong access code with 401", async () => {
    process.env["DEMO_ACCESS_CODE"] = "abc";
    const bad = requireDemoCode(new Request("http://x", { headers: { "x-demo-code": "nope" } }));
    expect(bad?.status).toBe(401);
    expect(await bad!.json()).toEqual({ error: "Access code required" });
    expect(requireDemoCode(new Request("http://x"))?.status).toBe(401);
    expect(requireDemoCode(new Request("http://x", { headers: { "x-demo-code": "abc" } }))).toBeNull();
  });
});
