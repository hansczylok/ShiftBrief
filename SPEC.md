# ShiftBrief – Voice Shift Handover

**Specification for Lovable (Hack Day Linz, 30.10.2026)**

> One sentence: A worker ending a shift dictates the handover; the next worker gets a
> 60-second personalized audio brief in their own language plus a tappable checklist.

Stack, all inside one Lovable project: **Lovable** (React UI + Cloud DB + edge functions) ·
**ElevenLabs** (Scribe speech-to-text, Multilingual v2 text-to-speech) ·
**Gemma 4** open weights via the Gemini API (extraction, safety flags, translation, brief script).

The Python backend in this repo is **not** used at the event. It stays as a reference
implementation and as proof that Gemma 4 can be self-hosted (Vertex AI switch).

---

## 1. Problem and pitch (90 s)

- **Problem (15 s):** Shift handovers are rushed, verbal, and lost. Night nurse tells day nurse
  three things in the corridor; one is forgotten. Same in hotels, factories, on-call rotations.
  Workers often don't share a first language.
- **Demo (50 s):** Anna (night shift, German) taps the mic and dictates 20 seconds. ShiftBrief
  transcribes, Gemma pulls out tasks and a safety flag, and Mehmet (day shift, Turkish) opens
  the app, hears a 60-second brief in Turkish, and sees the checklist. He ticks off the first task.
- **Why open source / Gemma (15 s):** Gemma 4 does all reasoning: extraction, risk flagging,
  translation, script writing. Open weights mean a hospital can later run it on-prem; our repo
  shows the same calls against a self-hosted Vertex AI endpoint. ElevenLabs handles ears and voice.
- **Next (10 s):** Shift history, escalation to a supervisor, Slack/Teams digest.

Challenges covered: Best Open-Source AI Project (Gemma is the core), Best Use of Gemma 4,
Best Use of ElevenLabs (STT + TTS), Best Use of Lovable (entire product built there).

---

## 2. Scope

### MVP (must work end to end by 17:30)

1. Pick who you are (demo persona dropdown, no login).
2. Record a dictation in the browser, transcribe it with ElevenLabs Scribe, show the transcript.
3. Gemma turns the transcript into structured handover JSON (summary, tasks, safety flags,
   open questions). User can edit the task list before publishing.
4. Publish the handover. It is stored in the Lovable Cloud database.
5. Next worker opens "Incoming", picks the latest handover for their team, presses Play.
   Gemma writes a personalized script in the recipient's language, ElevenLabs speaks it,
   checklist is shown and tickable.

### Stretch (only after MVP is demoed three times without errors)

- Live waveform while recording, "re-record" button.
- Due-time parsing ("by 10:00") into sortable times.
- Supervisor view: all open safety flags across teams.
- Image attachment (photo of whiteboard / machine display) sent to Gemma with the dictation.
- Export checklist as PDF / share link.

### Non-goals

- Authentication, roles, permissions. Personas are hardcoded.
- Offline mode. Everything is cloud.
- Medical-grade accuracy claims. The UI shows a "review before publishing" step on purpose.

---

## 3. Personas and demo data

Personas are seeded into the `personas` table:

| id | name | role | team | language |
|---|---|---|---|---|
| anna | Anna | Nurse, night shift | Ward 3B | de |
| mehmet | Mehmet | Nurse, day shift | Ward 3B | tr |
| lisa | Lisa | Receptionist, late shift | Hotel Front Desk | de |
| james | James | Receptionist, early shift | Hotel Front Desk | en |
| petra | Petra | Line operator, shift C | Factory Line 2 | de |
| ion | Ion | Line operator, shift A | Factory Line 2 | en |

Team is the routing key: a handover published by Anna (Ward 3B) is what Mehmet (Ward 3B) sees.

**Prepared dictations** (German, read these aloud in the demo; never improvise live):

