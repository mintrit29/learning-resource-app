# Hồi quy mind map trên Electron — 27/08/2026

> **Báo cáo lịch sử trước khi sửa.** Các lỗi MM-01–MM-06 bên dưới đã được xử lý và kiểm lại trên GUI trong cùng ngày. Xem [kết quả sau sửa và giới hạn hiện tại](KET_QUA_SAU_SUA_VIEWER.md). Giữ phần dưới để tái hiện và kiểm hồi quy, không dùng làm trạng thái hiện tại.

## Kết luận

**Chưa thể chốt hết lỗi.** Đã thao tác thật trên cửa sổ ScholarFlow, không chỉ gọi API/unit test. XMind đọc và tìm được nội dung, nhưng vẫn còn lỗi giữ vị trí khi quay lại; PDF còn lỗi kéo và vùng chọn lệch nội dung. OCR chữ trong preview XMind cũng chưa chính xác tuyệt đối.

Đợt này chỉ kiểm tra và ghi báo cáo, **chưa sửa các lỗi dưới đây, chưa commit/push/package**.

## Môi trường và phạm vi

- Source dev hiện tại, Windows/Electron; thử cửa sổ thường và phóng to.
- Database, uploads và bản sao runtime/model nằm riêng tại `.tmp/mindmap-electron-qa`; không sửa thư viện thật trong AppData.
- BGE-M3 và OCR chạy thật, không mock. Thư viện QA gồm hai PDF và hai XMind từ bộ test này, đã được nhập ở đợt trước.
- Giao diện thử: ảnh `01_mindmap_mang_may_tinh.png`, PDF `04_mindmap_text.pdf`, PDF scan `05_mindmap_scan.pdf`, XMind JSON `06_mindmap_hien_dai.xmind`, XMind XML `07_mindmap_legacy.xmind`, file hỏng `08_xmind_hong_KHONG_UPLOAD_THANH_CONG.xmind`.
- Không cấu hình AI cloud trong thư viện QA. Không dùng việc phân loại thiếu kết nối để kết luận lỗi embedding.
- Log gốc phiên thử: `.tmp/mindmap-electron-qa/logs/desktop.log`. Thời gian log là UTC; phiên GUI khoảng 21:02–21:17 giờ Việt Nam. Log tạm không cần đưa vào Git.

## Các lỗi đã tái hiện

### MM-01 — PDF quay lại sai trang, khung chọn không còn trùng nội dung (ưu tiên cao)

1. Vào **Tìm tài liệu → Ảnh hoặc file**, mở `04_mindmap_text.pdf`.
2. Dùng thanh điều khiển PDF để xem rõ trang; cuộn tới trang 2.
3. Khoanh ba dòng ở nhánh **Chuẩn hóa 3NF**. Chờ query và kết quả xuất hiện.
4. Bấm kết quả PDF: trang chi tiết mở đúng trang 2.
5. Bấm **Quay lại kết quả tìm kiếm**.

**Thực tế:** PDF nguồn trở về trang 1; khung chọn vẫn nằm ở tọa độ cũ, trong khi ảnh crop/query/kết quả bên phải vẫn là 3NF. Người dùng nhìn thấy vùng chọn và nội dung nhận dạng không tương ứng.

**Mong đợi:** giữ đúng trang, zoom, cuộn và vùng chọn ban đầu. Log không có OCR mới khi quay lại, nên trường hợp này là lỗi phục hồi trạng thái viewer, không phải OCR tự đọc lại chữ khác.

Liên quan source: `src/components/search/visual-resource-search.tsx` tạo lại object URL khi mount (khoảng dòng 139), nhúng PDF bằng iframe trình xem gốc (khoảng dòng 803); `src/lib/search/visual-search-draft.ts` chưa lưu trang/scroll của trình xem PDF.

### MM-02 — Khung chọn PDF đứng yên khi nội dung trang cuộn (ưu tiên cao)

1. Trong file 04, khoanh OSPF ở trang 1.
2. Chuyển **Kéo để xem**, dùng bánh xe cuộn xuống trang 2.

**Thực tế:** trang di chuyển nhưng khung chọn nổi vẫn đứng tại vị trí trong khung nhìn, có lúc nằm trên vùng trắng; query vẫn OSPF.

