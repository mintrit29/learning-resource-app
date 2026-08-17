# Implementation Plan — ScholarFlow Desktop

**Cập nhật:** 15/08/2026
**Nhánh thực hiện:** `desktop-app`
**Phạm vi:** ứng dụng desktop Windows chạy local, không có tài khoản, cloud backend, Docker hoặc bản web độc lập.
**Lưu ý tài liệu:** PRD chưa cập nhật ở giai đoạn này; chỉ cập nhật khi sản phẩm hoàn thiện theo yêu cầu của nhóm.

## 1. Kiến trúc đích

```text
ScholarFlow.exe
  ├─ Electron main process
  │   ├─ quản lý cửa sổ, IPC và chính sách bảo mật
  │   ├─ khởi động/dừng Next.js standalone trên loopback
  │   ├─ quản lý BGE-M3 và Docling trong vùng dữ liệu ứng dụng
  │   └─ khởi động/dừng embedding runtime
  ├─ Next.js application server — chỉ 127.0.0.1
  ├─ SQLite database
  ├─ sqlite-vec index — vector 1.024 chiều
  ├─ BGE-M3 — Transformers.js + ONNX Runtime
  ├─ Docling.rs — PDFium + layout + OCR + TableFormer
  └─ dữ liệu ứng dụng trong %APPDATA%\ScholarFlow
```

Next.js chỉ là lớp giao diện/API nội bộ của ứng dụng desktop. Tài liệu, database, vector, cấu hình AI, model và log đều nằm trên máy người dùng.

## 2. Nguyên tắc đã chốt

- Source of truth nằm trong `learning-resource-app`.
- Không dùng đăng ký, đăng nhập, session, mật khẩu, bảng `User` hoặc Supabase.
- Không duy trì Docker, PostgreSQL, pgvector hoặc Python embedding service.
- File gốc người dùng chọn bên ngoài ứng dụng không bị sửa hoặc xóa.
- Bản sao tài liệu được nhập vào thư viện là dữ liệu của ứng dụng và có thể được xóa trong app.
- Giữ lại môn học mặc định, cài đặt, cấu hình AI và model local khi chuyển sang chế độ local-only.
- BGE-M3 và Docling không nằm trong installer; người dùng quản lý chúng trong app.
- Ollama/Qwen là tùy chọn cho phân tích và tóm tắt, không phải điều kiện để tìm kiếm thư viện.
- Mỗi thay đổi lớn phải có test và commit riêng; không push nếu chưa được yêu cầu.

## 3. Những phần đã hoàn thành

### 3.1 Desktop shell và dữ liệu local

- Electron single-instance, sandbox, context isolation và điều hướng an toàn.
- Next.js/embedding runtime chạy trên cổng loopback ngẫu nhiên và được Electron quản lý vòng đời.
- SQLite + Prisma lưu metadata; sqlite-vec lưu vector BGE-M3 1.024 chiều.
- Database, uploads, model và log được đặt dưới `%APPDATA%\ScholarFlow`.
- Có migration tự động, idempotent và kiểm tra path containment.
- Đã sửa lỗi `EPIPE` khi Electron dev mất console pipe; lỗi ghi stdout không còn làm main process crash.

### 3.2 Quản lý BGE-M3 và Docling

- Có manifest cố định cho `bge-m3` và `docling`; renderer không truyền URL/path tùy ý.
- Có trạng thái `missing`, `downloading`, `verifying`, `ready`, `corrupt`, `error`.
- Hỗ trợ tải `.partial`, HTTP Range, tiếp tục tải, hủy, kiểm tra dung lượng và SHA-256.
- Có màn hình thiết lập lần đầu và `Cài đặt → Thành phần cục bộ`.
- Nhận diện cache BGE-M3 cũ và nhập Docling runtime cũ vào vùng quản lý.
- Installer không chứa model lớn hoặc `.docling-runtime`.
- Chế độ giới hạn hoạt động rõ ràng khi thiếu Docling hoặc BGE-M3.

### 3.3 Trích xuất tài liệu bằng Docling

- PDF, DOCX, PPTX và EPUB đều đi qua Docling.rs.
- PDF scan và ảnh trong tài liệu được OCR bằng pipeline Docling hiện tại.
- Giữ cấu trúc, trang/slide/mục và `sourceLabel` để dẫn về nguồn.
- Chunk Docling được dùng cho embedding và tìm kiếm.
- Có thao tác trích xuất lại, retry và queue xử lý tuần tự.
- Bốn định dạng có unit test extractor và preview.

### 3.4 Tìm kiếm hiện tại

