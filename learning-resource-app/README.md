# ScholarFlow

Web app quản lý, phân loại và tìm kiếm học liệu theo ngữ nghĩa dành cho sinh viên thực hiện Research Project.

## Tech Stack

- Next.js 16, React 19, TypeScript
- PostgreSQL 16 + pgvector
- Prisma 7
- Auth.js 5
- Tailwind CSS 4

## Chạy Local

Yêu cầu: Node.js, npm và Docker Desktop.

```bash
npm install --ignore-scripts
docker compose up -d
npx prisma generate
npx prisma db push
npm run db:vector-index
npm run dev
```

Mở `http://localhost:3000`.

Nếu không bị ảnh hưởng bởi cấu hình npm `allow-scripts` trên máy, có thể dùng `npm install` bình thường thay cho `npm install --ignore-scripts`.

## Biến Môi Trường

Sao chép `.env.example` thành `.env` và thay đổi:

- `DATABASE_URL`: PostgreSQL connection string.
- `AUTH_SECRET`: secret ngẫu nhiên, bắt buộc thay trước khi deploy.

## Trạng Thái Hiện Tại

Đã hoàn thành nền móng:

- PostgreSQL/pgvector chạy bằng Docker.
- Prisma schema cho User, Document, DocumentChunk, Project và AI Provider.
- Đăng ký, đăng nhập và đăng xuất bằng Auth.js credentials.
- Dashboard responsive và các route nền tảng.
- Upload và trích xuất text từ PDF, PPTX, DOCX và EPUB.
- Danh sách tài liệu, trạng thái xử lý và trang xem text đã trích xuất.
- Background jobs cho extraction/chunking, có progress tự cập nhật.
- Chunking khoảng 300-500 token ước tính, có overlap và lưu vào DocumentChunk.
- BGE-M3 local tạo vector 1024 chiều và semantic search bằng pgvector HNSW.
- Search result hiển thị trang/slide/chương/heading, mở đúng matched chunk và đúng trang PDF.

AI analysis và provider settings sẽ được triển khai theo `PROJECT_CHECKLIST.md` ở thư mục gốc.

## Benchmark BGE-M3 Hiện Tại

- Thiết bị: CPU Intel Core i7-10850H.
- Model: `BAAI/bge-m3`, batch size 4.
- 341 chunks: khoảng 615 giây, tương đương 0,55 chunk/giây.
- Truy vấn thử nghiệm gồm 2 câu ngắn: khoảng 610 ms.
