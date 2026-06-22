import argparse
import ctypes
import json
import os
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

class ProcessMemoryCounters(ctypes.Structure):
    _fields_ = [
        ("cb", ctypes.c_ulong),
        ("PageFaultCount", ctypes.c_ulong),
        ("PeakWorkingSetSize", ctypes.c_size_t),
        ("WorkingSetSize", ctypes.c_size_t),
        ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
        ("QuotaPagedPoolUsage", ctypes.c_size_t),
        ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
        ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
        ("PagefileUsage", ctypes.c_size_t),
        ("PeakPagefileUsage", ctypes.c_size_t),
    ]


def working_set_bytes() -> int:
    counters = ProcessMemoryCounters()
    counters.cb = ctypes.sizeof(counters)
    get_current_process = ctypes.windll.kernel32.GetCurrentProcess
    get_current_process.restype = ctypes.c_void_p
    handle = get_current_process()
    get_process_memory_info = ctypes.windll.psapi.GetProcessMemoryInfo
    get_process_memory_info.argtypes = [
        ctypes.c_void_p,
        ctypes.POINTER(ProcessMemoryCounters),
        ctypes.c_ulong,
    ]
    if not get_process_memory_info(
        handle, ctypes.byref(counters), counters.cb
    ):
        raise ctypes.WinError()
    return int(counters.WorkingSetSize)


def build_corpus(source: Path, chunk_words: int, sample_count: int) -> list[str]:
    words = source.read_text(encoding="utf-8").split()
    chunks = [
        " ".join(words[offset : offset + chunk_words])
        for offset in range(0, len(words), chunk_words)
        if words[offset : offset + chunk_words]
    ]
    if not chunks:
        raise ValueError("Source file does not contain benchmark text")
    return [chunks[index % len(chunks)] for index in range(sample_count)]


def main() -> None:
    parser = argparse.ArgumentParser(description="Benchmark BGE-M3 on CPU")
    parser.add_argument("--batch-size", type=int, required=True, choices=(2, 4, 8))
    parser.add_argument("--samples", type=int, default=525)
    parser.add_argument("--chunk-words", type=int, default=400)
    parser.add_argument("--source", type=Path, default=Path("../PRD.md"))
    parser.add_argument("--output-dir", type=Path, default=Path("benchmark-results"))
    args = parser.parse_args()

    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
    from sentence_transformers import SentenceTransformer

    corpus = build_corpus(args.source, args.chunk_words, args.samples)
    model_name = os.getenv("EMBEDDING_MODEL", "BAAI/bge-m3")
    model = SentenceTransformer(model_name, device="cpu")

    # Warm up lazy model paths before measuring the corpus.
    model.encode(corpus[:1], batch_size=1, normalize_embeddings=True, show_progress_bar=False)

    peak_ram = working_set_bytes()
    monitoring = True

    def monitor_memory() -> None:
        nonlocal peak_ram
        while monitoring:
            peak_ram = max(peak_ram, working_set_bytes())
            time.sleep(0.1)

    monitor = threading.Thread(target=monitor_memory, daemon=True)
    monitor.start()
    started_at = time.perf_counter()
    vectors = model.encode(
        corpus,
        batch_size=args.batch_size,
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=True,
    )
    elapsed_seconds = time.perf_counter() - started_at
    monitoring = False
    monitor.join()

    result = {
        "recordedAt": datetime.now(timezone.utc).isoformat(),
        "model": model_name,
        "device": "cpu",
        "batchSize": args.batch_size,
        "sampleCount": len(corpus),
        "chunkWords": args.chunk_words,
        "dimensions": int(vectors.shape[1]),
        "elapsedSeconds": round(elapsed_seconds, 3),
        "chunksPerSecond": round(len(corpus) / elapsed_seconds, 4),
        "peakRamMiB": round(peak_ram / 1024 / 1024, 2),
        "source": str(args.source),
    }
    args.output_dir.mkdir(parents=True, exist_ok=True)
    output = args.output_dir / f"cpu-batch-{args.batch_size}.json"
    output.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))
    print(f"Saved to {output}")


if __name__ == "__main__":
    main()
