# Kiểm thử giao diện nền — 28/08/2026

## Kết luận

Các luồng chính đã được thao tác trên giao diện thật bằng trình duyệt kiểm thử riêng, không điều khiển màn hình, chuột hay bàn phím Windows của người dùng. **Chưa thể kết luận toàn bộ app không còn lỗi.** Có lỗi UX tái hiện được, hạn chế nhận dạng/tìm kiếm và các phần chỉ kiểm được bằng Electron còn để riêng bên dưới.

- 11/11 tài liệu mẫu thêm vào được, trích xuất và chia đoạn thành công.
- 88/88 đoạn có embedding thật; không dùng embedding giả.
- OCR ảnh và PDF scan, chép lời audio Việt/Anh, đọc XMind JSON/XML và ảnh nhúng đều chạy được trên các mẫu đã thử.
- Tìm mô tả, tìm vùng ảnh/PDF, mở nguồn rồi quay lại giữ được trạng thái trong các lần thử được ghi nhận.
- Không ghi nhận lỗi JavaScript/JSON bất ngờ trong các luồng đã chạy. Console `error`/`warn` của hai tab kiểm thử trả về rỗng tại thời điểm kiểm tra; đây không phải chứng nhận không có lỗi ở mọi đường đi.
- Không sửa mã chức năng, không commit/push, không build EXE trong lượt kiểm thử này.

## Môi trường và phạm vi

- Mã dev đang có trong workspace trên `main`, gồm thay đổi tìm bằng giọng nói chưa commit; không phải chỉ commit HEAD.
- Dùng bản Next standalone đã build trước lượt này, chạy qua HTTP loopback; đây là giao diện của app, **không phải một phiên Electron đầy đủ**.
- Model thật: BGE-M3 ONNX và Whisper base; Docling/PDFium/Tesseract dùng runtime QA đã có. Không tải model mới.
- Database riêng: `.tmp/gui-audit-20260828/data/scholarflow.db` ở root repo. Không dùng database/thư viện thật trong AppData.
- Script dựng môi trường cục bộ: `.tmp/gui-audit-20260828.mjs`; log nằm trong `.tmp/gui-audit-20260828/`. Đây là artifact tạm của máy kiểm thử, không phải bộ test được phân phối qua Git.
- Kết nối `QA API cục bộ` rồi đổi tên thành `QA API đã sửa` chỉ trỏ tới endpoint loopback không chạy. Không dùng API key thật, không gửi tài liệu lên cloud.
- Tạo môn `QA Giao diện`, đổi thành `QA Giao diện đã sửa`, chỉ trong DB test.
- Không bật mic thật, không phát audio ra loa, không mở Explorer hoặc trình cài đặt trên màn hình người dùng.

## Kết quả nhập và xử lý tài liệu

Các số sau được đối chiếu thêm bằng truy vấn **read-only** DB test sau khi thao tác giao diện; không dùng truy vấn DB để thay cho kiểm thử UI.

| File trong bộ test | Ký tự | Đoạn | Có embedding |
| --- | ---: | ---: | ---: |
| `01_library/01_mang_may_tinh_ospf.docx` | 1.547 | 9 | 9 |
| `01_library/02_co_so_du_lieu_text.pdf` | 1.360 | 6 | 6 |
| `01_library/03_thuat_toan_do_thi.pptx` | 1.309 | 24 | 24 |
| `01_library/04_an_toan_thong_tin.epub` | 580 | 6 | 6 |
| `06_mindmap_audio/01_mindmap_mang_may_tinh.png` | 153 | 1 | 1 |
| `06_mindmap_audio/02_audio_tieng_viet.mp3` | 72 | 1 | 1 |
| `06_mindmap_audio/03_audio_tieng_anh.wav` | 81 | 1 | 1 |
| `06_mindmap_audio/05_mindmap_scan.pdf` | 695 | 2 | 2 |
| `06_mindmap_audio/06_mindmap_hien_dai.xmind` | 1.076 | 12 | 12 |
| `06_mindmap_audio/07_mindmap_legacy.xmind` | 1.076 | 12 | 12 |
| `06_mindmap_audio/09_xmind_anh_nhung.xmind` | 1.029 | 14 | 14 |
| **Tổng** | | **88** | **88** |

