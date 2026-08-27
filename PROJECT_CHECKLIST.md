# Project Checklist — ScholarFlow Desktop

**Cập nhật:** 21/08/2026
**Nhánh:** `desktop-app`
**Phạm vi:** desktop Windows, local-only, không đăng ký/đăng nhập, cloud backend, Docker hoặc web app riêng.
**Quy ước:** chỉ đánh dấu hoàn thành sau khi đã triển khai hoặc kiểm tra thực tế. Các ý tưởng ngoài MVP được ghi rõ, không để lẫn với việc bắt buộc trước release.

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
- [x] Packaged interaction test trên working tree cuối đạt ngày 21/08/2026.

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
- [x] Tạo migration xóa tài liệu/tài khoản cũ nhưng giữ tag, AI provider và cài đặt khác.
- [x] Test migration xác nhận tag và cấu hình Ollama được giữ lại.
- [x] Chỉ dọn bản sao tài liệu trong đúng `%APPDATA%\ScholarFlow\data\uploads` khi chuyển phiên bản.
- [x] Xác nhận file gốc người dùng chọn bên ngoài app không bị xóa.
- [x] File mới giữ tên gốc an toàn trong thư mục riêng theo document ID; app tự migrate file UUID cũ và cập nhật database khi khởi động.
- [x] Tách khóa mã hóa AI provider khỏi auth và nhận lại khóa cũ khi có.
- [x] Standalone và packaged smoke cuối trên working tree hiện tại đều đạt ngày 21/08/2026.
- [x] Commit bản chốt hiện tại trên `desktop-app`; không push.
- [x] Chốt backup/restore nằm ngoài phạm vi MVP hiện tại.

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
- [x] Xem file gốc, preview và text đã trích xuất; text dài chỉ tải toàn bộ khi mở disclosure, không reload trang qua nút `Xem toàn bộ`.
- [x] Test extractor PDF/DOCX/PPTX/EPUB đạt.
- [x] Test preview DOCX/PPTX/EPUB đạt.
- [x] Kiểm tra lại PDF, DOCX, PPTX và EPUB thực tế sau local-only; extraction/preview và mở nội dung liên quan đạt.

### D.1 Mind map và âm thanh

- [x] XMind JSON/XML: upload, trích xuất nhánh/ghi chú/nhãn, chunk có đường dẫn và số sơ đồ, xem sơ đồ nhánh tự sắp xếp, bộ lọc và tìm bằng chữ gốc trong vùng chọn.
- [x] Hồi quy GUI 27/08: PDF giữ trang/zoom/pan/vùng chọn khi Back; XMind giữ viewport khi Back và đổi tab; DOCX kéo được; tiêu đề chi tiết không bị ép thành cột chữ.
- [x] Upload thật XMind JSON/XML, MP3 Việt, WAV Anh → text/chunk/vector 1.024 chiều → tìm lại tài liệu. Giữ báo cáo và fixture trong `06_mindmap_audio`.
- [x] Thêm bộ PDF mind map chữ/scan 2 trang, XMind 2 sơ đồ, XMind hỏng và hướng dẫn test cụ thể trong bộ fixture chung.
- [x] Sửa mất tiêu đề mind map ở bước chia đoạn Docling; PDF chữ đạt 26/26 cụm, scan 24/26 với 2 lỗi dấu đã ghi rõ.

- [x] Nhận ảnh PNG/JPG/JPEG/WebP và âm thanh MP3/WAV/M4A vào thư viện.
- [x] OCR mind map bằng pipeline Việt–Anh; PDF mind map dùng Docling.
- [x] Thêm Whisper Base là thành phần local tùy chọn, pin revision và checksum.
- [x] Dùng FFmpeg đóng kèm runtime để giải mã audio về mono 16 kHz.
- [x] Chép lời Việt/Anh, giữ timestamp và đưa qua chung pipeline chunk/BGE-M3/search.
- [x] Thiếu Whisper chỉ chặn file audio, không chặn tài liệu/ảnh hoặc onboarding.
- [x] Test extractor mind map và audio bằng fixture cố định.
- [x] Test runtime thật với WAV, MP3, M4A tiếng Anh và MP3 tiếng Việt.
- [x] Chạy lại full unit test, production build, desktop standalone và packaged smoke sau khi hoàn thiện tính năng.

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
- [x] UI provider cho phép cập nhật khóa và không hiển thị API key đã lưu dưới dạng văn bản rõ.

## F. Môn học mặc định

- [x] Có 27 môn CNTT NTTU mặc định từ học kỳ 2 đến học kỳ 12.
- [x] AI chỉ chọn môn hiện có hoặc để “Chưa phân loại”.
- [x] Áp dụng ngưỡng tin cậy 75% ở server.
- [x] Không cho AI tự tạo môn học mới.
- [x] Cho phép thêm, đổi tên và xóa môn học.
- [x] Chuyển tài liệu về “Chưa phân loại” khi môn bị xóa.
- [x] Bỏ giao diện/API/bảng đề xuất gộp chủ đề.
- [x] Tối ưu để chỉ đồng bộ danh mục mặc định một lần trong mỗi phiên app.

