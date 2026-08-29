# Thử kết hợp Small/PhoWhisper và VAD — 28/08/2026

**Chốt thử nghiệm:** đề xuất tích hợp **Small + VAD** trước để chặn nhiễu/đuôi không lời nói, giữ chất lượng chữ hiện tại. Không bật Pho tự động theo cửa sổ; chỉ cân nhắc chế độ Việt thuần tùy chọn. **Cả hai hướng vẫn là script thử, chưa thay app.**

## Phạm vi

Thử nghiệm **ngoài app**, không đổi component manifest, model mặc định, micro, thư viện người dùng, GUI hay EXE. File thử và code nằm trong bộ test/scripts; model mới chỉ trong `.tmp/phowhisper-eval` (Git ignore).

Ba hướng đối chiếu:

1. **Small hiện tại**: baseline 22 ca đã có, xác minh lại hash; chạy thêm 9 ca stress mới.
2. **Small chọn ngôn ngữ → Pho cho Việt, Small cho Anh + VAD**: 31 ca.
3. **Small + VAD**, không Pho: 31 ca đối chứng để tách tác dụng lọc tiếng nhiễu khỏi thay model nhận dạng.

Đã hoàn tất 31 lượt gate độc lập, 31 lượt ASR hybrid, 31 lượt ASR Small+VAD và 9 baseline mới. Các lượt dùng cùng fixture/hash, không phải 102 mẫu ngôn ngữ độc lập hay 102 ca chính xác hoàn toàn.

Nguồn Pho/Q8 và phép đo chữ giữ như [báo cáo trước](PHOWHISPER_EVAL_2026-08-28.md). Tiếng Việt đếm đơn vị theo khoảng trắng, phần lớn là âm tiết; không coi số câu/file khác định dạng là dữ liệu ngôn ngữ độc lập. Các mẫu là TTS/âm tổng hợp, chưa có ghi âm giọng người thật.

## Cách làm thử