Mỗi loại job trích xuất/chia đoạn/embedding có 11 job hoàn thành. 11 job phân tích AI thất bại do lúc nhập chưa cấu hình provider; vấn đề thông báo của trường hợp này được ghi tại UX-02.

## Các luồng đã thao tác

“Đạt” dưới đây chỉ có nghĩa đạt trên dữ liệu và thao tác nêu tại dòng đó, không bảo đảm mọi tài liệu thực tế đều chính xác.

| Nhóm | Thao tác thực tế | Kết quả |
| --- | --- | --- |
| Khởi động | DB mới, mở dashboard và các trang từ sidebar | Đạt; thư viện rỗng, 27 môn mặc định, không cần đăng nhập |
| Thêm tài liệu | Chọn nhiều file, thêm 11 mẫu, quan sát tiến trình và chuyển về thư viện | Đạt; khóa các nút thay đổi hàng chờ khi đang tải |
| File quá lớn/sai loại | Chọn file giả 40 MB và TXT trong `03_negative_cases` | Đạt; không đưa vào hàng chờ hợp lệ |
| File hỏng | Chọn PDF hỏng rồi thêm vào thư viện | Đạt; báo nội dung không khớp định dạng, không tạo tài liệu |
| Bỏ file lỗi | Bỏ chọn PDF vừa tải lỗi | **UX-01:** thông báo lỗi tổng vẫn còn khi hàng chờ rỗng |
| Thư viện | Lọc tên `ospf`, mở tài liệu, quay lại thư viện | Lọc đúng, nhưng **UX-03:** mất bộ lọc khi quay lại |
| DOCX | Xem bản gốc, mở/thu gọn nội dung đã trích xuất | Đạt; thấy bảng và OCR ghi chú ảnh nhúng, không có nút “Xem toàn bộ” thừa |
| Xuất text | Bấm `Tải .txt` của DOCX | Sự kiện download được tạo; chưa đối chiếu byte của file tải về |
| Xóa tài liệu | Mở xác nhận rồi Hủy | Đạt; thông báo phân biệt bản sao trong app với file nguồn; không thực hiện xóa vĩnh viễn |
| Trích xuất lại | Mở xác nhận rồi Hủy | Đạt ở bước xác nhận; chưa chạy lại pipeline bằng nút này trong lượt test |
| Tiến trình | Mở panel trạng thái của audio | Thấy trích xuất/chia đoạn/embedding hoàn thành; phân tích AI hiển thị thất bại khi chưa cấu hình |
| Tìm mô tả | Gõ `OSPF trạng thái liên kết`, không bấm Tìm | Tự tìm; nguồn DOCX đúng, có lý do và tên đoạn |
| Quay lại kết quả | Mở DOCX từ tìm mô tả rồi quay lại | Đạt; giữ query và kết quả |
| Bộ lọc tìm | Lọc PDF với câu OSPF, mở nguồn rồi quay lại | Đạt; chỉ còn PDF, giữ bộ lọc PDF |
| Nguồn PDF | Tìm `chuẩn hóa 3NF`, mở `05_mindmap_scan` | Đạt; viewer PDF hiển thị trang 2/2, nội dung 3NF |
| Nguồn PPTX | Tìm `Dijkstra cạnh âm`, mở kết quả | Đạt; mở slide 3, tô đúng dòng Dijkstra cần trọng số không âm |
| Nguồn EPUB | Tìm `hàm băm chống va chạm`, mở kết quả | Đạt; tô đoạn hàm băm ở chương 1 |
| Nguồn XMind ảnh | Tìm OSPF, mở `09_xmind_anh_nhung` | Đạt; tô đúng nhánh Ảnh tiếng Việt, không nhầm Ảnh tiếng Anh |
| Nguồn XMind nhiều sơ đồ | Tìm 3NF, mở `07_mindmap_legacy` | Chọn đúng sơ đồ/nhánh; có một lần vị trí cuộn chưa đúng, xem OBS-01 |
| Truy vấn nhanh | Đổi liên tiếp OSPF → hàm băm → Dijkstra cạnh âm | Đạt; kết quả cuối tương ứng query cuối, không thấy kết quả cũ ghi đè |
| Không có kết quả | SQL JOIN trên PDF; lọc môn QA chưa có tài liệu | Đạt; thông báo không có tài liệu và gợi ý nới bộ lọc |
| Xóa câu tìm | Bấm nút Xóa nội dung tìm kiếm | Đạt; ô nhập được xóa, không phải bấm nút tìm lại |
| Ảnh câu hỏi | Mở `02_visual_queries/01_anh_cau_hoi_ospf.png`, khoanh câu OSPF | OCR và tự tìm được nguồn DOCX; còn sai chữ, xem Q-01 |
| Chống trộn OCR | Đổi từ vùng OSPF sang câu 3NF trên cùng ảnh | Đạt; query mới chỉ chứa câu 3NF, không dính OSPF; có nguồn PDF đúng |
| Vùng chọn quay lại | Từ kết quả ảnh mở DOCX rồi quay lại | Đạt; giữ file, khung, query OCR và kết quả; không chụp nhầm sidebar |
| Zoom/pan ảnh | Phóng 2 nấc tới 120%, chuyển Kéo để xem, kéo ảnh, đặt lại zoom | Đạt; ảnh thay đổi vị trí, query không bị thay; nút reset về Vừa khung |
| Đổi nguồn tìm | Đổi ảnh → XMind → DOCX → PDF | Đạt; nguồn mới được mở, query/kết quả cũ được xóa |
| XMind nhiều sơ đồ | `09_xmind_anh_nhung`, Mục sau/Mục trước | Đạt; chuyển 1/2 ↔ 2/2, nút biên bị vô hiệu hóa đúng |
| OCR ảnh nhúng XMind | Khoanh riêng ảnh tiếng Anh ở sơ đồ 1 | Đạt trên mẫu: lấy hai dòng về transactions/ACID, tìm XMind và PDF ACID |
| XMind không chữ | Khoanh hình tròn ở nhánh Ảnh không chữ | Đạt; báo không nhận đủ chữ, query cũ không còn |
| XMind thiếu/hỏng ảnh | Mở preview file 09 | Hiện cảnh báo riêng cho ảnh hỏng, ảnh thiếu và đường dẫn ảnh ngoài không hỗ trợ; sơ đồ vẫn xem được |
| XMind hỏng | Mở `08_xmind_hong_KHONG_UPLOAD_THANH_CONG.xmind` ở tìm kiếm | Đạt; lỗi dễ hiểu về thiếu content.json/content.xml, không lỗi JSON thô |
| Kéo DOCX | `03_bai_tap_nhieu_trang.docx`, Kéo để xem, kéo lên | Đạt; scrollTop vùng xem tăng từ 93,6 lên 186,4; nội dung di chuyển, không phải bôi đen chữ |
| PDF truy vấn | `02_de_thi_scan_hai_trang.pdf`, sang trang 2, khoanh câu Dijkstra | Đạt; OCR đúng câu, kết quả đầu là PPTX Dijkstra; xem thêm Q-02 về kết quả phụ |
| PDF quay lại/đổi tab | Mở PPTX từ kết quả PDF rồi quay lại, đổi Nhập mô tả ↔ Ảnh hoặc file | Đạt; giữ trang 2/2, query và kết quả PDF |
| Audio Việt/Anh | Mở hai tài liệu audio, mở nội dung trích xuất | Có transcript, đầy đủ các cụm kiến thức chính; tên riêng tiếng Việt sai, xem Q-01; không phát ra loa |
| Môn học | Thêm môn QA, lọc tên, sửa, reload | Đạt; tên và ghi chú được giữ |
| Môn học trùng | Thêm lại tên QA đã tồn tại | Đạt; báo tên đã tồn tại, không tạo trùng |
| Kết nối AI | Mở thêm, chuyển OpenRouter/Custom API, để trống rồi lưu | Đạt; Base URL/model bắt buộc, API key của Custom tùy chọn |
| Custom API lưu/sửa | Lưu endpoint loopback giả, reload, sửa tên, reload | Đạt; không mất kết nối sau khi rời/tải lại trang |
| API offline | Bấm Kiểm tra kết nối với endpoint test không chạy | Đạt; báo không kết nối được, trạng thái Có lỗi, không văng exception ra UI |
| Qwen cục bộ | Quan sát đề xuất cấu hình và điều kiện tải | Hiện giải thích Ollama/Qwen; nút tải bị khóa khi chưa có Ollama; không tải/chạy model |
| Thành phần cục bộ | Mở trang quản lý model qua browser | Báo chỉ dùng trong ScholarFlow Desktop; giới hạn môi trường, không coi là lỗi app |

