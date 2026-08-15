# Project Checklist — ScholarFlow Desktop

**Cập nhật:** 15/08/2026
**Nhánh:** `desktop-app`
**Phạm vi:** desktop Windows, local-only, không đăng ký/đăng nhập, cloud backend, Docker hoặc web app riêng.
**Quy ước:** mục đã code nhưng chưa hoàn tất packaged smoke/commit được ghi rõ trong nội dung. PRD để cập nhật sau khi sản phẩm hoàn thiện.

## A. Desktop shell

- [x] Đóng gói giao diện Next.js trong Electron.
- [x] Chỉ chạy dịch vụ nội bộ trên `127.0.0.1` với cổng động.
- [x] Electron tự khởi động, health-check và dừng Next.js/embedding runtime.
- [x] Dùng single-instance lock.
- [x] Bật `contextIsolation`, sandbox và tắt `nodeIntegration`.
- [x] Chặn điều hướng ngoài; URL HTTPS mở bằng trình duyệt hệ thống.
- [x] Ghi log vào `%APPDATA%\ScholarFlow\logs`.
- [x] Sửa lỗi `EPIPE` khi console dev bị đóng để main process không crash.
- [x] Có electron-builder và cấu hình NSIS Windows.
- [ ] Chạy lại packaged interaction test sau thay đổi local-only và sửa `EPIPE`.

## B. Dữ liệu local và loại bỏ tài khoản

- [x] Prisma dùng SQLite; vector dùng sqlite-vec 1.024 chiều.
- [x] Lưu database/uploads trong `%APPDATA%\ScholarFlow\data`.
- [x] Migration được áp dụng tự động và idempotent.
- [x] Chống path traversal cho file trong vùng uploads.
- [x] Không đưa database, uploads, logs hoặc model cache vào Git.
- [x] Xóa giao diện/API đăng ký và đăng nhập trong working tree.
- [x] Xóa NextAuth, adapter auth, bcrypt và type/validation liên quan trong working tree.
- [x] Xóa `User`, `Account`, `Session`, `VerificationToken` và các trường `userId` khỏi schema mới.
- [x] Chuyển document, tag, provider và search log sang một thư viện local duy nhất.
- [x] Tạo migration xóa tài liệu/tài khoản cũ nhưng giữ tag, alias, AI provider và cài đặt khác.
- [x] Test migration xác nhận tag và cấu hình Ollama được giữ lại.
- [x] Chỉ dọn bản sao tài liệu trong đúng `%APPDATA%\ScholarFlow\data\uploads` khi chuyển phiên bản.
- [x] Xác nhận file gốc người dùng chọn bên ngoài app không bị xóa.
- [x] Tách khóa mã hóa AI provider khỏi auth và nhận lại khóa cũ khi có.
- [ ] Chạy standalone/package smoke cuối cho migration local-only.
- [ ] Commit thay đổi local-only; hiện chưa push.
- [ ] Thêm backup/restore database và uploads trong giao diện nếu còn trong phạm vi release.

## C. Quản lý thành phần local

- [x] BGE-M3 và Docling có manifest cố định trong Electron.
- [x] Pin revision/version và SHA-256 của asset chính thức.
- [x] Tải stream vào `.partial` và hỗ trợ HTTP Range resume.
- [x] Kiểm tra dung lượng trống trước khi tải.
- [x] Hỗ trợ hủy, kiểm tra, tải lại và xóa thành phần.
- [x] Có trạng thái `missing`, `downloading`, `verifying`, `ready`, `corrupt`, `error`.
- [x] Có API preload/IPC và progress event giới hạn theo ID hợp lệ.
- [x] Có trang `/setup/components` trước giao diện chính khi thiếu thành phần.
- [x] Có `Cài đặt → Thành phần cục bộ`.
- [x] Nhận diện cache BGE-M3 cũ trong `%APPDATA%\ScholarFlow\models`.
- [x] Nhập Docling runtime cũ vào `%APPDATA%\ScholarFlow\runtimes\docling`.
- [x] Không đóng BGE-M3 hoặc `.docling-runtime` vào installer.
- [x] Thiếu Docling thì chặn upload/trích xuất lại với thông báo rõ.
- [x] Thiếu BGE-M3 vẫn cho trích xuất/xem nội dung nhưng chặn semantic search/embedding.
- [x] Unit/integration test download, resume, no-Range, checksum, cancel và containment đạt.

