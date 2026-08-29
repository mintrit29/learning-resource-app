# Thử và cải thiện thêm tài liệu âm thanh — 28/08/2026

> Báo cáo lịch sử của lượt sửa Base và thử Small riêng. Sau khi được đồng ý, Small đã được tích hợp cho upload; kết quả hiện hành ở [WHISPER_SMALL_UPLOAD_2026-08-28.md](WHISPER_SMALL_UPLOAD_2026-08-28.md). Voice vẫn dùng Base. Các đoạn mô tả “Small chưa áp dụng” bên dưới chỉ nói về thời điểm thử ban đầu.

## Kết luận

Đã cải thiện **độ ổn định và tốc độ của nhánh upload**, nhưng **chép đúng tiếng Việt vẫn chưa đạt yêu cầu**. Không đánh đồng job READY với văn bản chính xác. Tiếng Anh giữ nguyên 123/123 từ trên bài tổng hợp đang thử; không suy rộng thành đúng mọi giọng hoặc mọi file.

Chỉ sửa thêm tài liệu MP3/WAV/M4A. Không thay cấu hình/model của mic tìm kiếm, không gọi AI cloud sửa văn bản, không reprocess tài liệu thật. App vẫn dùng Whisper Base; Small chỉ nằm trong thư mục thử nghiệm `.tmp/whisper-small-eval`, không nằm trong manifest/download của app hay Git.

## Đã sửa và áp dụng

- Tách nhánh upload khỏi voice. Nhận diện ngôn ngữ bằng token ngôn ngữ của Whisper trên **từng đoạn âm thanh**, thay cách đếm từ/dấu trong hai bản chép vi/en để chọn một ngôn ngữ cho cả file.
- Mỗi đoạn tối đa 30 giây, chọn khoảng có năng lượng thấp trong giây 20–30 làm điểm ngắt. Các đoạn liền nhau, không chồng lặp hay bỏ mẫu âm thanh. Đây là heuristic khoảng nghỉ, không phải bộ VAD hoàn chỉnh; nếu nói liên tục, vẫn có thể cắt giữa từ.
- Không yêu cầu decoder sinh timestamp. Cách cũ đã tái hiện lặp chữ với mẫu WAV ngắn; riêng giới hạn token mà vẫn bật timestamp không chữa được ca đó.
- Lưu mốc bắt đầu/kết thúc của **đoạn**, ghi rõ `(mốc theo đoạn)` ở nhãn nguồn. Không giả đây là mốc chính xác từng từ/câu; mỗi đoạn có thể gồm nhiều câu.
- Giới hạn 64–384 token/lượt theo độ dài, từ chối kết quả bị cắt chưa có token kết thúc hoặc lặp liên tiếp bất thường. Không lưu một phần rồi báo hoàn thành nếu đoạn sau thất bại. Chặn im lặng theo năng lượng.
- Kiểm hủy/deadline giữa các token; giới hạn giải mã FFmpeg upload 60 giây. Deadline ASR tối thiểu 90 giây, tăng theo thời lượng file, tối đa 55 phút. **Không thể ngắt ngay một lệnh native ONNX đang treo bên trong**; đây không phải hard timeout độc lập bằng worker.
- File âm thanh hỏng hiển thị hướng dẫn xuất lại MP3/WAV/M4A, không đưa stderr/đường dẫn tạm FFmpeg ra giao diện.

## Kết quả đo

Cùng các file đã giữ trong `06_mindmap_audio/11_audio_quality`. “Phép sửa” là khoảng cách chỉnh sửa sau chuẩn hóa hoa/thường/dấu câu, chia theo khoảng trắng (tiếng Việt phần lớn là âm tiết). Số lớn hơn mẫu số do chèn/lặp, không phải phần trăm accuracy. Small dùng cùng nhánh chia theo khoảng nghỉ, chạy riêng không tích hợp app.

| File | Số đơn vị chuẩn | Cũ: phép sửa | Base sau sửa | Small thử riêng |
|---|---:|---:|---:|---:|
| short-vi.mp3 | 8 | 7 | 7 | 0 |
| short-vi.wav | 8 | 225 | 6 | 1 |
| short-vi.m4a | 8 | 7 | 5 | 0 |
| lecture-vi.mp3 | 150 | 57 | 35 | 17 |
| lecture-vi.wav | 150 | 603 | 33 | 18 |
| lecture-vi.m4a | 150 | 203 | 33 | 16 |
| lecture-en.mp3 | 123 | 0 | 0 | 0 |
| mixed.m4a | 273 | 282 | 34 | 32 |

