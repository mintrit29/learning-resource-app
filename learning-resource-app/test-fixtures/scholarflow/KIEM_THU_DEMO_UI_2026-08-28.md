# Kiểm thử giao diện mở rộng trước demo — 28/08/2026

## Cập nhật sau sửa và kiểm lại — 28/08/2026

**DEMO-01…06 đã sửa và kiểm lại các bước gây lỗi trên giao diện.** Phát hiện thêm DEMO-07 ở Electron: Hủy xác minh model không dừng đọc/hash file; đã sửa và kiểm trực tiếp BGE-M3 thật. Không ghi nhận lỗi mới trong vòng kiểm cuối bên dưới. Đây không phải cam kết mọi tổ hợp đều không có lỗi.

Phần từ “Kết quả lịch sử trước sửa” trở xuống giữ bằng chứng ban đầu; các chữ “Không đạt/chưa sửa” ở đó là kết quả **trước** bản sửa, không phải trạng thái hiện tại.

### Thay đổi

- Các thao tác lưu môn, lưu phân loại, xóa tài liệu, retry dùng chung bộ gọi JSON có bắt lỗi, giới hạn 30 giây và `finally` trả lại nút. Không tự gửi lại thao tác ghi/xóa khi mất kết nối, vì backend có thể đã thực hiện.
- Mở form sửa phân loại luôn lấy bản đã lưu; Hủy không giữ bản nháp sang lần mở sau.
- Lỗi tên môn ngắn/trống trả tiếng Việt; URL tài liệu đã xóa có hướng dẫn và nút về thư viện.
- Xác minh model truyền tín hiệu Hủy vào luồng đọc/hash. Hủy không tạo dấu “model hỏng”, không xóa file, không để sự kiện cuối vẫn là “Đang tải/Đang kiểm tra”.

### Vòng kiểm sau sửa

| Ca | Bằng chứng quan sát | Kết quả |
|---|---|---|
| Lưu môn gặp 503 HTML | Hiện thông báo không hợp lệ; Hủy/Đóng/Tạo đều dùng được; Tạo lại trên cùng form thành công | Đạt |
| Lưu môn bị ngắt socket | Thông báo mất kết nối; không khóa form; gửi lại thành công, danh sách có `QA mất kết nối` | Đạt |
| Tên môn chỉ một ký tự | `Tên môn học phải có ít nhất 2 ký tự.`; vẫn sửa được trên form | Đạt |
| Hủy sửa phân loại rồi mở lại | Textarea trở về tóm tắt đã lưu, không còn câu nháp vừa hủy | Đạt |
| Lưu phân loại gặp 503 HTML | Thông báo rõ; Hủy/Đóng/Lưu hoạt động; gửi lại cùng form thành công | Đạt |
| Xóa tài liệu gặp 503 HTML | Không khóa dialog; Hủy đóng được, tài liệu còn | Đạt |
| Xóa bản EPUB QA sau lỗi | Về thư viện còn 6 tài liệu; URL bản đã xóa hiện trang tiếng Việt; nút Về thư viện hoạt động | Đạt |
| Retry gặp 503 HTML rồi dịch vụ phục hồi | Nút không kẹt; retry lại EPUB hoàn tất 580 ký tự/6 đoạn, sẵn sàng tìm kiếm, có tóm tắt API mô phỏng | Đạt |
| Tìm `chuẩn hóa cơ sở dữ liệu` | Trả PDF, XMind JSON và XMind XML; mở XML đúng sơ đồ 2/nhánh 3NF | Đạt |
| Từ XMind quay lại, rồi xóa truy vấn | Giữ câu tìm và 3 kết quả; bấm Xóa thì ô tìm rỗng và kết quả cũ biến mất | Đạt |
| Desktop: Kiểm tra Docling, BGE-M3, Whisper | Từng model đi qua Đang kiểm tra rồi Sẵn sàng; không tải lại model | Đạt |
| Desktop: Hủy giữa xác minh BGE-M3 sau bản sửa | Lần chụp sau Hủy đã về Sẵn sàng, nút Kiểm tra/Xóa trở lại, không báo hỏng | Đạt |
| Desktop: Kiểm tra BGE-M3 lại sau khi Hủy | Hoàn tất về Sẵn sàng lần nữa; Docling/Whisper vẫn Sẵn sàng | Đạt |

