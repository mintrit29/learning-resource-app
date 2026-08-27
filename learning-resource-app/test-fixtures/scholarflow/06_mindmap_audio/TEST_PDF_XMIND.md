# Test nhanh mind map PDF và XMind

Giữ thư mục này trong bộ test chung, không xóa khi dọn cache. Không cần tải model mới cho XMind.

**Cập nhật 27/08:** đã sửa viewer và kiểm lại trên Electron thật. Xem [kết quả sau sửa](KET_QUA_SAU_SUA_VIEWER.md); [báo cáo cũ](KIEM_THU_HOI_QUY_GIAO_DIEN.md) được giữ làm lịch sử tái hiện lỗi. Không suy rộng các mẫu đã đạt thành mọi file đều chính xác.

## 1. Thêm đúng bốn file (khoảng 2-3 phút)

Mở app dev mới → **Thêm tài liệu → Chọn file**. Trong chính thư mục chứa hướng dẫn này, chọn:

| File | Dùng để kiểm tra |
| --- | --- |
| `04_mindmap_text.pdf` | 2 trang mind map có chữ thật |
| `05_mindmap_scan.pdf` | Cùng 2 trang nhưng chỉ có ảnh, buộc chạy OCR |
| `06_mindmap_hien_dai.xmind` | XMind JSON, 2 sơ đồ, có ghi chú và nhánh rời |
| `07_mindmap_legacy.xmind` | XMind XML cũ, nội dung giống file 06 |

Bấm **Thêm vào thư viện**. Đợi các bước đọc nội dung, chia đoạn và embedding hoàn thành. Docling và BGE-M3 cần được cài để chạy cả bộ này. Nếu chưa kết nối AI, phân loại/tóm tắt có thể báo chưa có kết nối; điều đó không được ngăn tìm nội dung.

## 2. Kiểm tra PDF (khoảng 2 phút)

Mở file 04 trong **Tài liệu**, xem trước cả 2 trang rồi mở **Nội dung đã trích xuất**:

- Trang 1 phải có chủ đề **MẠNG MÁY TÍNH** và đủ **Định tuyến OSPF**, **Mô hình TCP/IP**, **Bảo mật mạng**, **Địa chỉ IPv4**.
- Trang 2 phải có **CƠ SỞ DỮ LIỆU**, **Chuẩn hóa 3NF**, **Giao dịch ACID**, **Chỉ mục B-tree**, **Khóa ngoại**.
- Phải có cả nội dung nhỏ trong từng hộp, ví dụ “Trạng thái liên kết”, “Foreign key constraint”.
- Lặp lại với file 05. Không được trống nội dung; OCR có thể sai dấu. Baseline thực tế: “chi phí” → “chỉ phí”, “vận chuyển” → “vận chuyền”. Đây là giới hạn đã biết, không phải kết quả chính xác hoàn toàn.
- Hai file phải vẫn xem được nguyên sơ đồ. App tìm trên phần chữ, không hiểu ý nghĩa đường nối hoặc tự suy luận quan hệ nhánh từ PDF.

## 3. Kiểm tra XMind và tìm đúng nhánh (khoảng 3 phút)

1. Mở file 06. Xem trước phải là **sơ đồ các hộp nối theo nhánh**, không còn danh sách chữ. Có `Mạng máy tính > Ôn tập mạng > Định tuyến OSPF` và nhánh con `Dijkstra`. App tự sắp xếp bố cục, không sao chép nguyên giao diện XMind.
2. Cuộn xuống phải thấy sơ đồ **Cơ sở dữ liệu**. Kiểm tra ghi chú có dấu và nhánh **Nhánh rời**.
3. Mở file 07: phải đọc ra nội dung giống file 06, không lỗi JSON/XML.
4. Vào **Tìm tài liệu → Nhập mô tả**, chọn **Loại file → XMind**, nhập `SF-XM-3NF-73`.
5. Phải tìm được file 06/07. Bấm **Mở đoạn liên quan**: phải chỉ đến sơ đồ 2, nhánh **Chuẩn hóa 3NF**, không nhảy sang OSPF ở sơ đồ 1.
6. Quay lại: câu tìm, bộ lọc và kết quả vẫn còn. Đổi sang `SF-XM-OSPF-42` để kiểm tra nhánh OSPF.
7. Bỏ bộ lọc XMind, tìm `mind map mặt nạ mạng con`: không bị ép chỉ tìm file ảnh; PDF và XMind đều có thể xuất hiện.
8. Trong chi tiết file 06 bấm **Trích xuất lại**, xác nhận; khi xong tìm lại `SF-XM-3NF-73` vẫn được.

