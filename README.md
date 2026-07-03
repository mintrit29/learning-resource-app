# ScholarFlow

ScholarFlow là web app quản lý học liệu thông minh cho sinh viên. App cho phép tải lên PDF, DOCX, PPTX hoặc EPUB, tự trích xuất nội dung, phân tích bằng AI, tạo embedding BGE-M3 local và tìm đúng đoạn liên quan bằng semantic search.

## Roadmap ngắn

- Làm giao diện dễ dùng hơn cho người mới.
- Cải thiện mở/preview file gốc.
- Thêm OCR cho PDF scan/ảnh/tài liệu không copy được chữ.
- Cố định tiến trình xử lý và chạy lại đúng phần lỗi.
- Tối ưu embedding CPU/GPU và cải thiện semantic search.

Không nằm trong roadmap hiện tại: quota/usage provider, admin/storage dashboard, import/export dữ liệu, multi-user/phân quyền/chia sẻ nâng cao.

## Chạy nhanh bằng Docker

Yêu cầu: Docker Desktop.

```powershell
docker compose up --build
```

Mở app tại:

```text
http://localhost:3000
```

Lần đầu chạy có thể lâu vì embedding service cần tải model `BAAI/bge-m3`. Dữ liệu được giữ trong Docker volumes gồm PostgreSQL, uploads và model cache.

Docker web container đã cài Poppler + Tesseract để OCR PDF scan khi file không có text layer. Có thể chỉnh OCR bằng biến môi trường `OCR_LANGS`, `OCR_DPI`, `OCR_MAX_PAGES` hoặc tắt bằng `OCR_ENABLED=0`.

Nếu máy có NVIDIA GPU và đã cài NVIDIA Container Toolkit/WSL2, có thể chạy embedding bằng CUDA:

```powershell
docker compose -f docker-compose.yml -f docker-compose.cuda.yml up --build
```

Lưu ý quan trọng: `docker compose up --build` chỉ chạy cấu hình mặc định CPU. Muốn ưu tiên GPU cho embedding phải luôn chạy kèm file override `docker-compose.cuda.yml` như lệnh trên. CPU chỉ là fallback khi không dùng CUDA hoặc máy không hỗ trợ GPU trong Docker.

## Cách dùng cho user

1. Đăng ký hoặc đăng nhập.
2. Vào `Tải lên` và chọn tài liệu.
3. Chờ hệ thống trích xuất, chunk, embedding và phân tích AI.
4. Vào `Tìm kiếm` để hỏi bằng ngôn ngữ tự nhiên.
5. Bấm kết quả để mở đúng đoạn khớp hoặc đúng trang PDF.

Nếu tài liệu lỗi một bước nào đó, mở chi tiết tài liệu rồi bấm `Xử lý phần còn thiếu`. Nếu chỉ muốn chạy lại metadata AI, bấm `Phân tích AI lại`.

## Chạy kiểu dev

Yêu cầu: Node.js, npm, Python, Docker Desktop.

```powershell
cd learning-resource-app
Copy-Item .env.example .env
npm install
docker compose up -d
npx prisma generate
npx prisma db push
npm run dev
```

Terminal khác:

```powershell
cd embedding-service
Copy-Item .env.example .env
.\setup.ps1 -Device cpu
.\start.ps1 -Device cpu
```

Máy có CUDA thì đổi `cpu` thành `cuda`.

## Kiểm tra

```powershell
cd learning-resource-app
npm run lint
npm run test:unit
npm run build
```

Integration smoke tests cần database, embedding service và provider phù hợp:

```powershell
npm run test:integration
```

## Evaluation tuần 11

```powershell
cd learning-resource-app
npm run eval:template
```

Điền nhãn thủ công trong `learning-resource-app/evaluation/labels.json`, sau đó chạy:

```powershell
npm run eval:week11
```

Kết quả nằm trong `learning-resource-app/evaluation/results`.

## Công nghệ chính

Next.js, TypeScript, Auth.js, PostgreSQL, Prisma, pgvector, FastAPI, BGE-M3, OpenRouter, Ollama và Custom API.

## Tài liệu dự án

- [PRD.md](PRD.md)
- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)
- [PROJECT_CHECKLIST.md](PROJECT_CHECKLIST.md)
- [ERROR_REPORT.md](ERROR_REPORT.md)
