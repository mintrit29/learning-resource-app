# Kiểm thử unhappy path — 28/08/2026

## Phạm vi và kết luận

Kiểm tra lỗi chức năng ngoài dự kiến, không đánh giá độ chính xác OCR/công thức/chép lời. Thao tác trên giao diện Browser nền, Next standalone và embedding thật, với database/profile QA riêng; không chiếm màn hình, chuột hoặc mic của người dùng. Không kiểm bản EXE.

**Lượt đầu phát hiện 5 lỗi trạng thái giao diện. Lượt sửa tiếp theo đã sửa UP-01…05 và ba ca bổ sung UP-06…08 bên dưới.** Bốn lỗi ban đầu P2 ảnh hưởng thao tác/kết quả; một lỗi P3 làm mất phản hồi. Không thể kết luận toàn bộ app không còn lỗi từ các ca dưới đây. Kết quả này bổ sung audit trước, không phủ nhận các ca trước đã đạt.

## Lỗi đã tái hiện

### UP-01 · P2 · Xóa câu tìm kiếm bằng bàn phím nhưng quay lại thì câu cũ xuất hiện

1. Trong Nhập mô tả, tìm `chuẩn hóa 3NF`, đợi kết quả.
2. Xóa nội dung ô nhập bằng chỉnh sửa văn bản, không dùng nút X. Xác nhận ô trống và kết quả đã biến mất.
3. Mở Cài đặt, rồi Tìm tài liệu.

**Thực tế:** câu `chuẩn hóa 3NF` và hai kết quả XMind cũ trở lại. Đã tái hiện với chuỗi rỗng và với chuỗi chỉ chứa khoảng trắng. Nút X có luồng xóa riêng, không phải lỗi này.

**Mong đợi:** nội dung đã xóa vẫn trống sau điều hướng.

**Đối chiếu code:** `semantic-search.tsx`, `editQuery` và effect xử lý query dưới 2 ký tự chỉ xóa state đang hiển thị; bản lưu trong sessionStorage vẫn giữ tìm kiếm cũ.

### UP-02 · P2 · Bộ lọc mới đi cùng kết quả cũ sau điều hướng nhanh

1. Chọn Tất cả loại file, tìm `chuẩn hóa 3NF`, đợi hai kết quả XMind 06/07.
2. Chuyển Loại file thành PDF, lập tức mở Cài đặt rồi quay lại Tìm tài liệu, trước khi lượt tìm theo bộ lọc mới hoàn tất.
3. Quan sát bộ lọc và loại tài liệu trong kết quả.

**Thực tế:** bộ lọc PDF nhưng vẫn hiện hai XMind. Reload vẫn giữ trạng thái sai; bấm Tìm ngay mới trả về đúng trạng thái không có kết quả. Đã lặp lại với DOCX và cũng thấy hai XMind dưới bộ lọc DOCX. Đây không chỉ là kết quả cũ hiển thị thoáng qua trong lúc tải.

**Mong đợi:** kết quả phải thuộc bộ lọc đã chọn; nếu chưa tìm xong thì tìm lại hoặc thể hiện rõ trạng thái chờ, không coi cache cũ là kết quả mới.

**Đối chiếu code:** `updateFilter` lưu `nextFilters` kèm `results/status` của lần tìm trước. Khi restore, signature dùng bộ lọc mới khiến effect bỏ qua tìm lại. Cần phân biệt bộ lọc đang chỉnh với bộ lọc thực sự đã tạo ra kết quả.

### UP-03 · P3 · Mất thông báo không tìm thấy sau khi quay lại

1. Tìm `chuẩn hóa 3NF` với PDF; bấm Tìm ngay và đợi thông báo Không tìm thấy tài liệu phù hợp.
2. Mở Cài đặt rồi quay lại Tìm tài liệu.

**Thực tế:** câu tìm kiếm và bộ lọc còn, nhưng thông báo không tìm thấy biến mất; phía dưới chỉ trống.

**Mong đợi:** giữ phản hồi không có kết quả cho lượt tìm đã hoàn tất.

**Đối chiếu code:** restore chỉ đặt `searchedQuery` khi `results.length > 0`, dù đã lưu status `NO_RELEVANT_RESULTS`.

### UP-04 · P2 · Ô truy vấn ảnh/file trống nhưng kết quả cũ vẫn hiện

1. Mở Ảnh hoặc file, chọn `02_visual_queries/01_anh_cau_hoi_ospf.png`.
2. Nhập `OSPF` vào ô nội dung nhận dạng và bấm Tìm lại. Cố ý nhập tay để tách phép thử này khỏi chất lượng OCR.
3. Thay nội dung ô đó bằng một khoảng trắng.

**Thực tế:** ô trông trống, nút Tìm lại bị vô hiệu hóa, nhưng bốn kết quả cũ vẫn được trình bày là tài liệu phù hợp.

**Mong đợi:** xóa kết quả cũ khi query không hợp lệ, hoặc ghi rõ đó là kết quả của câu trước; không để người dùng hiểu nhầm là kết quả hiện tại.

