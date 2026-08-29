# PRD — ScholarFlow Desktop

**Phiên bản:** 1.0
**Cập nhật:** 21/08/2026
**Trạng thái:** MVP desktop local-only đã hoàn thiện chức năng, đang xác nhận bản đóng gói cuối

## 1. Tổng quan

ScholarFlow là ứng dụng desktop quản lý học liệu thông minh dành cho sinh viên. Sản phẩm giải quyết vấn đề tài liệu học tập nằm rải rác, khó phân loại và khó tìm lại đúng đoạn cần dùng. ScholarFlow biến tài liệu thành một thư viện cục bộ có thể tìm kiếm bằng ngôn ngữ tự nhiên và luôn hiển thị nguồn để người dùng kiểm chứng.

Phiên bản thống nhất của dự án là ứng dụng Windows desktop. Không duy trì bản chạy web riêng và không phụ thuộc Docker, PostgreSQL hay Python ở máy người dùng.

## 2. Mục tiêu

- Tập trung học liệu PDF, DOCX, PPTX, EPUB, XMind, ảnh mind map và audio vào một thư viện.
- Tự động trích xuất, chia đoạn và lập chỉ mục nội dung.
- Hỗ trợ tìm nguồn theo ý nghĩa, không chỉ theo từ khóa chính xác.
- Tự động gợi ý metadata để giảm thao tác phân loại thủ công.
- Giữ tài liệu, vector và lịch sử tìm kiếm trên máy người dùng.
- Đóng gói thành bộ cài Windows có thể sử dụng mà không cần môi trường lập trình.

## 3. Người dùng mục tiêu

### Sinh viên

- Lưu tài liệu môn học và tài liệu tham khảo.
- Tìm nhanh đoạn phù hợp cho bài tập, báo cáo hoặc ôn tập.
- Lọc tài liệu theo môn học, độ khó và định dạng.

Ứng dụng phục vụ một thư viện cục bộ trên máy đang dùng. MVP không có tài khoản, đăng nhập, phân quyền hoặc dashboard quản trị.

## 4. Phạm vi MVP hiện tại

### 4.1 Thư viện local-only

- Mở thẳng vào ứng dụng, không đăng ký hoặc đăng nhập.
- Tài liệu, môn học, cấu hình AI và lịch sử tìm kiếm thuộc một thư viện duy nhất trên máy.
- File gốc bên ngoài ScholarFlow không bị sửa hoặc xóa; ứng dụng chỉ quản lý bản sao đã nhập.

### 4.2 Quản lý tài liệu

- Nhận file PDF, DOCX, PPTX, EPUB, XMind JSON/XML, ảnh PNG/JPG/JPEG/WebP và âm thanh MP3/WAV/M4A.
- Nhận nhiều file hoặc một thư mục trong cùng lượt; bỏ qua file sai định dạng và báo trạng thái riêng từng file.
- Kiểm tra loại file, kích thước và tên file trước khi lưu.
- Hiển thị thư viện, chi tiết, trạng thái và tiến trình xử lý.
- Xem/tải file gốc và xem nội dung đã trích xuất.
- Xóa tài liệu cùng chunk và vector liên quan.
- Thử lại bước còn thiếu hoặc phân tích AI lại.

### 4.3 Pipeline xử lý

```text
Thêm file
  → Trích xuất nội dung
  → Chia thành đoạn có vị trí nguồn
  → Tạo vector BGE-M3 local
  → Phân tích metadata bằng AI nếu đã cấu hình
  → Đưa vào thư viện và tìm kiếm
```

Mỗi bước có trạng thái `PENDING`, `PROCESSING`, `COMPLETED` hoặc `FAILED`. Lỗi phải được rút gọn thành thông báo dễ hiểu, không đưa stack trace, HTML hoặc mã nguồn lên giao diện.

Khi có nhiều tài liệu, toàn bộ pipeline chạy tuần tự theo hàng đợi cục bộ. PDF, DOCX, PPTX và EPUB đều đi qua Docling.rs; text native được giữ và ảnh nhúng/PDF scan được bổ sung OCR Việt–Anh theo pipeline ổn định của ứng dụng. Ảnh mind map dùng OCR Việt–Anh; audio được FFmpeg giải mã và Whisper Small + Silero VAD chép lời Việt/Anh kèm mốc thời gian. Tất cả đầu vào sau đó dùng chung pipeline chunk và BGE-M3.

### 4.4 AI phân tích tài liệu

