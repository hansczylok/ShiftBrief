"""ElevenLabs text-to-speech wrapper. Returns MP3 bytes."""

import os

import httpx


async def speak(text: str) -> bytes:
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        raise RuntimeError("ELEVENLABS_API_KEY fehlt in .env")
    voice_id = os.getenv("ELEVENLABS_VOICE_ID", "JBFqnCBsd6RMkjVDRZzb")
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
            headers={"xi-api-key": api_key},
            json={
                "text": text,
                "model_id": os.getenv("ELEVENLABS_MODEL", "eleven_multilingual_v2"),
            },
        )
        r.raise_for_status()
        return r.content
