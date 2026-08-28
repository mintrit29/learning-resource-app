# ScholarFlow Desktop

ScholarFlow là ứng dụng desktop Windows giúp sinh viên lưu trữ, phân loại và tìm lại học liệu bằng tìm kiếm ngữ nghĩa. Ứng dụng hỗ trợ PDF, DOCX, PPTX, EPUB, XMind, ảnh mind map và âm thanh MP3/WAV/M4A; tự chuyển nội dung thành văn bản, chia đoạn, tạo vector BGE-M3 và cho phép tìm nguồn phù hợp bằng câu hỏi tự nhiên.

> Bản desktop hiện nằm trên nhánh `main`, dùng Electron, SQLite và các runtime cục bộ. Không có tài khoản/Supabase. Trích xuất và tìm kiếm chạy local; nếu chủ động bật AI trực tuyến, nội dung phục vụ phân tích sẽ được gửi đến provider đã cấu hình.

> **28/08/2026 — ưu tiên chốt bản dev:** nhóm chạy bằng `npm run dev`. Tạm dừng phát hành EXE; không cần đóng gói lại mỗi lần sửa code. CI vẫn kiểm lint/unit/build/standalone nhưng không tạo bộ cài khi push/PR. Các báo cáo EXE trong bộ test là lịch sử kiểm thử, không phải hướng dẫn tải bản hiện hành.

## Chức năng chính

- Mở thẳng vào thư viện cục bộ, không cần đăng ký hoặc đăng nhập.
- Thêm một hoặc nhiều tài liệu PDF, DOCX, PPTX, EPUB, XMind, ảnh PNG/JPG/WebP và âm thanh MP3/WAV/M4A; có thể chọn cả thư mục.
- Xử lý nhiều tài liệu theo hàng đợi tuần tự để không làm quá tải máy.
- Dùng Docling thống nhất để trích xuất cấu trúc, bảng, công thức và vị trí nguồn từ PDF, DOCX, PPTX và EPUB.
- Dùng pipeline OCR Việt–Anh cục bộ cho PDF scan và ảnh nhúng; kết hợp xử lý riêng cho chữ thường, bảng, code và công thức.
- OCR chữ trên ảnh/PDF scan mind map; PDF chữ dùng Docling và giữ cả tiêu đề đứng riêng. XMind JSON/XML đọc trực tiếp nhánh, ghi chú, nhãn và đường dẫn cha-con; xem bằng sơ đồ nhánh tự sắp xếp. Ảnh nhúng PNG/JPEG/WebP được hiển thị và OCR Việt–Anh, giữ nguồn theo nhánh/sơ đồ. Chọn vùng XMind lấy chữ gốc và chỉ OCR phần ảnh được khoanh. PDF/XMind hỗ trợ kéo, zoom và giữ vị trí khi quay lại kết quả.
- Dùng Whisper Base cục bộ để chép lời audio Việt–Anh, giữ mốc thời gian làm vị trí nguồn.
- Chia nội dung thành các đoạn và tạo vector BGE-M3 1.024 chiều trên máy.
- Phân loại tài liệu vào danh sách môn học cố định, đồng thời phân tích độ khó, ngôn ngữ và tóm tắt bằng OpenRouter, Ollama hoặc Custom API.
- Tìm kiếm kết hợp ngữ nghĩa, từ khóa và bộ lọc metadata.
- Tìm bằng ảnh hoặc file theo cách chọn trực tiếp một vùng; OCR vùng chọn rồi dùng nội dung đó làm truy vấn, không tự giải bài tập.
- Hiển thị đoạn phù hợp nhất, lý do phù hợp và vị trí để mở lại nguồn.
- Khi mở kết quả, app giữ trạng thái tìm kiếm và đưa bản xem file tới đúng trang, slide, chương hoặc vùng nội dung liên quan.
- Khởi tạo 27 môn chuyên ngành CNTT của Trường Đại học Nguyễn Tất Thành; người dùng có thể thêm, sửa hoặc xóa môn học.
- AI chỉ được chọn một môn học đang có. Tài liệu không đủ phù hợp được giữ ở trạng thái “Chưa phân loại”, AI không tự tạo môn mới.
- Header, footer và mục “Về dự án” hiển thị thông tin đề tài, nhóm TH67, giảng viên hướng dẫn và kênh liên hệ.
- Theo dõi tiến trình xử lý, thử lại bước lỗi và phân tích lại bằng AI.

## Kiến trúc hiện tại

```text
Electron Desktop
  ├─ Next.js chạy nội bộ trên 127.0.0.1
  ├─ SQLite + sqlite-vec
  ├─ BGE-M3 qua Transformers.js/ONNX Runtime
  ├─ Docling + OCR Việt–Anh cho trích xuất tài liệu và ảnh
  ├─ Whisper Base + FFmpeg cho chép lời âm thanh
  └─ OpenRouter / Ollama / Custom API (tùy chọn cho phân tích AI)
```

Next.js chỉ là dịch vụ giao diện chạy bên trong Electron và không phải một phiên bản web dành cho người dùng. Electron tự khởi động, kiểm tra và dừng các tiến trình nội bộ theo vòng đời ứng dụng.

## Dữ liệu cục bộ

