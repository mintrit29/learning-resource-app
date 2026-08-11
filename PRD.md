# PRD — ScholarFlow Desktop

**Phiên bản:** 1.0
**Cập nhật:** 10/08/2026
**Trạng thái:** MVP desktop đang hoàn thiện để báo cáo đồ án

## 1. Tổng quan

ScholarFlow là ứng dụng desktop quản lý học liệu thông minh dành cho sinh viên. Sản phẩm giải quyết vấn đề tài liệu học tập nằm rải rác, khó phân loại và khó tìm lại đúng đoạn cần dùng. ScholarFlow biến tài liệu thành một thư viện cục bộ có thể tìm kiếm bằng ngôn ngữ tự nhiên và luôn hiển thị nguồn để người dùng kiểm chứng.

Phiên bản thống nhất của dự án là ứng dụng Windows desktop. Không duy trì bản chạy web riêng và không phụ thuộc Docker, PostgreSQL hay Python ở máy người dùng.

## 2. Mục tiêu

- Tập trung học liệu PDF, DOCX, PPTX và EPUB vào một thư viện.
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

### Quản trị viên cục bộ — giai đoạn tiếp theo

- Quản lý tài khoản được tạo trên cùng thiết bị.
- Xem số lượng và trạng thái tài khoản.
- Thêm, sửa, khóa hoặc xóa tài khoản theo phân quyền.

Dashboard quản trị phải nằm trong ứng dụng desktop nếu được triển khai; không tạo thêm một sản phẩm web admin riêng.

## 4. Phạm vi MVP hiện tại

### 4.1 Tài khoản

- Đăng ký, đăng nhập và đăng xuất.
- Cô lập tài liệu, danh sách môn học, cấu hình AI và lịch sử tìm kiếm theo tài khoản cục bộ.

### 4.2 Quản lý tài liệu

- Nhận file PDF, DOCX, PPTX và EPUB.
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

Khi có nhiều tài liệu, toàn bộ pipeline chạy tuần tự theo hàng đợi cục bộ. PDF có text layer dùng bộ trích xuất native; PDF scan/ảnh mới dùng Docling OCR để giảm thời gian và mức dùng CPU không cần thiết.

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

### 4.6 Môn học và phân loại

- Mỗi tài khoản được khởi tạo một lần với 27 môn chuyên ngành CNTT của Trường Đại học Nguyễn Tất Thành, từ học kỳ 2 đến học kỳ 12.
- Danh sách không bao gồm tiếng Anh và các học phần đại cương hoặc không liên quan trực tiếp đến ngành CNTT.
- Người dùng có toàn quyền thêm, đổi tên, thêm tên gọi khác, xóa và gộp môn học.
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

## 6. Kiến trúc dữ liệu

- SQLite lưu tài khoản cục bộ, metadata, nội dung trích xuất, chunks, jobs, tags và cấu hình AI.
- sqlite-vec lập chỉ mục vector 1.024 chiều.
- File tải lên, database, model cache và log nằm dưới `%APPDATA%\ScholarFlow`.
- BGE-M3 chạy qua Transformers.js và ONNX Runtime trong tiến trình con do Electron quản lý.

## 7. Ngoài phạm vi MVP

- Triển khai ứng dụng như website công khai.
- Docker, PostgreSQL, pgvector hoặc Python embedding service.
- Đồng bộ tài liệu và vector giữa nhiều thiết bị.
- Chatbot tạo câu trả lời dài từ nhiều tài liệu.
- Dashboard quản trị và phân quyền hoàn chỉnh; đây là hạng mục ưu tiên của giai đoạn tiếp theo.

## 8. Tiêu chí nghiệm thu MVP

- Cài và mở ScholarFlow trên Windows mà không cài thêm dịch vụ nền.
- Thêm và xử lý được ít nhất một file thuộc mỗi định dạng hỗ trợ.
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
- OpenRouter và Custom API có thể phát sinh chi phí hoặc giới hạn theo nhà cung cấp.
- Quản lý nhiều người dùng trên nhiều máy cần một kiến trúc đồng bộ khác và chưa thuộc phạm vi desktop local hiện tại.
