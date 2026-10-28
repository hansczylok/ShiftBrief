"""Gemma wrapper: Gemini API (default) or local Ollama (offline fallback).

Switch with GEMMA_BACKEND=gemini|ollama in .env.
"""

import base64
import os

import httpx

SYSTEM_PROMPT = os.getenv(
    "SYSTEM_PROMPT",
    "Du bist ein hilfreicher Assistent. Antworte knapp, klar und auf Deutsch.",
)


def _backend() -> str:
    return os.getenv("GEMMA_BACKEND", "gemini").lower()


async def ask(prompt: str, image: bytes | None = None, mime_type: str = "image/jpeg") -> str:
    """Send a text prompt (optionally with one image) to Gemma and return the answer text."""
    if _backend() == "ollama":
        return await _ask_ollama(prompt, image)
    return await _ask_gemini(prompt, image, mime_type)


async def _ask_gemini(prompt: str, image: bytes | None, mime_type: str) -> str:
    from google import genai
    from google.genai import types

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY fehlt in .env")
    client = genai.Client(api_key=api_key)
    # Gemma models on the Gemini API don't accept system_instruction, so the
    # system prompt goes in front of the user prompt instead.
    parts: list = [f"{SYSTEM_PROMPT}\n\n{prompt}"]
    if image:
        parts.append(types.Part.from_bytes(data=image, mime_type=mime_type))

    response = await client.aio.models.generate_content(
        model=os.getenv("GEMMA_MODEL", "gemma-4-27b-it"),
        contents=parts,
    )
    return response.text or ""


async def _ask_ollama(prompt: str, image: bytes | None) -> str:
    message: dict = {"role": "user", "content": prompt}
    if image:
        message["images"] = [base64.b64encode(image).decode()]

    async with httpx.AsyncClient(timeout=120) as client:
        r = await client.post(
            os.getenv("OLLAMA_URL", "http://localhost:11434") + "/api/chat",
            json={
                "model": os.getenv("OLLAMA_MODEL", "gemma3"),
                "messages": [{"role": "system", "content": SYSTEM_PROMPT}, message],
                "stream": False,
            },
        )
        r.raise_for_status()
        return r.json()["message"]["content"]
