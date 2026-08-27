# HƯỚNG DẪN TEST FULL SCHOLARFLOW

Thời gian dự kiến: **45–60 phút**. Làm lần lượt từ trên xuống để không phải nhập lại tài liệu.

## 0. Chuẩn bị — 2 phút

1. Đóng ScholarFlow nếu đang mở, rồi mở lại.
2. Mở thư mục `learning-resource-app/test-fixtures/scholarflow` và để cạnh cửa sổ app.
3. Khi gặp lỗi, chụp màn hình ngay và ghi số bước vào file `KET_QUA_TEST.md`.
4. Không bấm **Xóa** BGE-M3/Docling và không tải Qwen trong đợt test này; các thao tác đó vừa lâu vừa không cần để kiểm tra chức năng chính.

File `03_negative_cases/02_file_qua_40mb.pdf` được giữ sẵn trong Git để thành viên khác có thể kiểm tra ngay. Nếu file bị mất hoặc hỏng, chạy `npm run fixtures:manual-large-file` trong thư mục `learning-resource-app` để tạo lại.

Đạt nếu app mở thẳng vào giao diện chính, không có đăng nhập và không hiện hộp lỗi JavaScript/EPIPE.

## 1. Khởi động và cài đặt — 5 phút

### 1.1 Thành phần cục bộ

1. Vào **Cài đặt → Thành phần cục bộ**.
2. BGE-M3 và Docling phải hiện **Sẵn sàng**.
3. Bấm **Kiểm tra** trên BGE-M3, đợi kết thúc.
4. Bấm **Kiểm tra** trên Docling, đợi kết thúc.

Đạt nếu cả hai vẫn là **Sẵn sàng**, app không treo và không bật hộp lỗi.

### 1.2 Chủ đề

1. Vào phần quản lý chủ đề.
2. Tạo chủ đề `QA ScholarFlow`.
3. Đổi tên thành `QA ScholarFlow 2`.
4. Xóa chủ đề vừa tạo. Không sửa hoặc xóa các chủ đề mặc định.

Đạt nếu danh sách cập nhật ngay và không ảnh hưởng các chủ đề mặc định.

### 1.3 Kết nối AI — chỉ kiểm tra giao diện

1. Mở **Thêm kết nối AI**.
2. Chuyển qua lại giữa AI cục bộ và AI trực tuyến.
3. Đóng bằng nút X; mở lại rồi đóng bằng phím `Esc`.

Đạt nếu hộp thoại đóng/mở đúng, không tự tải model. Không cần cấu hình AI để test tìm kiếm tài liệu.

## 2. Thêm bốn tài liệu chuẩn — 10 đến 20 phút

Vào **Thêm tài liệu → Chọn file**, chọn cùng lúc bốn file trong `01_library`:

- `01_mang_may_tinh_ospf.docx`
- `02_co_so_du_lieu_text.pdf`
- `03_thuat_toan_do_thi.pptx`
- `04_an_toan_thong_tin.epub`

Sau đó bấm **Thêm vào thư viện**. App xử lý lần lượt; cứ để chạy đến khi cả bốn hoàn tất.

Đạt nếu:

- Cả bốn file xuất hiện trong thư viện, không file nào quay vô hạn.
- Không có hộp lỗi bất ngờ.
- DOCX nói về OSPF; PDF nói về cơ sở dữ liệu; PPTX nói về thuật toán đồ thị; EPUB nói về an toàn thông tin.

### Kiểm tra nút Quét thư mục mà không tạo bản trùng

1. Quay lại **Thêm tài liệu → Quét thư mục**.
2. Chọn thư mục `04_batch_upload`, rồi xác nhận **Upload** trong cửa sổ Windows.
3. Danh sách phải nhận **5 file hỗ trợ**: bốn file ở thư mục gốc và một PDF trong `nested`.
4. File `khong_duoc_ho_tro.txt` phải bị bỏ qua.
5. Bấm dấu X ở từng file để bỏ danh sách; **không** bấm Thêm vào thư viện lần nữa.

## 3. Kiểm tra thư viện và từng loại tài liệu — 8 phút

Mở lần lượt bốn tài liệu vừa thêm.

### DOCX `01_mang_may_tinh_ospf`

- Kéo xuống được hết nội dung.
- Có chữ `SF-OSPF-LINK-STATE-42` và `SF-SUBNET-FOUR-26` trong nội dung trích xuất.

### PDF `02_co_so_du_lieu_text`