- WAV Việt 50,6 giây: từ khoảng **242 giây** ở bước trích xuất cũ xuống khoảng **11 giây cho cả upload/xử lý** mới trong QA. Đây là thời gian quan sát, không phải benchmark kiểm soát tuyệt đối tải máy.
- Bản ghép Việt–Anh: từ khoảng 121 giây cũ xuống khoảng 27 giây trong upload mới; không còn ép cả phần Anh thành tiếng Việt/lặp dài trên mẫu này. Small vẫn chép sai/dịch câu Anh đầu tiên nằm chung đoạn Việt; chuyển ngôn ngữ ngay giữa một đoạn còn là giới hạn.
- Small giảm lỗi Việt trên bộ này, nhưng vẫn nhầm “dữ liệu/giữ liệu”, “gói tin”, “chuẩn hóa”… và thường mất khoảng gấp đôi thời gian Base trong thử riêng. Vì vậy **chưa tự thay model app**, cũng không kết luận đổi sang Small là giải quyết xong.
- Ảnh hưởng codec vẫn thấy rõ: cùng câu, MP3/M4A với Small đúng nhưng WAV sai dấu “tài/tai”. Không hứa độ chính xác tuyệt đối chỉ vì âm nghe rõ.

## Kiểm thực tế sau sửa

17 ca qua `/api/documents/upload` thật, FFmpeg + Whisper Base q8 thật, Next.js production build mới và SQLite QA riêng `.tmp/audio-upload-improved-20260828/data`:

- 10 file có nội dung hoàn tất trích xuất/chia đoạn; đọc lại text từ DB và tải `.txt` khớp. Chất lượng ngôn từ theo bảng trên, **không gọi là 10 ca accuracy PASS**.
- Im lặng WAV/M4A, nhiễu trắng và MP3 hỏng: FAILED, không text/chunks. File sai định dạng 415 và file rỗng 413 trước khi tạo tài liệu.
- `database.mp3` vẫn bị từ chối ở tầng tài liệu vì ngưỡng tối thiểu 20 ký tự. Model nhận được “Database”; đây là giới hạn cũ chưa đổi, không phải lỗi giải mã.
- Trong QA dùng embedding mock để tách riêng bài toán ASR; không chứng minh chất lượng tìm kiếm/embedding bằng lượt này. AI provider không cấu hình; phân loại/tóm tắt SKIPPED đúng thiết kế.
- Browser nền: mở WAV dài, mở/thu nội dung và tiến trình, quay lại thư viện; xác nhận văn bản hiển thị khớp DB. Mở file MP3 hỏng và xác nhận thông báo dễ hiểu. Không giả đã chọn từng file bằng file chooser; batch upload thực hiện qua API.
- Trường “Ngôn ngữ” trên trang chi tiết vẫn lấy từ phân tích AI tùy chọn, không từ metadata ASR, nên QA không bật AI còn hiển thị “Chưa nhận diện”. Không dùng trường đó để đánh giá thuật toán chọn ngôn ngữ âm thanh.

Đã chạy đạt: `test-upload-transcription.mjs`, `test:voice-search`, `test:embedding-runtime`, `test:media-extractors`, `test:processing-queue`, lint các file thay đổi và production build. Không chạy lại toàn bộ các chức năng app/EXE trong lượt này.

## Chạy lại và dữ liệu đối chiếu

- Test logic, không cần tải model: `node scripts/test-upload-transcription.mjs`.
- Đánh giá ASR thật, không ghi thư viện:

```powershell
$env:AUDIO_EVAL_CACHE = "$env:APPDATA\ScholarFlow\models"
$env:AUDIO_EVAL_MODEL = "base" # tái hiện bản Base trong báo cáo lịch sử này
node scripts/evaluate-upload-audio.mjs
```

Có thể truyền tên file cuối lệnh để chỉ thử vài mẫu. Script không tải model, không đổi cache và ghi kết quả vào `.tmp/audio-evaluation-base.json`. Đây là đánh giá ASR, không thay cho test upload/API/DB.

- Bản cũ: [results.json](06_mindmap_audio/11_audio_quality/results.json).
- Bản mới, mọi output thử cấu hình, Small, hash file và số đo: [improvement-results.json](06_mindmap_audio/11_audio_quality/improvement-results.json).
- Nguồn Small: [ONNX Community Whisper Small](https://huggingface.co/onnx-community/whisper-small/tree/36050c46d777d46dc4b5f43f6d90574fc38f8732), revision cố định, hai file ONNX q8 kiểm SHA-256 theo LFS trước khi chạy. Tổng download khoảng 252 MB, chỉ phục vụ đánh giá.

Chưa kiểm giọng thật/giọng địa phương, âm nhạc lẫn lời, hội thoại nhiều người, mọi loại tiếng ồn, file dài hàng giờ. Bộ synthetic nhỏ này có giá trị hồi quy, không đủ chứng nhận chất lượng tiếng Việt tổng quát.