**Đối chiếu code:** effect tự tìm trong `visual-resource-search.tsx` return khi `normalizedQuery.length < 2`, không xóa results/searchStatus. Ca này chưa chứng minh race với phản hồi mạng tới muộn.

### UP-05 · P2 · XMind hỏng mất thông báo lỗi sau đổi chế độ

1. Trong Ảnh hoặc file, chọn `06_mindmap_audio/08_xmind_hong_KHONG_UPLOAD_THANH_CONG.xmind`.
2. Ban đầu app báo đúng: thiếu `content.json` hoặc `content.xml`.
3. Chuyển Nhập mô tả rồi trở lại Ảnh hoặc file.

**Thực tế:** tên file và thanh công cụ còn, nhưng vùng xem trắng, không còn lỗi hay thông báo khôi phục. Nút đổi file vẫn tồn tại; không phải toàn app bị treo.

**Mong đợi:** giữ lỗi cùng cách chọn lại file, hoặc chủ động bỏ file không hợp lệ.

**Đối chiếu code:** draft ảnh/file giữ file và preview nhưng không giữ `error`; component mount lại với lỗi rỗng và không tự dựng lại preview lỗi.

## Các ca đã đạt trong lượt này

| Ca | Kết quả quan sát |
| --- | --- |
| Mở PDF hỏng trong tìm bằng file | Báo lỗi dễ hiểu, không làm sập giao diện. |
| Đổi PDF hỏng sang ảnh hợp lệ | Lỗi được xóa, ảnh hiện và tìm `OSPF` được. |
| Mở XMind 09 có ảnh nhúng rồi đổi chế độ | Preview hợp lệ trở lại. |
| Chuyển XMind 09 sang sơ đồ thứ hai rồi đổi chế độ | Giữ sơ đồ 2/2; nút trước/sau đúng trạng thái. |
| Chọn cùng EPUB hai lần trong hàng đợi upload | Không thêm trùng hàng đợi. |
| Upload chung EPUB tốt, PDF hỏng và PDF trên 40 MB | File quá lớn bị loại trước upload (upload giới hạn 25 MB); EPUB được thêm, PDF hỏng báo lỗi riêng. |
| Retry batch sau khi EPUB đã thành công | Chỉ thử file lỗi; đối chiếu DB QA xác nhận EPUB vẫn một bản, không có bản ghi PDF hỏng. |
| Bỏ file lỗi khỏi hàng đợi | Thông báo retry/lỗi biến mất; trạng thái hàng đợi cập nhật đúng. |
| Mở thư viện sau batch lỗi một phần | EPUB đã thêm xuất hiện và hoàn tất phần trích xuất/embedding. |

Provider AI giả trong profile QA trỏ tới server đã tắt: EPUB hiển thị “Tìm được, phân tích AI lỗi”. Đây là tình huống dịch vụ AI tùy chọn không hoạt động, không tính là lỗi mới. Không dùng API trả phí hoặc dữ liệu cá nhân để thử.

## Thứ tự xử lý đề nghị

1. UP-02: kết quả và bộ lọc phải nhất quán.
2. UP-01 + UP-04: xóa truy vấn phải xóa đúng trạng thái hiện tại và trạng thái lưu.
3. UP-05: không biến lỗi preview thành màn hình trắng.
4. UP-03: giữ phản hồi không có kết quả khi quay lại.

Lượt đầu chỉ kiểm tra và ghi nhận. Sau khi được yêu cầu sửa, đã thực hiện lượt xác minh bên dưới; chưa commit/push.

## Lượt sửa và kiểm lại cùng ngày

### Thay đổi và kết quả UP-01…05

- UP-01: chỉnh/xóa câu truy vấn cập nhật ngay bản lưu và hủy kết quả cũ. UI xác nhận khoảng trắng vẫn giữ nguyên sau Cài đặt → Tìm tài liệu, không phục hồi kết quả cũ.
- UP-02: thay bộ lọc tạo bản nháp chưa có kết quả; chỉ lượt tìm hoàn tất mới được lưu như kết quả đã áp dụng. UI với PDF sau điều hướng nhanh trả về đúng không có kết quả. Test tự động cũng kiểm DOCX và sửa cache lệch bộ lọc từ phiên bản cũ.
- UP-03: khôi phục cả lượt tìm hoàn tất không có kết quả. UI giữ thông báo sau điều hướng.
- UP-04: sửa nội dung nhận dạng hủy OCR/search cũ, xóa kết quả ngay, không đợi debounce. UI xóa thành khoảng trắng rồi đổi chế độ không phục hồi kết quả cũ.
- UP-05: lưu lỗi preview và báo rõ khi preview bị ngắt giữa chừng; UI giữ lỗi XMind hỏng sau đổi chế độ.

### UP-06 · P2 · Đổi công cụ làm mất lỗi XMind

**Tái hiện trước sửa:** mở XMind 08 hỏng, đợi báo thiếu content.json/content.xml, bấm Kéo để xem. Thông báo biến mất, vùng xem trắng.

**Sửa:** đổi công cụ không tự xóa lỗi; lỗi tải preview tách khỏi lỗi tìm kiếm. Không cho khoanh vùng trên preview chưa đọc được.

