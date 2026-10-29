"""FastAPI backend: /analyze (Gemma) and /speak (ElevenLabs).

Run: uvicorn app.main:app --reload
"""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, File, Form, HTTPException, UploadFile  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.responses import FileResponse, Response  # noqa: E402
from pydantic import BaseModel  # noqa: E402

from app import gemma, voice  # noqa: E402

app = FastAPI(title="Hack Day Linz")

# Wide open on purpose so the Lovable frontend (any origin) can call us.
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
async def health():
    return {
        "ok": True,
        "gemma_backend": gemma.backend(),
        "gemma_model": os.getenv("GEMMA_MODEL", "gemma-4-26b-a4b-it"),
        "gemini_key": bool(os.getenv("GEMINI_API_KEY")),
        "vertex_endpoint": bool(os.getenv("VERTEX_ENDPOINT_URL")),
        "elevenlabs_key": bool(os.getenv("ELEVENLABS_API_KEY")),
    }


@app.post("/analyze")
async def analyze(prompt: str = Form(...), image: UploadFile | None = File(None)):
    """Text prompt plus optional image -> Gemma answer."""
    data = await image.read() if image else None
    try:
        answer = await gemma.ask(prompt, data, image.content_type if image else "image/jpeg")
    except Exception as e:
        raise HTTPException(502, f"Gemma-Fehler: {e}")
    return {"answer": answer}


class SpeakRequest(BaseModel):
    text: str


@app.post("/speak")
async def speak(req: SpeakRequest):
    """Text -> MP3 via ElevenLabs."""
    try:
        audio = await voice.speak(req.text)
    except Exception as e:
        raise HTTPException(502, f"ElevenLabs-Fehler: {e}")
    return Response(audio, media_type="audio/mpeg")


@app.get("/")
async def index():
    # Minimal test page, so the backend can be tried without Lovable.
    return FileResponse(Path(__file__).parent / "static" / "index.html")