**Mong đợi:** khung gắn với trang/nội dung đã chọn; nếu chưa hỗ trợ giữ vùng qua trang thì phải xóa/ẩn nó một cách rõ ràng, không hiển thị vùng sai.

### MM-03 — PDF “Kéo để xem” vẫn bôi đen chữ (ưu tiên vừa)

1. Mở file 04, đặt PDF vừa chiều rộng (phiên thử khoảng 52%).
2. Chọn **Kéo để xem** rồi kéo chuột từ phần chữ lên trên.

**Thực tế:** chữ bị bôi xanh, trang không được kéo như ảnh/XMind. Bánh xe vẫn cuộn được.

Source xác nhận `handlePointerDown` bỏ qua nhánh PDF khi ở chế độ move (khoảng dòng 492); thao tác rơi vào trình xem PDF gốc. Không phải do file không có đủ trang để cuộn.

### MM-04 — XMind giữ nội dung tìm nhưng mất vị trí cuộn sau Back (ưu tiên vừa)

1. Mở file 06, chuyển sang sơ đồ 2.
2. Zoom 120%, kéo ngang/dọc để xem nhánh 3NF.
3. Khoanh ghi chú “Loại bỏ phụ thuộc bắc cầu. SF-XM-3NF-73”.
4. Mở kết quả file 07 rồi **Quay lại kết quả tìm kiếm**.

**Thực tế:** vẫn đúng sơ đồ 2, zoom 120%, query/crop/kết quả còn, khung vẫn trỏ tới dòng 3NF; nhưng vị trí cuộn/kéo trước đó bị reset. Cuộn ngoài trang cũng thay đổi.

**Mong đợi:** trở về đúng chỗ đang xem. Không ghi lỗi này thành “mất toàn bộ kết quả” vì kết quả thực tế vẫn còn.

Source: draft lưu selection/query/zoom/currentPreviewItem nhưng chưa lưu scroll của viewport và iframe.

### MM-05 — OCR làm sai chữ vốn có sẵn trong XMind (ưu tiên vừa)

1. Mở file 07 ở mức **Vừa khung**.
2. Khoanh đường dẫn nhánh kết thúc bằng `Dijkstra` và dòng ghi chú `Shortest path first. Không dùng cho cạnh trọng số âm.`

**Thực tế:** preview gốc ghi đúng `Dijkstra`, query OCR hiện tên thuật toán sai ký tự. Hai kết quả XMind vẫn tìm được, nhưng không thể gọi trích xuất hoàn hảo.

Source `src/lib/search/visual-query.ts`: `mergeRecognizedText` luôn lấy OCR khi không rỗng (`ocr || native`), nên text gốc không sửa được một kết quả OCR có chữ nhưng sai. Ngoài ra, OCR trả lỗi khi không có chữ trước khi fallback này được dùng.

Hướng sửa cần kiểm chứng: với cây XMind do app tự dựng, lấy chính xác text nằm trong vùng chọn; không OCR lại chữ gốc một cách không cần thiết. Ảnh/scan vẫn OCR. Phải chọn đúng phần chữ trong vùng, không lấy cả đoạn ngoài vùng hay nối trùng OCR và text gốc.

### MM-06 — Tiêu đề tài liệu bị ép thành cột chữ ở cửa sổ hẹp (ưu tiên thấp)

Khi mở kết quả PDF ở cửa sổ khoảng 1267 × 810 logical pixels, dãy nút hành động chiếm gần hết hàng đầu; tên `04_mindmap_text` xuống dòng từng vài ký tự, đẩy nội dung xuống rất xa. Khi phóng to cửa sổ thì đỡ hơn. Cần cho cụm nút xuống hàng và giữ chiều rộng tối thiểu cho tiêu đề.

PDF còn bất tiện lúc mới mở: thumbnail sidebar và mức zoom nhỏ khiến chữ quá bé; nhãn hướng dẫn nổi che một phần thanh công cụ. Đây là vấn đề bố trí, không phải lỗi trích xuất.

## Các ca đã qua trên GUI