1. *Ward 3B:* "Zimmer 12, Herr Huber, hat seit drei Uhr Fieber 38,9, Paracetamol um vier
   gegeben, bitte um acht nochmal messen. Zimmer 14 ist nüchtern für die OP um zehn, bitte kein
   Frühstück bringen. Die Infusionspumpe auf Zimmer 9 piept dauernd, Technik ist informiert,
   Ticket Nummer 4471. Frau Maier in 11 ist sturzgefährdet, Bettgitter bleibt oben."
2. *Hotel Front Desk:* "Zimmer 305 hat sich über Lärm beschwert, Gäste reisen morgen ab, bitte
   Late-Checkout bis zwölf anbieten. Die Gruppe von Siemens kommt um 14 Uhr, 18 Zimmer,
   Schlüsselkarten liegen vorbereitet in der Schublade. Der Aufzug B klemmt manchmal in der
   dritten Etage, Techniker kommt vormittags. Kasse stimmt, 40 Euro Wechselgeld fehlen, hab
   ich im Buch notiert."
3. *Factory Line 2:* "Maschine 4 hatte zweimal Überhitzung, ich hab sie auf 80 Prozent
   gedrosselt, bitte nicht wieder hochfahren bevor Instandhaltung da war. Charge 2231 ist fertig,
   steht auf Palette 7, muss noch etikettiert werden. Achtung, am Notausgang Ost liegt Öl,
   abgesperrt mit Hütchen, noch nicht gereinigt. Material für Charge 2232 kommt um sieben."

Expected safety flags: fall risk (1), fasting patient (1), elevator fault (2), overheating
machine (3), oil spill at emergency exit (3).

---

## 4. Architecture

```
Browser (Lovable React app)              Lovable Cloud edge functions (Deno)            External APIs
───────────────────────────              ───────────────────────────────────            ─────────────
MediaRecorder → webm blob   ──▶ transcribe  ── multipart ─────────────────────────────▶ ElevenLabs Scribe (STT)
transcript + author         ──▶ handover    ── generateContent (system + user prompt) ─▶ Gemini API: gemma-4-26b-a4b-it
edited handover             ──▶ insert into `handovers` (Cloud DB)
recipient opens incoming    ──▶ brief       ── generateContent ───────────────────────▶ Gemini API: gemma-4-26b-a4b-it
script                      ──▶ speak       ── text-to-speech ────────────────────────▶ ElevenLabs TTS (mp3)
```

- API keys live only in Lovable Cloud secrets: `ELEVENLABS_API_KEY`, `GEMINI_API_KEY`.
  The browser never sees them.
- Four edge functions, one per operation, JSON in / JSON out (speak returns audio bytes).
- Database tables hold personas, handovers, cached briefs, and checklist ticks.

---

## 5. Edge function contract

All functions accept POST, return JSON unless noted, and on error return
`{"error": "<human readable>"}` with status 4xx/5xx. CORS headers on every response.

> **As built (30.10., 14:40):** Lovable implemented these as app server routes under
> `/api/public/<name>` (transcribe, handover, brief, speak, health) instead of standalone
> Supabase edge functions. Same contracts. Prompts live in `src/server/prompts.ts`, the Gemini
> call with its fallbacks in `src/server/ai.ts`.
> Project: https://lovable.dev/projects/f97d6603-8c20-4c6b-be73-a12490701472
> Live app: https://shiftbrief.lovable.app (published 30.10., 14:45; secrets must be set in
> Lovable before the voice and AI steps work)

### `transcribe`

Input: multipart form, field `audio` (webm/opus blob from MediaRecorder; mp3/wav also fine),
optional field `language` (ISO-639-1 hint).

Calls `POST https://api.elevenlabs.io/v1/speech-to-text` with header `xi-api-key`, multipart
fields `file` (the audio) and `model_id=scribe_v1`, plus `language_code` if given.

```json
{ "text": "Zimmer 12, Herr Huber, hat seit drei Uhr Fieber ...", "language": "de" }
```

### `handover`

