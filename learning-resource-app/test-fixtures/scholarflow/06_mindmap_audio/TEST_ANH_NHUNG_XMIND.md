# Ảnh nhúng XMind — 0.1.4

Giữ bộ file này trong Git để cả nhóm dùng lại. Không dùng tài liệu cá nhân.

## Test nhanh

1. Cài BGE-M3 và Docling trong Cài đặt → Thành phần cục bộ.
2. Thêm `09_xmind_anh_nhung.xmind` và `10_xmind_anh_nhung_legacy.xmind` vào thư viện. Hai file có cùng nội dung, khác cấu trúc JSON/XML.
3. Mở chi tiết: sơ đồ có ảnh Việt, Anh và công thức; nội dung trích xuất có `OSPF`, `Database transactions` và `log V`, kèm đúng nhánh/sơ đồ. Ảnh trắng, hỏng, thiếu và URL ngoài được báo trong bước trích xuất, không làm mất chữ gốc.
4. Tìm `Database transactions`: phải tìm được hai tài liệu. Mở đoạn liên quan phải dẫn về sơ đồ 1/nhánh ảnh tiếng Anh.
5. Tìm tài liệu → Ảnh hoặc file → mở file 09. Khoanh ảnh Việt: query có OSPF. Khoanh ảnh Anh: query mới có Database transactions, không dính OSPF.
6. Zoom 150%, kéo để xem rồi khoanh ảnh. Mở kết quả → Quay lại: giữ query, vùng chọn, zoom và vị trí xem, không tự OCR lại.
7. Đổi sơ đồ 2: xóa query/vùng cũ; ảnh Việt dùng lại vẫn hiện. Thử file 10 tương tự.
8. Trích xuất lại file 09: nội dung ảnh vẫn còn; không nối thêm bản OCR trùng.

## Kết quả đã đo / giới hạn

- Test tự động JSON/XML, chữ Việt/Anh/công thức mẫu, ảnh lặp ở sơ đồ khác, blank/corrupt/missing/external, đường dẫn thoát ZIP, ảnh nén quá lớn: đạt trên runtime local ngày 27/08/2026.
- Có lỗi dấu cụ thể: `Định tuyến` có thể thành `Định tuyên`. Không cam kết OCR đúng 100%; bảng phức tạp, chữ nhỏ, công thức nhiều tầng và hình không có chữ vẫn có giới hạn. Không suy luận nội dung sơ đồ.
- Chỉ ảnh nằm trong resources/attachments của file. Không tải URL ngoài, không đọc đường dẫn trên máy. PNG/JPEG/WebP tối đa 8 MB/ảnh, 32 MB tổng, 100 lượt ảnh, 16 triệu pixel/ảnh. Vượt giới hạn báo riêng và giữ chữ nhánh.
- JSON topic.image và ghi chú HTML dạng chuỗi, XML xhtml:img được đọc; định dạng ghi chú phong phú riêng của từng bản XMind chưa được cam kết đầy đủ.
- Bộ cài thật sẽ được kiểm trên Windows GitHub-hosted runner trước khi phát hành; báo cáo và trace nằm trong artifact `installed-exe-diagnostics`. Không chạy test này trên máy đang làm việc của người dùng.

## Lệnh cho người phát triển

`node scripts/generate-xmind-image-fixtures.mjs` tạo lại fixture. `npm run test:xmind-images` kiểm OCR thật (cần runtime Docling). `npm run test:installed-release` chỉ được phép chạy trên GitHub-hosted Windows, cài EXE và dùng model thật.
