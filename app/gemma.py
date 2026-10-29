"""Gemma 4 wrapper (cloud only): Gemini API or a self-hosted Vertex AI endpoint.

GEMMA_BACKEND=gemini (default) uses the Gemini API with GEMINI_API_KEY.
GEMMA_BACKEND=vertex uses a Model Garden endpoint (vLLM) at VERTEX_ENDPOINT_URL,
authenticated via Application Default Credentials (gcloud auth application-default login).
"""

import asyncio
import base64
import os

import httpx

SYSTEM_PROMPT = os.getenv(
    "SYSTEM_PROMPT",
    "You are a helpful assistant. Respond concisely, clearly, and in English.",
)


def backend() -> str:
    return os.getenv("GEMMA_BACKEND", "gemini").lower()


async def ask(prompt: str, image: bytes | None = None, mime_type: str = "image/jpeg") -> str:
    """Send a text prompt (optionally with one image) to Gemma and return the answer text."""
    if backend() == "vertex":
        return await _ask_vertex(prompt, image, mime_type)
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


_credentials = None


def _vertex_token() -> str:
    """Return a valid OAuth token from ADC, refreshing it when expired (~1 h lifetime)."""
    global _credentials
    import google.auth
    from google.auth.transport.requests import Request

    if _credentials is None:
        _credentials, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
    if not _credentials.valid:
        _credentials.refresh(Request())
    return _credentials.token


async def _ask_vertex(prompt: str, image: bytes | None, mime_type: str) -> str:
    url = os.getenv("VERTEX_ENDPOINT_URL")
    if not url:
        raise RuntimeError("VERTEX_ENDPOINT_URL fehlt in .env")

    content: list = [{"type": "text", "text": prompt}]
    if image:
        data_uri = f"data:{mime_type};base64,{base64.b64encode(image).decode()}"
        content.append({"type": "image_url", "image_url": {"url": data_uri}})

    # Model Garden vLLM containers take OpenAI-style chat requests wrapped in "instances".
    body = {
        "instances": [
            {
                "@requestFormat": "chatCompletions",
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": content},
                ],
                "max_tokens": int(os.getenv("VERTEX_MAX_TOKENS", "1024")),
            }
        ]
    }
    token = await asyncio.to_thread(_vertex_token)
    async with httpx.AsyncClient(timeout=120) as client:
        try:
            r = await client.post(url, json=body, headers={"Authorization": f"Bearer {token}"})
        except httpx.ConnectError:
            # The dedicated DNS name only exists while a model is deployed.
            raise RuntimeError("Vertex-Endpoint nicht erreichbar: Modell deployt und URL aktuell?")
    if r.status_code in (404, 502, 503):
        raise RuntimeError(f"Vertex AI {r.status_code}: kein Modell auf dem Endpoint deployt?")
    if r.status_code != 200:
        raise RuntimeError(f"Vertex AI {r.status_code}: {r.text[:500]}")
    return r.json()["predictions"]["choices"][0]["message"]["content"] or ""
