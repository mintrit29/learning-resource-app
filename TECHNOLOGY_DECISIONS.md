# Quyết định công nghệ ScholarFlow

## OCR và tìm kiếm tài liệu — ĐÃ KHÓA

- **Ngày chốt:** 20/08/2026
- **Trạng thái:** Đã kiểm thử nghiệm thu thủ công; không thay pipeline/model nếu không có bằng chứng lỗi nghiêm trọng mới.
- **Phạm vi:** Windows 10/11 x64, ứng dụng desktop local-only.

### Công nghệ được giữ

- Docling/docling.rs làm pipeline trích xuất và cấu trúc tài liệu PDF, DOCX, PPTX, EPUB.
- Tesseract local `vie + eng` làm OCR chính cho vùng tìm kiếm và ảnh nhúng, kết hợp tiền xử lý hiện tại: crop ảnh gốc, cắt viền, phóng vùng nhỏ, sparse text, bỏ đường lưới trên bản sao RAM và text-layer supplement khi có.
- BGE-M3 local tạo vector 1.024 chiều; hybrid retrieval kết hợp vector, từ khóa và metadata, sau đó qua relevance gate.
- Nội dung OCR được phép sửa trước khi tìm; app chỉ trả nguồn tương tự, không giải câu hỏi.

### Kết quả nghiệm thu

- Người dùng đã hoàn thành checklist thủ công ngày 20/08/2026: **20/20 luồng chính đạt**.
- PDF, DOCX, PPTX và EPUB đều thêm, xem, trích xuất lại và tìm được.
- Tìm bằng mô tả, ảnh, PDF scan, file nhiều phần, vùng trắng, pan/zoom/chọn vùng, quay lại kết quả và lưu dữ liệu đều hoạt động.
- File hỏng, file quá 40 MB và định dạng không hỗ trợ được chặn/báo rõ, không làm app văng.
- Pipeline mới ổn định hơn các thử nghiệm trước và số ca OCR sai/không nhận diện còn ít, không ảnh hưởng đáng kể đến scope đồ án.

### Giới hạn được chấp nhận

- Có thể sai một số ký hiệu toán phức tạp hoặc chữ rất nhỏ.
- Có thể bỏ sót nhãn ngắn trong bảng, biểu đồ hoặc sơ đồ như `Cạnh âm`, `Tháng 1`, `R1–R4`.
- OCR không cần “hiểu” biểu đồ; mục tiêu là lấy đủ chữ hữu ích để tìm tài liệu tương tự.
- Người dùng có thể sửa query OCR khi gặp sai sót nhỏ.

Các giới hạn trên **không phải lý do để thay model trong MVP**.

### Công nghệ đã thử nhưng không đưa vào app

- Không tích hợp tự động CodeFormulaV2: chính xác hơn ở một số công thức nhưng chậm, không ổn định trên mọi loại ảnh và ảnh nhúng thường bị layout nhận là `picture`.
- Không dùng RapidOCR làm OCR chính: nhanh ở một số biểu đồ tiếng Anh nhưng chất lượng tiếng Việt/công thức không ổn định và có nguy cơ sinh chữ rác.
- Không thêm vision model: tăng dung lượng, RAM và độ phức tạp triển khai vượt nhu cầu hiện tại.

### Điều kiện duy nhất để xem xét thay đổi

Chỉ mở lại quyết định nếu có lỗi thực tế lặp lại làm hỏng chức năng chính và giải pháp mới chứng minh tốt hơn bằng cùng một benchmark gồm tiếng Việt, tiếng Anh, text, bảng, biểu đồ, sơ đồ, công thức và vùng trắng. Đánh giá bắt buộc phải tính cả độ trễ CPU, RAM, dung lượng tải/installer và tỷ lệ sinh chữ rác. Không thay công nghệ chỉ dựa trên một ảnh mẫu hoặc quảng cáo của model.

## Các việc còn lại sau nghiệm thu

Đây là lỗi UX/điều hướng, không liên quan đến việc đổi OCR/model:

1. Link **Mở đoạn liên quan** có truyền `chunk` và render đúng thẻ đoạn khớp, nhưng cuộn bằng fragment `#matched-chunk` chưa ổn định sau điều hướng Next.js; cần chủ động scroll sau khi trang hydrate.
2. Hộp xóa ghi “file gốc” dễ làm người dùng tưởng file bên ngoài máy cũng bị xóa. Cần đổi thành “bản sao trong thư viện ScholarFlow”; file nguồn bên ngoài không bị tác động.
3. Preview PPTX trong công cụ tìm bằng file cần co chữ/bố cục tốt hơn để tránh cảm giác bị cắt hoặc quá lớn.
4. DOCX có thể cuộn bằng con lăn và kéo trang nhưng thanh cuộn khó/không kéo được; cần làm vùng scrollbar dễ tương tác hơn.
5. Nút **Tìm nội dung khác** trùng chức năng xóa query bằng nút X và có thể bỏ để giao diện gọn hơn.

File PDF hỏng bị nhận diện rồi báo “Nội dung file không khớp với định dạng đã chọn” là hành vi đúng, không phải bug.
