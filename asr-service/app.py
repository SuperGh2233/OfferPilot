"""Small, stateless FunASR HTTP service for OfferPilot.

The service accepts the 16 kHz mono PCM WAV emitted by the browser. Audio is
decoded into memory and passed to FunASR; it is never written to disk or logged.
"""

from __future__ import annotations

import hmac
import io
import logging
import os
import wave
from contextlib import asynccontextmanager
from typing import Any

import numpy as np
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

logger = logging.getLogger("offerpilot.asr")
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

MODEL_NAME = os.getenv("FUNASR_MODEL", "paraformer-zh-streaming")
MAX_AUDIO_BYTES = int(os.getenv("FUNASR_MAX_AUDIO_BYTES", str(2 * 1024 * 1024)))
SHARED_TOKEN = os.getenv("FUNASR_SHARED_TOKEN", "").strip()
ALLOW_ANONYMOUS = os.getenv("FUNASR_ALLOW_ANONYMOUS", "false").strip().lower() == "true"


class ModelState:
    model: Any | None = None
    error: str | None = None


state = ModelState()


def load_model() -> Any:
    # Importing FunASR is intentionally delayed until service startup so a
    # health check can still report a clean 503 while a model is unavailable.
    from funasr import AutoModel

    return AutoModel(model=MODEL_NAME, disable_update=True)


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        state.model = await run_in_threadpool(load_model)
        state.error = None
        logger.info("FunASR model ready: %s", MODEL_NAME)
    except Exception as error:  # pragma: no cover - exercised in deployment
        state.model = None
        state.error = type(error).__name__
        logger.exception("FunASR model failed to load")
    yield


app = FastAPI(title="OfferPilot FunASR", version="1", lifespan=lifespan)


def unauthorized() -> JSONResponse:
    return JSONResponse({"error": "unauthorized"}, status_code=401)


def check_token(authorization: str) -> bool:
    # Production is authenticated by default. Anonymous mode is an explicit
    # local-only opt-in, so a missing token never opens the API accidentally.
    if not SHARED_TOKEN:
        return ALLOW_ANONYMOUS
    scheme, _, value = authorization.partition(" ")
    return scheme.lower() == "bearer" and hmac.compare_digest(value, SHARED_TOKEN)


def decode_wav(payload: bytes) -> np.ndarray:
    try:
        with wave.open(io.BytesIO(payload), "rb") as wav:
            if wav.getcomptype() != "NONE":
                raise HTTPException(status_code=415, detail="wav_compression_not_supported")
            if wav.getsampwidth() != 2 or wav.getnchannels() != 1:
                raise HTTPException(status_code=415, detail="wav_must_be_16bit_mono")
            if wav.getframerate() != 16_000:
                raise HTTPException(status_code=415, detail="wav_sample_rate_must_be_16000")
            frames = wav.readframes(wav.getnframes())
    except HTTPException:
        raise
    except (EOFError, wave.Error) as error:
        raise HTTPException(status_code=400, detail="invalid_wav") from error

    samples = np.frombuffer(frames, dtype="<i2")
    if samples.size == 0:
        raise HTTPException(status_code=400, detail="empty_audio")
    return samples.astype(np.float32) / 32768.0


def run_inference(samples: np.ndarray) -> str:
    if state.model is None:
        raise RuntimeError("model_not_ready")
    result = state.model.generate(input=samples, batch_size_s=300)
    if not isinstance(result, list) or not result or not isinstance(result[0], dict):
        raise RuntimeError("invalid_model_response")
    text = result[0].get("text")
    if not isinstance(text, str):
        raise RuntimeError("invalid_model_text")
    return text.strip()


@app.get("/healthz")
async def healthz():
    if state.model is None:
        return JSONResponse({"ok": False, "error": "model_not_ready"}, status_code=503)
    return {"ok": True, "model": MODEL_NAME}


@app.post("/transcribe")
async def transcribe(request: Request, authorization: str = Header(default="")):
    if not check_token(authorization):
        return unauthorized()
    if state.model is None:
        return JSONResponse({"error": "asr_unavailable"}, status_code=503)

    content_type = request.headers.get("content-type", "").split(";", 1)[0].lower()
    if content_type != "audio/wav":
        raise HTTPException(status_code=415, detail="content_type_must_be_audio_wav")
    length = request.headers.get("content-length")
    if length:
        try:
            if int(length) > MAX_AUDIO_BYTES:
                raise HTTPException(status_code=413, detail="audio_too_large")
        except ValueError as error:
            raise HTTPException(status_code=400, detail="invalid_content_length") from error
    chunks: list[bytes] = []
    total = 0
    async for chunk in request.stream():
        total += len(chunk)
        if total > MAX_AUDIO_BYTES:
            raise HTTPException(status_code=413, detail="audio_too_large")
        chunks.append(chunk)
    payload = b"".join(chunks)

    try:
        samples = decode_wav(payload)
        text = await run_in_threadpool(run_inference, samples)
    except HTTPException:
        raise
    except Exception:
        logger.exception("FunASR inference failed")
        return JSONResponse({"error": "asr_unavailable"}, status_code=502)
    return {"text": text, "provider": "funasr"}
