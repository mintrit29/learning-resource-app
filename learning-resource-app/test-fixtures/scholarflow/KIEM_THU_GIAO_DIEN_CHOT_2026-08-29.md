# Kiểm thử giao diện chốt — 29/08/2026

## Môi trường

- Production build + standalone đã chạy lại sau khi đồng bộ static assets.
- SQLite và thư mục upload QA riêng trong `.tmp/final-gui-audit-20260829b`; không đọc hoặc sửa thư viện thật.
- Docling và BGE-M3 thật, không mock. Custom API dùng địa chỉ loopback không hoạt động để kiểm nhánh lỗi; không gửi dữ liệu ra Internet.
- Browser nền kiểm giao diện Next bên trong app; không thay thế kiểm thử Electron IPC hoặc hộp thoại Windows.

## Đã thao tác và đạt

- Dashboard thư viện rỗng hiển thị đúng trạng thái, điều hướng chính hoạt động.
- Cài đặt chỉ còn Thành phần cục bộ, Kết nối AI và Danh sách môn học; không còn mục `/help` hay liên kết giới hạn đã gỡ.
- Thêm môn QA, lọc, sửa tên và xóa nội dung ô lọc; dữ liệu cập nhật sau refresh.
- Tạo Custom API loopback, rời/reload trang vẫn còn cấu hình. Kiểm tra endpoint offline báo “Không kết nối được…” và trạng thái “Có lỗi”, không kẹt nút hay lộ HTML/JSON.
- Chọn PDF thật bằng nút **Chọn file**, thấy đúng tên/dung lượng, bấm **Thêm vào thư viện** và tự chuyển sang chi tiết.
- PDF qua Docling tạo 1.360 ký tự, 6 chunk và BGE-M3 hoàn thành. AI lỗi do chủ động đặt provider offline nhưng tài liệu vẫn tìm được.
- Mở nội dung đã trích xuất, file gốc và đoạn nguồn. Tìm “khóa chính trong cơ sở dữ liệu” trả đúng PDF/trang; mở nguồn rồi quay lại giữ nguyên câu và kết quả.
- Bấm **Trích xuất lại**, xác nhận thật trên tài liệu QA: giao diện chuyển qua Đang đọc nội dung rồi hoàn tất lại 1.360 ký tự/6 chunk; dữ liệu cũ vẫn hiện trong lúc xử lý.
- Tìm bằng ảnh: mở `01_anh_cau_hoi_ospf.png`, chuyển Chọn vùng, kéo vùng câu hỏi; OCR trả câu OSPF và tự tìm. Không có nguồn phù hợp là đúng vì thư viện QA chỉ có PDF cơ sở dữ liệu.
- Không có lỗi ứng dụng mới trong console của các luồng trên. Một thông báo `MutationObserver.observe` xuất hiện khi Browser nền quan sát iframe PDF; không có `MutationObserver` trong mã app, mở URL PDF trực tiếp không phát sinh, và Electron không nạp công cụ quan sát này. Ghi nhận là nhiễu của công cụ kiểm thử, không sửa mã sản phẩm.

## Đã có kiểm tự động nhưng chưa phải GUI Electron đầy đủ

- PDF/DOCX/PPTX/EPUB, OCR, XMind/ảnh nhúng, audio Small+VAD, chunk, queue, SQLite/vector, tìm kiếm và preview đều nằm trong `npm run test:unit` đã đạt.
- Logic tải mới/resume/checksum/cancel/verify/remove model dùng server/file giả đã đạt; standalone startup và migration đạt.
- Upload audio 26 fixture với Small+VAD/BGE thật đã đạt theo `CHOT_SMALL_VAD_VA_GIOI_HAN_2026-08-29.md`.

## Vẫn cần acceptance thủ công trên Electron/Windows

Không dùng các mục này để tuyên bố “đã test hết giao diện”:

