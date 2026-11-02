# Shiftbrief

Build "ShiftBrief", a mobile-first web app for voice shift handovers, with Lovable Cloud (database + edge functions). No authentication; the user picks a persona from a dropdown in the top bar ("I am…"), persisted in localStorage.

DATABASE. Tables with public read/write RLS (hackathon demo):
- personas(id text pk, name, role, team, language). Seed rows: anna / Anna / Nurse, night shift / Ward 3B / de; mehmet / Mehmet / Nurse, day shift / Ward 3B / tr; lisa / Lisa / Receptionist, late shift / Hotel Front Desk / de; james / James / Receptionist, early shift / Hotel Front Desk / en; petra / Petra / Line operator, shift C / Factory Line 2 / de; ion / Ion / Line operator, shift A / Factory Line 2 / ro.
- handovers(id uuid pk, created_at, author_id, team, transcript, summary, source_language, data jsonb, status).
- briefs(id uuid pk, handover_id, recipient_id, language, script, checklist jsonb, created_at).
- task_states(handover_id, task_id text, recipient_id, done bool, done_at; composite pk).

EDGE FUNCTIONS (secrets ELEVENLABS_API_KEY and GEMINI_API_KEY; ask me to add them). All return CORS headers and {error} on failure.
1. transcribe: multipart field `audio` (webm). POST to https://api.elevenlabs.io/v1/speech-to-text with header xi-api-key, multipart `file` and `model_id=scribe_v1`. Return {text, language}.
2. handover: JSON {transcript, author:{name,role,team,language}}. Call https://generativelanguage.googleapis.com/v1beta/models/gemma-4-26b-a4b-it:generateContent with header x-goog-api-key, a system_instruction plus a user prompt (I will give the exact prompt texts in my next message; use a sensible placeholder for now), temperature 0.3. Strip code fences and JSON.parse the reply; retry once with "Return only valid JSON" if parsing fails. Return {summary, source_language, tasks:[{id,title,priority,due,location}], safety_flags:[{text,severity}], open_questions:[], people_or_assets:[]}.
3. brief: JSON {handover, author:{name,role}, recipient:{name,role,language}}. Same Gemini call with a brief-writing prompt (exact text in my next message); return {script, language, checklist:[{id,title}]}.
4. speak: JSON {text}. POST to https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb?output_format=mp3_44100_128 with header xi-api-key and body {text, model_id:"eleven_multilingual_v2"}; return the audio/mpeg bytes.
5. health: returns {elevenlabs: boolean, gemini: boolean} (whether each secret is set, never the values).

PAGES.
- /incoming (default route): cards of handovers where team equals the current persona's team, newest first (author initial avatar, "Anna → Ward 3B", relative time, summary, "N tasks · M safety flags"). Tap opens /brief/:id.
- /brief/:id: load the cached row from briefs for this handover + current persona; if none, call the brief function and store it. Then immediately call speak and keep the mp3 blob ready. Show a big Play button with progress bar, the script text, a language badge, safety flags in red-bordered cards, and a checklist of the translated tasks with checkboxes that persist in task_states. Priority chips: high red, medium amber, low gray. Link "Show original transcript".
- /record: large round microphone button using MediaRecorder (audio/webm), tap to start/stop, timer, 120 s max; link "Type instead". On stop call transcribe and show the text in an editable textarea. Button "Extract tasks" calls handover and shows the summary, a safety flags card on top, and an editable task list (edit title, priority, due, location; delete; add). Button "Publish handover" inserts into handovers and navigates to /incoming with a toast.

Top bar: persona dropdown and a small green/red dot from the health function. Bottom navigation: Incoming, Record.
Loading states show a sentence: "Listening…", "Gemma is reading your handover…", "Writing {recipient}'s brief…", "Generating voice…". Error toasts show the `error` text.
Style: Inter font, light background, teal accent, red only for safety, rounded cards, 48 px touch targets, works at 390 px width. No landing page.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://shiftbrief.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f97d6603-8c20-4c6b-be73-a12490701472).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
