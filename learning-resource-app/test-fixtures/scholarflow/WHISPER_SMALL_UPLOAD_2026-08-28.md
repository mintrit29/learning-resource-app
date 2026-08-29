# Whisper Small cho thêm tài liệu âm thanh — 28/08/2026

## Đã áp dụng

- File MP3/WAV/M4A dùng **Whisper Small q8** local; nút micro tìm kiếm vẫn dùng **Whisper Base**, không đổi thuật toán voice trong lượt này.
- Cài đặt → Thành phần cục bộ có hai thẻ riêng, ghi rõ chức năng. Small khoảng **252 MB (240 MiB)**, tùy chọn, không chặn thiết lập ban đầu, không tự tải ngầm.
- Revision Small `36050c46d777d46dc4b5f43f6d90574fc38f8732`, 7 file pin dung lượng/SHA-256. Đã tải thật bằng ComponentManager từ Hugging Face và kiểm đủ hash; không phải chỉ chép model thử vào cache. Base giữ nguyên.
- Thiếu Small: upload/trích xuất lại âm thanh báo tải Small, không coi Base là đủ. Có Small nhưng thiếu Base: upload vẫn dùng được, micro báo cần Base.
- Giữ chia đoạn theo khoảng nghỉ, nhận ngôn ngữ từng đoạn, bảo vệ im lặng/lặp/ngắt/cancel/deadline của lượt sửa trước. Mốc nguồn là **mốc theo đoạn tối đa 30 giây**, không phải chính xác từng từ.
- Không tự trích xuất lại tài liệu cũ, không đổi database, không xóa file thật. Chưa thêm UI sửa bản chép lời. Không tạo EXE/release/commit/push trong lượt này.

## Kết quả thực tế

Đã chạy 17 fixture qua API upload của Next.js mới build, FFmpeg + Small + BGE-M3 thật (vector 1.024 chiều), SQLite QA riêng. Không dùng embedding mock hoặc AI cloud. Fixture là **giọng đọc tổng hợp**, không phải ghi âm người thật.

- **10 READY**: ba câu Việt ngắn MP3/WAV/M4A, ba bài Việt dài MP3/WAV/M4A, bài Anh dài, bài ghép Việt–Anh và hai mẫu ngắn Việt/Anh cũ. Text lưu DB khớp bản tải `.txt`, có chunks và embedding hoàn thành.
- **5 FAILED đúng dự kiến**: im lặng WAV/M4A, nhiễu trắng, MP3 có ID3 giả nhưng hỏng, một từ `database.mp3`. Không lưu text/chunks rác. Trường hợp `database.mp3` do ngưỡng tối thiểu 20 ký tự của tài liệu, không phải không nhận dạng được từ đó.
- **2 bị chặn trước khi tạo tài liệu**: `wrong-format.mp3` trả 415; `empty.wav` trả 413.
- Tìm kiếm thật với ba truy vấn Việt/Anh trả lại tài liệu âm thanh tương ứng. Trích xuất lại `short-vi.mp3` hoàn tất, tạo lại dữ liệu tìm kiếm.
- Runtime đang tải Small → gọi voice bằng file WebM test nhận `model=whisper-base` → gọi upload tiếp nhận `model=whisper-small`, không lẫn model. Không dùng mic vật lý và không đánh giá cải thiện voice.
- Browser nền: mở bản chép Việt dài, mở nội dung; tìm câu Anh với bộ lọc Âm thanh, mở đúng đoạn nguồn và quay lại. Batch upload qua API, không giả đã thao tác từng file bằng file chooser. Chưa kiểm lại nút tải Small qua cửa sổ Electron trong lượt này; đã kiểm downloader thật và wiring IPC dùng manifest chung.
- `npm run test:unit` (bao gồm voice/UX và các extractor cũ), `npm run lint`, `npm run build` đạt. Các báo cáo OCR vẫn ghi nhận giới hạn ký tự/công thức cũ; unit PASS không có nghĩa OCR chính xác 100%.

### Sai chữ vẫn còn, nhưng giảm trên bộ Việt này

Đếm khoảng cách chỉnh sửa sau chuẩn hóa dấu câu/hoa thường, chia theo khoảng trắng. Với tiếng Việt đây chủ yếu là âm tiết; **không phải tỷ lệ đúng tổng quát**.

| Mẫu | Base sau sửa trước đó | Small trong luồng upload mới |
|---|---:|---:|
| Câu Việt MP3 (8 đơn vị) | 7 phép sửa | 0 |
| Câu Việt WAV (8) | 6 | 1: “tài” → “tai” |
| Câu Việt M4A (8) | 5 | 0 |
| Bài Việt MP3 (150) | 35 | 17 |
| Bài Việt WAV (150) | 33 | 18 |
| Bài Việt M4A (150) | 33 | 16 |
| Bài Anh (123) | 0 | 0 |
| Ghép Việt–Anh (273) | 34 | 32 |

