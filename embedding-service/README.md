# ScholarFlow Embedding Service

FastAPI service chạy `BAAI/bge-m3` local để tạo vector 1024 chiều.

## Cài đặt

```powershell
.\setup.ps1 -Device cuda
```

Máy không có NVIDIA CUDA dùng `./setup.ps1 -Device cpu`.

## Chạy service

```powershell
.\start.ps1 -Device cuda
```

Cấu hình fallback CPU: `.\start.ps1 -Device cpu`. Script tự chọn batch 2 cho GPU và batch 4 cho CPU.

Lần chạy đầu sẽ tải model BGE-M3 vào `models-cache/` và có thể mất vài phút.

Kiểm tra: `http://127.0.0.1:8001/health`.
