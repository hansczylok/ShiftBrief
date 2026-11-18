import { describe, expect, it } from "vitest";
import { briefRefusal, handoverRow } from "@/server/records";

const author = { id: "anna", team: "Ward 3B" };
const body = { transcript: "Ruhige Nacht", summary: "Quiet night", source_language: "de", data: { tasks: [] } };

describe("handoverRow", () => {
  it("takes the team from the author, not from the request", () => {
    const row = handoverRow({ ...body, team: "Hotel Front Desk", author_id: "james" }, author);
    expect(row).toMatchObject({ author_id: "anna", team: "Ward 3B", status: "published" });
  });
  it("refuses empty, oversized or malformed input", () => {
    expect(handoverRow({ ...body, transcript: " " }, author)).toBe("Transcript is empty");
    expect(handoverRow({ ...body, transcript: "x".repeat(20001) }, author)).toBe("Transcript too long");
    expect(handoverRow({ ...body, summary: "" }, author)).toBe("Summary is empty");
    expect(handoverRow({ ...body, data: [] }, author)).toBe("Missing handover data");
    expect(handoverRow({ ...body, data: { x: "y".repeat(50000) } }, author)).toBe("Handover data too large");
    expect(handoverRow(undefined, author)).toBe("Transcript is empty");
  });
});

describe("briefRefusal", () => {
  const handover = { team: "Ward 3B", author_id: "anna" };
  it("allows a teammate", () => {
    expect(briefRefusal(handover, { id: "mehmet", team: "Ward 3B" })).toBeNull();
  });
  it("refuses another team and the author", () => {
    expect(briefRefusal(handover, { id: "lisa", team: "Hotel Front Desk" })).toBe("This handover is for Ward 3B");
    expect(briefRefusal(handover, { id: "anna", team: "Ward 3B" })).toMatch(/own handover/);
  });
});