## D. Trích xuất và xử lý tài liệu

- [x] Nhận PDF, DOCX, PPTX và EPUB.
- [x] Dùng Docling.rs thay cho các extractor cũ trong pipeline chính.
- [x] OCR PDF scan và ảnh nhúng trong tài liệu bằng Docling.
- [x] Giữ trang/slide/mục và `sourceLabel`.
- [x] Chunk nội dung Docling để embedding và tìm kiếm.
- [x] Có job extract, chunk, embed và analyze.
- [x] Hiển thị trạng thái, tiến trình và lỗi từng bước.
- [x] Có retry, trích xuất lại và phân tích AI lại.
- [x] Xử lý nhiều file/thư mục bằng queue tuần tự.
- [x] Xem file gốc, preview và text đã trích xuất.
- [x] Test extractor PDF/DOCX/PPTX/EPUB đạt.
- [x] Test preview DOCX/PPTX/EPUB đạt.
- [ ] Kiểm tra lại toàn bộ bốn tài liệu thực tế sau khi hoàn tất local-only.

## E. Embedding và AI provider

- [x] BGE-M3 chạy local bằng Transformers.js + ONNX Runtime.
- [x] Vector giữ đúng 1.024 chiều.
- [x] Electron quản lý vòng đời embedding runtime và tự khôi phục khi process dừng.
- [x] Tắt tải model ngầm từ runtime.
- [x] Hỗ trợ OpenRouter, Ollama và Custom API.
- [x] Thêm, sửa, kiểm tra, đặt mặc định và xóa provider.
- [x] API key được mã hóa trước khi lưu.
- [x] Lỗi provider được rút gọn, không lộ raw body/HTML/stack trace.
- [x] Phân tích môn học, độ khó, ngôn ngữ và tóm tắt là tùy chọn.
- [x] Tìm kiếm và thư viện không phụ thuộc Ollama/Qwen.
- [ ] Cải thiện UI che/đổi API key nếu còn trong phạm vi release.

## F. Môn học mặc định

- [x] Có 27 môn CNTT NTTU mặc định từ học kỳ 2 đến học kỳ 12.
- [x] AI chỉ chọn môn hiện có hoặc để “Chưa phân loại”.
- [x] Áp dụng ngưỡng tin cậy 75% ở server.
- [x] Không cho AI tự tạo môn học mới.
- [x] Cho phép thêm, đổi tên, alias, xóa và gộp môn học.
- [x] Chuyển tài liệu về “Chưa phân loại” khi môn bị xóa.
- [x] Bỏ giao diện/API/bảng đề xuất gộp chủ đề.
- [x] Tối ưu để chỉ đồng bộ danh mục mặc định một lần trong mỗi phiên app.

## G. Tìm kiếm chữ hiện tại

- [x] Tìm bằng truy vấn tự nhiên tiếng Việt và tiếng Anh.
- [x] Kết hợp vector BGE-M3, từ khóa và metadata.
- [x] Lọc theo môn học, độ khó và định dạng.
- [x] Có relevance gate loại kết quả yếu.
- [x] Hiển thị lý do phù hợp, chunk và vị trí nguồn.
- [x] Trả trạng thái thư viện trống/no-result rõ ràng.
- [x] Có test ranking, semantic retrieval và evidence search.
- [x] Search log là dữ liệu local, không còn gắn với tài khoản.

