# Kiểm tra chất lượng nhận dạng câu ngắn — 28/08/2026

## Kết luận

Chất lượng voice chưa đạt trên bộ câu ngắn này. Không phải app chỉ có model tiếng Anh. Tìm bằng mic và thêm audio dùng chung `onnx-community/whisper-base`, CPU q8, cùng hàm chọn kết quả Việt/Anh. Không thay model hoặc sửa hành vi app trong lượt chẩn đoán này.

Đã tái hiện sai chữ với giọng tổng hợp nam/nữ, không cần mic người dùng. Chưa có bản ghi mic thật nên không khẳng định đã tái hiện chính xác toàn bộ lỗi mà người dùng nghe/thấy.

## Cách kiểm tra

- Tạo 8 bản đọc tổng hợp: 2 câu Việt với HoaiMy/NamMinh; `computer science` và `database` với Jenny/Guy.
- Gửi cùng âm thanh qua hàm upload (MP3) và hàm voice (WebM Opus 64 kbps, 48 kHz), dùng FFmpeg/model thực tế đã cài. Thêm 2 audio mẫu VI/EN cũ: tổng 20 lượt nhận dạng.
- Nạp nguyên hàm từ `embedding-runtime/service.mjs` vào tiến trình chẩn đoán, chỉ bổ sung kết quả trung gian (bản Việt/Anh và điểm chọn) vào báo cáo, không sửa file runtime.
- Chạy thêm 8 lượt cấu hình đối chiếu và 4 lượt POST vào `/api/search/voice` của bản dev thực tế (không ghi tài liệu vào thư viện, không ghi âm môi trường).
- So sánh từ sau chuẩn hóa hoa/thường, dấu câu; không coi chỉ khớp vài từ khóa là chép đúng cả câu.

## Kết quả API bản dev đang chạy

| Nội dung mẫu | Kết quả thực tế | HTTP / thời gian |
|---|---|---|
| Tìm tài liệu về mạng máy tính | Tìm tay liệu về mạng máy tính? | 200 / 2,62 giây |
| Tìm tài liệu về cơ sở dữ liệu | Đi mọi người có thể làm những người thay đổi những người thay đổi. | 200 / 2,97 giây |
| computer science | Computer Science | 200 / 1,94 giây |
| database | Data base. | 200 / 1,86 giây |

Đây là mẫu tổng hợp, không phải bản chép lời từ mic thật của người dùng. HTTP 200 chỉ biểu thị xử lý thành công, không chứng minh chất lượng nhận dạng.

## Hai vấn đề tách biệt

1. **Cách chọn ngôn ngữ sai trên từ ngắn:** với `database` giọng nam, nhánh `en` trả `Database`, nhánh `vi` trả `Data base.`. Điểm tự tính lần lượt 0,18 và 0,20 khiến app chọn bản Việt. Đây là điểm theo số từ/dấu, không phải độ tin cậy âm học. Giọng nữ dạng MP3 cũng gặp trường hợp này, WebM thì đúng. `computer science` đúng cả nam/nữ và cả hai đường.
2. **Nhận dạng tiếng Việt sai ngay trong nhánh Việt:** cả 4 bản đọc Việt (2 câu × 2 giọng), qua cả hai đường, không đạt khớp toàn bộ từ. Câu mạng máy tính sai `tài` thành `tay`; câu cơ sở dữ liệu giọng nam sai thành `các sợ dữ liệu`; giọng nữ có thể sinh câu không liên quan. Không thể chữa hết bằng chọn ngôn ngữ.

Mẫu Việt dài cũ nhận được các từ khóa mạng máy tính/cơ sở dữ liệu nhưng sai tên ScholarFlow. Hai đường đều trả cùng kết quả với mẫu này. Bài test cũ chỉ assert từ khóa nên vẫn PASS; đó không phải bằng chứng chép lời hoàn hảo.

## Thử cấu hình đối chiếu

- Ép `vi`, tắt timestamps: hai mẫu cơ sở dữ liệu vẫn sai.
- Ép `en`, tắt timestamps: `database` đúng cả hai giọng.
- Bỏ tham số language ở runtime Transformers.js đang cài: xuất cảnh báo `No language specified - defaulting to English (en).` Không được coi đây là tự phát hiện ngôn ngữ.

## Hướng tiếp theo (chưa triển khai)

- Sửa cơ chế chọn ngôn ngữ, cho người dùng chỉ định VI/EN khi cần; không hứa bước này chữa được nhận dạng tiếng Việt.
- Đánh giá các cấu hình/model tiếng Việt trên chính bộ câu ngắn và bản ghi thật được người dùng chủ động cung cấp trước khi thay model.
- Giữ bộ test lifecycle/API riêng với bộ đánh giá chất lượng câu chữ. Không dùng tiêu chí tìm thấy từ khóa để tuyên bố chất lượng voice đạt.

## Tái chạy / giới hạn

Script và báo cáo thô của lượt chẩn đoán nằm tại `.tmp/voice-language-audit/` trong app: `generate.py`, `audit.mjs`, `live.mjs`, `report.json`, `variants.json`, `live.json`. Đây là đầu ra tạm, không phải fixture đã đóng gói; `live.mjs` dùng cổng của phiên dev lúc kiểm tra và cần đổi khi khởi động lại. `audit.mjs` bỏ qua các ca đã có kết quả trong JSON.

Chưa kiểm mic thật/tiếng ồn/giọng địa phương trong lượt này. Chưa đo độ chính xác tổng quát trên tập dữ liệu lớn. Không thu hoặc gửi âm thanh của người dùng lên mạng; chỉ gửi bốn câu công khai cho dịch vụ tạo giọng mẫu. Không tải model mới, không thay dữ liệu thư viện.