## G. Tìm kiếm chữ hiện tại

- [x] Tìm bằng truy vấn tự nhiên tiếng Việt và tiếng Anh.
- [x] Kết hợp vector BGE-M3, từ khóa và metadata.
- [x] Lọc theo môn học, độ khó và định dạng.
- [x] Bộ lọc hiển thị tên thân thiện cho ảnh mind map và âm thanh.
- [x] Có relevance gate loại kết quả yếu.
- [x] Hiển thị lý do phù hợp, chunk và vị trí nguồn.
- [x] Trả trạng thái thư viện trống/no-result rõ ràng.
- [x] Có test ranking, semantic retrieval và evidence search.
- [x] Search log là dữ liệu local, không còn gắn với tài khoản.

## H. Tìm bằng vùng chọn trên ảnh hoặc file

**Trạng thái: đã hoàn thiện và QA thủ công 20/20 ngày 20/08/2026. Pipeline OCR/search đã khóa theo `TECHNOLOGY_DECISIONS.md`; chỉ còn các chỉnh sửa UX nhỏ, không đổi model trong scope MVP.**

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
- [x] Đổi viewer sang pan thật khi `Kéo để xem`, giữ vùng chọn khi đổi chế độ, cho kéo cả khung chọn, giữ đúng tỉ lệ ảnh và đưa zoom về `Vừa khung` bằng một nút.
- [x] Chuyển tiếp con lăn/kéo vào iframe preview DOCX/PPTX/EPUB khi vùng cuộn ngoài chạm biên; kiểm thử local xác nhận DOCX nhiều trang cuộn được ở cả hai chế độ.
- [x] Với ảnh đầu vào, crop vùng chọn từ ảnh gốc ở độ phân giải native; các định dạng còn lại dùng Electron `capturePage`. Tất cả chỉ tồn tại trong RAM, không tạo file crop.
- [x] Dùng sparse-text segmentation cho ROI OCR để nhận nhãn rời trong bảng/biểu đồ; regression test gồm ảnh bảng nguyên gốc và ảnh mô phỏng bị thu nhỏ trên màn hình.
- [x] Bổ sung model tiếng Anh fast đã pin/checksum vào thành phần Docling; ghép lượt OCR Việt–Anh để sửa công thức/mã kỹ thuật mà vẫn ưu tiên dấu tiếng Việt.
- [x] Phát hiện và bỏ đường lưới dài trên bản sao RAM trước lượt OCR thứ hai; regression test xác nhận đủ `Thuật toán`, `Cấu trúc`, `Cạnh âm`, `Độ phức tạp` và toàn bộ ba hàng dữ liệu.
- [x] Bỏ ghép atlas/mã kỹ thuật tự động sau khi test thực tế cho thấy có thể sinh chữ rác; chặn query khi OCR có độ tin cậy hoặc lượng chữ hữu ích quá thấp.
- [x] Dùng chung bước cắt viền trắng/phóng vùng nhỏ cho OCR tìm kiếm và OCR ảnh nhúng; bật OCR ảnh nhúng trong PDF thay vì bỏ qua PDF có text layer.
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
- [x] Chọn lại nhanh không để kết quả cũ ghi đè kết quả mới.
- [x] Ảnh thường và ảnh scan tiếng Việt.
- [x] PDF text và PDF scan.
- [x] DOCX, PPTX và EPUB nhiều trang/phần.
- [x] Chấp nhận giới hạn công thức toán phức tạp dạng ảnh trong MVP; người dùng sửa query OCR khi cần, không tích hợp thêm model nặng.
- [x] Probe CodeFormulaV2 INT8 trực tiếp trên ba fixture thực tế: Gaussian, OLS/R² và Bayes/entropy đều trả LaTeX đúng; xác định blocker là ảnh nhúng bị layout phân loại thành `picture` nên enrichment toàn tài liệu không gọi model cho chúng.
- [x] Benchmark CodeFormulaV2 trên 12 công thức tổng hợp: 10 đúng ý nghĩa, Fourier sai cận/số mũ, phép tích sinh thừa ký tự; kiểm tra thêm 3 ảnh thực tế đều đúng.
- [x] Đối chứng PP-FormulaNet_plus-S trên cùng 15 ảnh: chỉ đúng ý nghĩa 8/15 dù nhanh hơn nhiều (0,59–1,25 giây/công thức, nạp 5,96 giây); loại khỏi hướng tích hợp do sai công thức quan trọng và sinh LaTeX rác khi nhận nhầm biểu đồ.
- [x] Đối chứng RapidOCR PP-OCRv6 small trên chữ Việt/Anh, bảng, công thức, hai biểu đồ và ảnh trắng: biểu đồ Anh đạt 18/18 marker nhưng ảnh Việt đạt 0/5 marker nghiêm ngặt, công thức không ổn định và ảnh trắng sinh chữ rác; giữ Tesseract Việt–Anh làm OCR chính.
- [x] Tạo regression suite hybrid gồm 16 ảnh ground-truth, ba crop chẩn đoán và DOCX stress chứa 11 ảnh nhúng; có script tạo lại, test router, so sánh PSM và test extractor tài liệu.
- [x] Router thử nghiệm đạt 24/24 trên fixture mới + ảnh thực tế; Tesseract đạt 24/32 marker OCR, RapidOCR bù 6 marker nhưng còn mất `documents`/`Cạnh âm` và không an toàn với tiếng Việt/ảnh trắng.
- [x] CodeFormula trên sáu công thức mới: 4 đúng, OLS sai phân số, ảnh có chú thích timeout >3 phút; crop entropy đúng nhưng hai crop OLS vẫn chưa đúng hoàn toàn. DOCX stress đạt 8/8 marker native nhưng chỉ 1/6 nhóm công thức ảnh.
- [x] Chuyển router đã đạt 24/24 từ benchmark vào mã app; tìm bằng vùng chọn nhận công thức ngắn theo tín hiệu toán học, vẫn chặn vùng trắng/rác và giữ nguyên Tesseract làm kết quả chính.
- [x] Chạy lại CodeFormula trực tiếp trên ba crop đại diện: bậc hai và entropy đúng (~18 giây/crop), R² sai phân số dù mất >30 giây; xác nhận không thể bật tự động chỉ với timeout/validation cú pháp.
- [x] Áp dụng pipeline không-model-mới: giữ 6/6 ảnh công thức trong DOCX fixture thành section tìm kiếm, loại đúng vùng rác; độ chính xác marker công thức đầy đủ hiện 2/6 (Bayes và entropy).
- [x] Trích trực tiếp ảnh nhúng PDF bằng PDF.js với giới hạn 100 ảnh/20 MP; stress PDF thực tế tăng từ 2 lên 5 OCR section và Bayes/entropy từ không tìm được thành tìm được; tránh OCR đôi trên PDF scan toàn trang.
- [x] Ghép OCR Việt–Anh giữ đúng thêm `documents` và `Infinity`; marker OCR tăng 24/32 → 26/32, còn hạn chế ở một ô bảng, một nhãn biểu đồ và bốn node sơ đồ.
- [x] Giữ merge Tesseract Việt/Anh hiện tại sau QA; các nhãn ngắn còn sót là giới hạn được chấp nhận, tránh sửa tiếp gây nhân đôi text hoặc hồi quy tiếng Việt.
- [x] Không gọi CodeFormula trong MVP; kết quả benchmark chưa đủ ổn định so với chi phí CPU/thời gian và pipeline hiện tại đã đủ scope.
- [x] Đối chiếu pipeline toàn file: fixture PDF chính thức nhận đúng formula 1/1; bốn stress-test PDF/DOCX/PPTX/EPUB đều có 0 item `formula`, xác nhận enrichment hiện tại không xử lý các ảnh công thức nhúng. Tesseract trong app bỏ Gaussian, làm hỏng OLS và chỉ đọc gần đúng Bayes/entropy.
- [x] Loại CodeFormulaV2 khỏi phạm vi MVP sau benchmark; không tải hoặc chạy model này trong app.
- [x] Bảng, hình có nhãn và vùng không có chữ bằng fixture tự động; vùng ít chữ/độ tin cậy thấp không được gửi làm query.
- [x] OCR chỉ xử lý vùng chọn trong viewport/slide/chương đang xem; không OCR toàn bộ file truy vấn.
- [x] Query tạm được xóa và file gốc không thay đổi.
- [x] Kết quả dưới ngưỡng trả no-result.
- [x] Đã đo mẫu OCR warm (~0,82 giây trên fixture chữ); tốc độ cold phụ thuộc máy và thời gian nạp runtime, không đặt SLA cứng cho MVP.