## Lỗi và điểm cần cải thiện

### UX-01 — Thông báo upload lỗi còn treo sau khi bỏ hết file (P2)

1. Thêm `03_negative_cases/01_file_hong.pdf`.
2. Bấm Thêm vào thư viện, nhận lỗi nội dung không khớp định dạng.
3. Bấm Bỏ chọn file.
4. Hàng chờ rỗng nhưng vẫn hiện “1 file chưa tải lên được. Bạn có thể bấm thử lại.”; không còn file/nút retry tương ứng.

Nên tính lại/xóa thông báo tổng khi bỏ file lỗi cuối cùng. Chọn bộ file mới đã làm thông báo mất đi.

### UX-02 — AI tùy chọn chưa cấu hình bị coi là lỗi (P2)

Sau khi nhập trên DB mới, 11 tài liệu có text và vector đầy đủ nhưng đều ghi “Tìm được, phân tích AI lỗi”. Panel job báo “Chưa có kết nối AI đang hoạt động” và “Thất bại”. Dashboard còn nói cần provider để “gợi ý tài liệu”, dù tìm kiếm thực tế chạy được không cần provider cloud/Qwen.

Nên phân biệt **chưa kết nối/bỏ qua AI tùy chọn** với **đã cấu hình nhưng gọi AI thất bại**; không làm người dùng hiểu nhầm phần trích xuất/embedding hỏng. Không cần thay model để sửa lỗi trạng thái này.

