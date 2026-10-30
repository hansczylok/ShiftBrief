import { describe, expect, it } from "vitest";
import { extractJson } from "@/server/ai";
describe("extractJson", () => {
  it("strips code fences and surrounding prose", () => {
    expect(extractJson('Sure!\n```json\n{"a":1}\n```\nDone')).toEqual({ a: 1 });
  });
  it("throws when there is no object", () => {
    expect(() => extractJson("no json here")).toThrow();
  });
});