- Hỗ trợ OpenRouter, Ollama chạy trên máy và Custom API tương thích chat completions.
- Cho phép thêm, sửa, kiểm tra, đặt mặc định và xóa kết nối.
- Phân tích độ khó, ngôn ngữ, tóm tắt và chọn một môn học từ danh sách hiện có.
- AI chỉ trả về mã môn học đang được phép phân loại hoặc `null`; server kiểm tra lại mã và chỉ tự gắn khi độ tin cậy đạt từ 75%.
- Nếu tài liệu không phù hợp rõ ràng với môn nào, tài liệu được giữ ở trạng thái “Chưa phân loại”; AI không được tạo môn học mới.
- API key được mã hóa trước khi lưu.
- Lỗi phổ biến cần được nhận diện: URL/model sai, API key sai, không đủ quyền, hết hạn mức, quá tải, timeout và mất kết nối.

AI phân tích metadata là tùy chọn. Embedding tìm kiếm luôn dùng BGE-M3 local và không phụ thuộc Ollama.

### 4.5 Tìm kiếm học liệu

- Nhận câu truy vấn tự nhiên bằng tiếng Việt hoặc tiếng Anh.
- Kết hợp vector BGE-M3, từ khóa và metadata.
- Cho phép lọc theo môn học, “Chưa phân loại”, độ khó, loại file và thời gian.
- Chỉ hiển thị kết quả đủ liên quan.
- Mỗi tài liệu lấy đoạn phù hợp nhất để tránh lặp kết quả.
- Hiển thị tiêu đề, đoạn trích, lý do phù hợp, trang/slide/mục và liên kết mở nguồn.

Tìm kiếm hiện tại là tìm nguồn tham khảo, không phải chatbot sinh câu trả lời thay cho tài liệu.

Ngoài truy vấn chữ, người dùng có thể mở ảnh, PDF, DOCX, PPTX hoặc EPUB, khoanh trực tiếp một vùng và dùng nội dung OCR có thể chỉnh sửa làm truy vấn. Ứng dụng giữ vùng chọn, OCR và kết quả tạm thời khi mở nguồn rồi quay lại; không nhập file truy vấn vào thư viện và không tự giải bài tập.

### 4.6 Môn học và phân loại

- Thư viện được khởi tạo một lần với 27 môn chuyên ngành CNTT của Trường Đại học Nguyễn Tất Thành, từ học kỳ 2 đến học kỳ 12.
- Danh sách không bao gồm tiếng Anh và các học phần đại cương hoặc không liên quan trực tiếp đến ngành CNTT.
- Người dùng có toàn quyền thêm, đổi tên và xóa môn học.
- AI chỉ được chọn trong danh sách môn học đang được người dùng cho phép phân loại, không được tự tạo tên mới.
- Tài liệu không đạt ngưỡng phù hợp được giữ ở trạng thái “Chưa phân loại” để người dùng xem và gắn thủ công.
- Khi xóa một môn học, tài liệu đang thuộc môn đó không bị xóa mà chuyển về “Chưa phân loại”.
- Các chủ đề cũ tồn tại trước bản nâng cấp không tự động được AI sử dụng; tài liệu liên quan chuyển về “Chưa phân loại”, còn người dùng có thể chỉnh sửa chủ đề cũ để xác nhận và bật lại.

### 4.7 Dashboard

- Thống kê số tài liệu, tài liệu sẵn sàng và môn học.
- Hiển thị tài liệu mới thêm và thao tác nhanh.
- Phản ánh đúng trạng thái xử lý của thư viện cục bộ.

### 4.8 Thông tin dự án

- Header toàn ứng dụng hiển thị tên đề tài, khoa và nhóm thực hiện.
- Footer hiển thị đơn vị đào tạo, giảng viên hướng dẫn, email, GitHub và phiên bản ứng dụng.
- Mục “Về dự án” cung cấp đầy đủ thành viên và mã số sinh viên mà không làm rối nội dung chính.
- Thông tin dự án hiển thị phù hợp trên cả màn hình desktop và màn hình nhỏ.

## 5. Yêu cầu phi chức năng

### Hiệu năng

- Giao diện không bị khóa trong lúc xử lý tài liệu.
- Có tiến độ, tốc độ và thời gian ước tính khi tạo embedding.
- Tái sử dụng model cache giữa các lần mở ứng dụng.

### Bảo mật và riêng tư

- Dịch vụ nội bộ chỉ lắng nghe trên `127.0.0.1`.
- Electron bật context isolation, sandbox và tắt node integration trong renderer.
- Không commit `.env`, API key, database, file người dùng, model cache hoặc file cài đặt.
- Chỉ mở URL ngoài bằng HTTPS qua trình duyệt hệ thống.

### Độ tin cậy

- Electron tự khởi động và tự dừng Next.js nội bộ cùng embedding runtime.
- SQLite migration chạy lặp lại an toàn.
- Có thể thử lại bước xử lý bị lỗi mà không cần thêm lại tài liệu.

### Khả năng triển khai