- Nhận truy vấn chữ tiếng Việt/Anh.
- Hybrid retrieval kết hợp vector BGE-M3, từ khóa và metadata.
- Có relevance gate để trả “không có tài liệu phù hợp” khi điểm thấp.
- Kết quả dẫn tới chunk và vị trí nguồn trong tài liệu.
- Tìm kiếm không phụ thuộc Ollama.

### 3.5 Tối ưu chuyển trang

- Danh mục 27 môn mặc định chỉ được đồng bộ một lần trong mỗi phiên app thay vì ghi lại SQLite ở mỗi lần chuyển trang.
- Thời gian đo trong dev giảm từ khoảng 520–620 ms xuống 210–225 ms cho Dashboard và từ 470–510 ms xuống 180–186 ms cho Tài liệu.
- Production build đã đạt sau thay đổi.

## 4. Công việc đang thực hiện: chuyển hoàn toàn sang local-only

**Trạng thái:** code đã triển khai trong working tree, đã qua lint, TypeScript, unit test và production build; chưa commit/push.

- Xóa giao diện/API đăng ký và đăng nhập.
- Xóa NextAuth, adapter auth, bcrypt và các type/validation liên quan.
- Xóa các bảng `User`, `Account`, `Session`, `VerificationToken` và toàn bộ `userId` khỏi schema mới.
- Chuyển document, tag, AI provider và search log sang phạm vi một thư viện local duy nhất.
- Migration xóa tài liệu đã nhập và dữ liệu tài khoản cũ nhưng giữ môn học/tag, alias, AI provider và cài đặt khác.
- Lần mở đầu sau nâng cấp chỉ dọn đúng `%APPDATA%\ScholarFlow\data\uploads`; file gốc bên ngoài app không bị đụng tới.
- Khóa mã hóa API provider được tách khỏi auth secret và có thể nhận khóa cũ để không làm mất cấu hình provider.
- Test migration xác nhận tài liệu/tài khoản bị xóa nhưng tag và cấu hình Ollama vẫn còn.
- Còn phải chạy lại desktop standalone/package/smoke trên bản local-only cuối cùng trước khi commit.

## 5. Tính năng đang triển khai: tìm bằng vùng chọn trên ảnh hoặc file

**Trạng thái:** đã hoàn thiện vòng triển khai kỹ thuật. Luồng ảnh/file → chọn/resize vùng → Docling OCR → hybrid search, zoom, lazy preview nhiều phần và crop nhiều DPI đã có; full lint/unit/build/standalone/package smoke đều đạt. Còn QA thủ công với bộ tài liệu/ảnh thực tế trước khi cập nhật PRD và phát hành.

### 5.1 Mục tiêu

Cho người dùng mở một ảnh hoặc file, chủ động khoanh vùng nội dung cần tìm và nhận kết quả tương tự trong thư viện. Đây là tìm kiếm học liệu, không phải hỏi đáp hoặc giải bài.

### 5.2 Trải nghiệm đã thống nhất

- Một nút chung `Mở ảnh hoặc file để tìm`; không chia chế độ ảnh/bài tập/đề thi.
- Hỗ trợ ảnh, PDF, DOCX, PPTX và EPUB.
- Giao diện hai cột: viewer bên trái, nội dung OCR và kết quả bên phải.
- Người dùng kéo/đổi kích thước khung trực tiếp trên viewer; không có bước crop/lưu ảnh riêng.
- Sau khi vùng chọn ổn định khoảng 250–400 ms, app tự OCR rồi tự tìm; yêu cầu cũ bị hủy/bỏ qua khi vùng chọn thay đổi.
- OCR là nguồn chính để không bỏ sót chữ nằm trong ảnh; text layer chỉ dùng bổ trợ độ chính xác.
- Nội dung OCR được hiển thị và có thể sửa; kết quả tự cập nhật sau khi sửa.
- Vùng chọn được xem là một query hoàn chỉnh, không tự tách câu hỏi và không phân loại bài tập/đề thi.
- Không phân chủ đề cho file truy vấn và không dùng chủ đề đoán được làm bộ lọc cứng.
- BGE-M3 + keyword retrieval dùng lại pipeline tìm kiếm hiện tại.
- Chỉ trả tài liệu/chunk phù hợp; không sinh đáp án. Nếu không vượt ngưỡng thì báo không có tài liệu phù hợp.
- File truy vấn và ảnh vùng chọn chỉ tồn tại tạm thời và bị xóa khi đóng công cụ.
- Chưa thêm vision model; vùng không có đủ chữ sẽ yêu cầu người dùng chọn thêm nhãn/chú thích.

### 5.3 File nhiều trang

