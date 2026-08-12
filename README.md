# ScholarFlow Desktop

ScholarFlow là ứng dụng desktop Windows giúp sinh viên lưu trữ, phân loại và tìm lại học liệu bằng tìm kiếm ngữ nghĩa. Ứng dụng hỗ trợ PDF, DOCX, PPTX và EPUB; tự trích xuất nội dung, chia đoạn, tạo vector BGE-M3 và cho phép tìm nguồn phù hợp bằng câu hỏi tự nhiên.

> Đây là nhánh `desktop-app`, dùng Electron, SQLite và local runtime. Phiên bản web/Docker cũ vẫn được giữ riêng trên nhánh `main` và `archive/web-docker-before-desktop-2026-08-08`. Không merge trực tiếp `desktop-app` vào nhánh Docker vì hai bản dùng kiến trúc database và embedding khác nhau.

## Chức năng chính

- Đăng ký, đăng nhập và quản lý thư viện cục bộ.
- Thêm một hoặc nhiều tài liệu PDF, DOCX, PPTX và EPUB; có thể chọn cả thư mục.
- Xử lý nhiều tài liệu theo hàng đợi tuần tự để không làm quá tải máy.
- Dùng Docling thống nhất để trích xuất cấu trúc, bảng, công thức và vị trí nguồn từ PDF, DOCX, PPTX và EPUB.
- Dùng Docling OCR cho PDF scan và ảnh nhúng trong DOCX, PPTX, EPUB.
- Chia nội dung thành các đoạn và tạo vector BGE-M3 1.024 chiều trên máy.
- Phân loại tài liệu vào danh sách môn học cố định, đồng thời phân tích độ khó, ngôn ngữ và tóm tắt bằng OpenRouter, Ollama hoặc Custom API.
- Tìm kiếm kết hợp ngữ nghĩa, từ khóa và bộ lọc metadata.
- Hiển thị đoạn phù hợp nhất, lý do phù hợp và vị trí để mở lại nguồn.
- Khởi tạo 27 môn chuyên ngành CNTT của Trường Đại học Nguyễn Tất Thành; người dùng có thể thêm, sửa, xóa hoặc gộp môn học.
- AI chỉ được chọn một môn học đang có. Tài liệu không đủ phù hợp được giữ ở trạng thái “Chưa phân loại”, AI không tự tạo môn mới.
- Header, footer và mục “Về dự án” hiển thị thông tin đề tài, nhóm TH67, giảng viên hướng dẫn và kênh liên hệ.
- Theo dõi tiến trình xử lý, thử lại bước lỗi và phân tích lại bằng AI.

## Kiến trúc hiện tại

```text
Electron Desktop
  ├─ Next.js chạy nội bộ trên 127.0.0.1
  ├─ SQLite + sqlite-vec
  ├─ BGE-M3 qua Transformers.js/ONNX Runtime
  ├─ Docling cho trích xuất tài liệu và OCR ảnh
  └─ OpenRouter / Ollama / Custom API (tùy chọn cho phân tích AI)
```

Next.js chỉ là dịch vụ giao diện chạy bên trong Electron và không phải một phiên bản web dành cho người dùng. Electron tự khởi động, kiểm tra và dừng các tiến trình nội bộ theo vòng đời ứng dụng.

## Dữ liệu cục bộ

Theo mặc định, ScholarFlow lưu dữ liệu trong `%APPDATA%\ScholarFlow`:

- `data\scholarflow.db`: cơ sở dữ liệu SQLite.
- `data\uploads`: tài liệu đã thêm.
- `models`: bộ nhớ đệm mô hình BGE-M3.
- `logs\desktop.log`: nhật ký chẩn đoán.

API key và dữ liệu cá nhân không được commit vào Git. Lần tạo embedding đầu tiên cần Internet để tải BGE-M3, dung lượng bộ nhớ đệm hiện khoảng 2,1 GB. Sau khi đã tải, tạo embedding và tìm kiếm có thể chạy cục bộ.

## Chạy mã nguồn

Yêu cầu phát triển:

- Windows 10/11 x64.
- Node.js 24 và npm 11 (chỉ cần khi phát triển hoặc đóng gói; người dùng bộ cài không cần Node.js).

```powershell
cd learning-resource-app
npm ci
npm run docling:prepare
cd embedding-runtime
npm ci
cd ..
npm run dev
```

Lệnh `npm run dev` mở cửa sổ Electron, không mở một sản phẩm web độc lập.

Pipeline trích xuất chỉ dùng Docling. Tải PDFium và các model layout/OCR/TableFormer một lần trước khi thêm tài liệu:

```powershell
npm run docling:prepare
```

Bộ model nằm trong `.docling-runtime` và không được commit. Nếu runtime thiếu, ScholarFlow báo lỗi rõ ràng và không quay về parser cũ. Các lệnh đóng gói tự chạy bước chuẩn bị này và đưa runtime vào bộ cài.

## Kiểm thử

```powershell
npm run lint
npm run test:unit
npm run build
npm run test:desktop-runtime
```

Kiểm tra bản đã đóng gói:

```powershell
npm run desktop:package:dir
npm run test:desktop-packaged
```

## Đóng gói bộ cài Windows

```powershell
npm run desktop:package
```

Bộ cài được tạo trong `learning-resource-app\dist-electron`. Thư mục build và file cài đặt không được commit vào repo; bản phát hành được tải lên GitHub Releases.

## Giới hạn hiện tại

- Tài liệu lớn có thể tạo embedding chậm khi chỉ dùng CPU.
- OCR tài liệu scan chạy trên CPU nên chậm hơn PDF có text; chất lượng công thức và biểu đồ phụ thuộc độ nét của bản scan.
- Phân tích metadata cần một kết nối AI hợp lệ; thư viện và tìm kiếm vẫn dùng dữ liệu đã xử lý cục bộ.
- Chưa có đồng bộ dữ liệu giữa nhiều máy.
- Dashboard quản trị tài khoản trong desktop là hạng mục ưu tiên tiếp theo và chưa nằm trong bản MVP hiện tại.

Chi tiết phạm vi sản phẩm nằm trong [PRD.md](PRD.md), tiến độ trong [PROJECT_CHECKLIST.md](PROJECT_CHECKLIST.md) và kế hoạch kỹ thuật trong [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

## Làm việc cùng phiên bản Docker

- `desktop-app`: Electron + SQLite + sqlite-vec + BGE-M3 local.
- `main`: web/Docker + PostgreSQL/pgvector + embedding service riêng.
- Không dùng nút **Merge** để nhập toàn bộ `desktop-app` vào `main`. Git có thể merge sạch nhưng đồng thời xóa Dockerfile, compose và Python embedding service.
- Muốn đưa một tính năng giao diện sang Docker, hãy tạo branch mới từ `main` rồi chuyển thủ công đúng component/API cần thiết và giữ nguyên tầng database của Docker.

Xem danh sách xung đột kiến trúc và cách xử lý tại [DOCKER_COMPATIBILITY.md](DOCKER_COMPATIBILITY.md).
