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
| 2 (GPU) | 525 | 490,629 giây | 1,0701 chunk/giây | 1.450,86 MiB | 2.268 MiB reserved |

Batch 8 nhanh hơn CPU batch 2 khoảng 2,6% nhưng dùng thêm khoảng 327,5 MiB RAM. GPU batch 2 nhanh hơn CPU batch 2 khoảng 43,1% (tốc độ gấp 1,76 lần) và nằm trong giới hạn VRAM 4 GiB. Kết quả batch 4 là số liệu lịch sử trên corpus tài liệu thực, vì vậy không dùng để so sánh trực tiếp với các lượt đo trên corpus PRD.

## GPU

Máy có NVIDIA Quadro T2000 4 GiB. Benchmark dùng PyTorch `2.12.1+cu130` trong thư mục thử nghiệm riêng để không thay đổi môi trường CPU hiện tại. GPU batch 2 đạt peak VRAM allocated 2.235,61 MiB và reserved 2.268 MiB, còn đủ biên an toàn.

Quyết định cho máy phát triển: ưu tiên GPU với batch size 2; giữ CPU batch size 4 làm fallback cho máy không có CUDA.
