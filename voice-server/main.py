"""Local, in-memory speech recognition endpoint for NEXA Web."""
from __future__ import annotations

import io
import os
from functools import lru_cache

import av
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from faster_whisper import WhisperModel

app = FastAPI(title="NEXA local voice service")


@lru_cache(maxsize=1)
def model() -> WhisperModel:
    return WhisperModel(
        os.getenv("WHISPER_MODEL", "base"),
        device=os.getenv("WHISPER_DEVICE", "cpu"),
        compute_type=os.getenv("WHISPER_COMPUTE_TYPE", "int8"),
        download_root=os.getenv("WHISPER_MODEL_DIR", "models"),
    )


@app.get("/health")
def health() -> dict[str, object]:
    return {"status": "ok", "stt": True, "tts": False, "model": os.getenv("WHISPER_MODEL", "base")}


@app.post("/stt")
async def transcribe(audio: UploadFile = File(...), language: str = Form("pt")) -> dict[str, str]:
    raw = await audio.read()
    if not raw:
        raise HTTPException(400, "Áudio vazio.")
    try:
        container = av.open(io.BytesIO(raw))
        resampler = av.AudioResampler(format="fltp", layout="mono", rate=16000)
        frames = []
        for frame in container.decode(audio=0):
            frames.extend(resampler.resample(frame))
        samples = np.concatenate([frame.to_ndarray().reshape(-1) for frame in frames]).astype(np.float32)
        segments, _ = model().transcribe(samples, language=language, vad_filter=True, beam_size=1)
        return {"text": " ".join(segment.text.strip() for segment in segments).strip()}
    except Exception as error:
        raise HTTPException(422, f"Não foi possível transcrever o áudio: {error}") from error
    finally:
        await audio.close()