Hướng đã triển khai cho v1:

- PPTX/EPUB chỉ render slide/chương hiện tại theo session RAM tạm, điều hướng bằng trước/sau và danh sách số thu gọn.
- PDF dùng viewer Chromium với điều hướng trang và zoom tích hợp; không thêm PDF.js vào package.
- DOCX cuộn liên tục vì ranh giới trang phụ thuộc font và renderer, không tự chia trang giả.
- Mỗi lần tìm chọn một vùng trong viewport hiện tại; chưa hỗ trợ gộp vùng qua nhiều trang.
- Khi đổi slide/chương, xóa khung chọn nhưng giữ kết quả cũ cho tới khi có vùng mới.
- Không tạo thumbnail ảnh ở v1 để tránh render trước toàn bộ trang và tăng bộ nhớ; danh sách số là chỉ mục thu gọn.
- Session preview giữ tối đa 15 phút, tối đa ba file và được xóa khi đổi file/đóng công cụ; không ghi file truy vấn xuống ổ đĩa.

### 5.4 Kiến trúc dự kiến

```text
Viewer + ROI overlay
  → render vùng chọn ở độ phân giải OCR vào RAM
  → Docling warm pipeline
  → chuẩn hóa text/công thức/bảng
  → API hybrid search hiện tại
  → relevance gate
  → kết quả tài liệu + chunk + trang/slide
```

- Giữ Docling pipeline ấm trong phiên tìm bằng vùng để tránh reload model sau mỗi lần chọn.
- Queue OCR tuần tự và gắn request id để bỏ kết quả cũ.
- Chuẩn hóa tọa độ vùng chọn độc lập với zoom/DPI.
- Không ghi ảnh crop vào thư viện hoặc database.

### 5.5 Hoàn thiện UX sau kiểm thử thực tế

- Giữ ảnh/file, vùng chọn, OCR và kết quả trong RAM tối đa 15 phút khi mở kết quả, đổi chế độ hoặc chuyển trang rồi quay lại; đóng app vẫn xóa toàn bộ dữ liệu tạm.
- Link kết quả ghi lại nguồn mở để nút quay lại trở về đúng chế độ tìm kiếm thay vì luôn về thư viện.
- Tìm bằng mô tả tự chạy sau debounce, tự hủy yêu cầu cũ và tự xóa kết quả khi query bị xóa; nút xóa nằm ngay trong ô nhập.
- Danh sách file chờ nhập thư viện được giữ trong RAM tối đa 30 phút khi chuyển trang; cảnh báo trước khi đóng app nếu còn file chưa xử lý.
- Sửa truy vấn SQLite làm trang `/documents?q=...` lỗi trên desktop.
- Modal hỗ trợ Escape, bấm nền để đóng và trả focus về nút đã mở; thao tác xóa provider và phân tích lại có xác nhận.
- Trang môn học có tìm nhanh; phần tiến trình và text trích xuất dài trên trang chi tiết được thu gọn.
- Trạng thái kiểm tra BGE-M3/Docling phản hồi ngay; kết quả dò cấu hình Local AI được cache ngắn để giảm giật khi chuyển trang cài đặt.
- Vòng kiểm tra UX ngày 17/08/2026: lint, toàn bộ unit test và production build đạt; kiểm thử local xác nhận tìm tự động/xóa, giữ state khi đổi/chuyển trang, lọc môn, Escape modal và truy vấn thư viện không còn lỗi.
- Bỏ bản preview mở riêng gây thay thế cửa sổ Electron; trang chi tiết chỉ preview trong app, có `Hiện file trong thư mục` để Explorer chọn bản sao do ScholarFlow quản lý và `Lưu bản sao` khi cần xuất file.
- Kết quả tìm bằng ảnh/file hiển thị cùng lý do phù hợp và nguồn như tìm bằng mô tả.
- Khi mở kết quả rồi quay lại, giữ nguyên vùng chọn/OCR/kết quả trong RAM và không tự OCR lại cho tới khi người dùng thật sự kéo hoặc resize vùng.
- Viewer dùng hai chế độ rõ ràng: `Chọn vùng` để khoanh/di chuyển/resize vùng OCR và `Kéo để xem` để pan nội dung khi đã zoom; đổi chế độ không làm mất vùng chọn hoặc kết quả.
- Zoom từ mức `Vừa khung` đến 200%, giữ đúng tỉ lệ ảnh, giữ vị trí logic của vùng chọn và hỗ trợ `Ctrl + lăn chuột`; PDF tiếp tục dùng điều khiển native của Chromium.
- Nội dung trích xuất mặc định thu gọn và chỉ tải toàn bộ text khi người dùng mở disclosure; bỏ nút điều hướng `Xem toàn bộ` gây tải lại trang.
- File ScholarFlow quản lý được lưu theo `uploads/<document-id>/<tên-gốc-an-toàn>`; file UUID cũ được migrate idempotent lúc app khởi động để Explorer hiển thị tên dễ đọc.

