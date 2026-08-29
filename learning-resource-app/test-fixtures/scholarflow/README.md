# Bộ test ScholarFlow

> **29/08/2026:** chốt upload audio Small + VAD, bỏ micro tìm kiếm. Xem [phạm vi app](../../../APP_CAPABILITIES.md). Các báo cáo voice/Pho cũ chỉ để đối chiếu lịch sử.

Đây là thư mục test cố định và duy nhất của dự án, dùng cho cả kiểm thử tự động lẫn kiểm thử thủ công ứng dụng desktop trước khi đóng gói hoặc bàn giao.

- Bắt đầu tại `HUONG_DAN_TEST_FULL_SCHOLARFLOW.md`.
- Thử tiếp routing/VAD trước khi chốt: [PHOWHISPER_HYBRID_EVAL_2026-08-28.md](PHOWHISPER_HYBRID_EVAL_2026-08-28.md). Kết quả này dẫn tới bản Small+VAD hiện hành; hybrid Pho không được tích hợp vì làm rơi từ ở file trộn ngắn.
- Thử PhoWhisper riêng, **chưa áp dụng**: [PHOWHISPER_EVAL_2026-08-28.md](PHOWHISPER_EVAL_2026-08-28.md). 22 ca/model: giảm lỗi bài Việt nhưng hỏng tiếng Anh và sinh câu từ nhiễu; giữ nguyên Small cho upload.
- Bản dev hiện dùng Small + VAD cho file âm thanh và không còn micro tìm kiếm: [WHISPER_SMALL_UPLOAD_2026-08-28.md](WHISPER_SMALL_UPLOAD_2026-08-28.md), có hướng dẫn test và giới hạn thực tế.
- Cải thiện upload âm thanh sau thử Base/Small: [CAI_THIEN_UPLOAD_AUDIO_2026-08-28.md](CAI_THIEN_UPLOAD_AUDIO_2026-08-28.md). Đã sửa lặp/chọn ngôn ngữ/chậm; chất lượng chữ tiếng Việt vẫn chưa đạt, voice chưa đổi.
- Kiểm riêng chất lượng thêm âm thanh (28/08): [KIEM_THU_UPLOAD_AUDIO_2026-08-28.md](KIEM_THU_UPLOAD_AUDIO_2026-08-28.md). Bộ file và đáp án tại [06_mindmap_audio/11_audio_quality](06_mindmap_audio/11_audio_quality/README.md); đã tái hiện lỗi sai chữ, lặp và chậm dù báo hoàn tất — chưa đạt.
- Báo cáo lịch sử tính năng giọng nói đã gỡ: [TEST_TIM_GIONG_NOI.md](06_mindmap_audio/TEST_TIM_GIONG_NOI.md). Không dùng tài liệu này để test bản hiện hành.
- Ghi kết quả hoặc tham khảo lần test trước trong `KET_QUA_TEST.md`.
- Audit giao diện nền ngày 28/08 (không chiếm màn hình người dùng): [KIEM_THU_GIAO_DIEN_NEN_2026-08-28.md](KIEM_THU_GIAO_DIEN_NEN_2026-08-28.md), gồm kết quả trên 11 file, lỗi UX và các phần Electron chưa kiểm.
- Báo cáo trên đã bổ sung kết quả sửa UX-01/02/03 và thử lại trên giao diện nền; chạy hồi quy tự động bằng `npm run test:ux-regression` (cũng nằm trong `test:unit`).
- Lượt unhappy path bổ sung (28/08): [KIEM_THU_UNHAPPY_PATH_2026-08-28.md](KIEM_THU_UNHAPPY_PATH_2026-08-28.md) — đã sửa 5 lỗi ban đầu và 3 ca mới về công cụ xem, ảnh hỏng, upload khi rời trang; có bước tái hiện và kết quả kiểm với phản hồi chậm.
- Lượt kiểm mở rộng trước demo (28/08): [KIEM_THU_DEMO_UI_2026-08-28.md](KIEM_THU_DEMO_UI_2026-08-28.md) — **đã sửa DEMO-01…07**, thử lại lỗi dịch vụ/phục hồi trên giao diện và kiểm Hủy xác minh model trong Electron. Đọc kết quả mới ở đầu báo cáo và các khoảng trống; không hiểu “đạt” là mọi tổ hợp đều không có lỗi.
- Lỗi cuộn nhánh XMind đã tái hiện và có ca hồi quy riêng: [TEST_QUAY_LAI_XMIND.md](06_mindmap_audio/TEST_QUAY_LAI_XMIND.md). Cần thử mở xen kẽ file JSON và XML rồi quay lại, không chỉ mở lặp một file.
- `01_library`: bốn tài liệu chuẩn DOCX, PDF, PPTX và EPUB để thêm vào thư viện.
- `02_visual_queries`: ảnh và tài liệu dùng để tìm bằng vùng chọn/OCR.
- `03_negative_cases`: file hỏng, file không hỗ trợ và file vượt 40 MB.
- `03_negative_cases/04_anh_hong.png` là file giả PNG cố ý hỏng: dùng kiểm cảnh báo ảnh và đổi sang ảnh tốt để phục hồi, không dùng kiểm chất lượng OCR.
- `04_batch_upload`: dữ liệu kiểm tra quét cả thư mục và thư mục con.
- `05_ocr_regression`: dữ liệu kiểm thử tự động cho chữ Việt–Anh, bảng, công thức, code, biểu đồ và sơ đồ.
- `06_mindmap_audio`: mind map ảnh, PDF chữ/PDF scan, XMind JSON/XML và audio Việt/Anh. Test mới bắt đầu tại [TEST_PDF_XMIND.md](06_mindmap_audio/TEST_PDF_XMIND.md); file 08 cố ý hỏng để test báo lỗi.
- Kết quả sửa viewer và hồi quy Electron ngày 27/08: [KET_QUA_SAU_SUA_VIEWER.md](06_mindmap_audio/KET_QUA_SAU_SUA_VIEWER.md), có ghi rõ giới hạn bố cục XMind, OCR và audio.
- Không xóa thư mục này khi dọn cache, benchmark, build output hoặc file tạm.
- Ảnh nhúng XMind mới: file 09/10 và [TEST_ANH_NHUNG_XMIND.md](06_mindmap_audio/TEST_ANH_NHUNG_XMIND.md).
- Kết quả cài và kiểm thử EXE 0.1.4 trên máy Windows riêng của GitHub: [KET_QUA_EXE_0.1.4.md](06_mindmap_audio/KET_QUA_EXE_0.1.4.md).
- File kiểm tra vượt 40 MB được giữ sẵn. Chạy `npm run fixtures:manual-large-file` chỉ khi cần tạo lại file đó.

Bản chốt hiện hành: [Small + VAD, giới hạn và test nhanh 29/08](CHOT_SMALL_VAD_VA_GIOI_HAN_2026-08-29.md). Micro tìm kiếm đã gỡ; giữ bộ mẫu/báo cáo cũ làm đối chứng, không xem chúng là hướng dẫn tính năng hiện hành.

Rà giao diện mới nhất và các mục native còn phải acceptance: [KIEM_THU_GIAO_DIEN_CHOT_2026-08-29.md](KIEM_THU_GIAO_DIEN_CHOT_2026-08-29.md).
