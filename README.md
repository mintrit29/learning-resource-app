# ScholarFlow

> Bản hiện hành (22/07/2026): ScholarFlow tập trung vào tự động phân loại và tìm nguồn tham khảo phù hợp. Các ghi chú lịch sử về hỏi–đáp/AI Answer trong tài liệu cũ không còn áp dụng cho luồng tìm kiếm hiện tại.

ScholarFlow là app quản lý và tìm nguồn tham khảo từ tài liệu học tập. Bạn có thể tải PDF, DOCX, PPTX hoặc EPUB lên app để hệ thống tự trích xuất nội dung, dùng AI phân loại chủ đề/độ khó, tạo embedding local, rồi tìm đúng tài liệu và đoạn liên quan cho nhu cầu Research Project.

## Cần cài trước

- Docker Desktop
- Nếu muốn chạy GPU: máy cần NVIDIA GPU và Docker đã hỗ trợ GPU/WSL2

## Mở app

Cách dễ nhất trên Windows là double-click file ở thư mục này:

- `start-cpu.bat`: chạy app bình thường, dùng được cho hầu hết máy.
- `start-gpu.bat`: chạy app với GPU/CUDA để embedding nhanh hơn.
- `stop.bat`: tắt app.

Sau khi mở thành công, vào:

```text
http://localhost:3000
```

Nếu muốn tự gõ lệnh:

```powershell
docker compose up --build -d web
```

Nếu dùng Podman/Arch Linux thay cho Docker Desktop, nên chạy toàn bộ service:

```powershell
docker compose up --build -d
```

Không nên chỉ chạy riêng `web` trên Podman, vì Podman Compose có thể không tự tạo đủ service phụ thuộc như `postgres` và `embedding`.

Chạy bằng GPU:

```powershell
docker compose -f docker-compose.yml -f docker-compose.cuda.yml up --build -d web
```

Tắt app:

```powershell
docker compose down
```

Lần đầu chạy có thể lâu vì app cần tải model embedding `BAAI/bge-m3`.

## Dùng Ollama với Docker

Nếu app chạy bằng Docker Desktop trên Windows và Ollama cũng chạy trên Windows, mở Ollama bằng PowerShell:

```powershell
$env:OLLAMA_HOST="0.0.0.0:11434"
ollama serve
```

Trong app chọn `Ollama` và dùng Base URL:

```text
http://host.docker.internal:11434
```

Nếu app chạy bằng Docker/Podman trong Linux hoặc WSL, cách ổn định nhất là chạy Ollama trong cùng môi trường Linux/WSL đó:

```bash
OLLAMA_HOST=0.0.0.0:11434 ollama serve
```

Kiểm tra Ollama từ Linux/WSL:

```bash
curl http://localhost:11434
```

Nếu thấy `Ollama is running`, vào app chọn `Ollama` và để Base URL:

```text
http://localhost:11434
```

Nếu bắt buộc chạy Ollama bên Windows nhưng app/container chạy trong WSL/Podman, đây là setup nâng cao vì `localhost` của container không phải Windows. Trong WSL lấy IP gateway:

```bash
ip route | grep default
```

Lấy IP sau chữ `via`, ví dụ `172.x.x.1`, rồi thử:

```bash
curl http://172.x.x.1:11434
```

Nếu Windows chặn kết nối, mở PowerShell bằng quyền admin và cho phép port Ollama:

```powershell
New-NetFirewallRule -DisplayName "Ollama 11434 for WSL" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 11434
```

Khi `curl` từ WSL trả về `Ollama is running`, nhập Base URL trong app theo IP đó, ví dụ:

```text
http://172.x.x.1:11434
```

## Cách dùng

1. Mở app và đăng ký/đăng nhập.
2. Vào `Thêm tài liệu` để tải file lên.
3. Chờ app trích xuất nội dung, chia chunk, tạo embedding và phân tích AI.
4. Vào `Tìm tài liệu`, mô tả nhu cầu bằng ngôn ngữ tự nhiên và chọn bộ lọc nếu cần.
5. Xem chủ đề, độ khó, đoạn khớp và lý do phù hợp trước khi mở đúng đoạn hoặc trang trong file gốc.

> Lưu ý: tìm kiếm không gọi AI chat. Vector của câu truy vấn kết hợp với keyword để tìm và xếp hạng tài liệu; AI chỉ được dùng ở bước upload/phân tích tài liệu.

Nếu tài liệu bị lỗi hoặc thiếu bước xử lý, mở chi tiết tài liệu rồi bấm `Xử lý phần còn thiếu`. Nếu chỉ muốn chạy lại phần AI, bấm `Phân tích AI lại`.

## Ghi chú nhanh

- Embedding dùng BGE-M3 local.
- CPU là chế độ mặc định.
- GPU chỉ dùng khi chạy bằng `start-gpu.bat` hoặc lệnh GPU ở trên.
- Image CPU nhẹ hơn; image GPU sẽ nặng hơn vì cần thêm thư viện CUDA.
- App có OCR cho PDF scan/tài liệu không copy được chữ.
- Dữ liệu được lưu trong Docker volumes gồm database, uploads và cache model.

## Kiểm tra code khi cần

```powershell
cd learning-resource-app
npm run lint
npm run build
```

## Công nghệ chính

Next.js, TypeScript, Auth.js, PostgreSQL, Prisma, pgvector, FastAPI, BGE-M3, OpenRouter, Ollama và Custom API.

## Tài liệu dự án

- [PRD.md](PRD.md)
- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)
- [PROJECT_CHECKLIST.md](PROJECT_CHECKLIST.md)
- [ERROR_REPORT.md](ERROR_REPORT.md)