### Hồi quy tự động

- `npm run test:ux-regression`: đạt; có `scripts/test-ui-actions.mjs` mới.
- `npm run test:component-manager`: đạt; thêm ca hủy hash, hủy verify trước khi đọc, không tạo marker hỏng, thử verify lại, và sự kiện cuối sau hủy install.
- `npm run test:unit`: chạy lại toàn bộ sau sửa Electron, exit 0. Bao gồm XMind JSON/XML/ảnh nhúng, PDF scan/native, voice API + FFmpeg, upload/search state, model manager, embedding, storage, vector, preview và queue.
- `npm run lint`: exit 0 sau sửa Electron. `npm run desktop:build`: exit 0 cho phần giao diện/standalone; không tạo EXE. Sửa Electron tiếp theo được kiểm bằng unit và chạy dev thật.
- Timeout (fetch treo/body treo), JSON lỗi, HTML 200/503 và không tự retry mutation: kiểm tự động, **không giả nhận đã bấm UI chờ hết 30 giây**.
- OCR giữ baseline đã công bố: PDF native 26/26 mốc, scan 24/26; công thức/bảng/sơ đồ vẫn có mốc sai/thiếu. Unit pass không có nghĩa OCR đúng 100%.

### DEMO-07: Hủy kiểm tra model

Trước sửa: Kiểm tra BGE-M3 → Hủy vẫn tiếp tục xác minh tới khi xong. `cancel()` chỉ abort controller nhưng `sha256File()` không nhận signal. Sửa cả hash khi tải file có sẵn và hash cuối tải; hủy không bị coi là checksum lỗi. Kiểm UI sau restart dùng runtime thật trong profile QA, không mock IPC.

### Lưu ý vận hành dev và an toàn dữ liệu

- Browser dùng database `.tmp/gui-ux-fix-20260828/data/scholarflow.db`; Electron dùng `.tmp/release-qa-20260828/profile`. Đã xác nhận profile Electron bằng tham số tiến trình, không phải AppData thật.
- Xóa thêm đúng bản EPUB QA `cmtcr841i0006louz67k6oq0q`; phục hồi bằng upload lại file mẫu. SHA-256 file mẫu bên ngoài vẫn là `937E42D38E7E5A06FFA45ADA302BFBC8B0652746D182461B9B670CF93C6829EC`.
- Sau khi build trong buổi đang có dev, lần restart gặp 404 ở cả `/api/health` và `/dashboard`. Dừng đúng cây tiến trình QA, **di chuyển** `.next/dev` sang `.tmp/dev-cache-before-ui-restart-20260828`, chạy lại thì health/dashboard/settings đều 200. Quan sát phù hợp với cache dev cũ không nhất quán; chưa kết luận sâu nguyên nhân bên trong Next. Không sửa dữ liệu hay hạ cơ chế health token. Nên dừng dev trước build và tránh nhiều tiến trình cùng ghi cache dev.
- Không cài EXE, không commit/push. Không xóa model hay tài liệu thật; không gọi cloud API thật.
- Cuối lượt đã đóng cửa sổ Electron QA và dừng runner dev, Next/embedding riêng cùng proxy/API giả. Tab Browser chẩn đoán cũ ở cổng đã dừng gặp giới hạn công cụ khi đóng; không tiếp tục thao tác tab lỗi này. Console của trang tìm kiếm ở vòng cuối không có error/warn mới.

### Khoảng trống vẫn phải ghi rõ

