# ScholarFlow — Hệ thống quản lý học liệu thông minh

ScholarFlow là đồ án cuối khóa về quản lý, phân loại và tìm kiếm học liệu bằng NLP, LLM và semantic search. Hệ thống cho phép sinh viên tải lên tài liệu học tập, tự động trích xuất nội dung, chia nhỏ văn bản, tạo vector embedding và tìm lại đúng đoạn liên quan bằng truy vấn ngôn ngữ tự nhiên.

## Tính năng chính

- Đăng ký, đăng nhập và quản lý dữ liệu theo người dùng.
- Tải lên tài liệu PDF, DOCX, PPTX và EPUB.
- Trích xuất nội dung kèm vị trí nguồn: trang, slide, chương hoặc heading.
- Chia nội dung thành chunks và tạo embedding 1024 chiều bằng `BAAI/bge-m3`.
- Lưu trữ và tìm kiếm vector với PostgreSQL và pgvector.
- Semantic search hiển thị đoạn khớp và điều hướng về đúng vị trí trong tài liệu.
- Quản lý cấu hình AI provider; pipeline phân tích LLM và recommendation đang được phát triển.

## Công nghệ

- Web app: Next.js 16, React 19, TypeScript, Tailwind CSS
- Authentication: Auth.js
- Database: PostgreSQL, Prisma ORM, pgvector
- Embedding service: Python, FastAPI, Sentence Transformers, BGE-M3
- Hạ tầng phát triển: Docker Compose

## Cấu trúc repository

```text
.
├── learning-resource-app/   # Ứng dụng Next.js, API và Prisma
├── embedding-service/       # Dịch vụ embedding BGE-M3 bằng FastAPI
├── PRD.md                   # Yêu cầu sản phẩm
├── IMPLEMENTATION_PLAN.md   # Kế hoạch triển khai
├── PROJECT_CHECKLIST.md     # Checklist tiến độ
└── ERROR_REPORT.md          # Lỗi và rủi ro đã ghi nhận
```

## Chạy dự án

### 1. Web app và database

```powershell
cd learning-resource-app
Copy-Item .env.example .env
npm install
docker compose up -d
npx prisma generate
npm run dev
```

Ứng dụng chạy tại [http://localhost:3000](http://localhost:3000).

### 2. Embedding service

Mở một terminal khác tại thư mục gốc:

```powershell
cd embedding-service
Copy-Item .env.example .env
.\setup.ps1
$env:EMBEDDING_DEVICE="cpu"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

Kiểm tra service tại [http://127.0.0.1:8001/health](http://127.0.0.1:8001/health). Lần chạy đầu tiên có thể mất vài phút để tải model.

## Kiểm tra chất lượng

```powershell
cd learning-resource-app
npm run lint
npm run test:extractors
npm run test:chunking
npm run build
```

## Trạng thái

Pipeline upload, extraction, chunking, BGE-M3, pgvector và semantic search đã hoạt động end-to-end. Tiến độ chi tiết và các hạng mục tiếp theo được cập nhật trong [PROJECT_CHECKLIST.md](PROJECT_CHECKLIST.md).

## Phạm vi đồ án

MVP tập trung vào Vector RAG cho học liệu ngành Computer Science/IT. Knowledge Graph, GraphRAG, OCR và cộng tác thời gian thực được để dành cho hướng phát triển sau MVP.

