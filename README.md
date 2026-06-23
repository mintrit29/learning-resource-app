# ScholarFlow

ScholarFlow là ứng dụng quản lý và tìm kiếm học liệu dành cho sinh viên. Bạn có thể tải lên PDF, DOCX, PPTX hoặc EPUB; hệ thống sẽ tự trích xuất nội dung, phân tích bằng AI và tìm đúng đoạn liên quan bằng câu hỏi tự nhiên.

## Dành cho người sử dụng

### Mở ứng dụng

Truy cập địa chỉ do người quản trị cung cấp. Nếu ScholarFlow đang chạy trên máy của bạn, mở:

**http://localhost:3000**

### Cách sử dụng

1. Đăng ký hoặc đăng nhập.
2. Vào **Tải lên** và chọn tài liệu.
3. Chờ hệ thống xử lý xong.
4. Vào **Tìm kiếm** và nhập nội dung cần tìm.
5. Bấm vào kết quả để mở đúng đoạn hoặc đúng trang trong tài liệu.

Nếu xử lý bị lỗi, mở chi tiết tài liệu và bấm chạy lại. Hệ thống chỉ chạy lại bước còn thiếu, không cần xóa tài liệu rồi tải lên lại.

---

## Dành cho nhà phát triển

### Yêu cầu

- Node.js và npm
- Docker Desktop
- Python
- NVIDIA CUDA (không bắt buộc; có thể chạy bằng CPU)

### Cài đặt lần đầu

#### 1. Web app và database

```powershell
cd learning-resource-app
Copy-Item .env.example .env
npm install
docker compose up -d
npx prisma generate
npx prisma db push
```

Mở `learning-resource-app/.env` và thay `AUTH_SECRET` trước khi triển khai thật.

#### 2. Embedding service

Mở terminal mới từ thư mục gốc:

```powershell
cd embedding-service
Copy-Item .env.example .env
.\setup.ps1 -Device cuda
```

Máy không có NVIDIA CUDA thì đổi `cuda` thành `cpu`. Lần đầu hệ thống có thể mất vài phút để tải model BGE-M3.

### Chạy ứng dụng

Mỗi lần phát triển, mở hai terminal.

**Terminal 1 — database và web:**

```powershell
cd learning-resource-app
docker compose up -d
npm run dev
```

**Terminal 2 — embedding service:**

```powershell
cd embedding-service
.\start.ps1 -Device cuda
```

Sau đó mở **http://localhost:3000**. Máy không có CUDA thì đổi `cuda` thành `cpu`.

### Kiểm tra trước khi commit

```powershell
cd learning-resource-app
npm run lint
npm run build
```

Kiểm tra embedding service tại **http://127.0.0.1:8001/health**.

## Công nghệ chính

Next.js, TypeScript, Auth.js, PostgreSQL, Prisma, pgvector, FastAPI và BGE-M3.

## Tài liệu dự án

- [Yêu cầu sản phẩm](PRD.md)
- [Kế hoạch triển khai](IMPLEMENTATION_PLAN.md)
- [Checklist tiến độ](PROJECT_CHECKLIST.md)
- [Báo cáo lỗi](ERROR_REPORT.md)

MVP tập trung vào Vector RAG cho học liệu Computer Science/IT.