**Kiểm lại:** lỗi vẫn còn sau Kéo để xem → Nhập mô tả → Ảnh hoặc file.

### UP-07 · P2 · Ảnh hỏng không được báo lỗi

**File mới:** `03_negative_cases/04_anh_hong.png` cố ý chứa văn bản thay vì pixel PNG; không phải ảnh để OCR.

**Tái hiện trước sửa:** mở file này trong Ảnh hoặc file; ảnh không giải mã được (naturalWidth = 0) nhưng app vẫn đưa công cụ chọn vùng, không có cảnh báo.

**Sửa:** xử lý lỗi giải mã ảnh, báo chọn ảnh khác và không khoanh trên ảnh hỏng.

**Kiểm lại:** báo Không đọc được ảnh, giữ lỗi khi đổi công cụ/tab. Đổi sang `01_anh_cau_hoi_ospf.png` thì ảnh hiện, lỗi hết và tìm kiếm hoạt động lại.

### UP-08 · P2 · Upload xong tự đổi trang sau khi người dùng đã rời đi

**Tái hiện trước sửa:** làm chậm phản hồi upload 1,8 giây, thêm EPUB rồi lập tức mở Cài đặt. Khi upload xong, app tự đưa sang trang chi tiết EPUB dù người dùng vừa chọn Cài đặt.

**Sửa:** dùng phiên upload dùng chung, không phụ thuộc vòng đời trang. Rời/quay lại không biến file đang tải thành file sẵn sàng để gửi lần nữa. Chỉ trang khởi tạo còn đang mở mới được tự điều hướng sau thành công.

**Kiểm lại:** với phản hồi upload chậm 6 giây, Cài đặt vẫn mở; quay lại upload giữa batch thấy đúng Đang thêm và khóa nút gửi trùng. EPUB thành công/PDF hỏng cập nhật đúng sau khi trang được mở lại. Đối chiếu DB QA số EPUB tăng đúng một (2 → 3); retry file lỗi không gửi lại EPUB.

Thử riêng lượt thành công với PDF cơ sở dữ liệu: sau khi rời upload, Cài đặt vẫn giữ nguyên cả trước và sau phản hồi; quay về upload thấy hàng đợi đã sạch. DB QA có đúng một PDF mới và EPUB vẫn ba bản do các lượt chọn mới chủ động trước đó, không tăng sau retry.

### Kiểm phản hồi chậm và phục hồi bổ sung

Chỉ trong môi trường QA: proxy loopback trì hoãn phản hồi tìm kiếm 3 giây, preview 5 giây, upload 6 giây. Không thay đổi tốc độ app thật, không gửi dữ liệu ra cloud.

- Tìm bằng mô tả: đang tìm 3NF rồi sửa OSPF → kết quả cuối chỉ thuộc OSPF.
- Xóa truy vấn trong lúc tìm rồi rời/quay lại → ô trống, không kết quả cũ.
- Tìm ảnh: đang tìm OSPF rồi sửa 3NF → kết quả cuối là hai XMind có đoạn 3NF, không bị kết quả OSPF ghi đè.
- Xóa nội dung ảnh khi tìm đang chạy rồi đổi chế độ → không hiện kết quả cũ.
- Rời trang trong lúc dựng preview XMind 09 → khi quay lại báo Bản xem trước chưa hoàn tất, không im lặng để trắng.
- Chọn lại XMind 09 → tải được; chuyển sơ đồ thứ hai, đổi chế độ rồi quay lại vẫn là Sơ đồ 2/2.

### Test tự động

- `npm run test:unit`: đã chạy lại toàn bộ chuỗi sau sửa cuối cùng, hoàn tất với exit code 0; các cảnh báo độ chính xác OCR đã biết không được tính thành lỗi UI mới.
- Sau sửa thêm upload/preview: chạy lại `npm run test:ux-regression`, `npm run test:visual-search`, `npm run lint` và `npm run desktop:build`, đều đạt. Build này để kiểm bản chạy, không tạo installer EXE.
- `test:ux-regression` có ca mới cho xóa/sửa query, đổi bộ lọc, cache lệch bộ lọc, kết quả rỗng, preview lỗi/bị ngắt; phiên upload có phản hồi muộn, khóa gửi trùng, lỗi một phần, retry và mất kết nối.

Không thay đổi dữ liệu người dùng; chỉ thêm tài liệu trong DB QA riêng. Bộ test gốc và file lỗi mới được giữ để người khác kiểm lại.

## Chưa được bao phủ bởi lượt này

- Mất điện/kill tiến trình lúc ghi dữ liệu, hết dung lượng đĩa, database hỏng.
- Mic thật, hộp thoại Windows, cài/gỡ model thật qua Electron, bản EXE.
- Các kiểu lỗi mạng khác ngoài độ trễ đã thử, ví dụ server đã ghi file nhưng kết nối mất trước khi trả documentId (cần cơ chế idempotency nếu muốn đảm bảo retry không trùng trong trường hợp đó).
- Mọi tổ hợp format/bộ lọc và các thao tác kéo dài nhiều giờ.

Không dùng các mục chưa kiểm để kết luận “đã pass toàn bộ”.