- Có kiểm nút xác minh và Hủy trong Electron, **chưa** kiểm lại tải model đầy đủ qua mạng, native xác nhận xóa model/môn/provider, mất mạng giữa tải thật, hoặc restart đang có job tài liệu.
- UI xóa môn dùng native confirm chưa xác nhận vòng Đồng ý/Hủy; nhánh lỗi dùng cùng helper đã có test nhưng không tính là UI đã đạt.
- Mic vật lý/quyền Windows, ứng dụng mở file ngoài, hết RAM/ổ đĩa và mọi tổ hợp nhiều cửa sổ chưa được kiểm hết. Desktop QA cấu hình mic giả từ file WAV, không ghi âm môi trường của người dùng.
- Các ca upload/visual trên 11 file và UP-01…08 có hồ sơ riêng, không ghi là đã chạy lại toàn bộ trên GUI ở vòng này. Unit hồi quy của chúng đã chạy lại.

## Kết quả lịch sử trước sửa

**Chưa nên chốt “không còn lỗi bất ngờ”.** Đã tái hiện bốn vị trí có thể bị kẹt khi dịch vụ lỗi: lưu môn học, lưu phân loại, xóa tài liệu và xử lý phần còn thiếu. Ngoài ra, Hủy sửa phân loại không bỏ bản nháp; một số thông báo còn tiếng Anh kỹ thuật.

Đây là lượt **kiểm thử và báo cáo**, chưa sửa các lỗi DEMO bên dưới. Các sửa đổi UP-01…08 từ lượt trước vẫn được giữ nguyên. Không build EXE, không commit/push trong lượt này.

## Môi trường và cách kiểm

- Browser nền, thao tác bằng nút/ô nhập/liên kết trên giao diện thật; không điều khiển màn hình, chuột hoặc mic của người dùng.
- Next standalone từ bản source hiện tại, BGE-M3 thật và runtime Docling/Tesseract của profile QA.
- Database riêng: `.tmp/gui-ux-fix-20260828/data/scholarflow.db`, không phải thư viện thật trong AppData.
- Thư viện đầu lượt có 8 tài liệu: DOCX, PDF, 3 bản EPUB và 3 XMind. Xóa một bản EPUB trùng để kiểm DELETE; cuối lượt còn 7 tài liệu.
- AI cloud được **mô phỏng trên loopback**: danh sách hai model; phản hồi phân tích hợp lệ; HTTP 401; HTML không hợp lệ. Không gọi API cloud thật, không kiểm chất lượng tóm tắt bằng dữ liệu mô phỏng.
- Proxy QA chỉ gây lỗi đúng một request được chỉ định: HTTP 503 trả HTML hoặc ngắt socket. Request lỗi không được chuyển tới backend, tránh vô tình lưu/xóa dữ liệu. Các request khác đi vào app thật.
- Harness cục bộ: `.tmp/gui-audit-20260828.mjs`, `.tmp/ui-audit-fault-proxy.mjs`. Đây là công cụ tạm, không phải tính năng app hoặc bộ cài. Bảng và bước tái hiện bên dưới là hồ sơ lâu dài.
- Bằng chứng: trạng thái DOM sau thao tác, console browser, và kiểm tra SQLite/file chỉ đọc khi cần đối chiếu xóa. Không suy ra kết quả UI chỉ từ unit test.

## Ma trận đã thao tác trong lượt này

“Đạt” chỉ có nghĩa ca ghi trong hàng đã đạt. Không đại diện cho mọi tổ hợp dữ liệu hoặc mọi kiểu lỗi mạng.

