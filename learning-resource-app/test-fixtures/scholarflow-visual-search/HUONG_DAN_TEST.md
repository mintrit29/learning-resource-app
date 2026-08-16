# Bộ kiểm thử ScholarFlow - tìm bằng vùng chọn

Bộ này được tạo tổng hợp, không lấy từ Internet. Nội dung trong thư mục `library` là nguồn để nhập vào thư viện; nội dung trong `queries` chỉ dùng tại **Tìm kiếm → Mở ảnh hoặc file để tìm**.

## 1. Chuẩn bị thư viện

Nhập lần lượt bốn file sau và đợi trạng thái xử lý hoàn tất:

1. `library/01_mang_may_tinh_ospf.docx`
2. `library/02_co_so_du_lieu_text.pdf`
3. `library/03_thuat_toan_do_thi.pptx`
4. `library/04_an_toan_thong_tin.epub`

Không nhập các file trong `queries` vào thư viện.

## 2. Các ca kiểm tra chính

### Ảnh có nhiều vùng

Mở `queries/01_anh_cau_hoi_ospf.png`.

- Chọn ô câu hỏi OSPF phía trên: kết quả nên ưu tiên `01_mang_may_tinh_ospf.docx`.
- Chọn ô 3NF phía dưới: kết quả nên ưu tiên `02_co_so_du_lieu_text.pdf`.
- Chọn riêng sơ đồ bên phải: app chỉ nên dùng các nhãn như `OSPF`, `R1`, `R2`; phiên bản hiện tại không suy luận hình học của sơ đồ.

### PDF scan hai trang

Mở `queries/02_de_thi_scan_hai_trang.pdf`.

- Trang 1, Câu 2 về ACID: nên tìm thấy `02_co_so_du_lieu_text.pdf`.
- Trang 2, Câu 4 về Dijkstra: nên tìm thấy `03_thuat_toan_do_thi.pptx`.
- Việc đổi trang phải giữ kết quả cũ cho tới khi chọn vùng mới.

### DOCX nhiều trang

Mở `queries/03_bai_tap_nhieu_trang.docx`, cuộn tới từng câu hỏi và chọn một câu:

- Câu 3NF → PDF cơ sở dữ liệu.
- Câu OSPF → DOCX mạng máy tính.
- Câu hàm băm → EPUB an toàn thông tin.

### PPTX nhiều slide

Mở `queries/04_cau_hoi_do_thi.pptx`.

- Chuyển sang slide 2 và chọn câu hỏi Dijkstra: nên tìm thấy PPTX thuật toán đồ thị.
- Slide 3 cho phép chọn riêng một hàng trong bảng.

### EPUB nhiều chương

Mở `queries/05_tuyen_tap_cau_hoi.epub`.

- Chương 1 về ACID → PDF cơ sở dữ liệu.
- Chương 2 về hàm băm → EPUB an toàn thông tin.
- Chương 3 về subnet → DOCX mạng máy tính.

### Ca biên

- `queries/06_vung_khong_co_chu.png`: app phải báo không nhận ra đủ chữ, không tự bịa query.
- `queries/07_cong_thuc_va_bang.png`: chọn riêng hàng Dijkstra; OCR có thể chưa giữ nguyên hoàn hảo công thức nhưng phải nhận được từ khóa chính.

## 3. Ba thao tác chỉ cần người dùng kiểm tra

1. Kéo và resize khung có cảm giác mượt, tọa độ khớp đúng vùng đang nhìn ở mức zoom bạn thường dùng.
2. Kéo nhanh từ ô OSPF sang ô 3NF: kết quả cuối phải là 3NF, không bị kết quả OSPF cũ ghi đè.
3. Đóng công cụ rồi mở lại: các file trong `queries` không xuất hiện trong thư viện và file gốc bên ngoài app vẫn còn nguyên.

Đáp án máy đọc được nằm trong `expected-results.json`.

## 4. Kết quả kiểm tra tự động đã chạy

- Docling extraction đạt với cả DOCX, PDF, PPTX và EPUB; ảnh nhúng trong DOCX cũng được OCR.
- Preview của app đạt với DOCX, PPTX ba slide và EPUB ba chương.
- OCR nhận được các từ khóa chính `OSPF`, `3NF` và `Dijkstra` trong ảnh/PDF scan/bảng.
- Ảnh không có chữ bị từ chối đúng, không tạo query giả.
- OCR tiếng Việt trong ảnh vẫn có thể mất dấu; công thức `O((V+E) log V)` có lần được đọc thành `O(+E)log V`. Vì vậy hãy đánh giá theo từ khóa/ngữ nghĩa chính, không yêu cầu chuỗi OCR giống tuyệt đối.