1. Thành phần cục bộ qua preload IPC: tải model thật từ đầu, hủy giữa mạng, tải tiếp, xác minh, xóa và cài lại; mất mạng/hết dung lượng; chặn xóa khi tài liệu đang chạy.
2. Hộp thoại Windows: Quét thư mục, Hiện file trong thư mục, Lưu bản sao/Tải `.txt`, kéo-thả từ Explorer và liên kết mở file ngoài.
3. Chấp nhận thật các hộp xác nhận xóa tài liệu/môn/provider/model. Logic và nhánh Hủy đã kiểm; lượt này không thực hiện mọi thao tác xóa qua GUI.
4. OpenRouter/Custom API với key và dịch vụ thật, rate limit/hết quota; Ollama/Qwen tải và chạy thật. Lượt này chỉ kiểm persistence và lỗi offline.
5. Âm thanh phát ra loa, nhiều thiết bị âm thanh; thao tác kéo/zoom/cuộn trực tiếp trong cửa sổ Electron với mọi định dạng.
6. Điều kiện hệ thống khó mô phỏng: khóa file, hết RAM/ổ đĩa, tắt app/mất điện đúng lúc ghi, nhiều cửa sổ hoặc hàng trăm tài liệu.

## Kết luận

Không tìm thấy lỗi sản phẩm mới trong các luồng giao diện nền vừa chạy. Các luồng chính đã có bằng chứng tốt, nhưng vẫn chưa trung thực nếu nói mọi hành vi native/online đều đã được test. Trước buổi bảo vệ nên chạy checklist acceptance 1–5 trên chính Electron; không cần lặp lại benchmark độ chính xác OCR/ASR đã biết giới hạn.

## Bổ sung acceptance Electron/Windows cùng ngày

Lượt này chạy trực tiếp cửa sổ Electron bằng hồ sơ QA riêng tại `%TEMP%\ScholarFlow-QA-20260829`; thư viện thật của người dùng không bị sửa. Theo yêu cầu, không mô phỏng trường hợp hết ổ đĩa.

### Đạt

- Hộp thoại **Quét thư mục** chỉ chọn thư mục nhưng app vẫn quét đúng các định dạng hỗ trợ bên trong.
- Hộp thoại **Chọn file** nhận XMind; **Hiện file trong thư mục** mở Explorer và chọn đúng tên gốc; **Lưu bản sao** giữ tên và phần mở rộng gốc.
- Upload XMind có ảnh nhúng: trích xuất 1.029 ký tự/14 chunk, dựng lại sơ đồ và hiển thị ảnh nhúng.
- Tìm bằng PDF hai trang: render đúng sơ đồ, chọn vùng chữ tiếng Việt, OCR đúng nội dung và trả nguồn liên quan.
- Tìm bằng XMind: dựng bố cục sơ đồ, chọn trực tiếp vùng ảnh nhúng, OCR đúng `Định tuyến OSPF dùng trạng thái liên kết` và tự tìm được nguồn.
- Upload audio `.m4a`, đóng app giữa lúc xử lý rồi mở lại: job bị gián đoạn được xếp lại và hoàn tất 2/2; trình phát phát/tạm dừng bình thường.
- Khởi chạy Electron lần hai không tạo cửa sổ trùng; tiến trình thứ hai thoát, cửa sổ đang chạy vẫn dùng được.
- Xác minh BGE-M3, Docling và Whisper trực tiếp từ **Thành phần cục bộ** đều đạt. Hộp xác nhận xóa model xuất hiện; chọn Hủy không làm mất file.
- Ollama được nhận diện và liệt kê model hiện có. Máy QA không có Qwen local nên app giữ nút tải, không giả vờ sẵn sàng và không treo.
- Khóa file nguồn rồi **Trích xuất lại**: job báo lỗi thân thiện, không văng app và không mất bản trích xuất cũ. Sau khi bỏ khóa, chạy lại hoàn tất 1.029 ký tự/14 chunk.
- `test:component-manager` và `test:ux-regression` đều đạt, gồm tải tiếp Range, checksum sai, hủy tải, path containment, trạng thái model và hồi quy UX.

### Lỗi phát hiện và đã sửa

- Sau khi API chấp nhận **Trích xuất lại**, modal đóng nhưng state `loading` cũ không được trả về `false`. Nếu job thất bại rồi người dùng mở lại modal, nút bị kẹt ở **Đang bắt đầu**. Đã reset state khi request thành công và mỗi lần mở modal; tái hiện lại đúng kịch bản khóa file rồi phục hồi đã đạt.
- Lỗi xử lý/preview/OCR/tìm kiếm từng có thể đưa nguyên `error.message` kỹ thuật lên khối cảnh báo màu đỏ, tạo đoạn rất dài chứa đường dẫn, HTML hoặc chi tiết runtime. App nay ánh xạ lỗi khóa file, thiếu file, hết dung lượng và timeout thành câu tiếng Việt ngắn; lỗi kỹ thuật khác dùng thông báo an toàn, còn chi tiết đầy đủ chỉ ghi vào log. Hồi quy HTML, `Unexpected token`, đường dẫn Windows và lỗi dài đã đạt.

