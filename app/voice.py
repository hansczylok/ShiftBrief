"""ElevenLabs text-to-speech via the official SDK. Returns MP3 bytes.

The SDK reads ELEVENLABS_API_KEY from the environment (loaded from .env in main.py).
"""

import os

from elevenlabs.client import AsyncElevenLabs


async def speak(text: str) -> bytes:
    if not os.getenv("ELEVENLABS_API_KEY"):
        raise RuntimeError("ELEVENLABS_API_KEY fehlt in .env")
    client = AsyncElevenLabs()
    audio = client.text_to_speech.convert(
        voice_id=os.getenv("ELEVENLABS_VOICE_ID", "JBFqnCBsd6RMkjVDRZzb"),
        text=text,
        model_id=os.getenv("ELEVENLABS_MODEL", "eleven_multilingual_v2"),
        output_format="mp3_44100_128",
    )
    return b"".join([chunk async for chunk in audio])