Kiểm tra nhanh ngày 15/08/2026: unit validation vùng/payload/query merge/session đạt; typecheck và lint file mới đạt; DOCX thực tế preview 200 (~3 giây); lazy PPTX integration tạo session → render slide 2 → xóa session đạt; Docling OCR ảnh chữ sinh tự động trả đúng text (~0,82 giây khi warm); Electron crop đạt ở DPI 100%/150%; OCR → search trả trạng thái thư viện trống đúng dự kiến. OCR ảnh tiếng Việt có thể mất dấu và công thức ảnh có thể không giải mã, nên đã thêm text-layer supplement cho preview có text gốc. Chưa thay thế cho full test/build/package/smoke.

### Điểm còn cần chốt

- [x] V1 dùng chỉ mục số thu gọn, không render thumbnail ảnh.
- [x] Không gộp nhiều vùng trong MVP; mỗi lần tìm dùng một vùng trên trang/phần đang xem.

## I. Hiệu năng và ổn định

- [x] Sửa lỗi `EPIPE` do stdout của tiến trình dev bị đóng.
- [x] Kiểm tra điều hướng nhiều trang không còn làm Electron crash trên tiến trình mới.
- [x] Giảm truy vấn ghi SQLite lặp lại khi chuyển Dashboard/Tài liệu.
- [x] Đo thời gian dev trước/sau tối ưu.
- [x] Production build đạt sau tối ưu.
- [x] Packaged smoke xác nhận app local-only khởi động, database đúng và embedding tự khôi phục.
- [x] Tối ưu Docling warm pipeline cho tìm bằng vùng chọn.
- [x] Sửa lỗi SQLite khi lọc thư viện bằng `?q=`.
- [x] Tìm mô tả tự chạy sau debounce, hủy request cũ và xóa sạch query/kết quả bằng một thao tác.
- [x] Giữ trạng thái tìm ảnh/file trong RAM khi đổi chế độ, mở kết quả hoặc chuyển trang rồi quay lại.
- [x] Giữ danh sách file chờ upload trong RAM và cảnh báo khi đóng app lúc còn việc chưa xong.
- [x] Link kết quả và nút quay lại giữ đúng nguồn tìm kiếm chữ/ảnh-file.
- [x] Modal hỗ trợ Escape, bấm nền và khôi phục focus; các thao tác xóa/phân tích lại có xác nhận.
- [x] Thêm tìm nhanh môn học và thu gọn các phần dài trên trang chi tiết tài liệu.
- [x] Cache ngắn trạng thái Local AI và phản hồi ngay khi kiểm tra thành phần local.
- [x] Bỏ preview cửa sổ riêng gây kẹt app; thêm thao tác hiện file ScholarFlow trong Explorer bằng IPC/path containment.
- [x] Đồng nhất lý do phù hợp và trích dẫn nguồn giữa tìm mô tả với tìm ảnh/file.
- [x] Khi quay lại kết quả ảnh/file, phục hồi OCR và kết quả đã lưu mà không tự chụp lại bằng tọa độ màn hình cũ.
- [x] Khi quay lại tìm bằng mô tả, chờ phục hồi session hoàn tất trước khi chạy logic tự tìm/xóa để không làm mất kết quả cũ.
- [x] Sửa vòng QA thủ công 20/08/2026: tự cuộn tới chunk phù hợp, mở đúng slide/phần khi có vị trí, bỏ nút tìm lại thừa, làm rõ hộp xóa, co font PPTX và đưa cuộn DOCX ra scrollbar viewer.

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
- [x] UX regression ngày 17/08/2026: lint, `test:unit`, production build và kiểm thử trình duyệt local đều đạt.
- [x] Lượt chốt ngày 21/08/2026: full unit test, lint, production build, desktop standalone, unpacked package và packaged smoke đều đạt.
- [x] Kiểm tra `dist-electron/win-unpacked` không chứa BGE-M3, `.docling-runtime`, model cache hoặc test fixture.