### Còn là giới hạn có chủ đích

- Không kiểm tra hết ổ đĩa trong lượt này.
- Không gọi OpenRouter thật hoặc kiểm tra quota/rate-limit của dịch vụ ngoài.
- Các thao tác phá hủy bên dưới chỉ chạy trong hồ sơ QA riêng, không đụng thư viện thật của người dùng.

## Bổ sung chốt vòng đời dữ liệu, model và Ollama

### Xóa rồi phục hồi tài liệu thật trong hồ sơ QA

- Xóa `09_xmind_anh_nhung.xmind`: API trả 200, bản ghi SQLite và file lưu trong app đều biến mất.
- Thêm lại đúng fixture: tạo ID mới, hoàn tất EXTRACT/CHUNK/EMBED, giữ 1.029 ký tự, 14 chunk và vector BGE-M3 1.024 chiều.
- Tìm `OSPF Dijkstra mạng máy tính` trả lại đúng tài liệu vừa thêm.
- Khóa file bằng `FileShare.None`, xử lý lại và mở chi tiết tiến trình trên Electron: giao diện chỉ hiện `File đang được ứng dụng khác sử dụng. Hãy đóng file rồi thử lại.`, không lộ stack, đường dẫn hay khối lỗi đỏ dài. Dữ liệu cũ vẫn giữ nguyên. Mở khóa và xử lý lại lần cuối đạt trạng thái **Sẵn sàng tìm kiếm**, 1.029 ký tự/14 chunk.

### Xóa rồi cài lại model thật

- Xóa Whisper Small + VAD khỏi hồ sơ QA: trạng thái chuyển sang `missing`, dung lượng 0 byte.
- Thử upload audio khi thiếu model: API chặn trước khi ghi file, trả 503 cùng hướng dẫn tới **Cài đặt → Thành phần cục bộ**; không tạo tài liệu rác.
- Cài lại từ manifest thật, gồm tải xuống, kiểm SHA-256 và xác minh: đạt `ready`, 254.174.137 byte (khoảng 242 MB).
- Trích xuất lại `mixed.m4a` sau khi cài: hoàn tất trong khoảng 67,6 giây, 1.541 ký tự, 5 chunk, vector 1.024 chiều. Các sai khác nhỏ trong phiên âm tiếng Việt vẫn là giới hạn Small+VAD đã ghi riêng, không phải lỗi luồng xử lý.
- BGE-M3 và Docling vẫn `ready`; giao diện Thành phần cục bộ hiển thị đủ ba thành phần.

### So sánh model Ollama thật trên máy đích

Đã cài và giữ lại hai model để có thể chọn trực tiếp trong app:

- `qwen3:4b-instruct`: 2,5 GB, phù hợp nhất làm phương án local trên máy 16 GB RAM/Quadro T2000 4 GB.
- `qwen3:1.7b`: 1,4 GB, phương án nhẹ hơn.

Benchmark dùng đúng schema phân tích của app với cùng đoạn tiếng Việt về OSPF, chạy hai lượt:

| Model | Thời gian thực tế | Kết quả |
| --- | --- | --- |
| `gemma4:31b-cloud` đang dùng qua Custom API Ollama | 0,96 giây; 0,91 giây | Đúng schema, chủ đề, độ khó, ngôn ngữ và tóm tắt. Tốt nhất cho demo khi có mạng. |
| `qwen3:4b-instruct` local | 27,7 giây; 15,4 giây | Đúng schema/chủ đề/độ khó; nhầm metadata ngôn ngữ thành English. Dùng được khi cần offline và riêng tư. |
| `qwen3:1.7b` local | 15,6 giây; 8,2 giây | Đúng schema nhưng chọn sai chủ đề OSPF với confidence 0; app an toàn không tự gán vì dưới ngưỡng 0,75. Chỉ nên dùng khi ưu tiên nhẹ. |

Kết luận: giữ Custom API `gemma4:31b-cloud` làm lựa chọn tốt nhất hiện tại; dùng Qwen 4B làm fallback local. Qwen 1.7B chạy được nhưng không nên là mặc định. Không chọn Qwen 8B vì catalog yêu cầu từ 18 GB RAM, vượt cấu hình máy.
