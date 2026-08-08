# ScholarFlow Desktop

ScholarFlow là ứng dụng desktop Windows giúp sinh viên lưu trữ, phân loại và tìm lại học liệu bằng tìm kiếm ngữ nghĩa. Ứng dụng hỗ trợ PDF, DOCX, PPTX và EPUB; tự trích xuất nội dung, chia đoạn, tạo vector BGE-M3 và cho phép tìm nguồn phù hợp bằng câu hỏi tự nhiên.

> Phiên bản chính thức của dự án là ứng dụng desktop. Repo không còn sử dụng Docker, PostgreSQL, Python embedding service hoặc một bản web triển khai riêng.

## Chức năng chính

- Đăng ký, đăng nhập và quản lý thư viện cục bộ.
- Thêm tài liệu PDF, DOCX, PPTX và EPUB.
- Trích xuất văn bản và giữ vị trí nguồn như trang, slide hoặc mục.
- Chia nội dung thành các đoạn và tạo vector BGE-M3 1.024 chiều trên máy.
- Phân tích chủ đề, độ khó, ngôn ngữ và tóm tắt bằng OpenRouter, Ollama hoặc Custom API.
- Tìm kiếm kết hợp ngữ nghĩa, từ khóa và bộ lọc metadata.
- Hiển thị đoạn phù hợp nhất, lý do phù hợp và vị trí để mở lại nguồn.
- Quản lý chủ đề, tên gọi khác và gộp thủ công các chủ đề trùng nhau.
- Theo dõi tiến trình xử lý, thử lại bước lỗi và phân tích lại bằng AI.

## Kiến trúc hiện tại

```text
Electron Desktop
  ├─ Next.js chạy nội bộ trên 127.0.0.1
  ├─ SQLite + sqlite-vec
  ├─ BGE-M3 qua Transformers.js/ONNX Runtime
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
npm run dev
```

Lệnh `npm run dev` mở cửa sổ Electron, không mở một sản phẩm web độc lập.

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
- PDF scan chưa có lớp văn bản cần OCR trước khi thêm.
- Phân tích metadata cần một kết nối AI hợp lệ; thư viện và tìm kiếm vẫn dùng dữ liệu đã xử lý cục bộ.
- Chưa có đồng bộ dữ liệu giữa nhiều máy.
- Dashboard quản trị tài khoản trong desktop là hạng mục ưu tiên tiếp theo và chưa nằm trong bản MVP hiện tại.

Chi tiết phạm vi sản phẩm nằm trong [PRD.md](PRD.md), tiến độ trong [PROJECT_CHECKLIST.md](PROJECT_CHECKLIST.md) và kế hoạch kỹ thuật trong [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).
