# Bộ test ScholarFlow

Đây là thư mục test cố định và duy nhất của dự án, dùng cho cả kiểm thử tự động lẫn kiểm thử thủ công ứng dụng desktop trước khi đóng gói hoặc bàn giao.

- Bắt đầu tại `HUONG_DAN_TEST_FULL_SCHOLARFLOW.md`.
- Ghi kết quả hoặc tham khảo lần test trước trong `KET_QUA_TEST.md`.
- `01_library`: bốn tài liệu chuẩn DOCX, PDF, PPTX và EPUB để thêm vào thư viện.
- `02_visual_queries`: ảnh và tài liệu dùng để tìm bằng vùng chọn/OCR.
- `03_negative_cases`: file hỏng, file không hỗ trợ và file vượt 40 MB.
- `04_batch_upload`: dữ liệu kiểm tra quét cả thư mục và thư mục con.
- `05_ocr_regression`: dữ liệu kiểm thử tự động cho chữ Việt–Anh, bảng, công thức, code, biểu đồ và sơ đồ.
- `06_mindmap_audio`: mind map ảnh, PDF chữ/PDF scan, XMind JSON/XML và audio Việt/Anh. Test mới bắt đầu tại [TEST_PDF_XMIND.md](06_mindmap_audio/TEST_PDF_XMIND.md); file 08 cố ý hỏng để test báo lỗi.
- Kết quả sửa viewer và hồi quy Electron ngày 27/08: [KET_QUA_SAU_SUA_VIEWER.md](06_mindmap_audio/KET_QUA_SAU_SUA_VIEWER.md), có ghi rõ giới hạn bố cục XMind, OCR và audio.
- Không xóa thư mục này khi dọn cache, benchmark, build output hoặc file tạm.
- Ảnh nhúng XMind mới: file 09/10 và [TEST_ANH_NHUNG_XMIND.md](06_mindmap_audio/TEST_ANH_NHUNG_XMIND.md).
- Kết quả cài và kiểm thử EXE 0.1.4 trên máy Windows riêng của GitHub: [KET_QUA_EXE_0.1.4.md](06_mindmap_audio/KET_QUA_EXE_0.1.4.md).
- File kiểm tra vượt 40 MB được giữ sẵn. Chạy `npm run fixtures:manual-large-file` chỉ khi cần tạo lại file đó.