### UX-03 — Mất bộ lọc thư viện khi quay lại (P2)

Thư viện → lọc tên `ospf` → mở DOCX → Quay lại thư viện. Link đưa về `/documents` và ô tên trống. Khác với trang Tìm tài liệu đã giữ được query và bộ lọc.

Nên giữ URL bộ lọc/ngữ cảnh quay lại của thư viện, gồm cả vị trí cuộn khi có danh sách dài.

### OBS-01 — Một lần XMind cuộn nhánh khớp ra ngoài phần nhìn thấy (cần tái hiện thêm)

Tìm `chuẩn hóa 3NF` → mở `07_mindmap_legacy.xmind`: đúng nhánh có `id=matched-preview`, nhưng lần đầu tiêu đề có `top=-46,4`, `bottom=-21,2` trong viewport iframe và bị khuất. Lần mở lại sau đó tiêu đề ở `top=93,6`, hiển thị đúng.

Không kết luận đây là lỗi xảy ra mọi lần hoặc đã biết nguyên nhân. Cần test thêm phối hợp cuộn trang cha/iframe, back/forward và chờ layout ổn định. Chưa sửa trong lượt này.

### Q-01 — Nhận dạng chạy được nhưng chưa chính xác tuyệt đối

- Vùng câu OSPF trên PNG: `OSPF` thành `OSPPF`, `chi phí` thành `chỉ phí`.
- PDF mind map scan: còn các sai dấu như `chi phí` → `chỉ phí`, `vận chuyển` → `vận chuyền`.
- Ảnh nhúng XMind tiếng Việt: `Định tuyến` thành `Định tuyên`.
- Audio tiếng Việt: tên riêng ScholarFlow thành `Cô la Phông`; cụm “tài liệu học tập”, “mạng máy tính”, “cơ sở dữ liệu” vẫn có đủ.
- Câu 3NF trên PNG, câu Dijkstra trên PDF và hai dòng ảnh tiếng Anh XMind đã đọc đúng trong các vùng được thử.