| ID | Thao tác | Kết quả thực tế |
|---|---|---|
| M01 | Thêm môn, để tên rỗng rồi Tạo | Đạt: trình duyệt chặn trường bắt buộc |
| M02 | Tên chỉ có khoảng trắng | Chặn được, nhưng thông báo Zod tiếng Anh — DEMO-06 |
| M03 | Tên trùng `Hệ thống mạng` | Đạt: báo tên đã tồn tại, vẫn sửa và gửi lại được |
| M04 | Sau lỗi trùng, tạo `QA Demo môn tạm` | Đạt: danh sách tăng 27 → 28 |
| M05 | Tìm tên không tồn tại rồi xóa tìm kiếm | Đạt: trạng thái rỗng rõ ràng, danh sách phục hồi |
| M06 | Sửa tên môn, Hủy, mở lại | Đạt: giữ tên đã lưu, bỏ thay đổi vừa hủy |
| M07 | Đổi tên thành `QA Demo môn đã sửa` | Đạt: tên mới hiện ở danh sách và bộ lọc thư viện |
| M08 | Tạo môn, proxy trả 503 HTML | Không đạt: mọi nút hộp thoại bị khóa — DEMO-01 |
| M09 | Tạo môn, proxy ngắt socket | Không đạt: cùng lỗi kẹt, console `Failed to fetch` — DEMO-01 |
| A01 | Kiểm tra provider trỏ tới dịch vụ đã tắt | Đạt: thông báo không kết nối được, trạng thái Có lỗi, nút dùng tiếp được |
| A02 | Sửa Base URL/model rồi reload | Đạt: cấu hình còn, provider vẫn mặc định |
| A03 | Tải danh sách model từ API mô phỏng | Đạt: hiện hai model, tự chọn model hợp lệ |
| A04 | OpenRouter không nhập API key rồi Lưu | Đạt: trường key không hợp lệ, không lưu cấu hình |
| A05 | Tạo thêm Custom API không key | Đạt: provider phụ được lưu, không tự thay provider mặc định |
| A06 | Kiểm tra Custom API trả 401 | Đạt: báo API key không hợp lệ/hết hạn |
| A07 | Chuyển mặc định sang provider thứ hai, reload, đổi lại | Đạt: lựa chọn được giữ và đổi lại được |
| A08 | Tải model từ endpoint trả HTML | Đạt: báo dịch vụ trả dữ liệu không hợp lệ, form không kẹt |
| A09 | Sau A08 sửa URL tốt và tải model lại | Đạt: hiện “Đã tải 2 model”, Hủy đóng form được |
| D01 | Xử lý phần còn thiếu, proxy trả HTML | Không đạt: nút bị khóa, không có thông báo — DEMO-02 |
| D02 | Reload sau D01, xử lý phần còn thiếu với API tốt | Đạt: PDF hoàn tất, hiện tóm tắt mô phỏng và trạng thái sẵn sàng |
| D03 | Sửa tóm tắt, Hủy, mở lại | Không đạt về UX: bản nháp đã hủy vẫn nằm trong form — DEMO-05 |
| D04 | Lưu phân loại, proxy trả HTML | Không đạt: Đang lưu/Hủy/Đóng bị khóa — DEMO-03 |
| D05 | Reload, sửa môn và tóm tắt rồi lưu bình thường | Đạt: nội dung và môn được cập nhật |
| D06 | Lọc môn vừa gán, mở PDF, Quay lại thư viện | Đạt: đúng PDF, bộ lọc vẫn giữ |
| D07 | Trích xuất lại, proxy trả HTML, bấm Hủy | Đạt: báo lỗi rõ, Hủy/Đóng vẫn hoạt động |
| D08 | Trích xuất lại PDF thật, chờ hoàn tất, mở lại hộp xác nhận | Đạt: 1.360 ký tự, 6 đoạn, sẵn sàng; hộp mở lại vẫn dùng được |
| D09 | Xóa tài liệu rồi Hủy | Đạt: tài liệu còn nguyên |
| D10 | Xóa vĩnh viễn, proxy trả HTML | Không đạt: hộp xóa bị khóa — DEMO-04 |
| D11 | Reload, xóa bản EPUB trùng thành công | Đạt: về thư viện, row/file trong QA bị xóa, file mẫu ngoài QA không đổi |
| D12 | Mở lại URL tài liệu đã xóa | Không crash, sidebar còn dùng được; thông báo 404 tiếng Anh — DEMO-06 |
| D13 | Lọc PPTX khi QA không có PPTX, rồi Xóa lọc | Đạt: thông báo không khớp rõ ràng, danh sách trở lại |
| D14 | Mở Nội dung đã trích xuất, endpoint text trả 503 HTML | Đạt: báo không tải được nội dung, không kẹt trang |
| D15 | Thu gọn rồi mở lại sau D14 | Đạt: tải đủ phần text PDF và hiện nội dung |
| S01 | Tìm mô tả khi `/api/search` trả HTML | Đạt: báo không kết nối được, nút tìm vẫn dùng được |
| S02 | Bấm Tìm ngay lại sau S01 | Đạt: trả PDF và XMind phù hợp với `chuẩn hóa cơ sở dữ liệu` |
| S03 | Mở kết quả XMind 06 rồi quay lại tìm kiếm | Đạt: mở đúng sơ đồ 2/nhánh 3NF; câu tìm và danh sách kết quả còn |
| B01 | Mở Thành phần cục bộ bằng Browser không có Electron IPC | Đạt cho chế độ giới hạn: báo chỉ khả dụng trong Desktop; **không phải đã test tải/xóa model** |

