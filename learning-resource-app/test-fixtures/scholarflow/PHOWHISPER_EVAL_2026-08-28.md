# Thử riêng PhoWhisper Small — 28/08/2026

**Lượt thử tiếp đã hoàn tất:** [routing Small/Pho + Silero VAD và đối chứng Small+VAD](PHOWHISPER_HYBRID_EVAL_2026-08-28.md). Giữ kết quả nguyên bản bên dưới để đối chiếu; chưa thay model app.

## Kết luận trong phạm vi đã đo

Bản PhoWhisper ONNX Q8 thử nghiệm giảm lỗi trên bài tiếng Việt, nhưng **không thể thay thẳng Small hiện tại**: tự nhận nhầm tiếng Anh thành tiếng Việt, làm hỏng bài Anh/file trộn, và sinh câu giả từ nhiễu trắng. App chưa đổi model; upload vẫn Small, micro vẫn Base. Không sửa câu bằng từ điển/LLM để che lỗi nhận dạng.

Đã chạy đủ **22 ca/model, 44 lượt đối chiếu**. Đây không phải 44 PASS hoặc 22 câu độc lập. Script kiểm hai bên dùng đúng cùng hash fixture, lưu cả lỗi và nguyên văn bản chép. Kiểm cú pháp ba script và `test-upload-transcription.mjs` đạt; không chạy lại toàn bộ build/GUI vì lượt này chỉ thêm thí nghiệm/fixture/tài liệu, không sửa runtime app.

## Nguồn và điều kiện thử