| Ca | Kết quả quan sát |
| --- | --- |
| PNG: chọn OSPF | Nhận đúng nhãn/nội dung, có 4 kết quả |
| PNG: mở kết quả PDF rồi quay lại | Giữ ảnh, vùng chọn, crop, query và kết quả; cuộn ngoài trang chưa giữ |
| PNG: zoom 110%, kéo ngang/dọc | Kéo được; chọn TCP/IP sau đó thay query OSPF, không nối chữ cũ |
| PDF chữ: OCR OSPF rồi 3NF trang 2 | Cả hai vùng đọc đúng các dòng đã chọn; không lẫn OSPF vào 3NF |
| PDF: mở kết quả trang 2 | Trang chi tiết đến đúng trang 2; lỗi xảy ra khi quay lại nguồn tìm (MM-01) |
| PDF scan: chọn TCP/IP | Nhận đúng ba dòng được chọn, có 4 kết quả; thay file xóa trạng thái file trước |
| XMind JSON: chọn OSPF | Đúng nội dung ghi chú/nhãn; tìm được 4 kết quả |
| XMind: chuyển sơ đồ 1 → 2 | Đúng nội dung, xóa vùng/query/kết quả sơ đồ trước |
| XMind: zoom 120%, kéo ngang/dọc | Kéo được, không biến thành bôi đen chữ |
| XMind: chọn 3NF rồi mở kết quả | Tới đúng sơ đồ 2 của file kết quả, nhánh 3NF được tô nổi bật |
| XMind XML: mở preview | Đọc được nội dung sơ đồ; có lỗi OCR tên riêng MM-05 |
| XMind: khoanh vùng trắng sau Dijkstra | Query/kết quả cũ bị xóa; báo không nhận ra đủ chữ, không tự bịa nội dung |
| Nút xóa vùng sau lỗi vùng trắng | Xóa khung, crop và lỗi, trở về trạng thái chưa chọn vùng |
| XMind hỏng ở tìm bằng file | Báo thiếu `content.json`/`content.xml`, không lỗi JSON thô, không treo |

Trong các ca trên chưa thấy tái diễn EPIPE, phản hồi HTML bị parse JSON, OCR ghép đoạn cũ hoặc tự OCR lại lúc Back. Đây là kết luận trong các ca đã chạy, không phải bảo đảm tuyệt đối cho mọi thao tác nhanh đồng thời.

## Kiểm thử tự động chạy lại trong đợt này

- `npm run test:visual-search`: PASS.
- `npm run test:xmind`: PASS — JSON/XML, sheet/nhánh/ghi chú/nhãn/nhánh rời, chunk location, highlight, input hỏng, giới hạn giải nén, XSS.
- `npm run test:mindmap-pdf`: PASS với runtime thật trong QA. PDF chữ **26/26** cụm đúng trang (~3,3 giây); PDF scan **24/26** (~8,8 giây), giữ nguyên hai lỗi dấu đã ghi ở báo cáo trước.
- Log GUI: các OCR có chữ trả HTTP 200 (~0,39–1,00 giây), tìm kiếm HTTP 200 (~0,16–0,89 giây). Vùng trắng và XMind hỏng trả 422 có thông báo dự kiến. Dòng Tesseract `Estimating resolution` trên stderr không phải crash.

Unit test vẫn qua dù GUI có lỗi MM-01–MM-06: hiện chúng chưa bao phủ đủ trạng thái trình xem PDF nhúng và quay lại sau pan/scroll. Cần bổ sung ca hồi quy thực tế trước khi chốt bản sửa.

## Thứ tự xử lý đề nghị

1. Giữ đúng trang/scroll/zoom và neo vùng chọn PDF vào tọa độ nội dung trang; thống nhất thao tác kéo. Cân nhắc viewer PDF do app kiểm soát thay vì iframe PDF gốc không cung cấp trạng thái cần thiết.
2. Lưu/phục hồi cuộn cả viewport và preview XMind sau khi nội dung render xong.
3. Dùng text gốc đúng vùng cho XMind; OCR cho phần raster, không nối hai nguồn thành đoạn lặp.
4. Sửa responsive tiêu đề/nút và thanh điều khiển PDF.
5. Chạy lại đúng các bước tái hiện bên trên và kiểm trên EXE mới trước khi phát hành.

Chưa kiểm trong đợt này: cài EXE sạch, mọi phiên bản XMind chính thức, file cực lớn, thao tác race liên tục, audio và toàn bộ chức năng ngoài mind map. Không suy rộng kết quả mẫu thành “mọi file đều đúng”.
