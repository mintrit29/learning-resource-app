# Kiểm tra riêng THÊM TÀI LIỆU ÂM THANH — 28/08/2026

> Đây là baseline trước sửa. Xem [kết quả cải thiện và giới hạn còn lại](CAI_THIEN_UPLOAD_AUDIO_2026-08-28.md) cho phiên bản mới; giữ số liệu dưới đây để đối chiếu.

## Kết luận

**Upload/giải mã/lưu nội dung hoạt động, nhưng chất lượng chép lời tiếng Việt chưa đạt.** Đã tái hiện sai chữ, sinh nội dung không liên quan, chọn đầu ra tiếng Anh cho bài nói tiếng Việt và lặp nhiều lần; app vẫn đánh dấu trích xuất hoàn tất. Không thể kết luận phần thêm âm thanh đã tốt chỉ vì thử mẫu ngắn cũ thành công.

Lượt này chỉ chẩn đoán và bổ sung bộ test. Không đổi model, sửa runtime hay chỉnh chức năng tìm kiếm.

## Phạm vi và môi trường

- 17 ca khác nhau: câu ngắn MP3/WAV/M4A, bài Việt dài 50,6 giây ở ba định dạng, bài Anh 65,35 giây, bài ghép Việt rồi Anh 115,99 giây, hai mẫu cũ, một từ ngắn, im lặng/nhiễu và file hỏng/rỗng. Có thêm một lượt short-vi.m4a trùng khi khởi động lại QA; báo cáo chính dùng lượt thứ hai.
- Upload thực qua `/api/documents/upload`, đọc trạng thái job, textContent, chunks và mốc thời gian trong SQLite QA. Không gọi API tìm kiếm.
- Kiểm bằng Browser: giao diện upload ghi rõ MP3/WAV/M4A; mở danh sách/chi tiết, mở nội dung đã trích xuất, xác nhận văn bản lặp và lỗi file hỏng xuất hiện trên giao diện; quay lại thư viện được. Upload hàng loạt thực hiện bằng API, không giả nhận đã thao tác file chooser từng file.
- Server web dùng bản standalone đã build từ mã ứng dụng, thư viện riêng `.tmp/audio-upload-audit-20260828/data`. Whisper Base q8 và FFmpeg thật, model sẵn có, không tải model mới.
- Những ca đầu dùng BGE-M3 thật. Sau ca WAV chậm, chuyển sang runtime QA riêng với **embedding giả lập**, còn Whisper/FFmpeg vẫn thật. Không dùng kết quả embedding của phần sau để khẳng định chất lượng tìm kiếm; tìm kiếm nằm ngoài phạm vi.
- Không cấu hình AI cloud trong QA; bước phân loại/tóm tắt được SKIPPED đúng thiết kế. Không gửi file hoặc giọng người dùng lên mạng. Các bài mới là giọng tổng hợp từ văn bản tự viết, không phải kiểm mic/giọng thật.

## Kết quả

| Ca | Kết quả quan sát |
|---|---|
| short-vi.mp3 | Câu 8 từ/âm tiết chép sai 7 phép sửa từ; vẫn READY. |
| short-vi.wav | Câu 3 giây sinh 1.337 ký tự, lặp từ “thích”; xử lý ~29 giây; vẫn READY. |
| short-vi.m4a | Câu ngắn chép sai 7/8 phép sửa từ; vẫn READY. |
| lecture-vi.mp3 | Giữ được câu cuối nhưng nhiều từ sai và lặp cuối đoạn; 57 phép sửa trên 150 từ/âm tiết; trích xuất ~34 giây. |
| lecture-vi.wav | Bài Việt thành nội dung tiếng Anh sai nghĩa, lặp rất dài (2.948 ký tự); trích xuất ~242 giây rồi vẫn READY. |
| lecture-vi.m4a | Bài Việt thành tiếng Anh sai nghĩa và lặp; ~74 giây rồi READY. |
| lecture-en.mp3 | Khớp toàn bộ 123 từ sau bỏ khác biệt hoa/thường/dấu câu; giữ câu đầu/cuối; trích xuất ~26 giây. Chỉ kết luận trên mẫu này. |
| mixed.m4a | Hoàn tất sau ~121 giây, nhưng nhiều nội dung sai/lặp; có câu cuối không chứng minh phần giữa đúng. |
| baseline-vi.mp3 | Nhận các từ khóa quen thuộc nhưng “ScholarFlow” thành “Cô la Phông”. |
| baseline-en.wav | Nội dung chính đúng; tên riêng thành “scholar flow”. |
| database.mp3 | FAILED với thông báo không đủ lời nói: pipeline AUDIO yêu cầu ít nhất 20 ký tự, không phải không hỗ trợ MP3. |
| silence.wav / silence.m4a / noise.wav | Cả ba FAILED, không lưu text/chunks. Đây là mẫu im lặng/nhiễu trắng cụ thể, không bảo đảm mọi loại tiếng nền đều an toàn. |
| corrupt.mp3 | Nhận upload 202 vì có chữ ký ID3; decoder thất bại, job chuyển FAILED, không kẹt. Giao diện còn lộ lỗi kỹ thuật FFmpeg và đường dẫn tạm. |
| wrong-format.mp3 | HTTP 415, không tạo tài liệu. |
| empty.wav | HTTP 413, không tạo tài liệu. |

