# Bộ kiểm tra chất lượng THÊM TÀI LIỆU ÂM THANH

## Mẫu bổ sung để so sánh PhoWhisper (thử riêng, chưa áp dụng)

Các file sau được giữ từ bộ giọng tổng hợp đã tạo trước đó; không ghi âm mic người dùng và không coi là giọng người thật:

| File | Giọng TTS | Đáp án |
|---|---|---|
| `female-1.mp3`, `female-2.mp3` | vi-VN-HoaiMyNeural | “Tìm tài liệu về mạng máy tính”; “Tìm tài liệu về cơ sở dữ liệu” |
| `male-1.mp3`, `male-2.mp3` | vi-VN-NamMinhNeural | Hai câu tương ứng ở trên |
| `en-female-1.mp3`, `en-female-2.mp3` | en-US-JennyNeural | “computer science”; “database” |
| `en-male-1.mp3`, `en-male-2.mp3` | en-US-GuyNeural | “computer science”; “database” |

Giữ các bản này trong bộ test chính, không phụ thuộc file tạm. Một số mẫu trùng nội dung/âm thanh với mẫu cũ, không tính thành các câu độc lập để thổi phồng độ chính xác. Các câu quá ngắn có thể không đạt ngưỡng 20 ký tự của upload dù ASR đọc đúng.

Báo cáo thử riêng: [PHOWHISPER_EVAL_2026-08-28.md](../../PHOWHISPER_EVAL_2026-08-28.md). App vẫn dùng Small cho upload và Base cho micro.

## Bộ kiểm thử upload hiện hành

Không dùng nút mic hoặc trang tìm kiếm cho bộ test này. Dùng **Thêm tài liệu → Chọn file → Thêm vào thư viện**. Đây là dữ liệu tổng hợp, không phải ghi âm người dùng.

**Hiện hành:** tải Whisper Small trong Cài đặt → Thành phần cục bộ để thêm audio. Base chỉ phục vụ micro. Xem [kết quả Small](../../WHISPER_SMALL_UPLOAD_2026-08-28.md); giữ các kết quả Base bên dưới để đối chiếu lịch sử, không coi chúng là trạng thái mới nhất.

**Kết quả mới sau sửa:** xem [cải thiện upload](../../CAI_THIEN_UPLOAD_AUDIO_2026-08-28.md) và `improvement-results.json`. Các lỗi lặp/chậm mô tả bên dưới là baseline cũ; đã giảm rõ, nhưng Base vẫn sai chữ Việt. `results.json` được giữ nguyên để đối chiếu, không ghi đè.

## Thử nhanh

1. Thêm `short-vi.mp3`, `short-vi.wav`, `short-vi.m4a` lần lượt. Cả ba phải chép cùng câu: **Tìm tài liệu về cơ sở dữ liệu**. Mở **Nội dung đã trích xuất** để đối chiếu; không coi trạng thái hoàn tất là đủ.
2. Thêm `lecture-en.mp3`. So với đoạn `long-en` trong `expected.json`. Phải giữ cả câu đầu và câu cuối, không lặp câu ở chỗ chuyển đoạn.
3. Thêm `lecture-vi.mp3`. So với `long-vi` trong `expected.json`. Kiểm kỹ các từ bộ định tuyến, gói tin, mạng đích, khóa chính, khóa ngoại, sao lưu.
4. `silence.wav`, `silence.m4a`, `noise.wav`: không có lời nói; không được tự tạo nội dung có nghĩa rồi báo thành công.
5. `corrupt.mp3`, `wrong-format.mp3`, `empty.wav` cố ý hỏng/rỗng: cần báo lỗi rõ, không treo app. `corrupt.mp3` có chữ ký ID3 giả để kiểm lỗi sau khi đã nhận upload.

## Ca chậm / giới hạn cần biết

- `lecture-vi.wav` và `lecture-vi.m4a`: cùng bài đọc với bản MP3 nhưng đã tái hiện chép sai sang tiếng Anh và lặp nội dung. WAV từng mất khoảng 4 phút mới hoàn tất; không mở nhiều lượt cùng lúc.
- `mixed.m4a`: ghép nguyên bài tiếng Việt rồi đến bài tiếng Anh, dùng để phát hiện việc cố định một ngôn ngữ cho toàn file và mất nội dung ở phần sau. Ca này có thể chậm.
- `database.mp3`: chỉ nói một từ. App hiện yêu cầu ít nhất 20 ký tự sau trích xuất với AUDIO, nên báo không đủ lời nói; cần phân biệt giới hạn này với không đọc được định dạng.
- `baseline-vi.mp3`/`baseline-en.wav`: bản sao hai mẫu ngắn cũ, dùng để chứng minh nhận ra vài từ khóa không đồng nghĩa chép đúng cả câu.

`results.json` là kết quả quan sát, không phải bộ đáp án đúng. `expected.json` chứa nguyên văn hai bài dài. Sai số từ tiếng Việt được đếm theo khoảng trắng (âm tiết), không phải đánh giá ngôn ngữ học.

Bộ này đang dùng để tái hiện lỗi; **không phải tất cả đã PASS**. Xem [báo cáo](../../KIEM_THU_UPLOAD_AUDIO_2026-08-28.md). Giữ lại khi dọn cache.
