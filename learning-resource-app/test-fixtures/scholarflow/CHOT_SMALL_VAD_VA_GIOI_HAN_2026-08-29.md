# Chốt Small + VAD và giới hạn tính năng — 29/08/2026

## Bản hiện hành

- Upload/trích xuất lại MP3, WAV, M4A dùng Whisper Small Q8 + Silero VAD local; không dùng Pho. VAD bỏ cửa sổ không có lời nói, không sửa từ nghe sai hay khử mọi loại nhiễu.
- Đã bỏ tìm kiếm bằng micro, endpoint voice, quyền microphone và thẻ Whisper Base. Cache Base cũ không bị xóa, nhưng không được dùng. Thư viện người dùng không bị chỉnh sửa trong lần kiểm này.
- Giữ cửa sổ xử lý tối đa 30 giây đã kiểm; mốc nguồn theo đoạn, không chính xác từng từ. File tối đa 25 MB/60 phút.
- Thành phần Small có thêm VAD ~2,3 MB, pin revision/SHA-256. Cài lại tái sử dụng các file Small hợp lệ. Đã kiểm cài bổ sung trên cache hiện có: trạng thái ready.
- Theo chốt lại sau lượt kiểm này, đã gỡ mục **Chức năng và giới hạn** cùng các khối ghi chú giới hạn mới thêm trên giao diện. Nội dung 7 nhóm tính năng được giữ ở [bảng phạm vi chung](../../../APP_CAPABILITIES.md) và README. Các kết quả kiểm GUI bên dưới là lịch sử trước thay đổi này.

## Kết quả thực chạy

Chạy bản production standalone, SQLite/thư viện thử riêng, Small + VAD và BGE-M3 thật; không mock nhận dạng/vector. Không bật AI trực tuyến và không tạo EXE.

| Kiểm tra | Kết quả |
| --- | --- |
| 26 file qua API upload → hàng đợi → DB/chunk/vector | Đạt: 14 READY, 10 FAILED có kiểm soát, 2 từ chối ngay khi upload |
| File có lời nói Việt, Anh, trộn; MP3/WAV/M4A; tiếng nhỏ/nhiễu/đuôi im lặng | 14 file tạo bản chép, chunk, vector; nội dung tải .txt khớp DB |
| Im lặng/nhiễu/âm không lời và file hỏng | Không lưu chữ rác/chunk, không báo hoàn thành giả |
| File rỗng và nội dung không đúng định dạng | HTTP 413/415 |
| 3 truy vấn nội dung với BGE thật | Tìm được đúng tài liệu đích; đây là kiểm tra có lọc tài liệu |
| Trích xuất lại short-vi.mp3 | Hoàn thành lại các bước cần thiết |
| Toàn bộ npm run test:unit | Đạt, gồm các bộ OCR, XMind, tìm kiếm, hàng đợi, runtime, local storage |
| Lint, production build | Đạt |
| Standalone startup/migration SQLite mới | Đạt |

**Đạt luồng xử lý không có nghĩa chép đúng 100%.** Các mẫu âm thanh là giọng tổng hợp và nhiễu kiểm soát, không đại diện mọi người nói thực tế. Lần này không chạy lại toàn bộ thao tác GUI của từng định dạng hay kiểm lại API cloud với dịch vụ thật.

## Chất lượng chép lời đo lại

So với `expected.json`, bỏ khác biệt hoa/thường và dấu câu. Tiếng Việt đếm đơn vị cách nhau bằng khoảng trắng (không phải phân từ ngôn ngữ học).

| File | Đơn vị tham chiếu | Số phép sửa cần thiết |
| --- | ---: | ---: |
| lecture-vi.mp3 | 150 | 17 |
| lecture-vi.wav | 150 | 18 |
| lecture-vi.m4a | 150 | 16 |
| lecture-en.mp3 | 123 | 0 |

Ví dụ lỗi còn thật: “dữ liệu” → “giữ liệu”, “khóa chính” → “phá chính”; mẫu nhiễu ngắn “Tìm tài liệu…” → “Kim Tài Liệu…”. Mẫu trộn dài vẫn có lỗi ở đoạn đổi ngôn ngữ. Kết quả Anh 123/123 chỉ đúng trên mẫu này, không bảo đảm tất cả tiếng Anh. VAD chủ yếu cải thiện chặn âm không lời và trường hợp có đuôi nhiễu, không tăng độ chính xác từ trên các bài sạch nói trên.

## GUI đã kiểm trực tiếp bằng Browser nền

- Trang /help: hiển thị đủ 7 nhóm, đọc được, không tràn ở viewport đã kiểm.
- Cài đặt có liên kết tới trang giới hạn; mở được.
- Upload: mở ghi chú, thấy giới hạn OCR và âm thanh.
- Tìm kiếm: không còn micro; gõ câu tự hiện kết quả. Tab ảnh/file mở được ghi chú OCR.
- Tìm `A primary key identifies each record` không lọc → hiện mixed và lecture-en; mở lecture-en → đúng đoạn nguồn và cảnh báo chép lời → quay lại vẫn còn câu và kết quả.
- Console Browser không ghi lỗi trong lượt kiểm này. Các file của kiểm tích hợp được upload bằng API, không giả là đã bấm upload 26 file trên GUI.

## Test nhanh lại (khoảng 3–5 phút)

1. Cài đặt → Thành phần cục bộ: **Whisper Small + VAD** sẵn sàng. Nếu bản Small cũ thiếu VAD, bấm tải lại/bổ sung; không cần xóa model trước.
2. Trong thư mục `06_mindmap_audio/11_audio_quality`, thêm `lecture-en.mp3` và `short-vi.mp3`. Chờ hoàn tất, mở Nội dung đã trích xuất và nghe file gốc để đối chiếu.
3. Thêm `silence.wav`: phải báo không nhận ra lời nói, không tạo chữ tùy tiện. Đây là từ chối đúng dự kiến, không phải app treo.
4. Tìm `A primary key identifies each record`, mở đoạn của lecture-en rồi quay lại: câu tìm và kết quả phải giữ nguyên.
5. Đọc `APP_CAPABILITIES.md` hoặc mục Giới hạn hiện tại trong README để chuẩn bị demo. Không còn micro trong trang tìm kiếm và không có mục Chức năng và giới hạn trong Cài đặt.

Kết quả nguyên bản nằm cạnh fixture: [upload](06_mindmap_audio/11_audio_quality/small-vad-upload-results.json), [tìm kiếm](06_mindmap_audio/11_audio_quality/small-vad-upload-searches.json), [thống kê](06_mindmap_audio/11_audio_quality/small-vad-upload-summary.json). Giữ lại các file này cùng bộ test; báo cáo voice/Pho cũ chỉ là lịch sử thử nghiệm.

Tái chạy tự động: `scripts/start-audio-test-server.mjs` + `scripts/test-audio-upload-flow.mjs` với cùng `QA_AUDIO_ROOT` mới bên dưới `.tmp`; sau khi đạt dùng `scripts/summarize-small-vad-upload.mjs` để lưu kết quả. Không trỏ các script QA vào thư viện thật.