## Lỗi cần sửa trước khi chốt demo

### DEMO-01 · P1 · Lưu môn học bị kẹt khi phản hồi bất thường

1. Cài đặt → Danh sách môn học → Thêm môn học; nhập tên hợp lệ.
2. Cho request `POST /api/tags` nhận 503 `text/html` hoặc mất kết nối.
3. Bấm Tạo môn học.

Thực tế: Tạo môn học, Hủy và Đóng đều disabled; Escape không đóng được. Console có `Unexpected token '<' ... is not valid JSON` hoặc `TypeError: Failed to fetch`. Không có thông báo giải thích trên form. Reload mới thoát được.

Đối chiếu: `src/components/settings/tag-manager.tsx`, `save()` dùng `fetch`/`response.json()` không có catch/finally. Luồng xóa môn cũng có mẫu code tương tự nhưng **chưa trực tiếp kiểm xác nhận xóa môn trong lượt này**.

### DEMO-02 · P2 · “Xử lý phần còn thiếu” không thử lại được sau lỗi

1. Mở tài liệu có phân tích AI lỗi, ví dụ PDF QA.
2. Cho `POST /api/documents/:id/retry` trả 503 HTML.
3. Bấm Xử lý phần còn thiếu.

Thực tế: nút disabled vô hạn trong lượt quan sát, không báo lỗi; console lỗi JSON. Các phần còn lại của trang vẫn dùng được. Reload rồi thử với dịch vụ tốt thì hoàn tất.

Đối chiếu: `src/components/documents/retry-job-button.tsx`, thiếu catch/finally.

### DEMO-03 · P1 · Lưu phân loại bị kẹt

1. Mở PDF đã có phân tích → Chỉnh sửa; thay tóm tắt bằng nội dung hợp lệ.
2. Cho `PATCH /api/documents/:id` trả 503 HTML.
3. Lưu thay đổi.

Thực tế: Đang lưu, Hủy, Đóng đều disabled; không có thông báo. Nội dung backend không bị sửa bởi request giả lập. Reload mới phục hồi được.

Đối chiếu: `src/components/documents/edit-analysis-button.tsx`, `save()` không bắt lỗi fetch/parse và không bảo đảm trả lại trạng thái nút.

### DEMO-04 · P1 · Xóa tài liệu bị kẹt

1. Mở bản tài liệu QA có thể xóa → Xóa tài liệu.
2. Cho `DELETE /api/documents/:id` trả 503 HTML.
3. Xóa vĩnh viễn.

Thực tế: Đang xóa/Hủy/Đóng disabled, không có thông báo; file chưa bị xóa. Sau reload và gửi bình thường thì xóa thành công.

Đối chiếu: `src/components/documents/delete-document-button.tsx`, `deleteDocument()` thiếu catch/finally.

### DEMO-05 · P2 · Hủy chỉnh sửa phân loại nhưng bản nháp vẫn còn

1. Mở tài liệu có tóm tắt → Chỉnh sửa.
2. Đổi tóm tắt thành `QA bản nháp đã hủy, không được lưu` → Hủy.
3. Bấm Chỉnh sửa lần nữa.

Thực tế: form vẫn chứa bản nháp đã hủy, trong khi phần tóm tắt ngoài form vẫn là bản đã lưu. **Không phải Hủy tự ghi database**; rủi ro là người dùng lần sau lưu nhầm nội dung tưởng đã bỏ. Hộp sửa môn học không gặp lỗi này.

Đối chiếu: `EditAnalysisButton` khởi tạo `form` một lần bằng useState; mở/đóng chỉ đổi `isOpen`, không đặt lại từ `initial`.