- Silero VAD chính thức, revision `867c2aa692646a1f1de3e94a15c9dd9f614c0acb`, 2.327.524 byte, SHA-256 `1a153a22f4509e292a94e67d6f9b85e8deb25b4988682b7e174c65279d8788e3`. [Nguồn model](https://github.com/snakers4/silero-vad/tree/867c2aa692646a1f1de3e94a15c9dd9f614c0acb), MIT. Chỉ nhận có/không có lời nói; không sửa chữ, không gọi cloud.
- Frame 512 mẫu/16 kHz, context 64 mẫu và recurrent state reset mỗi file. Gate 0,5 vào / 0,35 ra, thời lượng lời nói tối thiểu 250 ms, khoảng im tối thiểu 100 ms. Chạy toàn file để xác định hoạt động lời nói; không thay âm thanh gốc hay cắt đầu/cuối âm tiết.
- Giữ cách chia cửa sổ tối đa 30 giây/ngắt ở khoảng nghỉ như app. Bỏ cửa sổ có dưới 250 ms lời nói đã phát hiện. Small nhận ngôn ngữ từng cửa sổ; không dùng Pho tự nhận ngôn ngữ. Cấu hình tiền xử lý hai model được đối chiếu bằng code trước khi chia sẻ input features.
- Đầu ra dùng tokenizer của model tương ứng. Không hậu sửa từ/tên riêng, không LLM viết lại. Kiểm EOS/lặp, lỗi ở đoạn sau không trả thành công phần đầu. Hủy/deadline kiểm giữa token/các frame; không thể ngắt một ONNX native call đang treo. Deadline thử tối thiểu 90 giây, tối đa 55 phút, theo thời lượng audio ×8; không thay deadline app.
- Node 24.13.0, Transformers.js 4.2.0, ONNX Runtime 1.24.3 CPU; i7-10850H. Các lượt inference chạy tuần tự. Thời gian mới gồm giải mã/VAD, baseline cũ chỉ ASR nên không so như benchmark được kiểm soát.

## Kết quả kết hợp hai model

| Mẫu | Small hiện tại: phép sửa | Ghép hai model + VAD |
|---|---:|---:|
| Bài Việt MP3 / WAV / M4A (150 đơn vị) | 17 / 18 / 16 | 10 / 5 / 6 |
| Bài Anh dài (123 từ) | 0 | 0 |
| Việt–Anh dài (273 đơn vị) | 32 | 14, **vẫn mất một câu Anh** |
| Anh–Việt–Anh ngắn (11 đơn vị) | 1 | 3, **mất cả ba từ Anh** |
| Việt nói nhỏ / lẫn nhiễu (8 đơn vị) | 1 / 1 | 0 / 0 |
| Việt có nhiễu dài đầu/cuối (8 đơn vị) | Báo lỗi khi đọc cửa sổ đuôi nhiễu | Chép đúng, bỏ đuôi không lời nói |

- Các mẫu Anh riêng gồm `computer science`, `database`, bài dài và mẫu baseline đều giữ text của Small; bài dài vẫn đúng 123/123 sau bỏ dấu câu/hoa thường.
- Bài Việt còn các lỗi thật đã nêu: “mạng” → “mảng”, “khóa” → “phá”… Một câu nữ về mạng máy tính còn kém hơn Small (0 → 1 lỗi). Không phải mọi câu Việt đều cải thiện.
- File trộn dài: cửa sổ 28,5–54,5 giây chứa cuối bài Việt và câu “Today we study computer networks and databases.”; Small chọn `vi`, Pho bỏ câu Anh này. Số phép sửa giảm **không chứng minh đủ nội dung**.
- File đổi Anh–Việt–Anh trong 8,936 giây: chọn `vi` cho cả cửa sổ. Pho chỉ trả câu Việt, mất “computer science” và “database”. Small đơn giữ được các từ Anh, chỉ sai “tài” → “tai”. Đây là regression chặn việc bật routing hai model mặc định.
- VAD gate đạt **31/31 trên bộ mẫu này**; không bỏ cả file nói nhỏ/lẫn nhiễu. Có 8 ca không lời nói (im lặng, nhiễu cũ, trắng/nâu, tone/chords/clicks), cả 8 bị chặn trước ASR. Không có câu giả trong các ca đó khi dùng VAD.
- Small không VAD sinh `you` trên hợp âm tổng hợp. Đây là lỗi ở ASR; app còn chặn tài liệu dưới 20 ký tự, nên không suy ra mẫu này được lưu thành tài liệu thành công. Với file có đuôi nhiễu dài, baseline bị lỗi cả bản chép khi đuôi không nhận ra Việt/Anh; gate bỏ đuôi này.
- Hai model nạp đồng thời: peak RSS tiến trình **2.716,8 MiB (~2,65 GiB)**, chưa gồm BGE/giao diện. Bài Việt 51 giây mất khoảng 40–43 giây; bài Anh 65 giây khoảng 41 giây; file trộn 116 giây khoảng 96 giây. Chưa tối ưu tải lười/giải phóng model/thread; số đo không chứng minh toàn bộ chênh lệch do routing.

## Kết luận thiết kế

### Đối chứng Small + VAD đã chạy xong

- Đủ 31 ca: chặn 8 ca không lời nói; 23 ca có lời nói đều trả text, không có lỗi runtime trong bộ này.
- **22/22 bản chép baseline có text được giữ nguyên về từ/âm tiết** sau chuẩn hóa dấu câu/hoa thường. Không có bản chép bị lùi ở đối chứng này. File thứ 23 có lời nói (`padded-vi.wav`) baseline báo lỗi; Small+VAD đọc được câu, nhưng còn 2 lỗi chữ (“tài” → “tai”, “dữ” → “giữ”).
- Bài Anh dài vẫn 0/123; bài Việt MP3/WAV/M4A vẫn 17/18/16 phép sửa; file đổi ngôn ngữ ngắn vẫn giữ cả “computer science” và “database”, chỉ 1 lỗi Việt như cũ. File trộn dài vẫn 32 phép sửa/giới hạn cũ, VAD không sửa được lỗi chọn ngôn ngữ.
- Lời nói nhỏ/lẫn nhiễu không bị chặn nhầm ở hai mẫu đã thử; còn 1 lỗi chữ/mẫu như baseline. Phần đuôi toàn nhiễu được bỏ đúng cửa sổ, không nối text giả.
- Peak RSS **1.360,7 MiB (~1,33 GiB)** so với hybrid 2.716,8 MiB (~2,65 GiB). Đây là tiến trình ASR thử, không phải RAM toàn app. VAD độc lập nạp khoảng 228 ms, đa số file ngắn xử lý dưới 0,2 giây gồm giải mã; file 116 giây khoảng 1,5 giây trong lượt gate độc lập. Không cần nạp Pho trong đối chứng Small+VAD.

Kết quả này ủng hộ tích hợp bộ lọc lời nói trước; **không phải bằng chứng chữ tiếng Việt đã được cải thiện**. Việc tích hợp phải có checksum/đóng gói hoặc tải model rõ ràng, giữ hủy/deadline, kiểm lại upload/reextract và nguồn mốc thời gian trên GUI. Các phần đó chưa làm trong thí nghiệm này.

Không bật tự động Pho cho mọi cửa sổ được nhận là tiếng Việt: một cửa sổ có thể chứa nhiều ngôn ngữ. Giữ Small cho chế độ tự động/Anh/trộn là hướng ít nguy cơ hơn. VAD là phần cải thiện ổn định riêng biệt; Pho chỉ nên cân nhắc chế độ **tiếng Việt thuần do người dùng chọn**, chưa triển khai chế độ đó.

Giới hạn chưa giải quyết: chép đúng mọi chữ Việt, đổi ngôn ngữ trong một cửa sổ, giọng thật/địa phương, lời nói chồng nhau, nhạc thật/tiếng ồn đa dạng, audio dài hàng giờ. VAD không đảm bảo phát hiện mọi giọng nói hay loại mọi câu bịa. Chưa thử bộ tách ngôn ngữ theo câu, PyTorch gốc/FP32 hoặc model Pho tự export.

## Bằng chứng và chạy lại

- [hybrid-comparison.json](06_mindmap_audio/11_audio_quality/hybrid-comparison.json): bảng đối chiếu/hash.
- [hybrid-hybrid-results.json](06_mindmap_audio/11_audio_quality/hybrid-hybrid-results.json): nguyên văn text, routing/mốc thời gian, VAD, lỗi và số đo.
- [hybrid-small-results.json](06_mindmap_audio/11_audio_quality/hybrid-small-results.json): Small trên 9 ca mới.
- [hybrid-vad-results.json](06_mindmap_audio/11_audio_quality/hybrid-vad-results.json): gate độc lập 31 ca.
- [hybrid-small-vad-results.json](06_mindmap_audio/11_audio_quality/hybrid-small-vad-results.json): đối chứng Small+VAD, 31 ca, không nạp Pho.
- [Bộ 9 file mới và lệnh chạy](06_mindmap_audio/11_audio_quality/hybrid/README.md). Giữ cùng bộ test chính cho nhóm; không dọn mất.

Kiểm cú pháp/lint các script và unit `test-audio-hybrid-experiment.mjs`/`test-upload-transcription.mjs` đã chạy. Không gọi đây là full app/GUI/installer PASS; không sửa app hay phát hành trong lượt thử này.
