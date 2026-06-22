import os
import time
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer


MODEL_NAME = os.getenv("EMBEDDING_MODEL", "BAAI/bge-m3")
DEVICE = os.getenv("EMBEDDING_DEVICE", "cpu")
BATCH_SIZE = int(os.getenv("EMBEDDING_BATCH_SIZE", "4"))
MAX_BATCH_TEXTS = 32
MAX_TEXT_LENGTH = 20_000


class EmbedRequest(BaseModel):
    texts: Annotated[list[str], Field(min_length=1, max_length=MAX_BATCH_TEXTS)]


class EmbedResponse(BaseModel):
    model: str
    dimensions: int
    embeddings: list[list[float]]
    elapsed_ms: float


class ModelState:
    model: SentenceTransformer | None = None
    loaded_at: float | None = None


state = ModelState()


@asynccontextmanager
async def lifespan(_: FastAPI):
    os.environ.setdefault("HF_HOME", os.path.join(os.getcwd(), "models-cache"))
    state.model = SentenceTransformer(MODEL_NAME, device=DEVICE)
    state.loaded_at = time.time()
    yield
    state.model = None


app = FastAPI(
    title="ScholarFlow Embedding Service",
    version="0.1.0",
    lifespan=lifespan,
)


@app.get("/health")
def health():
    return {
        "status": "ready" if state.model is not None else "loading",
        "model": MODEL_NAME,
        "device": DEVICE,
        "batch_size": BATCH_SIZE,
        "dimensions": 1024,
        "loaded_at": state.loaded_at,
    }


@app.post("/embed", response_model=EmbedResponse)
def embed(payload: EmbedRequest):
    if state.model is None:
        raise HTTPException(status_code=503, detail="Embedding model is not ready")

    texts = [text.strip() for text in payload.texts]
    if any(not text for text in texts):
        raise HTTPException(status_code=400, detail="Texts must not be empty")
    if any(len(text) > MAX_TEXT_LENGTH for text in texts):
        raise HTTPException(status_code=413, detail="A text exceeds the 20,000 character limit")

    started_at = time.perf_counter()
    vectors = state.model.encode(
        texts,
        batch_size=BATCH_SIZE,
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=False,
    )
    elapsed_ms = (time.perf_counter() - started_at) * 1000
    embeddings = vectors.astype(float).tolist()

    if any(len(vector) != 1024 for vector in embeddings):
        raise HTTPException(status_code=500, detail="Unexpected embedding dimensions")

    return EmbedResponse(
        model=MODEL_NAME,
        dimensions=1024,
        embeddings=embeddings,
        elapsed_ms=round(elapsed_ms, 2),
    )