- Xem được đủ 2 trang.
- Có nội dung 3NF, ACID và B-tree.

### PPTX `03_thuat_toan_do_thi`

- Xem được đủ 4 slide.
- Có `SF-BFS-QUEUE-14`, `SF-DFS-STACK-25`, `SF-DIJKSTRA-NONNEGATIVE-37` và `SF-CHART-DIJKSTRA-90`.

### EPUB `04_an_toan_thong_tin`

- Xem được đủ 3 phần/chương.
- Có `SF-HASH-COLLISION-61`, `SF-AES-GCM-27` và `SF-PASSWORD-SALT-84`.

Trên một tài liệu bất kỳ, kiểm tra thêm:

1. **Nội dung đã trích xuất** mở ra xem được toàn bộ và thu gọn lại được.
2. **Hiện file trong thư mục** mở Explorer và chọn đúng file có tên gốc, không phải tên UUID.
3. **Lưu bản sao** lưu được file ra Desktop và file đó mở được.
4. **Trích xuất lại** → xác nhận → chờ trạng thái sẵn sàng; nội dung và tìm kiếm vẫn còn hoạt động.
5. Nếu chưa kết nối AI, nút phân tích AI phải báo rõ là thiếu kết nối, không làm app văng.

## 4. Tìm bằng mô tả — 5 phút

Vào **Tìm tài liệu → Nhập mô tả** và chạy từng câu sau:

| Nhập chính xác | Kết quả mong đợi đầu tiên |
|---|---|
| `OSPF trạng thái liên kết và chi phí đường đi` | DOCX mạng máy tính |
| `chuẩn hóa 3NF và phụ thuộc bắc cầu` | PDF cơ sở dữ liệu |
| `Dijkstra và cạnh âm` | PPTX thuật toán đồ thị |
| `hàm băm chống va chạm` | EPUB an toàn thông tin |
| `xylophone quasar trilobite` | Không có tài liệu phù hợp |

Với một kết quả có thật:

1. Kiểm tra có phần **Vì sao phù hợp** và **Nguồn**.
2. Thử lọc theo loại file; kết quả phải đổi đúng.
3. Bấm **Mở đoạn liên quan**, rồi quay lại bằng nút Back của app/Windows.
4. Câu tìm kiếm, bộ lọc và kết quả phải còn nguyên.
5. Bấm dấu X trong ô tìm kiếm; câu và kết quả phải được xóa, không cần bấm thêm nút.

### Kiểm tra “Mở đoạn liên quan” trên đủ bốn định dạng

Tìm lần lượt các câu dưới đây, mở đúng tài liệu được nêu rồi kiểm tra vị trí bản xem file:

| Câu tìm kiếm | Tài liệu cần mở | Kết quả bắt buộc |
|---|---|---|
| `OSPF trạng thái liên kết và chi phí đường đi` | DOCX `01_mang_may_tinh_ospf` | Đưa tới bảng có “Loại thuật toán”; vùng liên quan được tô xanh. |
| `chuẩn hóa 3NF và phụ thuộc bắc cầu` | PDF `02_co_so_du_lieu_text` | PDF mở đúng trang 1. |
| `Dijkstra và cạnh âm` | PPTX `03_thuat_toan_do_thi` | Đưa tới slide/vùng Dijkstra; nội dung liên quan được tô xanh. |
| `hàm băm chống va chạm` | EPUB `04_an_toan_thong_tin` | Đưa tới phần “Hàm băm mật mã”; nội dung liên quan được tô xanh. |

Với mỗi tài liệu:

1. Trang chi tiết phải có ô **Đoạn khớp với tìm kiếm**.
2. Kéo xuống **File gốc**; bản xem phải ở đúng nội dung nêu trong bảng, không bắt đầu lại ở đầu file.
3. Bấm **Quay lại kết quả tìm kiếm**.
4. Câu tìm kiếm, bộ lọc và danh sách kết quả phải còn nguyên.

Kiểm tra thêm bằng ảnh:

1. Vào **Ảnh hoặc file**, mở `02_visual_queries/01_anh_cau_hoi_ospf.png`.
2. Khoanh câu hỏi OSPF bên trái và chờ OCR/tìm kiếm hoàn tất.
3. Mở DOCX được gợi ý; vùng OSPF liên quan phải được tô xanh.
4. Quay lại; ảnh, khung chọn, nội dung OCR và kết quả phải còn nguyên.

## 5. Tìm bằng ảnh hoặc file — 15 phút

