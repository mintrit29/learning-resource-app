# Bộ test ScholarFlow

Đây là thư mục test cố định và duy nhất của dự án, dùng cho cả kiểm thử tự động lẫn kiểm thử thủ công ứng dụng desktop trước khi đóng gói hoặc bàn giao.

- Bắt đầu tại `HUONG_DAN_TEST_FULL_SCHOLARFLOW.md`.
- Ghi kết quả hoặc tham khảo lần test trước trong `KET_QUA_TEST.md`.
- `01_library`: bốn tài liệu chuẩn DOCX, PDF, PPTX và EPUB để thêm vào thư viện.
- `02_visual_queries`: ảnh và tài liệu dùng để tìm bằng vùng chọn/OCR.
- `03_negative_cases`: file hỏng, file không hỗ trợ và file vượt 40 MB.
- `04_batch_upload`: dữ liệu kiểm tra quét cả thư mục và thư mục con.
- `05_ocr_regression`: dữ liệu kiểm thử tự động cho chữ Việt–Anh, bảng, công thức, code, biểu đồ và sơ đồ.
- Không xóa thư mục này khi dọn cache, benchmark, build output hoặc file tạm.
- File kiểm tra vượt 40 MB được giữ sẵn. Chạy `npm run fixtures:manual-large-file` chỉ khi cần tạo lại file đó.