## 6. Thứ tự thực hiện tiếp theo

### Giai đoạn A — Hoàn tất local-only

1. Chạy lại lint, toàn bộ unit test và production build trên working tree cuối.
2. Chạy desktop standalone smoke test.
3. Tạo unpacked/package mới và chạy packaged smoke test.
4. Kiểm tra installer không chứa model và không còn auth dependency/route.
5. Commit thay đổi local-only + sửa ổn định/hiệu năng; không push nếu chưa được yêu cầu.

### Giai đoạn B — Tìm bằng vùng chọn

1. Tạo viewer thống nhất và adapter render cho ảnh/PDF/DOCX/PPTX/EPUB.
2. Thêm điều hướng lazy cho file nhiều trang.
3. Thêm ROI overlay với kéo, resize, zoom và chuẩn hóa tọa độ.
4. Tạo OCR endpoint/worker nhận buffer vùng chọn trong RAM.
5. Dùng Docling warm pipeline và cơ chế hủy kết quả cũ.
6. Nối text OCR với hybrid search hiện tại.
7. Hoàn thiện panel kết quả, trạng thái loading/no-result và chỉnh sửa OCR.
8. Kiểm tra cleanup file tạm, giới hạn dung lượng/trang và path containment.
9. Thêm unit, integration và desktop interaction tests.

### Giai đoạn C — Hoàn thiện sản phẩm

1. Kiểm thử với tài liệu thực tế và ảnh câu hỏi tiếng Việt.
2. Đo độ trễ OCR lần đầu/lần sau và chất lượng relevance gate.
3. Hoàn thiện backup/restore nếu còn trong phạm vi release.
4. Cập nhật README, PRD và tài liệu bàn giao sau khi chức năng cuối ổn định.
5. Package, smoke test, tạo commit/release theo yêu cầu nhóm.

## 7. Chiến lược kiểm thử

### Mỗi thay đổi

- ESLint và TypeScript.
- Unit test liên quan.
- `git diff --check` và kiểm tra không stage secret/build/model.

### Tìm bằng vùng chọn

- Tọa độ crop đúng ở nhiều mức zoom và DPI.
- Debounce/cancel không cho kết quả cũ ghi đè vùng mới.
- OCR ảnh, PDF scan, PDF text, DOCX, PPTX và EPUB.
- Vùng chứa tiếng Việt, công thức, bảng và vùng gần như không có chữ.
- File nhiều trang chỉ render/xử lý trang cần thiết.
- Query/file tạm bị xóa; file gốc không bị thay đổi.
- Kết quả dưới ngưỡng trả no-result, không tạo câu trả lời.

### Trước commit/release

- Toàn bộ `test:unit`.
- Production build.
- Desktop standalone smoke.
- Packaged desktop smoke.
- Kiểm tra mở/đóng app, chuyển trang và tương tác nhiều lần không tái diễn `EPIPE`.

## 8. Trạng thái Git

- `main`: phiên bản đã được nhóm duyệt.
- `archive/web-docker-before-desktop-2026-08-08`: lịch sử bản web/Docker cũ.
- `desktop-app`: nhánh phát triển desktop, hiện đang trước `origin/desktop-app` ba commit.
- Ba commit local gần nhất: chuyển toàn bộ extraction sang Docling, thêm trích xuất lại, quản lý BGE-M3/Docling.
- Thay đổi local-only, sửa `EPIPE`, tối ưu chuyển trang và hai tài liệu kế hoạch hiện chưa commit/push.

## 9. Điều kiện hoàn thành sản phẩm

- App không còn auth/user/Supabase/Docker/PostgreSQL/Python runtime cũ.
- Docling và BGE-M3 được cài, kiểm tra, tải lại và xóa an toàn trong app.
- PDF, DOCX, PPTX, EPUB và OCR ảnh hoạt động trên dữ liệu thực tế.
- Tìm kiếm chữ và tìm bằng vùng chọn đều trả nguồn/chunk phù hợp hoặc no-result trung thực.
- File gốc bên ngoài app không bị sửa/xóa; dữ liệu tạm được cleanup.
- Unit, build, standalone smoke và packaged smoke đều đạt.
- Installer không chứa model lớn.
- README, PRD, Plan và Checklist phản ánh đúng sản phẩm cuối trước release.