## H. Tìm bằng vùng chọn trên ảnh hoặc file

**Trạng thái: đang triển khai. Luồng MVP đã hoạt động; các mục chưa đánh dấu bên dưới vẫn cần hoàn thiện và kiểm thử.**

### Quyết định sản phẩm đã thống nhất

- [x] Một luồng chung cho ảnh, PDF, DOCX, PPTX và EPUB.
- [x] Không phân loại đầu vào thành bài tập/đề thi/tài liệu.
- [x] Không tự tách câu hỏi.
- [x] Không phân chủ đề cho query và không lọc cứng theo chủ đề đoán được.
- [x] Bố cục viewer bên trái, OCR/kết quả bên phải.
- [x] Chọn vùng trực tiếp như Lens; không có thao tác crop/lưu riêng.
- [x] OCR là nguồn chính; text layer chỉ bổ trợ.
- [x] Tự OCR/tìm sau khi vùng chọn ổn định khoảng 250–400 ms.
- [x] Mỗi vùng chọn là một query hoàn chỉnh.
- [x] Dùng hybrid search/relevance gate hiện tại; không giải bài hoặc sinh đáp án.
- [x] Không thêm vision model ở bản đầu.
- [x] File truy vấn và ảnh vùng chọn là dữ liệu tạm, không nhập vào thư viện.
- [x] Bản đầu chọn một vùng trên một trang mỗi lần.

### Việc cần triển khai

- [x] Thêm nút `Mở ảnh hoặc file để tìm` trên trang Tìm kiếm.
- [x] Xây viewer hai cột thống nhất cho năm loại đầu vào.
- [x] Render lazy slide/chương đang xem qua session RAM tạm; integration test xác nhận lần đầu chỉ có slide 1, lần sau mới render slide 2 và DELETE trả 204.
- [x] Thêm điều hướng trước/sau và chỉ mục số thu gọn cho PPTX/EPUB; PDF dùng viewer Chromium, DOCX cuộn liên tục. Không tạo thumbnail ảnh ở v1.
- [x] Thêm ROI overlay hỗ trợ kéo, resize và zoom; smoke test tọa độ đạt ở DPI 100%/150% với zoom 80%/100%/125%.
- [x] Render vùng chọn vào buffer ảnh trong RAM qua Electron `capturePage`; không tạo file crop.
- [x] Tạo Docling warm pipeline/worker cho OCR lặp lại nhanh.
- [x] Thêm debounce, request id và bỏ kết quả OCR/search đã lỗi thời.
- [x] Chuẩn hóa OCR text thành một query; giữ Markdown cho công thức/bảng Docling nhận ra.
- [x] Bổ sung text layer đúng vùng chọn cho DOCX/PPTX/EPUB để bù lỗi dấu/công thức OCR; ảnh và PDF scan vẫn dùng OCR.
- [x] Hiển thị text OCR có thể sửa; tự tìm lại sau khi sửa.
- [x] Nối query OCR vào API hybrid search hiện tại.
- [x] Hiển thị loading, kết quả, no-result và lỗi OCR bên phải.
- [x] Báo rõ khi vùng chọn không có đủ chữ để tìm.
- [x] Cleanup object URL/buffer tạm khi đổi file hoặc đóng công cụ; không ghi vào thư viện.
- [x] Giới hạn file 40 MB, vùng 8 MP, payload OCR 12 MB, tối đa 200 slide/chương; timeout UI 30 giây cho preview/search và 90 giây cho OCR.

### Kiểm thử cần bổ sung