Đây là giới hạn chất lượng cần giữ trong hướng dẫn sử dụng. Không dùng kết quả này để tuyên bố mọi bảng/công thức/biểu đồ đều trích xuất đúng; lượt này không benchmark lại toàn bộ bộ công thức/bảng. Nên ưu tiên text gốc khi có và tiếp tục cho sửa query OCR.

### Q-02 — Kết quả phụ có thể không liên quan đủ sát

Với câu OCR PDF “Câu 1. Vì sao Dijkstra không áp dụng trực tiếp cho đồ thị có cạnh âm?”, PPTX Dijkstra đứng đầu đúng và XMind Dijkstra cũng đúng, nhưng danh sách còn trả PDF 3NF. Nhãn giải thích chỉ là “Khớp ngữ nghĩa · Khớp từ khóa”, không giúp người dùng thấy vì sao một nguồn phụ lại xuất hiện.

Nên bổ sung ca này vào đánh giá precision, kiểm tra từ khóa phổ biến/ngưỡng nhận kết quả trước khi điều chỉnh thuật toán. Không kết luận toàn bộ tìm kiếm sai; vấn đề ở độ chính xác của kết quả phụ.

### DEV-01 — Cấu hình test có key trùng (P3, phát hiện khi đọc source)

`package.json` có hai dòng `pretest:unit` giống hệt nhau. Hiện cả hai cùng giá trị nên không giải thích lỗi runtime, nhưng nên bỏ dòng trùng để tránh nhập nhằng. Chưa sửa vì lượt này là kiểm tra/báo cáo.

### DOC-01 — Số câu trong expected-results chưa khớp mẫu hiện tại (P3)

`expected-results.json` mô tả câu Dijkstra ở PDF truy vấn là “trang 2, Câu 4”, nhưng giao diện PDF thực tế ghi “Câu 1” trên trang 2. Nên cập nhật mô tả theo nội dung câu thay vì chỉ dựa số thứ tự. Chưa đổi dữ liệu kỳ vọng trong lượt audit.

## Chưa kiểm hoặc chưa kết luận trong lượt này

- Electron main/preload: cài, hủy, resume, xác minh, xóa model; bật/tắt dịch vụ và onboarding sau khi thiếu model.
- Dialog Windows chọn/quét thư mục thật, mở Explorer, mở file bằng ứng dụng hệ điều hành, đóng/mở Electron.
- Mic thật, quyền Windows, thao tác Dừng/Hủy khi thu từ thiết bị thật. Không ghi âm khi người dùng đang làm việc. Audio upload không thay thế kiểm thử mic.
- OCR vùng DOCX/PPTX/EPUB qua chụp vùng Electron; browser không có IPC này. DOCX pan và preview đã được thử nhưng không được suy ra toàn bộ OCR các định dạng này đã đạt.
- Xóa vĩnh viễn tài liệu/môn/provider/model và thực thi trích xuất lại qua UI: chỉ mở xác nhận rồi hủy với tài liệu; chưa thực hiện thao tác phá hủy/thay thế dữ liệu trong lượt này.
- Kết nối OpenRouter/Custom API thật thành công, lưu khóa thật, phân tích AI thành công, Qwen/Ollama tải/chạy. Lượt này chỉ kiểm form, persistence và lỗi offline trên endpoint giả.
- Kiểm tra âm thanh phát ra loa, chất lượng trên audio dài/nhiễu và video; chỉ hai audio ngắn được chép lời.
- Hiệu năng với thư viện lớn, nhiều cửa sổ đồng thời, file rất dài, mọi tổ hợp filter và toàn bộ bảng/công thức/biểu đồ.
- Installer/EXE/release: không thực hiện, theo yêu cầu chốt dev trước.

