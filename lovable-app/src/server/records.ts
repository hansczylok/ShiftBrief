// Pure checks for the writes the browser may no longer make itself: the anon role only reads,
// so publishing a handover and saving a brief go through API routes with the service role.

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_TRANSCRIPT = 20000;
const MAX_SUMMARY = 4000;
const MAX_DATA = 50000;

type Author = { id: string; team: string };

export type HandoverRow = {
  author_id: string;
  team: string;
  transcript: string;
  summary: string;
  source_language: string | null;
  data: Record<string, unknown>;
  status: "published";
};

// Builds the handovers row from a publish request, or returns the reason it is refused.
// The team always comes from the author's persona, never from the request.
export function handoverRow(body: any, author: Author): HandoverRow | string {
  const { transcript, summary, source_language, data } = body ?? {};
  if (typeof transcript !== "string" || !transcript.trim()) return "Transcript is empty";
  if (transcript.length > MAX_TRANSCRIPT) return "Transcript too long";
  if (typeof summary !== "string" || !summary.trim()) return "Summary is empty";
  if (summary.length > MAX_SUMMARY) return "Summary too long";
  if (!data || typeof data !== "object" || Array.isArray(data)) return "Missing handover data";
  if (JSON.stringify(data).length > MAX_DATA) return "Handover data too large";
  if (source_language != null && (typeof source_language !== "string" || source_language.length > 10))
    return "Invalid source language";
  return {
    author_id: author.id,
    team: author.team,
    transcript,
    summary,
    source_language: source_language ?? null,
    data,
    status: "published",
  };
}

// Briefs are written only for people on the handover's team, and never for its author.
export function briefRefusal(
  handover: { team: string; author_id: string },
  recipient: { id: string; team: string },
): string | null {
  if (recipient.team !== handover.team) return `This handover is for ${handover.team}`;
  if (recipient.id === handover.author_id) return "Authors get no brief for their own handover";
  return null;
}
