"""Gemma wrapper: Gemini API (default) or local Ollama (offline fallback).

Switch with GEMMA_BACKEND=gemini|ollama in .env.
"""

import base64
import os

import httpx

SYSTEM_PROMPT = os.getenv(
    "SYSTEM_PROMPT",
    "You are a helpful assistant. Respond concisely, clearly, and in English.",
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
    parts: list = [prompt]
    if image:
        parts.append(types.Part.from_bytes(data=image, mime_type=mime_type))

    # Gemma 4 only knows thinking on/off: "high" = on, "minimal" = off.
    thinking = os.getenv("GEMMA_THINKING", "false").lower() == "true"
    response = await client.aio.models.generate_content(
        model=os.getenv("GEMMA_MODEL", "gemma-4-26b-a4b-it"),
        contents=parts,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            thinking_config=types.ThinkingConfig(thinking_level="high" if thinking else "minimal"),
        ),
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