## K. Tài liệu bàn giao

### Bổ sung ảnh XMind / EXE 0.1.4 — 27/08/2026

- [x] Hiển thị ảnh nhúng PNG/JPEG/WebP; OCR dùng runtime hiện có và gắn đúng nhánh/sơ đồ.
- [x] Test JSON/XML, Việt/Anh/công thức mẫu, ảnh trắng/hỏng/thiếu, đường dẫn và giới hạn giải nén.
- [x] Giữ fixture 09/10 và hướng dẫn `TEST_ANH_NHUNG_XMIND.md` cho nhóm.
- [ ] Windows GitHub-hosted runner cài EXE, tải model thật, kiểm pipeline và hồi quy GUI.
- [ ] Phát hành đúng installer đã kiểm (SHA-256 khớp), không build lại sau kiểm thử.

- [x] `IMPLEMENTATION_PLAN.md` cập nhật trạng thái local-only và thiết kế tìm bằng vùng chọn.
- [x] `PROJECT_CHECKLIST.md` phân biệt rõ đã làm, đang thiết kế và chưa làm.
- [x] Cập nhật README theo sản phẩm local-only và tìm bằng vùng chọn.
- [x] Cập nhật PRD theo sản phẩm hoàn thiện.
- [x] Giữ hướng dẫn test đầy đủ, kết quả kỳ vọng và bộ fixture hợp nhất để nhóm dùng khi demo/kiểm tra.
