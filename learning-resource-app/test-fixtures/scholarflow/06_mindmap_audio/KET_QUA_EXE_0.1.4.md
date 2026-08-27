# Kết quả EXE 0.1.4 — 28/08/2026

## Bản đã phát hành

- [ScholarFlow Desktop 0.1.4](https://github.com/mintrit29/learning-resource-app/releases/tag/v0.1.4-desktop), đánh dấu prerelease để nhóm tiếp tục nghiệm thu.
- Commit đóng gói: `f0f32c4ec253cb5764125951c5e9d9e887e18fe3`.
- File `ScholarFlow-Setup-0.1.4.exe`: 295.572.534 byte.
- SHA-256: `9466d0be2f2cec5800cd565da4ee818058262615e1d57e07413dfdfbe7fbdc88`.
- [CI của đúng commit](https://github.com/mintrit29/learning-resource-app/actions/runs/33097201259), [báo cáo tự động đính kèm release](https://github.com/mintrit29/learning-resource-app/releases/download/v0.1.4-desktop/release-report.md).

Workflow release chỉ lấy artifact của CI thành công trên đúng commit, kiểm checksum và phát hành chính installer đó, không build lại. Đã xác nhận EXE, checksum và báo cáo tải được từ release công khai.

## Đã kiểm thực tế

Thực hiện trên GitHub-hosted Windows runner, cài NSIS thật vào thư mục tạm và dùng database/profile riêng. Không cài, mở cửa sổ hoặc điều khiển chuột/bàn phím trên desktop người dùng.

- Lint, toàn bộ unit test, production package và standalone runtime: đạt.
- Cài EXE, mở khi chưa có model, tải/kiểm tra Docling, BGE-M3 và Whisper thật: đạt; không dùng embedding giả.
- Upload qua API của EXE đang chạy: 4 file trong `01_library`; file 04/05 PDF mind map, 06/07 XMind native, 09/10 XMind ảnh nhúng, 02 audio Việt và 03 audio Anh trong thư mục này. Cả 12 file có text, vector 1.024 chiều và tìm lại được nguồn.
- XMind JSON/XML có ảnh: lấy được nội dung mẫu Việt/Anh/công thức, gắn đúng nhánh/sơ đồ; trích xuất lại đạt.
- GUI: mở kết quả OCR tiếng Anh đúng nhánh ảnh tiếng Anh; trước đó đã tìm và sửa lỗi chọn nhầm nhánh ảnh tiếng Việt do so khớp bỏ dấu.
- GUI: chọn vùng ảnh XMind ở zoom 150%, nhận dạng và tìm; mở kết quả rồi quay lại giữ query, khung chọn và vị trí cuộn.
- GUI: đổi sơ đồ xóa query cũ; PDF mở trang 2, zoom và kéo để xem đạt.
- GUI: thêm Custom API, lưu rồi tải lại trang; restart EXE vẫn giữ kết nối và trạng thái model. Không gọi provider trả phí thật.
- Không ghi nhận JavaScript exception từ renderer trong các ca GUI này.
- Unit bổ sung: PNG/JPEG/WebP, ghi chú có ảnh, ảnh trắng/hỏng/thiếu, URL ngoài, path traversal, file/kích thước ảnh vượt giới hạn và giới hạn số ảnh.

## Giới hạn và việc còn theo dõi

- Đây là kết quả trên bộ fixture, không phải bảo đảm mọi tài liệu và mọi máy đều không có lỗi. Không phải tất cả nút đều được bấm lại bằng GUI trong lượt này; upload/chunk/vector/search chủ yếu kiểm qua API/database của EXE đang chạy.
- OCR có thể mất dấu: mẫu `tuyến` có lúc thành `tuyên`. Công thức, bảng và chữ nhỏ/phức tạp không được bảo đảm trích xuất hoàn hảo; OCR chữ không đồng nghĩa hiểu biểu đồ.
- XMind được tự sắp xếp lại bố cục. Chỉ hỗ trợ ảnh nhúng PNG/JPEG/WebP nội bộ; ảnh thiếu/hỏng/không hỗ trợ có cảnh báo, vẫn giữ chữ nhánh. Không tải ảnh URL ngoài.
- Một [lượt CI trước](https://github.com/mintrit29/learning-resource-app/actions/runs/33095811099) từng timeout ở bước xử lý upload sau 240 giây. Chưa xác định nguyên nhân từ dữ liệu có được; không kết luận đã sửa nguyên nhân đó. Đã bổ sung tên fixture/trạng thái job khi timeout. Lượt sau `33096501296` đạt và bản phát hành này cũng vượt qua toàn bộ suite; tiếp tục theo dõi nếu tái diễn.
- `npm audit --omit=dev` tại thời điểm kiểm còn 5 mục mức high: `@prisma/config`, `deepmerge-ts`, `prisma`, `nanoid`, `undici` (không đồng nghĩa 5 lỗ hổng độc lập). Chưa nâng cấp dependency trong đợt này, chưa xác minh đầy đủ mục nào thực sự đi vào EXE hoặc có thể khai thác. Không tuyên bố audit sạch.
- Chưa kiểm phản hồi thật từ OpenRouter/Custom API/Ollama trong lượt EXE này; chỉ kiểm lưu cấu hình Custom API. Chưa kiểm mọi thiết bị âm thanh hoặc mọi biến thể XMind bên ngoài fixture.

## Nhóm kiểm lại nhanh

Giữ nguyên bộ fixture. Làm theo [TEST_ANH_NHUNG_XMIND.md](TEST_ANH_NHUNG_XMIND.md) với file 09 và 10; hướng dẫn PDF/XMind native nằm trong [TEST_PDF_XMIND.md](TEST_PDF_XMIND.md). Nếu có lỗi, ghi tên file, nhánh/sơ đồ, thao tác và ảnh chụp; không chỉ ghi “OCR sai”.