```json
{
  "transcript": "…",
  "author": { "name": "Anna", "role": "Nurse, night shift", "team": "Ward 3B", "language": "de" }
}
```

Calls the Gemini API (section 7, extraction prompt) and returns parsed JSON:

```json
{
  "summary": "Ruhige Nacht, ein Fieberpatient, eine OP-Vorbereitung, ein Technikdefekt.",
  "source_language": "de",
  "tasks": [
    { "id": "t1", "title": "Fieber bei Herrn Huber (Zi. 12) um 08:00 erneut messen", "priority": "high", "due": "08:00", "location": "Zimmer 12" },
    { "id": "t2", "title": "Zimmer 14 nüchtern lassen, kein Frühstück (OP 10:00)", "priority": "high", "due": "10:00", "location": "Zimmer 14" },
    { "id": "t3", "title": "Infusionspumpe Zi. 9: Technik-Ticket 4471 verfolgen", "priority": "medium", "due": null, "location": "Zimmer 9" }
  ],
  "safety_flags": [
    { "text": "Frau Maier (Zi. 11) sturzgefährdet – Bettgitter oben lassen", "severity": "high" }
  ],
  "open_questions": [],
  "people_or_assets": ["Herr Huber", "Frau Maier", "Infusionspumpe Zi. 9"]
}
```

`priority` ∈ `high | medium | low`. `severity` ∈ `high | medium`. `due` is a free string or null.
If Gemma returns invalid JSON, retry once with "Return only valid JSON", then return 502.

### `brief`

```json
{
  "handover": { …the object above, after user edits… },
  "author": { "name": "Anna", "role": "Nurse, night shift" },
  "recipient": { "name": "Mehmet", "role": "Nurse, day shift", "language": "tr" }
}
```

Returns the spoken script (target ≈ 150 words ≈ 60 s) in the recipient's language:

```json
{ "script": "Günaydın Mehmet, ben Anna. Gece sakin geçti. Üç önemli nokta var: …", "language": "tr", "checklist": [ { "id": "t1", "title": "…translated…" } ] }
```

`checklist` is the task list translated into the recipient's language, same ids, so the UI
can map ticks back to the stored handover.

### `speak`

Input `{"text": "…"}`. Calls
`POST https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb?output_format=mp3_44100_128`
with header `xi-api-key` and body `{"text": "...", "model_id": "eleven_multilingual_v2"}`.
Returns `audio/mpeg` bytes. One voice covers all demo languages. Frontend creates a blob URL
and plays it in an `<audio>` element.

### Gemini API call (used by `handover` and `brief`)

```
POST https://generativelanguage.googleapis.com/v1beta/models/gemma-4-26b-a4b-it:generateContent
Header: x-goog-api-key: <GEMINI_API_KEY>
Body: {
  "system_instruction": { "parts": [{ "text": "<system prompt>" }] },
  "contents": [{ "role": "user", "parts": [{ "text": "<user prompt>" }] }],
  "generationConfig": { "temperature": 0.3, "thinkingConfig": { "thinkingLevel": "minimal" } }
}
```

Read `candidates[0].content.parts[0].text`, strip ``` fences, `JSON.parse`. If the API rejects
`thinkingConfig`, drop it. Each call must return in under ~8 s or the demo drags.

---

## 6. Lovable app specification

### Data model (Lovable Cloud)

```
personas      id text pk, name, role, team, language
handovers     id uuid pk, created_at, author_id → personas, team, transcript text,
              summary text, source_language text, data jsonb (full Gemma object), status text ('published')
briefs        id uuid pk, handover_id → handovers, recipient_id → personas, language text,
              script text, checklist jsonb, created_at
