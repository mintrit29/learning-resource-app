# ScholarFlow

ScholarFlow là app quản lý và hỏi đáp tài liệu học tập. Bạn có thể tải PDF, DOCX, PPTX hoặc EPUB lên app, để hệ thống tự trích xuất nội dung, phân tích bằng AI, tạo embedding local và tìm đúng đoạn liên quan khi cần hỏi lại.

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

## Dùng Ollama với Docker trên Linux/WSL

Nếu app chạy bằng Docker/Podman trong Linux hoặc WSL, nên chạy Ollama trong cùng môi trường Linux/WSL đó:

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

App sẽ tự thử `localhost` và `host.docker.internal`. Nếu Docker chạy trong Linux/WSL nhưng Ollama chạy bên Windows, cách kết nối sẽ rắc rối hơn vì phải dùng IP Windows và mở firewall; người mới nên chạy Ollama cùng Linux/WSL cho dễ.

## Cách dùng

1. Mở app và đăng ký/đăng nhập.
2. Vào `Thêm tài liệu` để tải file lên.
3. Chờ app trích xuất nội dung, chia chunk, tạo embedding và phân tích AI.
4. Vào `Hỏi tài liệu` để hỏi bằng ngôn ngữ tự nhiên.
5. Bấm kết quả để mở đúng đoạn hoặc đúng trang trong file gốc.

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
