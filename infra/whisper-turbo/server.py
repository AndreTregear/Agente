"""
Whisper Turbo Server — OpenAI-compatible STT endpoint.
Uses faster-whisper with large-v3-turbo model for ~2x faster Spanish transcription.
"""

import io
import os
import time
import tempfile
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import JSONResponse

MODEL = os.environ.get("WHISPER_MODEL", "large-v3-turbo")
DEVICE = os.environ.get("WHISPER_DEVICE", "cuda")
COMPUTE_TYPE = os.environ.get("WHISPER_COMPUTE", "float16")

model = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global model
    from faster_whisper import WhisperModel
    print(f"Loading {MODEL} on {DEVICE} ({COMPUTE_TYPE})...")
    t = time.time()
    model = WhisperModel(MODEL, device=DEVICE, compute_type=COMPUTE_TYPE)
    print(f"Model loaded in {time.time()-t:.1f}s")
    yield

app = FastAPI(lifespan=lifespan)

@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL}

@app.post("/v1/audio/transcriptions")
async def transcribe(
    file: UploadFile = File(...),
    model: str = Form(default=MODEL),
    language: str = Form(default="es"),
    response_format: str = Form(default="json"),
):
    if not globals()["model"]:
        raise HTTPException(503, "Model not loaded")

    # Save uploaded file to temp
    content = await file.read()
    suffix = "." + (file.filename or "audio.webm").split(".")[-1]
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        t = time.time()
        segments, info = globals()["model"].transcribe(
            tmp_path,
            language=language if language != "auto" else None,
            beam_size=5,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500),
        )
        text = " ".join(seg.text.strip() for seg in segments)
        elapsed = time.time() - t
        print(f"Transcribed {info.duration:.1f}s audio in {elapsed*1000:.0f}ms: {text[:80]}")

        return JSONResponse({"text": text})
    finally:
        os.unlink(tmp_path)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