task_states   handover_id, task_id text, recipient_id, done bool, done_at   (pk: handover_id, task_id, recipient_id)
```

RLS: public read/write for the hackathon (no auth). Seed `personas` with the table in section 3.

### Screens

**0. Persona picker (top bar, always visible)**
Dropdown "I am…" listing personas as "Anna · Nurse, night shift · Ward 3B". Stored in
localStorage. A small status dot shows whether both secrets are configured (a tiny `health`
edge function that returns `{elevenlabs: bool, gemini: bool}` without exposing values).

**1. Record handover** (`/record`)
- Big round mic button. Tap to start (MediaRecorder, `audio/webm`), tap to stop. Timer shown.
  Max 120 s.
- On stop: send to `transcribe`, show spinner "Listening…", then transcript in an editable
  textarea (so typos can be fixed, and the demo has a typed fallback if the mic fails).
  A "Type instead" link skips recording and shows the empty textarea.
- Button **"Extract tasks"** → `handover` with transcript and current persona. Spinner text
  "Gemma is reading your handover…".
- Result view: summary paragraph; **Safety flags** card at the top in red/amber with a warning
  icon; **Tasks** as an editable list (title, priority chip, due, location; delete and add row);
  **Open questions** list if non-empty.
- Button **"Publish handover"** → insert into `handovers`, toast "Handover published for
  Ward 3B", navigate to `/incoming`.

**2. Incoming briefs** (`/incoming`, default landing page)
- Cards for handovers where `team == current persona's team`, newest first: author avatar
  initial, "Anna → Ward 3B", relative time, summary, counts "4 tasks · 1 safety flag".
- Tap a card → **Brief detail** (`/brief/:handoverId`):
  - On open: look up `briefs` for this handover + recipient. If missing, call `brief` and store
    the result. Then immediately call `speak` with the script so audio is ready before Play.
  - Large **Play** button, progress bar, script text below. Language badge "🇹🇷 Türkçe".
  - **Checklist**: translated tasks with checkboxes, priority chips (high = red, medium = amber,
    low = gray). Ticks persist in `task_states`. Safety flags shown above checklist, not
    tickable, red border.
  - Small link "Show original transcript (Deutsch)".

**3. Team board** (`/board`, stretch)
Table of all handovers across teams with open safety flags count. Only if time allows.

### Visual direction

- Mobile-first, works at 390 px wide; the demo is shown on a laptop in a narrow window or
  phone mirroring. Large touch targets (min 48 px). Dark text on light background, one accent
  color (teal), red reserved for safety.
- Font: Inter. Rounded cards, generous spacing. No marketing landing page; the app opens
  directly on `/incoming`.
- Loading states have a sentence each ("Listening…", "Gemma is reading your handover…",
  "Writing Mehmet's brief…", "Generating voice…"). The demo narrates itself.
- Error toasts show the edge function's `error` text.

### Paste-ready Lovable prompt (first message)

