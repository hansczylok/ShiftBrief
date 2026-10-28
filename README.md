# Hack Day Linz – Starter

Starter-Backend für den Hacktoberfest Hack Day Linz × Young AI Leaders Linz (30.10.2026).
**Gemma 4** (open weights) für Text + Bild, **ElevenLabs** für Sprachausgabe, Frontend über **Lovable**.

## Setup

```bash
python -m venv .venv
.venv\Scripts\activate          # Windows (PowerShell: .venv\Scripts\Activate.ps1)
pip install -r requirements.txt
copy .env.example .env          # dann Keys eintragen
uvicorn app.main:app --reload
```

Testseite: http://localhost:8000 · API-Doku: http://localhost:8000/docs

In VS Code: Ordner öffnen, empfohlene Extensions installieren, `F5` → „Backend (uvicorn, Debug)“.

Mit Docker: `docker compose up --build`

## Endpunkte

| Methode | Pfad | Input | Output |
|---|---|---|---|
| GET | `/health` | – | Status, ob Keys gesetzt sind |
| POST | `/analyze` | multipart: `prompt` (Text), `image` (optional) | `{"answer": "..."}` |
| POST | `/speak` | JSON: `{"text": "..."}` | `audio/mpeg` |

## Offline-Fallback

[Ollama](https://ollama.com) installieren, `ollama pull gemma3` (oder ein Gemma-4-Tag, falls verfügbar), dann in `.env` `GEMMA_BACKEND=ollama`.

## Lovable anbinden

Lovable läuft im Browser und kommt nicht an `localhost`. Backend tunneln:

```bash
npx cloudflared tunnel --url http://localhost:8000
```

Die ausgegebene `https://….trycloudflare.com`-URL im Lovable-Prompt als API-Basis angeben, z. B.:

> Baue eine App mit Bild-Upload und Textfeld. Beim Absenden POST multipart (`prompt`, `image`) an `<URL>/analyze`, zeige `answer` an. Button "Vorlesen" schickt `{"text": answer}` per POST an `<URL>/speak` und spielt die MP3-Antwort ab.

## Lizenz

MIT
