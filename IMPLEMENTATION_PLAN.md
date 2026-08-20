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

**Trạng thái:** đã hoàn thiện và QA thủ công ngày 20/08/2026. Luồng ảnh/file → chọn/resize vùng → OCR Việt–Anh → hybrid search, zoom, lazy preview nhiều phần và crop nhiều DPI đã có; full lint/unit/build/standalone/package smoke đều đạt. Checklist thủ công đạt 20/20. Pipeline OCR/search hiện tại đã khóa trong `TECHNOLOGY_DECISIONS.md`; không tiếp tục đổi model trong scope MVP.

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
- Với preview HTML của DOCX/PPTX/EPUB, con lăn và thao tác kéo được chuyển tiếp vào vùng cuộn bên trong khi vùng ngoài đã chạm biên; người dùng không bị kẹt ở trang/phần đầu.
- Zoom từ mức `Vừa khung` đến 200%, giữ đúng tỉ lệ ảnh, giữ vị trí logic của vùng chọn và hỗ trợ `Ctrl + lăn chuột`; PDF tiếp tục dùng điều khiển native của Chromium.
- Với đầu vào là ảnh, vùng OCR được crop trực tiếp từ ảnh gốc theo tọa độ native thay vì chụp lại pixel đang hiển thị; OCR dùng chế độ phân đoạn sparse text để đọc nhãn rời trong bảng, biểu đồ và sơ đồ tốt hơn.
- OCR vùng chọn dùng hai model Tesseract local Việt–Anh: tiếng Việt giữ dấu và văn bản chính, tiếng Anh sửa các dòng công thức/mã kỹ thuật khi có cấu trúc đáng tin cậy hơn. Ảnh có lưới dài được tạo thêm một bản sao RAM đã bỏ đường kẻ để OCR đủ tiêu đề và ô bảng; ảnh gốc không bị thay đổi.
- Không tự ghép mã/nhãn từ các tile nhỏ của sơ đồ vào query vì thử nghiệm thực tế sinh chữ rác và làm sai kết quả. Vùng OCR có độ tin cậy hoặc lượng chữ hữu ích quá thấp được yêu cầu chọn lại thay vì tự tìm.
- Pipeline OCR dùng chung bước cắt viền trắng và phóng vùng nhỏ trước khi nhận dạng. Khi nhập tài liệu, ảnh nhúng trong PDF cũng được OCR như DOCX/PPTX/EPUB; text layer gốc vẫn được giữ.
- Tesseract Việt–Anh hiện đọc tốt chữ thường, bảng và nhãn biểu đồ nhưng chưa đáng tin cậy với công thức toán phức tạp dạng ảnh. CodeFormulaV2 là hướng tiếp theo, nhưng binding Node của `docling.rs` đang dùng chưa công khai tùy chọn formula enrichment nên chưa thể chỉ tải model rồi bật lên.
- Probe ngày 18/08/2026 với `docling.rs` CLI 1.12 và CodeFormulaV2 INT8 xác nhận model đọc đúng cả ba fixture công thức Gaussian, hồi quy tuyến tính và Bayes/entropy thành LaTeX (khoảng 18–37 giây/ảnh trên CPU, gồm thời gian nạp model của tiến trình thử). Pipeline tài liệu mặc định vẫn bỏ sót vì layout gắn ảnh công thức nhúng là `picture`, không phải `formula`; hướng tích hợp phải gọi CodeFormula trực tiếp cho crop/vùng ảnh phù hợp hoặc mở API tương ứng trong Node binding, không chỉ bật `--enrich-formula` toàn tài liệu.
- Benchmark mở rộng ngày 18/08/2026: CodeFormulaV2 giữ đúng ý nghĩa 10/12 công thức tổng hợp và đúng 3/3 ảnh công thức thực tế; hai lỗi là công thức Fourier bị sai cận/số mũ và phép tích sinh thừa ký tự. Fixture PDF chính thức được enrichment đúng 1/1, nhưng bốn file stress-test thực tế đều trả `0` item `formula`: DOCX/PPTX/EPUB giữ ảnh dưới dạng `picture`, còn PDF bỏ qua ba ảnh công thức và chỉ giữ hai biểu đồ. Pipeline app dùng Tesseract cho ảnh nhúng chỉ đọc gần đúng Bayes/entropy, làm hỏng OLS và bỏ mất Gaussian, nên chưa đạt tiêu chí trích xuất công thức ảnh đầy đủ.
- Thử nghiệm đối chứng ngày 18/08/2026 bác bỏ việc thay toàn bộ OCR bằng RapidOCR PP-OCRv6 small: model đọc đúng 18/18 marker tiếng Anh ở hai biểu đồ và chạy khoảng 0,94–2,06 giây/ảnh, nhưng chỉ khớp nghiêm ngặt 0/5 marker ở ảnh câu hỏi tiếng Việt, làm rơi nhiều dấu dù confidence gần 0,98 và sinh `O Q O O` trên ảnh trắng. Tesseract Việt–Anh hiện tại tiếp tục là OCR chữ chính; RapidOCR chưa được thêm vào thành phần phát hành.
- PP-FormulaNet_plus-S (247,6 MiB) chạy nhanh, nạp khoảng 5,96 giây và nhận từng công thức trong 0,59–1,25 giây, nhưng chỉ đúng ý nghĩa 8/15 ảnh cùng bộ test so với CodeFormulaV2 13/15. Model sai Gaussian/chuỗi/ma trận/Fourier, sai ít nhất một thành phần quan trọng ở cả ba ảnh thực tế và sinh LaTeX rác dài khi nhận nhầm biểu đồ. Vì vậy kiến trúc chốt là Docling cho layout/text/bảng native, Tesseract cho OCR chữ/bảng/nhãn và CodeFormulaV2 chỉ cho ROI hoặc ảnh nhúng đã qua phát hiện công thức; không chạy formula model cho mọi ảnh.
- Regression suite bổ sung ngày 18/08/2026 tạo 16 ảnh có ground truth và một DOCX chứa text/bảng native cùng 11 ảnh nhúng; cộng tám ảnh thực tế cục bộ thành 24 ca routing. Router thử nghiệm phân đúng 24/24, nhưng Tesseract chính chỉ giữ 24/32 marker OCR: thiếu một từ Anh, một tiêu đề bảng, một nhãn tháng, bốn node trong sơ đồ và `Infinity`. RapidOCR bù 6/8 marker còn thiếu nhưng tiếp tục mất dấu Việt/sinh rác trên ảnh trắng; Tesseract tiếng Anh raw đã đọc đúng `documents` và `Infinity`, cho thấy ưu tiên sửa merge theo dòng/vị trí trước khi thêm runtime OCR mới.
- CodeFormula trên sáu ảnh công thức mới chỉ đúng bốn ảnh nguyên vẹn: OLS sai phân số và ảnh entropy có chú thích không trả kết quả sau hơn ba phút. Bỏ chú thích giúp entropy đúng, nhưng tách OLS thành hai crop vẫn làm sai phân số và biến `y` thành chỉ số dưới `Y`. DOCX stress giữ đủ 8/8 marker native nhưng năm trong sáu nhóm công thức ảnh không đạt. Vì vậy hướng hybrid là khả thi có điều kiện, chưa đủ để tích hợp tự động: cần crop/segmentation, timeout cứng, validation/fallback và UI cho sửa kết quả; không được coi LaTeX của model là ground truth.
- Kiểm tra end-to-end bổ sung ngày 18/08/2026 trên ba ca đại diện xác nhận crop bậc hai đúng sau 18 giây, crop entropy đúng sau 18 giây, còn crop R² mất hơn 30 giây và vẫn biến phân số thành căn. Do lỗi R² tạo ra LaTeX hợp lệ, validation cú pháp không thể phát hiện sai nghĩa; CodeFormula chưa được bật tự động. Router 24/24 đã được chuyển từ script thử nghiệm vào mã app và dùng để chấp nhận query công thức ngắn, đồng thời vẫn chặn vùng trắng/rác. Tesseract tiếp tục là fallback và không bị ghi đè.
- Pipeline ổn định ngày 19/08/2026 không thêm model mới: router được dùng cả khi nhập tài liệu; ảnh công thức ngắn/độ tin cậy thấp vẫn được giữ thành section riêng thay vì bị ngưỡng 20 ký tự loại mất. PDF có text layer lấy trực tiếp XObject ảnh qua PDF.js nên stress PDF tăng từ 2/5 lên 5/5 ảnh được OCR (ba công thức, hai biểu đồ); trang scan toàn trang được loại trùng và chỉ OCR một lần. Ghép Việt–Anh giữ thêm `documents` và `Infinity`; bộ marker OCR tăng từ 24/32 lên 26/32, router giữ 24/24.
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