```
Build "ShiftBrief", a mobile-first web app for voice shift handovers, with Lovable Cloud
(database + edge functions). No authentication; the user picks a persona from a dropdown in
the top bar ("I am…"), persisted in localStorage.

DATABASE. Tables with public read/write RLS (hackathon demo):
- personas(id text pk, name, role, team, language). Seed: anna/Anna/Nurse, night shift/
  Ward 3B/de; mehmet/Mehmet/Nurse, day shift/Ward 3B/tr; lisa/Lisa/Receptionist, late shift/
  Hotel Front Desk/de; james/James/Receptionist, early shift/Hotel Front Desk/en;
  petra/Petra/Line operator, shift C/Factory Line 2/de; ion/Ion/Line operator, shift A/
  Factory Line 2/en.
- handovers(id uuid pk, created_at, author_id, team, transcript, summary, source_language,
  data jsonb, status).
- briefs(id uuid pk, handover_id, recipient_id, language, script, checklist jsonb, created_at).
- task_states(handover_id, task_id text, recipient_id, done bool, done_at; composite pk).

EDGE FUNCTIONS (secrets ELEVENLABS_API_KEY and GEMINI_API_KEY; ask me to add them).
All return CORS headers and {error} on failure.
1. transcribe: multipart field `audio` (webm). POST to
   https://api.elevenlabs.io/v1/speech-to-text with header xi-api-key, multipart `file` and
   `model_id=scribe_v1`. Return {text, language}.
2. handover: JSON {transcript, author:{name,role,team,language}}. Call
   https://generativelanguage.googleapis.com/v1beta/models/gemma-4-26b-a4b-it:generateContent
   with header x-goog-api-key, system_instruction + user prompt (I will give the exact prompt
   texts in the next message), temperature 0.3. Strip code fences and JSON.parse the reply;
   retry once with "Return only valid JSON" if parsing fails. Return
   {summary, source_language, tasks:[{id,title,priority,due,location}],
    safety_flags:[{text,severity}], open_questions:[], people_or_assets:[]}.
3. brief: JSON {handover, author:{name,role}, recipient:{name,role,language}}. Same Gemini
   call with the brief prompt; return {script, language, checklist:[{id,title}]}.
4. speak: JSON {text}. POST to
   https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb?output_format=mp3_44100_128
   with header xi-api-key and body {text, model_id:"eleven_multilingual_v2"}; return the
   audio/mpeg bytes.
5. health: returns {elevenlabs: boolean, gemini: boolean} (whether each secret is set).

PAGES.
- /incoming (default): cards of handovers where team equals the current persona's team,
  newest first (author initial avatar, "Anna → Ward 3B", relative time, summary,
  "N tasks · M safety flags"). Tap opens /brief/:id.
- /brief/:id: load the cached row from briefs for this handover + current persona; if none,
  call the brief function and store it. Then immediately call speak and keep the mp3 blob
  ready. Show a big Play button with progress bar, the script text, a language badge, safety
  flags in red-bordered cards, and a checklist of the translated tasks with checkboxes that
  persist in task_states. Priority chips: high red, medium amber, low gray. Link "Show
  original transcript".
- /record: large round microphone button using MediaRecorder (audio/webm), tap to start/stop,
  timer, 120 s max; link "Type instead". On stop call transcribe and show the text in an
  editable textarea. Button "Extract tasks" calls handover and shows the summary, a safety
  flags card on top, and an editable task list (edit title, priority, due, location; delete;
  add). Button "Publish handover" inserts into handovers and navigates to /incoming with a
  toast.

Top bar: persona dropdown and a small green/red dot from the health function.
Loading states show a sentence: "Listening…", "Gemma is reading your handover…",
"Writing {recipient}'s brief…", "Generating voice…". Error toasts show the `error` text.
Style: Inter font, light background, teal accent, red only for safety, rounded cards,
48 px touch targets, works at 390 px width. No landing page.
```

**Second message:** paste both prompts from section 7 verbatim, introduced with
"Use these exact prompt texts in the handover and brief edge functions."

Follow-up prompts to keep ready:

- "The handover function returned prose instead of JSON for this transcript: <paste>. Make the
  parser more forgiving: find the first `{` and the last `}` before parsing."
- "On /brief, show a toast 'Brief ready' and auto-focus the Play button when loading finishes."
- "Add a /board page listing all handovers across teams with the count of safety flags."

---

## 7. Gemma 4 prompts (edge functions)

Gemma via the Gemini API has no structured-output mode, so ask for JSON and parse defensively.

### Extraction (`handover`)

System:

```
You are ShiftBrief, an assistant that turns spoken shift handovers into structured data.
Return ONLY a JSON object, no prose, no code fences. Keep the language of the transcript for
all text fields. Be concrete: keep room numbers, names, ticket numbers, times.
Mark as safety_flags anything that can harm a person or cause damage if forgotten
(fall risk, fasting before surgery, faulty equipment, spills, blocked exits, overheating).
Tasks are actions the next shift must do; give each a short imperative title.
```

User:

```
Author: {name}, {role}, team {team}.
Transcript:
"""
{transcript}
"""
JSON schema:
{"summary": str (1-2 sentences), "source_language": ISO-639-1,
 "tasks": [{"id": "t1".., "title": str, "priority": "high"|"medium"|"low", "due": str|null, "location": str|null}],
 "safety_flags": [{"text": str, "severity": "high"|"medium"}],
 "open_questions": [str], "people_or_assets": [str]}
```

