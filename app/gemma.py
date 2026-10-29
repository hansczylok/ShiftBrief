"""Gemma 4 wrapper via the Gemini API (cloud only)."""

import os

SYSTEM_PROMPT = os.getenv(
    "SYSTEM_PROMPT",
    "You are a helpful assistant. Respond concisely, clearly, and in English.",
)


async def ask(prompt: str, image: bytes | None = None, mime_type: str = "image/jpeg") -> str:
    """Send a text prompt (optionally with one image) to Gemma and return the answer text."""
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