Sai số từ ở đây tính bằng khoảng trắng; tiếng Việt thực tế là nhiều đơn vị âm tiết. Số phép sửa có thể vượt số từ nguồn khi có nhiều nội dung chèn/lặp. Không dùng các số này như độ chính xác tổng quát của model.

## Diễn biến ca chậm — tránh nhầm “kẹt vĩnh viễn”

- lecture-vi.wav còn EXTRACTING ở mốc 180 giây. Đã dừng script gửi thêm để tránh hàng đợi kéo dài. Kiểm lại SQLite: EXTRACT_TEXT bắt đầu 13:57:32 UTC, kết thúc 14:01:34 UTC, tức ~242 giây. Nó **có hoàn tất**, nhưng chậm và nội dung sai nghiêm trọng.
- Đã kiểm thư viện thật không có job PENDING/PROCESSING rồi khởi động lại phiên dev do agent mở. App thật được mở lại tại cổng 61734; phần QA còn lại chuyển sang dịch vụ riêng.
- mixed.m4a còn EXTRACTING ở mốc 120 giây; khi chốt báo cáo nó vừa hoàn tất ở ~121 giây. Kết quả cuối được lấy lại từ DB, không giữ kết luận timeout ban đầu là kết quả cuối.
- Sau cùng đã đóng tab và dịch vụ QA. Không xóa hoặc chỉnh tài liệu trong thư viện thật.

## Kiểm lưu/hiển thị file

- Chữ lặp/sai đã nằm trong `textContent` và hiển thị nguyên trên trang chi tiết, không phải chỉ lỗi hiển thị hoặc lỗi tìm kiếm.
- Tải `.txt` của bốn tài liệu mẫu trả 200, nội dung khớp DB sau bỏ dòng tiêu đề tên file; không có lỗi mất text khi xuất.
- Endpoint file trả đúng MIME cho MP3/WAV/M4A. Yêu cầu Range hiện nhận 200/toàn bộ file thay vì 206; đây là quan sát về phục vụ media, chưa kết luận thao tác tua bị hỏng. Chưa kiểm nghe/tua thực tế trong lượt này.

## Những việc cần sửa / thử tiếp (chưa triển khai)

1. Thay cách chọn Việt/Anh theo đếm từ/dấu; kiểm trên bài dài, không chỉ từ đơn. Cùng bài Việt sau đổi mã hóa có thể nhận ra đầu ra khác nhau, nên không gán lỗi đơn giản cho phần mở định dạng.
2. Có cơ chế phát hiện bản chép lặp bất thường và xử lý lại/báo cần kiểm tra; không coi đủ 20 ký tự là đủ chất lượng. Không dùng AI tự viết lại để che lỗi nhận dạng.
3. Đánh giá giải mã/model tiếng Việt bằng toàn bộ câu và đoạn, gồm điểm nối quá 30 giây. Nâng model chỉ khi đo được cải thiện.
4. Kiểm soát thời gian xử lý và hàng đợi; một file chậm không nên làm người dùng tưởng app bị treo.
5. Thông báo MP3 hỏng nên dễ hiểu, giữ lỗi kỹ thuật trong log. Xem xét lại giới hạn 20 ký tự riêng cho tài liệu audio ngắn.

## Bộ dữ liệu giữ lại

- [File mẫu và cách thử](06_mindmap_audio/11_audio_quality/README.md)
- [Văn bản đúng của hai bài dài](06_mindmap_audio/11_audio_quality/expected.json)
- [Kết quả thực tế chi tiết](06_mindmap_audio/11_audio_quality/results.json)

Script chẩn đoán tạm nằm ở `.tmp/voice-language-audit/`: generate-upload.py, upload-server.mjs, upload-audit.mjs, finalize-upload.mjs. Không cần các script tạm để test thủ công bằng bộ file đã giữ. Chưa kiểm file âm thanh dài hàng giờ, mọi loại tiếng ồn, mọi giọng địa phương hoặc sự cố thiết bị/mic trong lượt này. Không có commit/push/EXE mới.