### Brief script (`brief`)

System:

```
You write short spoken shift briefings. Output ONLY a JSON object with keys "script" and
"checklist". "script" is what a text-to-speech voice will read: natural spoken language, no
markdown, no bullet symbols, no headings, about 140-160 words so it takes about one minute.
Write entirely in the recipient's language. Structure: greet the recipient by name and say who
is handing over; one sentence overview; safety flags first, clearly marked as important;
then tasks in priority order with times and locations; close with one friendly sentence.
Keep names, room numbers and ticket numbers unchanged. "checklist" is the list of tasks
translated into the recipient's language, with the same ids.
```

User:

```
Recipient: {recipient.name}, {recipient.role}, language: {recipient.language}.
Handing over: {author.name}, {author.role}.
Handover JSON:
{handover_json}
```

Validation: if `script` is above 220 words, ask Gemma once to shorten it. If the checklist ids
don't match, fall back to untranslated task titles.

---

## 8. Event timeline (14:30–18:45)

| Time | Lovable driver | Prompt & QA | Pitch / data |
|---|---|---|---|
| 14:30–15:00 | Create project with the master prompt, add both secrets, seed personas | Send section 7 prompts as second message | Record the three dictations as MP3 backups, write pitch cards |
| 15:00–16:00 | Get `/record` → transcribe → handover working with dictation 1 | Check extracted JSON for all three dictations, adjust prompt wording | Prepare demo narration |
| 16:00–17:00 | `/incoming` + `/brief` with play, checklist, persistence | Verify Turkish and English briefs read naturally; time the brief | Full run-through Anna → Mehmet, time it |
| 17:00–17:30 | Buffer, mobile width check, loading sentences | Error cases: empty transcript, mic denied | 30-s screen recording as demo backup |
| 17:30 | **Feature freeze** | | |
| 17:30–18:15 | Final visual pass, publish the Lovable app | README in this repo: screenshot, link to Lovable app, architecture | Pitch rehearsed twice, demo path clicked three times |
| 18:15–18:45 | Submission on Organizer HQ, ask mentors about format | | |

---

## 9. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Mic permission or MediaRecorder fails on the demo machine | "Type instead" fallback; prepared dictation text ready to paste. **Seen 30.10.:** Chrome blocked the mic for shiftbrief.lovable.app, result was an empty transcript. Before the demo: open the site, click the mic icon in the address bar, set Microphone to Allow and pick the real device, reload, test one recording. |
| Gemma returns prose instead of JSON | Retry with "Return only valid JSON"; forgiving parser (first `{` to last `}`) |
| Gemini free-tier rate limit | Each demo run is 2 Gemma calls; `brief` results cached in DB; second API key ready |
| ElevenLabs free tier characters (10k/month) | Brief is ≈ 900 characters; cache audio in the browser for the rehearsed demo |
| Edge function timeout (Lovable Cloud limit ~60 s) | Thinking off, temperature 0.3; keep prompts short |
| Lovable credits run out mid-build | Keep prompts batched and specific; avoid "make it nicer" rounds before the MVP works |
| JKU Wi-Fi flaky | Phone hotspot tested before 14:00 |
| Slow TTS (5–10 s) | `speak` is called when the brief page loads, not on Play |

---

## 10. Definition of done for the demo

- [ ] Anna records dictation 1, sees transcript, extracted tasks with one red safety flag, publishes.
- [ ] Switch persona to Mehmet, `/incoming` shows the card, open it, Turkish brief plays in under 10 s total.
- [ ] Tick a checklist item, reload, tick persists.
- [ ] Same flow works for Factory Line 2 (Petra → Ion, English).
- [ ] Lovable app is published; this repo's README links to it, has a screenshot, and names
      Gemma 4, ElevenLabs, Lovable; repo is public under MIT.
