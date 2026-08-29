# ScholarFlow — Chức năng và giới hạn

Cập nhật 29/08/2026. Tài liệu này và mục **Giới hạn hiện tại** trong [README](README.md) là nơi mô tả phạm vi. Không có mục “Chức năng và giới hạn” riêng trong app; giao diện chỉ giữ hướng dẫn thao tác và thông báo cần thiết.

## 1. Lưu và quản lý tài liệu

- Nhận PDF, DOCX, PPTX, EPUB, XMind, ảnh PNG/JPG/WebP và audio MP3/WAV/M4A. Sao chép file vào thư viện local, xử lý theo hàng đợi.
- Không có tài khoản hay đồng bộ cloud. Xóa bản sao trong app không xóa file nguồn ngoài app. Người dùng cần tự sao lưu thư viện.
- File sai định dạng, vượt giới hạn, hỏng, mã hóa/có mật khẩu hoặc có cấu trúc không hỗ trợ có thể bị từ chối. File thử quá dung lượng được giữ trong bộ test, không phải tài liệu dùng để trích xuất.

## 2. Trích xuất và OCR

- Đọc chữ/cấu trúc có sẵn và bổ sung OCR Việt–Anh cho ảnh, trang scan.
- Bảng có cấu trúc trong DOCX/PPTX khác với bảng dưới dạng ảnh. Không bảo đảm giữ đủ ô, thứ tự hoặc đúng ký hiệu công thức.
- Biểu đồ/sơ đồ: có thể lấy một phần nhãn/chú thích, **không bảo đảm đọc hết chữ và không diễn giải quan hệ/đường nối**. Ảnh nhìn rõ vẫn có thể nhận dạng sai.
- Đối chiếu Nội dung đã trích xuất với File gốc; truy vấn OCR vùng chọn có thể sửa trước khi tìm lại.

## 3. Mind map và XMind

- Đọc cây nhánh cha–con, ghi chú, nhãn; hiển thị/OCR ảnh nhúng PNG/JPEG/WebP theo nhánh.
- App tự sắp xếp bố cục, không tái tạo hoàn toàn giao diện XMind. Chưa hỗ trợ liên kết chéo, mọi loại đính kèm hoặc file có mật khẩu.
- Mind map ảnh/PDF chủ yếu tìm theo chữ; không suy luận từ đường nối.

## 4. Âm thanh

- Chỉ **thêm file audio**, không còn micro tìm kiếm. MP3/WAV/M4A tối đa 25 MB, 60 phút.
- **Whisper Small + Silero VAD**, local, không dùng Pho. VAD nằm trong gói Small (thêm khoảng 2,3 MB), tải có kiểm SHA-256.
- VAD đánh dấu lời nói, bỏ cửa sổ không lời nói; không khử sạch nhiễu nằm cùng lời nói, không sửa từ Small nghe sai.
- Chữ tiếng Việt thường, dấu, tên riêng và câu trộn Anh–Việt có thể sai hoặc thiếu. Chưa bảo đảm giọng thật/địa phương, nhiều người nói chồng nhau, nhạc/nhiễu phức tạp.
- Nguồn theo cửa sổ tối đa 30 giây, có tìm khoảng nghỉ; không phải mốc chính xác từng từ. Không nhận diện người nói, chưa có giao diện sửa bản chép tài liệu.
- Mẫu Anh 123 từ đạt toàn bộ từ sau chuẩn hóa; mẫu Việt MP3 còn 17 phép sửa/150 đơn vị cách nhau bằng khoảng trắng. Đây là mẫu giọng tổng hợp, không phải cam kết độ chính xác trên mọi file.

## 5. Tìm kiếm

- Tìm theo mô tả hoặc chữ lấy từ vùng ảnh/file được chọn, kết hợp ngữ nghĩa, từ khóa và bộ lọc. Trả đoạn nguồn và lý do phù hợp.
- Chỉ tìm trong thư viện đã có dữ liệu; không tìm Internet, giải bài hay bảo đảm nguồn trả lời được câu hỏi. Không tìm tương đồng hình ảnh thuần túy.
- Chất lượng OCR/chép lời ảnh hưởng tìm kiếm. Có thể không có kết quả hoặc gợi ý chưa sát; người dùng cần kiểm tra nguồn.
- Thiếu BGE-M3: chưa thể tạo vector/tìm ngữ nghĩa; cài xong chạy lại bước lỗi. File dùng làm truy vấn không tự thêm vào thư viện.

## 6. Bản xem và nguồn

- Xem file, mở đoạn liên quan, giữ trạng thái khi quay lại; mở thư mục chứa bản sao.
- DOCX/PPTX/EPUB là bản xem chuyển đổi, không bảo đảm bố cục giống phần mềm gốc. Vị trí chỉ tới trang/slide/chương/nhánh/đoạn, không luôn chính xác từng chữ.

## 7. AI phân loại và tóm tắt

- Qwen qua Ollama local hoặc OpenRouter/Custom API. AI chỉ chọn môn học đang có, có thể để chưa phân loại; người dùng thêm/sửa/xóa môn và sửa kết quả phân tích.
- Phân loại/tóm tắt có thể sai. Kết nối trực tuyến cần key/model hợp lệ, có thể tính phí/giới hạn tốc độ và **gửi nội dung phục vụ phân tích tới provider**.
- Không cấu hình AI vẫn dùng được trích xuất/tìm kiếm với model local cần thiết; bước phân tích được bỏ qua.

## Phân biệt giới hạn và lỗi

Chất lượng nhận dạng chưa hoàn hảo là giới hạn được công khai, **không phải lý do bỏ qua hồi quy mới**. Văng app, mất dữ liệu, kẹt tiến trình, kết quả cũ ghi đè mới hoặc báo hoàn tất với nội dung rỗng là lỗi phải điều tra và sửa.

Bộ test cố định: [hướng dẫn đầy đủ](learning-resource-app/test-fixtures/scholarflow/HUONG_DAN_TEST_FULL_SCHOLARFLOW.md). Không xóa mẫu, báo cáo và kết quả đối chứng khi dọn file tạm.

Kiểm chứng bản Small + VAD và giao diện giới hạn: [báo cáo 29/08/2026](learning-resource-app/test-fixtures/scholarflow/CHOT_SMALL_VAD_VA_GIOI_HAN_2026-08-29.md). Đạt các ca đã kiểm không đồng nghĩa nhận dạng hoàn hảo hoặc bảo đảm không còn lỗi ở mọi đầu vào.
