# Audio thử routing Small/PhoWhisper và lọc lời nói

Đây là nhánh thử nghiệm **ngoài app**, chưa đổi model đang dùng. Dữ liệu được tạo bằng `scripts/generate-hybrid-audio-fixtures.mjs`; không ghi âm người dùng, không gọi mạng.

| File | Nội dung / kết quả mong đợi |
|---|---|
| `white.wav` | Nhiễu trắng, không được sinh bản chép lời |
| `brown.wav` | Nhiễu tần số thấp, không có lời nói |
| `tone.wav` | Âm 440 Hz, không có lời nói |
| `chords.wav` | Hợp âm tổng hợp, không có lời nói; không đại diện mọi bản nhạc thật |
| `clicks.wav` | Tiếng lách tách tổng hợp, không có lời nói |
| `quiet-vi.wav` | Câu “Tìm tài liệu về cơ sở dữ liệu”, giảm âm lượng khoảng 26 dB |
| `noisy-vi.wav` | Cùng câu Việt, thêm nhiễu trắng khoảng SNR 10 dB |
| `padded-vi.wav` | 4 giây nhiễu + câu Việt + 32 giây nhiễu; không được bịa lời ở đuôi |
| `switch-en-vi.wav` | “computer science” → “Tìm tài liệu về cơ sở dữ liệu” → “database”; ca đổi ngôn ngữ trong cùng đoạn ngắn |

`expected.json` giữ mô tả/đáp án. Nhiễu sinh bằng seed cố định; giọng nói dùng lại mẫu TTS nam/nữ có sẵn trong thư mục cha. Không coi đây là đánh giá giọng người thật. VAD nhận ra lời nói không đồng nghĩa bản chép đúng chữ.

Chạy từ thư mục `learning-resource-app`:

```powershell
node scripts/download-phowhisper-eval.mjs
node scripts/download-silero-eval.mjs
node scripts/generate-hybrid-audio-fixtures.mjs
node scripts/test-audio-hybrid-experiment.mjs
$env:HYBRID_EVAL_MODE = 'vad'
node scripts/evaluate-hybrid-audio.mjs
$env:HYBRID_EVAL_MODE = 'hybrid'
node scripts/evaluate-hybrid-audio.mjs
$env:HYBRID_EVAL_MODE = 'small-vad'
node scripts/evaluate-hybrid-audio.mjs
```

Model Small phải có sẵn trong `%APPDATA%/ScholarFlow/models` (hoặc đặt `AUDIO_EVAL_CACHE`). Chỉ hai lệnh download có mạng, inference local-only. Script evaluator mặc định chạy 31 ca gồm 22 ca cũ và 9 ca mới ở đây. Để so riêng Small dùng `HYBRID_EVAL_MODE=small`; để chọn ca, truyền tên như `hybrid/noisy-vi.wav`.

Các kết quả `hybrid-*-results.json` trong thư mục cha là output thực tế, không phải đáp án. Chạy lại cùng mode sẽ cập nhật file kết quả mode đó. Không xóa bộ fixture này khi dọn cache. Không dùng các ca rất ngắn để đánh giá upload có thành công không: app vẫn có ngưỡng tối thiểu 20 ký tự của tài liệu âm thanh.

Để tạo bảng đối chiếu cùng baseline 22 ca cũ, chạy Small trên đúng 9 ca mới rồi tổng hợp:

```powershell
$env:HYBRID_EVAL_MODE = 'small'
node scripts/evaluate-hybrid-audio.mjs hybrid/white.wav hybrid/brown.wav hybrid/tone.wav hybrid/chords.wav hybrid/clicks.wav hybrid/quiet-vi.wav hybrid/noisy-vi.wav hybrid/padded-vi.wav hybrid/switch-en-vi.wav
node scripts/summarize-hybrid-audio.mjs
```

[Báo cáo/giới hạn](../../../PHOWHISPER_HYBRID_EVAL_2026-08-28.md) phân biệt gate PASS với chép đúng chữ và ca bị mất câu khi đổi ngôn ngữ.
