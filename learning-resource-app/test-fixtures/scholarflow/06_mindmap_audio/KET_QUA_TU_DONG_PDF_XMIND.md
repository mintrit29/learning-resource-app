# Kết quả kiểm thử PDF mind map / XMind - 27/08/2026

## Đã kiểm tra

- XMind JSON và XML: cùng 2 sơ đồ, 12 nhánh, chữ Việt/Anh, ghi chú, nhãn, nhánh con và nhánh rời. Kết quả text và vị trí nguồn bằng nhau hoàn toàn giữa hai file mẫu.
- Chặn ZIP hỏng, thiếu content, JSON sai, khai báo XML entity, quá nhiều nhánh/quá sâu và content giải nén quá 8 MB. Nội dung HTML trong tiêu đề/ghi chú không được thực thi ở preview.
- PDF chữ: phát hiện và sửa lỗi chunker Docling bỏ các tiêu đề đứng riêng (bao gồm chủ đề trung tâm). Sau sửa: **26/26** cụm chữ đúng trang.
- PDF scan: không có text layer; chạy OCR thật, **24/26** cụm đúng dấu. Hai cụm còn sai: “chi phí” thành “chỉ phí”; “vận chuyển” thành “vận chuyền”. Chữ tiêu đề trang cũng có thể bị nhận sai dấu. Không tuyên bố OCR chính xác 100%.
- Đã render và xem đủ 4 trang của 2 PDF để xác nhận chữ, hộp nhánh và đường nối không bị cắt/chồng.
- Nhập đủ 4 file bằng nút trên giao diện app local dùng database thử riêng. Tạo **38 chunk**, tất cả có BGE-M3 thật **1.024 chiều**. Không chỉnh/xóa thư viện người dùng.
- Không cấu hình AI cloud trong database thử: 4 job phân loại báo chưa có kết nối (đúng dự kiến), nhưng trích xuất/chunk/embedding hoàn thành và tìm vẫn dùng được.
- Tìm `SF-XM-3NF-73` với bộ lọc XMind trả về 2 file, đúng nhánh 3NF của sơ đồ 2. Đã bấm mở kết quả trên giao diện, xem vùng tô nổi bật, quay lại còn câu tìm và kết quả.
- Tìm `mind map mặt nạ mạng con` trả cả PDF và XMind; không ép về file IMAGE.
- Trích xuất lại XMind giữ 12 chunk/vector; file hỏng nhận HTTP 422 và không tạo bản ghi tài liệu.
- Chế độ “Ảnh hoặc file”: XMind xem cây, chuyển sơ đồ 1 → 2 đúng nội dung.
- Unit test hiện có, test XMind/PDF mới, lint, TypeScript, production build và standalone startup đều đạt.
- Bản production standalone nhận XMind và xem sơ đồ 2 ngay cả khi không có runtime Docling.

## Kiểm tra desktop bổ sung

- Đã thao tác thật trên Electron với PNG, PDF chữ/scan và XMind JSON/XML. **Còn lỗi vùng chọn/trang PDF khi quay lại, kéo PDF, giữ cuộn XMind và OCR tên riêng.** Xem [báo cáo hồi quy GUI](KIEM_THU_HOI_QUY_GIAO_DIEN.md) với bước tái hiện và ca đã qua. Không coi kết quả tự động phía trên là xác nhận hết lỗi giao diện.

## Chưa xác nhận

- Chưa đóng gói/cài lại EXE hoặc phát hành GitHub trong đợt này; đây là thay đổi source/dev và production standalone.
- Chưa thử mở các fixture XMind trong mọi phiên bản ứng dụng XMind chính thức.

Không mở rộng kết luận của các file mẫu thành bảo đảm mọi sơ đồ đều trích xuất đúng. Hình nhúng, đường nối chéo, file có mật khẩu và OCR chữ nhỏ/mờ vẫn theo giới hạn đã ghi trong hướng dẫn.
