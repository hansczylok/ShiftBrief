# ShiftBrief – Voice Shift Handover

**Live app:** https://shiftbrief.lovable.app

A worker ending a shift dictates the handover. The next worker hears a 60-second personalized
audio brief in their own language and gets a tappable checklist. Works for hospital wards,
hotel front desks, factory lines and on-call rotations.

Built in one afternoon at the **Hacktoberfest Hack Day Linz × Young AI Leaders Linz**
(30 October 2026, JKU Linz).

## How it works

1. **Dictate.** The outgoing worker taps the mic and speaks for 20 to 60 seconds.
2. **Transcribe.** ElevenLabs Scribe turns the recording into text.
3. **Understand.** Gemma 4 extracts tasks with priority, time and location, flags anything
   safety-relevant (fall risk, fasting patient, faulty machine, blocked exit), and writes a summary.
   The worker reviews and edits the list, then publishes it to their team.
4. **Brief.** When the incoming worker opens the handover, Gemma 4 writes a spoken script in that
   worker's language, personalized with both names and roles. ElevenLabs reads it aloud. The
   translated checklist persists ticks per person.

German in, Turkish or English out, with room numbers, names and ticket numbers kept intact.

## Stack

| Part | Technology |
|---|---|
| App, database, server routes | [Lovable](https://lovable.dev) with Lovable Cloud (Postgres + server functions) |
| Speech-to-text | ElevenLabs Scribe (`scribe_v1`) |
| Text-to-speech | ElevenLabs Multilingual v2 |
| Reasoning, extraction, translation | **Gemma 4** (`gemma-4-26b-a4b-it`, open weights) via the Gemini API |

Gemma 4 is the core of the product: every task, safety flag, translation and spoken script comes
from it. Because the weights are open, the same prompts can run on-prem. This repository contains
a reference Python backend that calls Gemma 4 either through the Gemini API or through a
self-hosted Vertex AI endpoint, with a single environment switch.

## What is in this repository

| Path | Purpose |
|---|---|
| `SPEC.md` | Full product specification: scope, personas, demo data, architecture, API contracts, Lovable prompt, Gemma prompts, risks |
| `app/` | Reference FastAPI backend: `/analyze` (Gemma 4, text + image), `/speak` (ElevenLabs TTS), Vertex AI switch |
| `Dockerfile`, `docker-compose.yml` | Run the reference backend in a container |

The production app itself lives in the Lovable project and is deployed at the link above.

## Team

- **Hans Czylok** – [@hansczylok](https://github.com/hansczylok)
- **Rohit Kadam**
- **Peter Paul Kirschner** – [@petkir](https://github.com/petkir)
- **Syed Alhaam Faridi**

## Running the reference backend

```bash
python -m venv .venv
.venv\Scripts\activate            # Windows (PowerShell: .venv\Scripts\Activate.ps1)
pip install -r requirements.txt
copy .env.example .env            # then fill in the keys
uvicorn app.main:app --reload
```

Test page: http://localhost:8000 · API docs: http://localhost:8000/docs

With Docker: `docker compose up --build`

### Choosing where Gemma 4 runs

`GEMMA_BACKEND` in `.env` selects the backend:

| Value | Where | Needs |
|---|---|---|
| `gemini` (default) | Gemini API | `GEMMA_API_KEY`, `GEMMA_MODEL` |
| `vertex` | your own Vertex AI endpoint (Model Garden, vLLM) | `VERTEX_ENDPOINT_URL`, `gcloud auth application-default login` |

The endpoint URL is built from `gcloud ai endpoints list --region=<REGION> --format="table(name.basename(),dedicatedEndpointDns)"`
and your project number (format in `.env.example`). A Vertex endpoint costs money while a model is
deployed; undeploy after the demo with `gcloud ai endpoints undeploy-model …`. `GEMMA_THINKING`
applies to `gemini` only. Inside Docker there is no gcloud login, so `vertex` needs a service-account
key via `GOOGLE_APPLICATION_CREDENTIALS`.

### Endpoints

| Method | Path | Input | Output |
|---|---|---|---|
| GET | `/health` | – | which keys are set |
| POST | `/analyze` | multipart: `prompt` (text), `image` (optional) | `{"answer": "..."}` |
| POST | `/speak` | JSON: `{"text": "..."}` | `audio/mpeg` |

## License

MIT