### DEMO-06 · P3 · Thông báo chưa thân thiện

- Tạo tên môn chỉ có khoảng trắng: `Too small: expected string to have >=2 characters`.
- Mở URL tài liệu đã xóa: `404 / This page could not be found.`.

Không làm crash, nhưng nên đổi thành hướng dẫn tiếng Việt: tên môn tối thiểu hai ký tự; tài liệu không còn tồn tại và nút về thư viện. Validation HTML mặc định của trình duyệt có thể theo ngôn ngữ trình duyệt; cần phân biệt với lỗi Zod do app trả ra.

## Bằng chứng không ảnh hưởng file người dùng

- Bản xóa trong QA: `cmtcro3kj00061ouze2yyayfs`, file `data/uploads/4a4ef60f-e978-42c2-a63c-9dcbd094a76a/04_an_toan_thong_tin.epub`.
- Sau xóa: SQLite không còn row này; bản sao trong QA không còn.
- File mẫu `01_library/04_an_toan_thong_tin.epub` có SHA-256 trước/sau giống nhau: `937E42D38E7E5A06FFA45ADA302BFBC8B0652746D182461B9B670CF93C6829EC`.
- Có thể phục hồi bản QA bằng upload lại file mẫu. Không sửa/xóa tài liệu AppData thật.
- Đã tạo một môn QA và một provider phụ trong database QA; phân tích và trích xuất lại PDF cũng chỉ ở QA.
- Kết thúc lượt: đã đóng hai tab kiểm thử, dừng Next/embedding và proxy/API mô phỏng; không để dịch vụ QA chạy nền. `git diff --check` đạt. Không chạy lại lint/unit/build vì lượt này không sửa code sản phẩm.

## Phần còn phải kiểm, không được ghi là đã đạt

- Electron thực: tải/hủy/kiểm tra/xóa model, mất mạng giữa tải, thiếu dung lượng, restart khi đang xử lý; Browser ở lượt này không có preload IPC.
- Native confirm khi xóa môn/provider và Phân tích AI lại: chưa xác nhận đầy đủ vòng Đồng ý/Hủy trong lượt này. Không suy ra đạt từ đọc code.
- Tải file về/Hiện file trong thư mục, hộp chọn thư mục Windows, association ứng dụng ngoài.
- Mic thật: cấp/từ chối quyền, ngắt thiết bị, thu/Dừng/Hủy; không dùng mic khi người dùng đang làm việc.
- Focus trap và đầy đủ phím tắt: thử Tab chưa có bằng chứng đủ chắc để kết luận; không ghi thành lỗi đã xác nhận.
- Mọi tổ hợp nhiều cửa sổ, hai người/thao tác đồng thời, hàng trăm tài liệu, hệ điều hành khóa file, hết RAM/ổ đĩa.
- API cloud thật và Ollama thật: lượt này chỉ kiểm giao diện/khôi phục bằng API mô phỏng.
- Không chạy lại toàn bộ upload/OCR/visual/PDF/PPTX/DOCX/EPUB/audio/XMind trong lượt mở rộng này. Kết quả các lượt trước ở [audit giao diện nền](KIEM_THU_GIAO_DIEN_NEN_2026-08-28.md) và [unhappy path](KIEM_THU_UNHAPPY_PATH_2026-08-28.md), không tính là vừa chạy lại.

## Thứ tự xử lý đề nghị

1. Bắt lỗi và giải phóng trạng thái loading cho bốn vị trí DEMO-01…04; có thông báo và nút thử lại, không khóa đường thoát.
2. Đặt lại form khi mở/Hủy sửa phân loại; kiểm dữ liệu mới sau refresh.
3. Việt hóa validation và trang tài liệu không tồn tại.
4. Chạy lại đúng các request lỗi ở bảng, cả mất kết nối lẫn HTML/JSON lỗi, sau đó thử gửi thành công ngay trên cùng form.
5. Làm lượt Electron riêng cho các khoảng trống nêu trên trước khi chốt demo. Không hứa “zero bug” dựa vào số lượng case.