## 4. Tìm bằng vùng chọn (khoảng 2 phút)

1. **Tìm tài liệu → Ảnh hoặc file** → mở file `04_mindmap_text.pdf` ở trên.
2. Chọn vùng bao quanh hộp **Định tuyến OSPF**, đợi nhận chữ và tìm. Bên phải phải có nội dung liên quan OSPF, không phải hộp ở nhánh khác.
3. Chuyển trang 2, khoanh hộp **Chuẩn hóa 3NF**. Kết quả phải theo vùng mới, không dính chữ OSPF cũ.
4. Lặp lại với `05_mindmap_scan.pdf`.
5. Đổi sang `06_mindmap_hien_dai.xmind`: phải hiện sơ đồ nhánh và nút chuyển 2 sơ đồ. Chuyển sơ đồ 2, chọn vùng ghi chú 3NF; app lấy chữ gốc trong vùng, không OCR lại. Thử tương tự với file 07 và nhánh Dijkstra: tên thuật toán phải giữ đúng.
6. Phóng to 150%, chọn **Kéo để xem**, kéo ngang/dọc rồi chọn vùng. Mở kết quả → **Quay lại kết quả tìm kiếm**: giữ trang/sơ đồ, zoom, vị trí kéo, vùng chọn, chữ và kết quả.
7. Đổi qua **Nhập mô tả** rồi về **Ảnh hoặc file**: giữ nguyên trạng thái. Với PDF, khoanh trước rồi bấm zoom: khung vẫn bám đúng chữ. Bánh xe cuộn trong khung xem; Ctrl+bánh xe zoom, Shift+bánh xe cuộn ngang.
8. Đổi trang/sơ đồ hoặc đổi file: xóa vùng và nội dung tìm cũ. Khoanh vùng trắng: không được nối lại câu cũ hoặc bịa chữ.

## 5. File hỏng không được lưu (30 giây)

Thêm riêng `08_xmind_hong_KHONG_UPLOAD_THANH_CONG.xmind`. App phải báo thiếu `content.json`/`content.xml`, cho bỏ chọn hoặc thử lại, không tạo tài liệu rỗng trong thư viện.

## Giới hạn rõ ràng

- XMind đọc chữ của nhánh, ghi chú plain/HTML, nhãn, nhánh con và nhánh rời; giữ đường dẫn cha-con và số sơ đồ cho tìm kiếm.
- Không tái tạo vị trí/màu/icon, đường nối chéo, ranh giới nhóm, tập tin đính kèm không phải ảnh. Ảnh nhúng PNG/JPEG/WebP được hiển thị và OCR; xem bài test mới trong `TEST_ANH_NHUNG_XMIND.md`.
- Không hỗ trợ XMind mã hóa/mật khẩu; tối đa 25 MB, 200 sơ đồ, 5.000 nhánh, 64 cấp, 8 MB dữ liệu chữ sau giải nén. Vượt giới hạn phải báo lỗi, không âm thầm cắt mất dữ liệu.
- File XMind mẫu được tạo từ cấu trúc JSON/XML công khai, kiểm tra bằng ScholarFlow; việc mở/lưu lại trong mọi phiên bản ứng dụng XMind chưa được kiểm chứng.

## Chạy kiểm thử tự động

Từ `learning-resource-app`: `npm run test:xmind`.
PDF: đặt `DOCLING_RS_HOME` tới runtime Docling đã cài và `PDFIUM_DYNAMIC_LIB_PATH` tới `pdfium/lib`, rồi `npm run test:mindmap-pdf`.
Kết quả đối chiếu từng cụm chữ nằm ở `.tmp/mindmap-pdf-report.json`; test scan chấp nhận đúng hai lỗi dấu baseline đã nêu, không cho phát sinh thiếu cụm mới.

Tạo lại XMind: `npm run fixtures:xmind`. Tạo lại PDF: chạy `scripts/generate-mindmap-pdf-fixtures.py` bằng Python có reportlab và pypdfium2, font Arial Windows.

Ghi kết quả thực tế và ảnh lỗi vào `../KET_QUA_TEST.md`, kèm tên file và bước ở trên.