- Nguồn gốc: [VinAI/PhoWhisper-small](https://huggingface.co/vinai/PhoWhisper-small), revision `a86b604c346caf7148c37512eafe783a16420adb`, BSD-3-Clause.
- Thử [bản ONNX cộng đồng huuquyet/PhoWhisper-small](https://huggingface.co/huuquyet/PhoWhisper-small/tree/515c6b55639f2944aa8b64f2b0268b41c944353c), không phải ONNX do VinAI phát hành. Revision `515c6b55639f2944aa8b64f2b0268b41c944353c`; 7 file, **251.659.372 byte**. File lớn kiểm SHA-256, file JSON kiểm Git blob SHA-1 và dung lượng theo metadata revision cố định.
- Metadata PyTorch nguồn của hai repo cùng SHA-256 `9ec6f07c5bd321fc8f477cf778c43c3fd94b0e33a9f20283fc61cc6d22cbfded`. Chưa tự export hoặc chứng minh ONNX tương đương từng tensor với bản PyTorch. Metadata license của bản cộng đồng khác upstream: cần kiểm lại quyền phân phối nếu tích hợp; thử nghiệm này không đóng gói/phát hành model.
- Baseline: `onnx-community/whisper-small`, revision app pin `36050c46d777d46dc4b5f43f6d90574fc38f8732`.
- Cùng helper `transcribeUploadedSamples`, FFmpeg mono 16 kHz, cùng ngắt đoạn theo khoảng nghỉ, cùng giới hạn token, cùng nhận ngôn ngữ từ model; CPU Q8, không sinh timestamp bằng decoder. Không đổi ngưỡng/làm sạch riêng để ưu ái một model.
- Windows x64, i7-10850H, RAM 15,64 GiB, Node 24.13.0, Transformers.js 4.2.0, ONNX Runtime 1.24.3. Hai lượt inference chạy tuần tự, không tranh CPU với nhau; không phải benchmark máy nhàn rỗi được kiểm soát hoàn toàn.
- Chỉ kiểm ASR/helper, không upload vào thư viện thật, không dùng micro, không kiểm lại GUI/embedding/installer. Không có audio người dùng gửi ra ngoài. Model thử nằm trong `.tmp/phowhisper-eval`, được Git ignore; không sửa manifest/model trong `%APPDATA%`.

## Kết quả bài dài

Đếm Levenshtein trên chuỗi NFC, bỏ dấu câu/hoa thường và tách theo khoảng trắng. Tiếng Việt chủ yếu đếm **âm tiết**, không phải WER ngôn ngữ học. Các cách đặt dấu như `hoá/hóa` vẫn bị tính khác. Ba định dạng Việt là cùng bài đọc chuyển định dạng, không phải ba bài độc lập.

| File | Đơn vị tham chiếu | Small: phép sửa | Pho: phép sửa | Small: giây | Pho: giây |
|---|---:|---:|---:|---:|---:|
| `lecture-vi.mp3` | 150 | 17 | 10 | 34,7 | 41,4 |
| `lecture-vi.wav` | 150 | 18 | 5 | 28,1 | 40,9 |
| `lecture-vi.m4a` | 150 | 16 | 6 | 24,8 | 35,7 |
| `lecture-en.mp3` | 123 | 0 | 123 | 18,8 | 32,7 |
| `mixed.m4a` | 273 | 32 | 129 | 45,9 | 68,1 |

Pho giữ được “dữ liệu”, “bảo mật”, “trùng lặp” tốt hơn trên bài này. Vẫn có lỗi thật: “mạng” → “mảng”, “khóa chính” → “phá chính”, “khóa ngoại” → “phá ngoại”, “bản ghi” → “bảng ghi”; bản MP3 còn thiếu “chuyển” và sai “giao thức”. Đầu ra Pho cũng ít dấu câu hơn. Không gọi đây là chép lời hoàn hảo.

Trong bài Anh, Pho tự chọn `vi` cho cả ba đoạn và sinh tiếng Việt/phiên âm rác. Small vẫn **0 phép sửa trên đúng bài 123 từ**, không có nghĩa mọi audio Anh đều 100%. File trộn vẫn là giới hạn cả hai; Pho làm hỏng phần Anh nặng hơn.

## Mẫu ngắn và ca không có lời nói

- Ba câu Việt ngắn MP3/WAV/M4A: Pho 0/0/0 phép sửa, Small 0/1/0 trên mỗi câu 8 đơn vị.
- Giọng nữ “mạng máy tính”: Small đúng, Pho sai “mạng” → “mảng”. Giọng nam cùng câu: cả hai sai một đơn vị khác nhau. Giọng nam “cơ sở dữ liệu”: Small sai 2, Pho đúng. **Không phải mọi câu Việt đều tốt hơn.**
- `computer science` nam/nữ: cả hai đúng chữ, nhưng Pho gán sai ngôn ngữ `vi`. `database` nam/nữ: Small đúng, Pho thành “đây là bài” hoặc “dây tơ bâys”. Hai mẫu baseline cũ giữ output để đọc thủ công, chưa đưa vào điểm số tự động.
- Im lặng WAV/M4A: cả hai được helper chặn trước inference, không phải bằng chứng model tự biết im lặng.
- **Nhiễu trắng `noise.wav`: Small từ chối; Pho nhận `vi` và bịa “họ cho rằng không nên ngồi vào đầu mục đích để xem giấy giấy giấy này.”** Helper hiện tại không chặn trường hợp này vì có năng lượng và không lặp đủ dài. Ca không đạt, cần kiểm/chặn có lời nói (VAD) và nhiễu trước bất kỳ tích hợp nào; VAD cũng phải được kiểm, không đảm bảo loại mọi câu bịa.
- Peak RSS cả tiến trình thử: Small **1.503 MiB**, Pho **1.787 MiB** (xấp xỉ 1,47/1,74 GiB). Đây là mức đỉnh tích lũy qua lượt thử, gồm JS/ONNX/tensor, không phải riêng trọng số hay RAM toàn app. Nạp model lần đầu 3,28/2,95 giây; số đo từng audio không bao gồm FFmpeg/nạp model/embedding.

## Hướng tiếp theo, chưa triển khai

Pho có tiềm năng cho **riêng tiếng Việt**, không dùng làm model chung hoặc bộ tự nhận ngôn ngữ Việt/Anh. Nếu tiếp tục: giữ Small cho tiếng Anh; thử chế độ chép tiếng Việt rõ ràng hoặc bộ chọn model độc lập, thêm kiểm có lời nói/nhiễu, rồi kiểm cả file trộn, tốc độ và RAM. Chỉ đổi sau khi thử lại đạt những ca hỏng này. Không dựa vào kết quả Pho tự nhận `vi` để định tuyến: bài Anh và nhiễu cũng bị nhận `vi` trong lượt này.

Chưa đánh giá giọng người thật, giọng địa phương, nhiều người nói, nhạc/nhiễu đa dạng, file dài hàng giờ. Mẫu đang có là TTS; muốn quyết định tích hợp cần thêm ghi âm thật kèm đáp án. Chưa kiểm PyTorch gốc, bản FP32, beam search hoặc routing hai model. Không suy ra mọi phiên bản PhoWhisper đều cho kết quả như bản ONNX Q8 này.

## Chạy lại

Từ `learning-resource-app`, có dependencies runtime và Small đã cài. Không cần mở app:

```powershell
node scripts/download-phowhisper-eval.mjs
$env:AUDIO_EVAL_CACHE = "$env:APPDATA\ScholarFlow\models"
$env:AUDIO_EVAL_MODEL = "small"
node scripts/evaluate-upload-audio.mjs
$env:AUDIO_EVAL_CACHE = "$PWD\.tmp\phowhisper-eval"
$env:AUDIO_EVAL_MODEL = "phowhisper"
node scripts/evaluate-upload-audio.mjs
node scripts/summarize-phowhisper-eval.mjs
```

Lệnh đầu có mạng, chỉ tải model thử. Inference `allowRemoteModels=false`. Không chạy hai lượt inference đồng thời. Script lưu nguyên văn output, hash từng fixture, số đo và lỗi trong [phowhisper-comparison.json](06_mindmap_audio/11_audio_quality/phowhisper-comparison.json). Bộ file/đáp án [11_audio_quality](06_mindmap_audio/11_audio_quality/README.md) được giữ lâu dài; cache model `.tmp` có thể tải lại. Không build EXE, commit hoặc push trong lượt này.