Vào **Tìm tài liệu → Ảnh hoặc file**. Với mỗi ca, bấm **Mở ảnh hoặc file**, chọn file được nêu, chuyển sang **Chọn vùng**, kéo khung quanh nội dung cần tìm và đợi OCR.

### Sáu ca bắt buộc

1. `02_visual_queries/01_anh_cau_hoi_ospf.png`
   - Chọn câu hỏi OSPF bên trái.
   - OCR phải đọc gần đúng cả câu; kết quả đầu nên là DOCX mạng máy tính.

2. `02_visual_queries/02_de_thi_scan_hai_trang.pdf`
   - Trang 1: chọn câu 3NF → nên tìm PDF cơ sở dữ liệu.
   - Trang 2: chọn câu OSPF → nên tìm DOCX mạng máy tính.
   - Đây là PDF ảnh hoàn toàn, không có lớp chữ; nếu tìm được nghĩa là OCR thực sự hoạt động.

3. `02_visual_queries/03_bai_tap_nhieu_trang.docx`
   - Cuộn xuống được bằng bánh xe/thanh cuộn.
   - Chọn câu 3NF rồi câu OSPF; mỗi lần OCR phải chỉ chứa vùng mới, không dính hoặc nhân đôi vùng cũ.

4. `02_visual_queries/04_cau_hoi_do_thi.pptx`
   - Dùng nút chuyển slide, chọn câu Dijkstra.
   - Kết quả đầu nên là PPTX thuật toán đồ thị.

5. `02_visual_queries/05_tuyen_tap_cau_hoi.epub`
   - Dùng nút chuyển phần, chọn câu ACID hoặc mật khẩu.
   - Kết quả nên là PDF cơ sở dữ liệu hoặc EPUB an toàn thông tin tương ứng.

6. `02_visual_queries/06_vung_khong_co_chu.png`
   - Chọn một vùng trống.
   - App phải báo không nhận đủ chữ/không có kết quả; không được tạo chữ rác rồi tự tìm.

### OCR mở rộng — kiểm tra giới hạn hiện tại

| File | Chọn vùng | Cần đọc được |
|---|---|---|
| `07_cong_thuc_va_bang.png` | Công thức rồi bảng | Ký hiệu chính và các từ lớn trong bảng |
| `08_text_tieng_viet.png` | Toàn đoạn | Tiếng Việt có dấu gần đúng |
| `09_bang_tieng_viet.png` | Toàn bảng | BFS, Dijkstra, Bellman-Ford và phần lớn ô chữ |
| `10_bieu_do_duong.png` | Tiêu đề + chú giải | Tiêu đề, nhãn hoặc giá trị chính |
| `11_so_do_mang_ospf.png` | Toàn sơ đồ | OSPF và phần chữ chú thích lớn |
| `12_cong_thuc_bayes.png` | Công thức | Các ký hiệu chính; có thể cần sửa tay |
| `13_code_english.png` | Khối code | Các từ khóa/code chính |

Sai một vài ký hiệu công thức, chữ cực nhỏ trong bảng/biểu đồ hoặc nhãn `R1–R4` là giới hạn OCR đã biết. Nhưng app không được trả chữ rác hoàn toàn, treo hoặc báo lỗi JavaScript. Ô OCR phải sửa tay được trước khi bấm **Tìm lại**.

### Thao tác UX phải thử trên `01_anh_cau_hoi_ospf.png`

1. Bấm `+`, chuyển **Kéo để xem**, giữ chuột kéo ảnh qua lại.
2. Chuyển **Chọn vùng**, vẽ vùng, kéo cả khung và kéo các nút góc để đổi kích thước.
3. Chọn vùng OSPF → có kết quả → mở một tài liệu → quay lại.
4. File, mức zoom, khung chọn, chữ OCR và kết quả phải còn nguyên.
5. Chọn nhanh hai vùng khác nhau; kết quả cuối phải thuộc vùng chọn sau cùng.
6. Đổi sang file khác; trạng thái file cũ phải được xóa sạch.

Lưu ý: file dùng làm truy vấn chỉ để tìm, không được tự xuất hiện trong thư viện.

## 5.1 Thêm mind map và âm thanh — 8 đến 15 phút