Small còn nhầm cả từ tiếng Việt thông thường: “dữ liệu” → “giữ liệu”, “chuẩn hóa” → “chưởng hóa”, “bảo mật” → “bão mật”. Câu Anh nằm chung đoạn với cuối bài Việt vẫn bị chép/dịch sai; các đoạn Anh tiếp theo đúng trên mẫu này. Không dùng AI tự sửa để che sai số.

Thời gian **cả upload → embedding** quan sát: câu ngắn khoảng 6–9 giây; bài Việt 50 giây khoảng 37–41 giây; bài Anh 65 giây khoảng 27 giây; bài ghép khoảng 57 giây. Máy đồng thời chạy bộ test khác nên đây không phải benchmark tốc độ có kiểm soát. Small tốn tài nguyên hơn Base.

Chưa kiểm giọng thật/địa phương, nhiều người nói, nhạc/nhiễu đa dạng hoặc file dài hàng giờ. Giới hạn đầu vào vẫn 25 MB/60 phút; mức giới hạn cho phép không đồng nghĩa đã kiểm chất lượng tới 60 phút. Deadline kiểm giữa token không thể ngắt ngay một native ONNX call đang treo.

## Test nhanh bằng tay (chỉ phần thêm tài liệu)

1. Tắt/mở lại app dev để backend nhận code mới. Vào **Cài đặt → Thành phần cục bộ**: Small phải “Sẵn sàng”; nếu chưa có thì tải Small. Không cần tải lại Base.
2. Vào **Thêm tài liệu**. Trong `06_mindmap_audio/11_audio_quality`, chọn `short-vi.mp3`. Mở **Nội dung đã trích xuất**: dự kiến “Tìm tài liệu về cơ sở dữ liệu.”
3. Thêm `lecture-en.mp3`, kiểm câu đầu “Today we study…” và câu cuối “This is the final sentence of the audio test.”
4. Thêm `lecture-vi.mp3`, đối chiếu `expected.json`. Dự kiến đủ phần đầu/cuối và không lặp dài; lỗi chữ theo bảng trên vẫn là giới hạn đã biết.
5. **Tìm tài liệu** → gõ `A primary key identifies each record` → lọc **Âm thanh** → mở `lecture-en` → quay lại. Phải giữ truy vấn/kết quả và thấy nhãn mốc theo đoạn.
6. Thêm `silence.wav` và `corrupt.mp3`: cần báo lỗi dễ hiểu, không tạo bản chép lời giả. Với file cũ muốn dùng Small, chọn **Trích xuất lại**, không phải “Phân tích lại AI”.

Để đánh giá thêm giọng thật, cần vài file ghi âm 20–60 giây kèm nội dung chuẩn do người nói xác nhận; chưa có các mẫu đó trong bộ test này.

## Chạy lại tự động

Từ thư mục `learning-resource-app`, đã cài BGE-M3 và Whisper Small trong app:

```powershell
npm run test:component-manager
npm run test:embedding-runtime
npm run build
node scripts/prepare-desktop.mjs
$env:QA_AUDIO_ROOT = "$PWD\.tmp\audio-small-check-01"
node scripts/start-audio-test-server.mjs
```

Giữ terminal đó chạy. Mở terminal thứ hai tại cùng thư mục:

```powershell
$env:QA_AUDIO_ROOT = "$PWD\.tmp\audio-small-check-01"
node scripts/test-audio-upload-flow.mjs
```

Mỗi lần test dùng tên QA root mới, script không tự xóa dữ liệu cũ. Dừng server bằng Ctrl+C. Đây là build dịch vụ nội bộ để QA, **không tạo EXE**. Kết quả/SQLite trong `.tmp` chỉ là thư viện test; không dùng thư viện `%APPDATA%` của người dùng. Model đọc từ cache đã cài, không tải ngầm.

Chỉ đo ASR, không ghi thư viện:

```powershell
$env:AUDIO_EVAL_CACHE = "$env:APPDATA\ScholarFlow\models"
$env:AUDIO_EVAL_MODEL = "small"
node scripts/evaluate-upload-audio.mjs short-vi.mp3 lecture-vi.mp3
```

Bằng chứng đầy đủ gồm hash fixture, output, job và truy vấn: [small-upload-results.json](06_mindmap_audio/11_audio_quality/small-upload-results.json). Báo cáo Base trước đó được giữ tại [CAI_THIEN_UPLOAD_AUDIO_2026-08-28.md](CAI_THIEN_UPLOAD_AUDIO_2026-08-28.md).
