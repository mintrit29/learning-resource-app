# Báo Cáo Lỗi Và Rủi Ro

**Ngày kiểm tra:** 22/06/2026  
**Trạng thái tổng thể:** Ứng dụng hoạt động; lint, tests và production build đều pass.

## 1. Dependency Vulnerabilities

**Mức độ:** Trung bình  
**Số lượng:** 5 moderate, 0 high, 0 critical

Các package bị ảnh hưởng:

- `next` kéo theo `postcss < 8.5.10`: advisory XSS trong CSS stringify output.
- `prisma` kéo theo `@prisma/dev` và `@hono/node-server`: advisory middleware bypass trong `serveStatic`.

Ảnh hưởng hiện tại:

- Ứng dụng không dùng PostCSS để stringify CSS do người dùng nhập.
- `@prisma/dev` chủ yếu thuộc Prisma CLI/tooling, không phải API phục vụ người dùng.
- Chưa phát hiện khai thác hoặc lỗi runtime trong dự án.

Không chạy `npm audit fix --force` vì npm đề xuất downgrade Next/Prisma sang major version cũ, có thể phá vỡ code hiện tại.

Hướng xử lý:

- Theo dõi bản vá chính thức của Next.js, PostCSS và Prisma.
- Nâng dependency khi có phiên bản tương thích, sau đó chạy lại lint, tests và build.
- Kiểm tra lại bằng `npm audit --omit=dev` trước khi deploy/bảo vệ đồ án.

## 2. Background Job Chưa Bền Vững Khi Service Tắt

**Mức độ:** Thấp trong môi trường demo, cần xử lý trước production

- Extraction/embedding đang chạy bằng background callback trong Next.js.
- Nếu Docker, Next.js hoặc embedding service tắt giữa chừng, job có thể dừng ở `PROCESSING`.
- Đã có script resume embeddings, nhưng chưa có worker tự động khôi phục mọi loại job.

Hướng xử lý:

- MVP/demo: giữ các script `resume:embeddings` và `reprocess:documents`.
- Production: dùng job queue/worker riêng và cơ chế retry timeout.

## Kết Quả Kiểm Tra Thành Công

- ESLint: pass.
- Production build: pass.
- PDF, DOCX, PPTX, EPUB extractors: pass.
- Chunking và source-location metadata: pass.
- PostgreSQL/pgvector: healthy.
- BGE-M3 service: ready, vector 1024 chiều.
- 525/525 chunks có source location và embedding.