1. Vào **Cài đặt → Thành phần cục bộ**. Cài **Whisper Base** nếu chưa có; thành phần này là tùy chọn và chỉ cần cho audio.
2. Vào **Thêm tài liệu**, chọn cả ba file trong `06_mindmap_audio` rồi thêm vào thư viện.
3. `01_mindmap_mang_may_tinh.png` phải trích xuất được ít nhất `MẠNG MÁY TÍNH`, `OSPF` và `Định tuyến trạng thái liên kết`.
4. `02_audio_tieng_viet.mp3` phải có bản ghi chứa các ý `tài liệu học tập`, `mạng máy tính`, `cơ sở dữ liệu` và vị trí nguồn dạng mốc thời gian.
5. `03_audio_tieng_anh.wav` phải có `learning resources`, `computer networks`, `databases` và mốc thời gian.
6. Tìm mô tả `định tuyến trạng thái liên kết` và `computer networks databases`; kết quả tương ứng phải xuất hiện nếu embedding đã hoàn tất.
7. Mở kết quả audio: app phải phát/mở được file gốc và vẫn hiển thị nội dung đã chép lời. Quay lại không được mất truy vấn.
8. Có thể xóa Whisper để kiểm tra chế độ giới hạn: tài liệu/ảnh vẫn thêm được, riêng audio phải bị chặn với liên kết tới Cài đặt. Cài lại Whisper sau ca này.

Chấp nhận: Whisper Base có thể viết sai tên riêng hoặc thương hiệu. Không chấp nhận: bản ghi rỗng, báo hoàn tất với `0 ký tự`, mất timestamp, treo ở bước đọc nội dung hoặc làm các định dạng khác ngừng hoạt động.

## 6. Xử lý file lỗi — 5 phút

Vào **Thêm tài liệu** và dùng thư mục `03_negative_cases`:

1. `02_file_qua_40mb.pdf`: phải bị từ chối ngay với thông báo quá 40 MB.
2. `03_dinh_dang_khong_ho_tro.txt`: không chọn được hoặc bị app bỏ qua rõ ràng.
3. `01_file_hong.pdf`: app có thể nhận tên file nhưng bước xử lý phải chuyển sang lỗi có thông báo và nút thử lại/xóa; app không được treo hoặc văng.
4. Xóa bản ghi file hỏng khỏi app sau khi test.

## 7. Lưu trạng thái và xóa tài liệu — 3 phút

1. Đóng app bằng nút X, mở lại.
2. Bốn tài liệu và các chủ đề mặc định vẫn còn; không xuất hiện màn hình đăng nhập.
3. Xóa một tài liệu test trong app và xác nhận.
4. Kiểm tra file gốc trong `01_library` vẫn còn nguyên. App chỉ xóa bản sao do ScholarFlow quản lý.
5. Nếu cần tiếp tục test, thêm lại file vừa xóa.

## 8. Tiêu chí chốt

App có thể chốt khi:

- Không có hộp lỗi JavaScript/EPIPE, màn hình trắng, app tự thoát hoặc thao tác quay vô hạn.
- Bốn định dạng tài liệu, ảnh mind map và audio thêm/xem/trích xuất/tìm được.
- Tìm mô tả trả đúng nhóm tài liệu; tìm ảnh/file giữ trạng thái khi mở kết quả rồi quay lại.
- OCR chữ thường và tiếng Việt đủ dùng; trường hợp bảng/công thức/biểu đồ có giới hạn nhưng không phá luồng sử dụng.
- File lỗi, file quá dung lượng và file không hỗ trợ đều được chặn/báo rõ.
- Đóng mở app không làm mất dữ liệu cục bộ.

Nếu chỉ có 15 phút, hãy làm các mục **1.1, 2, 4, sáu ca bắt buộc ở mục 5 và mục 7**.

## 9. Quy tắc lưu giữ bộ test

Toàn bộ thư mục `learning-resource-app/test-fixtures/scholarflow` là bộ kiểm thử cố định duy nhất của dự án. Không xóa thư mục này khi dọn cache, benchmark, output build hoặc file tạm.

File `03_negative_cases/02_file_qua_40mb.pdf` được giữ sẵn cùng bộ test để thành viên khác có thể kiểm tra ngay. Lệnh `npm run fixtures:manual-large-file` chỉ dùng để tạo lại file nếu nó bị hỏng hoặc mất.

## 10. Phần bổ sung PDF mind map và XMind - 27/08/2026

Chạy thêm [TEST_PDF_XMIND.md](06_mindmap_audio/TEST_PDF_XMIND.md) sau bộ test bên trên. Có sẵn 4 file hợp lệ và 1 file hỏng trong `06_mindmap_audio`, hướng dẫn tên file, thao tác và kết quả mong đợi cụ thể.