Theo mặc định, ScholarFlow lưu dữ liệu trong `%APPDATA%\ScholarFlow`:

- `data\scholarflow.db`: cơ sở dữ liệu SQLite.
- `data\uploads`: tài liệu đã thêm.
- `models\BAAI\bge-m3`: mô hình embedding BGE-M3.
- `models\onnx-community\whisper-base`: mô hình chép lời Whisper tùy chọn.
- `runtimes\docling`: model Docling và PDFium.
- `logs\desktop.log`: nhật ký chẩn đoán.

API key, database và tài liệu cá nhân không được commit vào Git. BGE-M3, Docling và Whisper được tải, kiểm tra, tải lại hoặc xóa trong **Cài đặt → Thành phần cục bộ**. Whisper là tùy chọn và chỉ cần khi thêm file âm thanh. Bộ cài không chứa các model lớn; sau khi thiết lập xong, trích xuất và tìm kiếm hoạt động cục bộ.

## Chạy mã nguồn

Yêu cầu phát triển:

- Windows 10/11 x64.
- Node.js 24 và npm 11 (chỉ cần khi phát triển hoặc đóng gói; người dùng bộ cài không cần Node.js).

```powershell
cd learning-resource-app
npm ci
cd embedding-runtime
npm ci
cd ..
npm run dev
```

Lệnh `npm run dev` mở cửa sổ Electron, không mở một sản phẩm web độc lập. Khi BGE-M3 hoặc Docling chưa có, app mở trang thiết lập thành phần; người dùng có thể tải trong giao diện hoặc chọn dùng tạm chế độ giới hạn. Whisper được cài riêng trong Cài đặt khi cần xử lý audio và không chặn onboarding. `npm run docling:prepare` chỉ còn phục vụ CI/test tương thích cũ, không phải bước bắt buộc để đóng gói và không đưa model vào installer.

## Kiểm thử

```powershell
npm run lint
npm run test:unit
npm run desktop:build
npm run test:desktop-runtime
```

Kiểm tra bản đã đóng gói:

```powershell
npm run desktop:package:dir
npm run test:desktop-packaged
```

Kiểm thử thủ công đầy đủ nằm trong `learning-resource-app\test-fixtures\scholarflow`. Bắt đầu từ `HUONG_DAN_TEST_FULL_SCHOLARFLOW.md`; đây là bộ test cố định của dự án và không được xóa khi dọn file tạm.

## Đóng gói bộ cài Windows

Chỉ thực hiện khi nhóm đã nghiệm thu bản dev và yêu cầu phát hành cuối. Giữ cấu hình/script đóng gói để dùng lại; không chạy trong vòng lặp sửa code thông thường.

```powershell
npm run desktop:package
```

Bộ cài được tạo trong `learning-resource-app\dist-electron`. Thư mục build và file cài đặt không được commit vào repo; bản phát hành được tải lên GitHub Releases.

Trên GitHub, chạy CI thủ công với `test_installer=true` trên commit cần phát hành, đợi kiểm bản cài đạt rồi mới chạy thủ công workflow `Release desktop` với tag đúng commit đó. Push code hoặc push tag không tự tạo/phát hành EXE.

## Giới hạn hiện tại

- Tài liệu lớn có thể tạo embedding chậm khi chỉ dùng CPU.
- OCR tài liệu scan chạy trên CPU nên chậm hơn PDF có text; chất lượng công thức và biểu đồ phụ thuộc độ nét của bản scan.
- OCR bảng/công thức/biểu đồ ưu tiên trích xuất chữ và ký hiệu để tìm kiếm, không diễn giải quan hệ thị giác hoặc giải bài tập.
- Mind map ảnh/PDF được tìm bằng chữ, không suy luận đường nối. XMind giữ cây cha-con và đọc/OCR ảnh nhúng PNG/JPEG/WebP; chưa đọc tập tin đính kèm khác, liên kết chéo hay file có mật khẩu. Bộ test mới: [PDF/XMind](learning-resource-app/test-fixtures/scholarflow/06_mindmap_audio/TEST_PDF_XMIND.md).
- Audio giới hạn 25 MB và tối đa 60 phút. Whisper Base nhận tốt lời nói rõ bằng tiếng Việt/Anh nhưng tên riêng, thương hiệu, tiếng ồn hoặc nhiều người nói có thể cần sửa bản chép lời.
- Phân tích metadata cần một kết nối AI hợp lệ; thư viện và tìm kiếm vẫn dùng dữ liệu đã xử lý cục bộ.
- Chưa có đồng bộ dữ liệu giữa nhiều máy.

Chi tiết phạm vi sản phẩm nằm trong [PRD.md](PRD.md), tiến độ trong [PROJECT_CHECKLIST.md](PROJECT_CHECKLIST.md) và kế hoạch kỹ thuật trong [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

## Phiên bản Docker cũ

Kiến trúc web/Docker cũ không còn được dùng bởi desktop app. Mã và lịch sử của phiên bản đó vẫn có thể lấy lại từ Git, đặc biệt ở nhánh/tag lưu trữ được ghi trong [DOCKER_COMPATIBILITY.md](DOCKER_COMPATIBILITY.md); không cần giữ Python embedding service hoặc model Docker cũ trong working tree hiện tại.
