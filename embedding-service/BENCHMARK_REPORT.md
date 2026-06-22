# BGE-M3 Benchmark

Ngày đo: 22/06/2026  
Model: `BAAI/bge-m3`  
Vector: 1024 chiều

## Phương pháp

- Thiết bị: CPU.
- Corpus cố định gồm 525 chunks, mỗi chunk 400 từ, tạo tuần tự từ `PRD.md`.
- Warm-up một mẫu trước khi tính thời gian.
- Thời gian chỉ tính giai đoạn `model.encode`, không gồm tải model.
- Peak RAM là working set lớn nhất của tiến trình Python, lấy mẫu mỗi 100 ms.
- Script tái lập: `benchmark.py`.

## Kết quả

| Batch size | Số chunks | Thời gian | Tốc độ | Peak RAM | VRAM |
|---:|---:|---:|---:|---:|---:|
| 2 | 525 | 863,022 giây | 0,6083 chunk/giây | 1.995,20 MiB | Không dùng |
| 4 | 341 | 615 giây | 0,5545 chunk/giây | Không ghi nhận ở lượt đo cũ | Không dùng |
| 8 | 525 | 840,724 giây | 0,6245 chunk/giây | 2.322,71 MiB | Không dùng |

Batch 8 nhanh hơn batch 2 khoảng 2,6% nhưng dùng thêm khoảng 327,5 MiB RAM. Kết quả batch 4 là số liệu lịch sử trên corpus tài liệu thực, vì vậy không dùng để so sánh trực tiếp với batch 2 và 8.

## GPU

Máy có NVIDIA Quadro T2000 4 GiB, nhưng môi trường PyTorch hiện tại là bản CPU-only (`torch.cuda.is_available() = false`, `torch.version.cuda = None`). Benchmark GPU chưa thể chạy nếu chưa thay PyTorch bằng CUDA build; VRAM 4 GiB cũng cần kiểm tra nguy cơ thiếu bộ nhớ với BGE-M3.