- [x] Tọa độ vùng chọn đúng ở nhiều zoom/DPI bằng Electron capture smoke test.
- [ ] Chọn lại nhanh không để kết quả cũ ghi đè kết quả mới.
- [ ] Ảnh thường và ảnh scan tiếng Việt.
- [ ] PDF text và PDF scan.
- [ ] DOCX, PPTX và EPUB nhiều trang/phần.
- [ ] Công thức, bảng, hình có nhãn và vùng không có chữ.
- [x] OCR chỉ xử lý vùng chọn trong viewport/slide/chương đang xem; không OCR toàn bộ file truy vấn.
- [ ] Query tạm được xóa và file gốc không thay đổi.
- [ ] Kết quả dưới ngưỡng trả no-result.
- [ ] Đo độ trễ OCR lần đầu và các lần sau khi pipeline đã warm.

Kiểm tra nhanh ngày 15/08/2026: unit validation vùng/payload/query merge/session đạt; typecheck và lint file mới đạt; DOCX thực tế preview 200 (~3 giây); lazy PPTX integration tạo session → render slide 2 → xóa session đạt; Docling OCR ảnh chữ sinh tự động trả đúng text (~0,82 giây khi warm); Electron crop đạt ở DPI 100%/150%; OCR → search trả trạng thái thư viện trống đúng dự kiến. OCR ảnh tiếng Việt có thể mất dấu và công thức ảnh có thể không giải mã, nên đã thêm text-layer supplement cho preview có text gốc. Chưa thay thế cho full test/build/package/smoke.

### Điểm còn cần chốt

- [x] V1 dùng chỉ mục số thu gọn, không render thumbnail ảnh.
- [ ] Có đưa “gộp nhiều vùng” vào phiên bản sau hay loại khỏi phạm vi hoàn toàn.

## I. Hiệu năng và ổn định

- [x] Sửa lỗi `EPIPE` do stdout của tiến trình dev bị đóng.
- [x] Kiểm tra điều hướng nhiều trang không còn làm Electron crash trên tiến trình mới.
- [x] Giảm truy vấn ghi SQLite lặp lại khi chuyển Dashboard/Tài liệu.
- [x] Đo thời gian dev trước/sau tối ưu.
- [x] Production build đạt sau tối ưu.
- [x] Packaged smoke xác nhận app local-only khởi động, database đúng và embedding tự khôi phục.
- [x] Tối ưu Docling warm pipeline cho tìm bằng vùng chọn.

## J. Kiểm thử, Git và phát hành

- [x] ESLint đạt trên working tree local-only.
- [x] TypeScript `--noEmit` đạt.
- [x] Toàn bộ `test:unit` đạt.
- [x] Test SQLite migration/local storage đạt.
- [x] Production build đạt.
- [x] Nhánh lưu trữ web/Docker cũ đã tồn tại.
- [x] Nhánh `desktop-app` giữ toàn bộ commit local, chưa push lên `origin/desktop-app`.
- [x] Chạy standalone smoke sau thay đổi local-only.
- [x] Tạo bản `dist-electron/win-unpacked` mới sau thay đổi tìm bằng vùng chọn.
- [x] Chạy packaged smoke: startup local-only, 27 chủ đề mặc định, không còn bảng credential và embedding auto-restart đều đạt.
- [x] Commit thay đổi local-only, sửa `EPIPE`, tối ưu chuyển trang và MVP tìm bằng vùng chọn.
- [x] Không push hoặc tạo release nếu chưa được yêu cầu.
- [x] Sau khi tìm bằng vùng chọn hoàn tất, chạy lại full lint/unit/build/standalone/package smoke.

## K. Tài liệu bàn giao

- [x] `IMPLEMENTATION_PLAN.md` cập nhật trạng thái local-only và thiết kế tìm bằng vùng chọn.
- [x] `PROJECT_CHECKLIST.md` phân biệt rõ đã làm, đang thiết kế và chưa làm.
- [ ] Cập nhật README sau khi chức năng tìm bằng vùng chọn ổn định.
- [ ] Cập nhật PRD sau khi sản phẩm hoàn thiện theo yêu cầu của nhóm.
- [ ] Chuẩn bị kịch bản demo và câu hỏi phản biện.
