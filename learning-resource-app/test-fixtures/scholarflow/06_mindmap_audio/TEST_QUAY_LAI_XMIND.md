# Hồi quy: mở đoạn liên quan XMind rồi quay lại

## Chuẩn bị

Thêm ba file cạnh tài liệu này vào thư viện:

- `06_mindmap_hien_dai.xmind` (JSON).
- `07_mindmap_legacy.xmind` (XML cũ).
- `09_xmind_anh_nhung.xmind` (ảnh nhúng).

Chờ trích xuất/chia đoạn/embedding hoàn thành. Không cần kết nối AI tóm tắt/phân loại.

## Các bước dễ lặp lại

1. Vào **Tìm tài liệu → Nhập mô tả**, gõ `chuẩn hóa 3NF`.
2. Mở kết quả `06_mindmap_hien_dai`. Trong File gốc phải thấy nhánh **Chuẩn hóa 3NF** được tô xanh, đọc được tiêu đề và nội dung. Đây là sơ đồ 2, không phải sơ đồ mạng máy tính.
3. Bấm **Quay lại kết quả tìm kiếm**. Câu tìm và hai nguồn phải còn nguyên.
4. Mở `07_mindmap_legacy`, kiểm tra giống bước 2.
5. Lặp bước 2–4 ít nhất hai vòng nữa. Phải thử mở xen kẽ hai file, không chỉ lặp một file.
6. Lặp lại bằng nút Back trình duyệt (khi test web nền), rồi mở lại kết quả. Thử tải lại trang chi tiết khi đang ở nhánh 3NF.
7. Đổi câu tìm thành `OSPF trạng thái liên kết`, mở `09_xmind_anh_nhung`. Nhánh **Ảnh tiếng Việt** chứa hình phải được tô, không nhảy nhầm sang Ảnh tiếng Anh.
8. Quay lại, đổi về `chuẩn hóa 3NF`, mở cả hai nguồn lần nữa.

Nếu dùng desktop, thử thêm cuộn xuống nhánh khác bên trong bản xem, quay lại kết quả rồi mở lại. Khi mở đoạn liên quan lần mới, phải đưa về nhánh khớp; không bị mắc ở vị trí đã cuộn trước đó.

## Lỗi đã bắt được ngày 28/08/2026

- Mở JSON → quay lại → mở XML với câu 3NF: đúng nhánh đã được tô, nhưng tiêu đề nằm ở `top=-46,4`, `bottom=-21,2` trong iframe, không nhìn thấy. Đợi trang ổn định vẫn lệch.
- Lặp vòng mở các bản xem đã từng xem cũng gây lỗi. Chỉ mở một file ba lần trong lượt kiểm trước không đủ phát hiện.
- Thử tắt CSS scroll anchoring không giải quyết được và đã bỏ thử nghiệm đó.
- Bản sửa: mỗi lần mở đoạn khớp của bản xem HTML có một mã phiên xem riêng, giữ nguyên sheet/chunk/fragment. Không để lần mở cũ phục hồi vị trí cuộn lấn át vị trí khớp. Phản hồi phiên xem riêng không cache để tránh tích lũy các bản HTML giống nhau.
- Không thay sandbox/CSP, nội dung XMind, đường trích xuất, OCR hoặc model. PDF/ảnh/audio trực tiếp và mở tài liệu thông thường không dùng cơ chế làm mới phiên này.

## Kết quả xác nhận

- Trước sửa: tái hiện nhánh 3NF bị khuất với đúng tọa độ nêu trên, có kiểm ảnh chụp giao diện nền.
- Sau sửa trên build thử nghiệm: 4 lần mở xen kẽ JSON/XML, 2 lần dùng Back trình duyệt, 1 lần reload đều cho tiêu đề 3NF ở `top=93,6`, `bottom=118,8` (iframe cao 518 px).
- Nhánh ảnh Việt của file 09 ở `top=76`, `bottom=206,675`, có 1 ảnh trong nhánh, hiển thị đúng.
- Trên build cuối (đã thêm `no-store` và helper URL): thêm 4 lần mở xen kẽ JSON/XML, cả 4 đều có tiêu đề ở `top=93,6`, `bottom=118,8`.
- `test:ux-regression`, `test:xmind`, `test:xmind-images`, `test:document-preview`, lint và `desktop:build` đều đạt. `desktop:build` chỉ dựng giao diện/runtime, không tạo installer.
- Các con số trên thuộc viewport kiểm thử; trên máy khác không cần bằng đúng pixel, chỉ cần thấy được nhánh khớp dưới thanh tiêu đề bản xem.
- Test tự động `npm run test:ux-regression` kiểm mã phiên mới không làm mất sheet/chunk/fragment, không lặp tham số visit và không chuyển ra origin ngoài app. Test này bổ sung, **không thay thế thao tác UI** ở trên.

Giới hạn: công cụ nền có một số thao tác kéo/keypress trong iframe không thực hiện được hoặc timeout. Không tính những thao tác đó là đạt; cuộn thủ công trong Electron và các kích thước cửa sổ khác vẫn cần kiểm riêng. Không kết luận mọi lỗi XMind có thể có đều đã hết.