## Thứ tự xử lý đề xuất

1. Sửa UX-01/02/03; test lại đúng các bước trên.
2. Tái hiện OBS-01 trên Electron và kiểm tra cuộn/layout trước khi sửa.
3. Thêm Q-02 vào bộ đánh giá tìm kiếm; giữ công bố giới hạn Q-01.
4. Dọn DEV-01 và cập nhật DOC-01.
5. Khi người dùng rảnh hoặc có máy Windows QA riêng, chạy phần Electron/mic/model chưa kiểm; không lấy báo cáo browser này thay cho desktop acceptance.

Giữ nguyên báo cáo kết quả cũ trong bộ test. Báo cáo này bổ sung bằng chứng của lượt 28/08, không viết đè lịch sử hoặc tự đánh dấu các lỗi đã sửa.

## Kết quả sửa và kiểm tra lại — 28/08/2026

Phần dưới bổ sung sau khi người dùng yêu cầu sửa lỗi. Các phát hiện phía trên giữ nguyên làm lịch sử.

### Đã sửa

| Mã | Thay đổi | Kiểm tra lại |
| --- | --- | --- |
| UX-01 | Thông báo upload lỗi và liên kết thiếu thành phần được tính từ file còn trong hàng đợi, không giữ một trạng thái lỗi tổng cũ. Không nhận thêm file khi batch đang tải. | UI: chọn `03_negative_cases/01_file_hong.pdf`, bấm thêm, thấy lỗi định dạng và tổng 1 lỗi; bỏ chọn file, cả tổng lỗi lẫn nút thử lại biến mất. Unit kiểm thêm nhiều file lỗi, trạng thái đang tải và thiếu thành phần. |
| UX-02 | Không cấu hình AI là `SKIPPED` (bỏ qua tùy chọn), không phải `FAILED`. Dashboard nói rõ AI chỉ phục vụ tóm tắt/phân loại. Chi tiết tài liệu không mời chạy lại một bước thiếu cấu hình; có liên kết thiết lập khi cần. | UI upload DOCX và XMind không có provider: trích xuất/chia đoạn/embedding hoàn thành, ghi “Sẵn sàng tìm kiếm · Chưa phân tích AI”, job AI “Bỏ qua (tùy chọn)”; tìm kiếm thật vẫn trả đúng XMind. Integration test: provider giả trả 401 vẫn FAILED; đổi sang phản hồi thành công rồi retry đạt COMPLETED. |
| UX-03 | Link mở tài liệu mang theo bộ lọc thư viện; nút quay lại phục hồi bộ lọc và trỏ về dòng tài liệu vừa mở. Chỉ chấp nhận đường `/documents` cùng các tham số cho phép. | UI: `q=ospf`, loại DOCX, trạng thái READY → mở DOCX → quay lại; URL và cả 3 ô lọc giữ nguyên, chỉ hiện đúng DOCX. Unit kiểm tên tiếng Việt, ký tự đặc biệt, loại bỏ URL ngoài app và tham số không cho phép. |
| DEV-01 | Xóa key `pretest:unit` trùng; thêm `test:ux-regression` vào pretest. | `npm run test:unit` chạy được, gồm test mới và voice-search có sẵn. |
| DOC-01 | Sửa mô tả vùng Dijkstra thành trang 2, Câu 1, kèm nội dung câu. | Đã sửa `expected-results.json` theo mẫu quan sát trong audit. |

