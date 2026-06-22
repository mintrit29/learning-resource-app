# ScholarFlow Embedding Service

FastAPI service chạy `BAAI/bge-m3` local để tạo vector 1024 chiều.

## Cài đặt

```powershell
.\setup.ps1
```

## Chạy service

```powershell
$env:EMBEDDING_DEVICE="cpu"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

Lần chạy đầu sẽ tải model BGE-M3 vào `models-cache/` và có thể mất vài phút.

Kiểm tra: `http://127.0.0.1:8001/health`.
