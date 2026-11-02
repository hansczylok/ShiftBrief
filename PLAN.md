# ShiftBrief – development plan

What has changed since the Hack Day, and what is planned but not built. The product idea and
the original specification are in [`SPEC.md`](SPEC.md); the running code is in
[`lovable-app/`](lovable-app/).

## Done after the Hack Day (November 2026)

- **Cost guards.** Brief audio is generated once per brief and cached in storage; the four
  paid API routes require a demo access code, count against daily limits and refuse oversized
  input. Cached audio plays without the code. Details in `lovable-app/AGENTS.md`.
- **Inbox semantics.** *Incoming* is the inbox of the selected person: handovers from the rest
  of the team, never their own recordings. Opening a handover as someone from another team, or
  as its author, shows a notice instead of generating a brief.
- **Persona menu** shows the language each person hears their brief in.
- **Demo data.** One published demo handover per team (Ward 3B, Hotel Front Desk,
  Factory Line 2), each with tasks and safety flags.
- **Workflow.** The Lovable project is GitHub-synced; this repository carries the app as a git
  subtree, see the README section *What is in this repository*.

## Planned, not started

### "My recordings" view for authors

Today a person only sees handovers addressed to them. There is no screen that lists the
handovers they recorded themselves.

- New route *My recordings* in the bottom navigation, listing the selected persona's own
  handovers newest first with summary, task and safety-flag counts.
- Detail view in the author's own language: summary, safety flags, task list with the original
  titles, transcript, and which team members will hear it and in which language.
- No brief generation and no speech calls from this view; it only reads what was recorded.
- Possible later additions: edit or withdraw a handover, see which recipients have already
  listened and which tasks they ticked.

### Accounts and team-scoped data access

The database still has the Hack Day policies ("demo all"): anyone can read and write every
table. Before any deployment with real shift data: Supabase Auth, personas bound to user
accounts, row-level policies per team, and the demo access code replaced by real sessions.

### Demo data in both directions

Each demo handover goes one way (Anna to Mehmet, James to Lisa, Petra to Ion), so the inboxes of
Anna, James and Petra are empty. Three handovers in the other direction would fill them; the
briefs are generated on first open and cost speech credits once.

### Smaller items

- `SPEC.md` still lists Ion with Romanian; the app uses English for him. Decide whether the
  spec or the persona should change.
- Voice choice per language, and a short "what changed since your last shift" recap.
- On-premises deployment with Gemma 4 running locally for sites with strict data rules.

## Operating notes

- Publishing the live site is a manual step in Lovable; secrets changed in Lovable only reach
  the live app after the next publish.
- The ElevenLabs plan is prepaid credits; when they are used up, voice generation fails with
  `quota_exceeded` and nothing is charged. Cached audio keeps playing.
- Gemma 4 on the Gemini API is free of charge and rate-limited; the key lives in a Google Cloud
  project without billing.
- On the Lovable free plan an unused project may be unpublished after a period of inactivity.
