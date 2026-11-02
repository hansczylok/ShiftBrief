import { describe, expect, it } from "vitest";
import { languageName } from "@/lib/persona";

describe("languageName", () => {
  it("turns persona language codes into English names", () => {
    expect(languageName("de")).toBe("German");
    expect(languageName("tr")).toBe("Turkish");
    expect(languageName("en")).toBe("English");
    expect(languageName("ro")).toBe("Romanian");
  });
});