- Hỗ trợ Windows 10/11 x64 trong MVP.
- Phát hành bằng bộ cài NSIS trên GitHub Releases.
- Người dùng cuối không cần Node.js, Docker, PostgreSQL hoặc Python.
- BGE-M3, Docling và Whisper không nằm trong installer; app cho phép tải, kiểm tra, tải lại hoặc xóa từ nguồn/version cố định có kiểm tra SHA-256. Whisper là tùy chọn và chỉ cần cho audio.

## 6. Kiến trúc dữ liệu

- SQLite lưu metadata, nội dung trích xuất, chunks, jobs, tags, lịch sử tìm kiếm và cấu hình AI; không lưu tài khoản hoặc mật khẩu.
- sqlite-vec lập chỉ mục vector 1.024 chiều.
- File tải lên, database, model cache và log nằm dưới `%APPDATA%\ScholarFlow`.
- BGE-M3 chạy qua Transformers.js và ONNX Runtime trong tiến trình con do Electron quản lý.
- Whisper Small + Silero VAD chạy trong cùng runtime model cục bộ; FFmpeg nằm trong package để giải mã audio mà không yêu cầu người dùng cài riêng.

## 7. Ngoài phạm vi MVP

- Triển khai ứng dụng như website công khai.
- Docker, PostgreSQL, pgvector hoặc Python embedding service.
- Đồng bộ tài liệu và vector giữa nhiều thiết bị.
- Chatbot tạo câu trả lời dài từ nhiều tài liệu.
- Tài khoản, đăng nhập, dashboard quản trị và phân quyền.

## 8. Tiêu chí nghiệm thu MVP

- Cài và mở ScholarFlow trên Windows mà không cài thêm dịch vụ nền.
- Thêm và xử lý được ít nhất một file thuộc mỗi định dạng hỗ trợ.
- Khoanh vùng trên ảnh/file, nhận OCR có thể sửa và tìm được nguồn tương tự hoặc no-result trung thực.
- Tạo được vector BGE-M3 1.024 chiều khi các dịch vụ cũ đã dừng/gỡ bỏ.
- Tìm được tài liệu liên quan bằng truy vấn tự nhiên và mở đúng vị trí nguồn.
- Kết nối, sửa và kiểm tra được ít nhất một nhà cung cấp AI.
- AI chỉ gắn một môn học hiện có hoặc để tài liệu ở “Chưa phân loại”; không tạo môn mới.
- Thông báo lỗi AI ngắn gọn và không làm lộ chi tiết kỹ thuật.
- Dữ liệu được giữ sau khi đóng và mở lại ứng dụng.
- Unit test, lint, production build và packaged smoke test đều đạt trước khi phát hành.

## 9. Rủi ro và giới hạn

- BGE-M3 chạy CPU có thể chậm với tài liệu rất lớn.
- Lần đầu cần tải model khoảng 2,1 GB và phụ thuộc tốc độ mạng.
- OCR tiếng Việt/Anh trên bản scan mờ, công thức viết tay hoặc biểu đồ phức tạp có thể chưa chính xác hoàn toàn.
- OCR mind map ảnh/PDF chỉ lập chỉ mục phần chữ, chưa suy luận đường nối. XMind đọc cây cha-con, ghi chú/nhãn và OCR ảnh nhúng PNG/JPEG/WebP; xem trước dạng nhánh tự sắp xếp. Không đọc liên kết ảnh ngoài, file đính kèm khác, liên kết chéo hoặc file có mật khẩu. Giới hạn XMind: 25 MB, 200 sơ đồ, 5.000 nhánh, 64 cấp, 8 MB chữ sau giải nén; ảnh tối đa 8 MB/ảnh, 32 MB tổng, 100 lượt và 16 MP/ảnh. Whisper Small + Silero VAD có thể sai cả từ tiếng Việt thông thường, tên riêng, thương hiệu, giọng nhiễu hoặc nhiều người nói; VAD bỏ đoạn không lời, không sửa từ nghe sai. Mốc nguồn theo đoạn, không theo từ; không có micro tìm kiếm. Audio giới hạn 25 MB và 60 phút.
- OpenRouter và Custom API có thể phát sinh chi phí hoặc giới hạn theo nhà cung cấp.
- OCR bảng, nhãn biểu đồ và công thức ảnh phức tạp có thể chưa hoàn hảo; MVP cho phép sửa query trước khi tìm và không tích hợp model công thức thử nghiệm thiếu ổn định.

Phạm vi và giới hạn hiện hành được công khai tại [APP_CAPABILITIES.md](APP_CAPABILITIES.md) và [README.md](README.md), không có trang giới thiệu phạm vi riêng trong app. Không coi văng app, mất dữ liệu, kẹt tiến trình hoặc hoàn tất rỗng là giới hạn nhận dạng được chấp nhận.