Tương thích dữ liệu cũ: job phân tích `FAILED` với đúng thông báo “Chưa có kết nối AI đang hoạt động.” được hiển thị như bỏ qua AI; không xóa hoặc viết lại lịch sử job. Các lỗi API thật vẫn hiện cảnh báo. SQLite lưu trạng thái dưới dạng TEXT; thêm enum SKIPPED và sinh lại Prisma client, không cần xóa/chuyển dữ liệu tài liệu.

### Bằng chứng và phạm vi

- `npm run lint`: đạt, không lỗi/cảnh báo lint.
- `npm run test:unit`: exit 0; gồm test trạng thái, database, kết nối AI giả qua HTTP loopback, pipeline OCR/extractor, tìm kiếm và runtime hiện có.
- `npm run desktop:build`: đạt TypeScript, Next production build và chuẩn bị standalone. **Không tạo EXE/installer/release.**
- `git diff --check`: đạt (Git chỉ thông báo chuyển đổi LF/CRLF trên Windows).
- Giao diện chạy trong Browser nền trên build mới, DB riêng `.tmp/gui-ux-fix-20260828/data/scholarflow.db`. Không điều khiển màn hình/chuột, không ghi âm, không sửa thư viện hoặc provider thật của người dùng.
- File kiểm lại: `01_library/01_mang_may_tinh_ospf.docx`, `06_mindmap_audio/07_mindmap_legacy.xmind`, và PDF hỏng nói trên.
- Đọc DB test: 2 job mỗi loại EXTRACT_TEXT/CHUNK_DOCUMENT/EMBED_DOCUMENT COMPLETED, 2 job ANALYZE_DOCUMENT SKIPPED; **21/21 chunk có vector BGE-M3 thật**, mỗi vector 4.096 byte = 1.024 float32. Không bật embedding mock.
- Console Browser sau các bước trên: không có error/warn. Đã xem ảnh chụp giao diện nền để kiểm tra vị trí nhánh XMind.
- Bộ test sửa lỗi chạy riêng bằng `npm run test:ux-regression` tại thư mục `learning-resource-app`; tự dùng DB tạm và provider loopback giả, không gọi cloud.

### Chưa được coi là đã sửa

- **OBS-01:** mở kết quả 3NF → XMind → quay lại → mở lại, tổng 3 lần. Cả 3 lần tiêu đề nhánh có top 93,6 / bottom 118,8 trong iframe cao 518 px, đúng phần nhìn thấy. Query và kết quả tìm kiếm giữ nguyên. Chưa tái hiện lại lần cuộn sai nên **không thay mã cuộn và không tuyên bố lỗi chập chờn đã hết**; cần theo dõi thêm trong Electron.
- **Q-01:** không thay OCR/model. Test định tuyến đạt 19/19 nhưng vẫn báo thiếu 6 marker ở bảng/biểu đồ/sơ đồ; benchmark công thức ảnh phức tạp vẫn thiếu ký hiệu. Exit 0 của bộ test không có nghĩa OCR chính xác tuyệt đối.
- **Q-02:** chưa đổi xếp hạng/ngưỡng tìm kiếm; kết quả phụ kém sát vẫn cần bộ đánh giá riêng để tránh sửa một query làm hỏng query khác.
- Các giới hạn kiểm thử Electron, mic thật, Explorer, model management và cloud thật ở mục trước vẫn còn; lượt sửa này không thay thế kiểm thử chấp nhận trên desktop.

### Cập nhật OBS-01 sau khi người dùng yêu cầu tái hiện thêm

Đã tái hiện và sửa lỗi cuộn nhánh XMind khi mở xen kẽ JSON/XML và quay lại các bản xem trước đó. Bằng chứng trước/sau, cách sửa, các lượt kiểm tra đã đạt và giới hạn công cụ được lưu tại [TEST_QUAY_LAI_XMIND.md](06_mindmap_audio/TEST_QUAY_LAI_XMIND.md). Ghi nhận “chưa tái hiện” ở mục trước là kết quả của lượt thử ban đầu, không phải trạng thái mới nhất.
