# Project Checklist — ScholarFlow Desktop

**Cập nhật:** 10/08/2026
**Phạm vi thống nhất:** một ứng dụng desktop Windows, không Docker và không có bản web riêng.

## A. Hợp nhất phiên bản desktop

- [x] Đóng gói giao diện Next.js trong Electron.
- [x] Dịch vụ nội bộ chỉ chạy trên `127.0.0.1`.
- [x] Electron tự khởi động, health-check và dừng các tiến trình con.
- [x] Bật `contextIsolation`, sandbox và tắt `nodeIntegration`.
- [x] Chỉ cho phép điều hướng nội bộ; URL HTTPS ngoài mở bằng trình duyệt hệ thống.
- [x] Tạo cấu hình electron-builder và bộ cài NSIS Windows.
- [x] Loại bỏ Docker Compose, Dockerfile và script khởi động Docker.
- [x] Loại bỏ Python embedding service cũ.
- [x] Loại bỏ PostgreSQL, pgvector và các script SQL dành cho PostgreSQL.
- [x] Cập nhật CI để kiểm tra phiên bản desktop trên Windows.

## B. Dữ liệu cục bộ

- [x] Chuyển Prisma từ PostgreSQL sang SQLite.
- [x] Tạo migration SQLite cho database mới.
- [x] Lưu database và uploads trong `%APPDATA%\ScholarFlow\data`.
- [x] Tích hợp sqlite-vec cho vector BGE-M3 1.024 chiều.
- [x] Chuyển tìm kiếm vector sang SQLite.
- [x] Xóa vector liên quan khi xóa tài liệu.
- [x] Kiểm tra đường dẫn upload, chống path traversal và sai user.
- [x] Không đưa database, uploads, logs hoặc model cache lên Git.
- [ ] Thêm chức năng backup/restore trực tiếp trong giao diện.

## C. Embedding local

- [x] Thay embedding service Python bằng Transformers.js và ONNX Runtime.
- [x] Dùng model `BAAI/bge-m3` và giữ vector 1.024 chiều.
- [x] Electron tự chọn cổng trống và quản lý vòng đời embedding runtime.
- [x] Lưu model cache trong `%APPDATA%\ScholarFlow\models`.
- [x] Hỗ trợ batch request và hiển thị tốc độ/thời gian ước tính.
- [x] Kiểm thử embedding thật khi Docker đã dừng.
- [x] Kiểm thử vector mới tương thích độ tương đồng với vector BGE-M3 cũ.
- [ ] Tối ưu thêm tốc độ CPU cho tài liệu rất lớn.
- [ ] Hiển thị tiến độ tải model ở lần chạy đầu tiên.

## D. Xử lý tài liệu

- [x] Nhận PDF, DOCX, PPTX và EPUB.
- [x] Trích xuất văn bản và vị trí nguồn theo trang/slide/mục.
- [x] Chia nội dung thành chunks.
- [x] Tạo các job extract, chunk, embed và analyze.
- [x] Hiển thị trạng thái, tiến trình và lỗi từng bước.
- [x] Cho phép xử lý lại phần còn thiếu.
- [x] Cho phép phân tích AI lại.
- [x] Xem/tải file gốc và xem nội dung đã trích xuất.
- [x] Hiển thị ước tính thời gian khi tạo embedding.
- [ ] Tích hợp OCR cho PDF scan không có lớp văn bản.

## E. Kết nối và phân tích AI

- [x] Hỗ trợ OpenRouter.
- [x] Hỗ trợ Ollama chạy trực tiếp trên máy.
- [x] Hỗ trợ Custom API tương thích chat completions.
- [x] Thêm, sửa, kiểm tra, đặt mặc định và xóa kết nối.
- [x] Cho phép đổi loại nhà cung cấp trong màn hình chỉnh sửa.
- [x] Phân tích môn học, độ khó, ngôn ngữ và tóm tắt.
- [x] Chỉ cho AI chọn mã môn học có sẵn hoặc trả về “Chưa phân loại”.
- [x] Kiểm tra lại mã môn học và áp dụng ngưỡng tin cậy 75% ở server.
- [x] Không cho AI tự tạo môn học mới.
- [x] Nhận diện lỗi URL/model/API key/quyền/hạn mức/timeout/mạng/server.
- [x] Rút gọn thông báo lỗi và không hiển thị stack trace, HTML hoặc mã nguồn.
- [x] Tìm kiếm và thư viện không phụ thuộc Ollama.
- [ ] Bổ sung cơ chế che/đổi API key rõ ràng hơn trong UI.

## F. Tìm kiếm học liệu

- [x] Tìm kiếm bằng câu truy vấn tự nhiên tiếng Việt và tiếng Anh.
- [x] Kết hợp ngữ nghĩa, từ khóa và metadata.
- [x] Lọc theo môn học, “Chưa phân loại”, độ khó, định dạng và thời gian.
- [x] Mỗi tài liệu chỉ hiện đoạn phù hợp nhất.
- [x] Hiển thị lý do phù hợp và vị trí nguồn.
- [x] Có ngưỡng từ chối kết quả không đủ liên quan.
- [x] Ghi lịch sử tìm kiếm theo tài khoản cục bộ.
- [x] Có bộ kiểm thử ranking và đánh giá evidence search.

## G. Môn học và phân loại

- [x] Khởi tạo một lần 27 môn chuyên ngành CNTT NTTU từ học kỳ 2 đến học kỳ 12.
- [x] Loại tiếng Anh và các học phần không liên quan trực tiếp đến ngành CNTT khỏi danh sách mặc định.
- [x] Cho người dùng thêm, đổi tên, thêm tên gọi khác, xóa và gộp môn học.
- [x] Gắn môn học từ AI hoặc thao tác người dùng mà không tạo môn mới.
- [x] Chuyển tài liệu về “Chưa phân loại” khi môn học của tài liệu bị xóa.
- [x] Chuyển tài liệu mang chủ đề cũ về “Chưa phân loại” và không bật chủ đề cũ cho AI cho đến khi người dùng chỉnh sửa xác nhận.
- [x] Bỏ giao diện, API và bảng “đề xuất gộp chủ đề”.

## H. Dashboard và quản trị

- [x] Dashboard thư viện hiển thị số tài liệu, tài liệu sẵn sàng và môn học.
- [x] Hiển thị tài liệu mới thêm và thao tác nhanh.
- [x] Thêm header/footer chứa thông tin đề tài, nhóm, GVHD, email, GitHub và phiên bản.
- [x] Thêm bảng “Về dự án” với họ tên và MSSV của thành viên.
- [x] Kiểm tra header/footer trên giao diện desktop và màn hình nhỏ.
- [ ] **Ưu tiên tiếp theo:** thêm role `USER` và `ADMIN` cho tài khoản cục bộ.
- [ ] **Ưu tiên tiếp theo:** tạo dashboard quản trị bên trong ứng dụng desktop.
- [ ] **Ưu tiên tiếp theo:** xem, tìm kiếm, thêm, sửa, khóa/mở và xóa tài khoản.
- [ ] Kiểm tra người dùng thường không truy cập được màn hình quản trị.

Không tạo một web admin riêng. Nếu sau này cần quản lý tài khoản xuyên nhiều máy, nhóm phải duyệt lại kiến trúc backend trước khi triển khai.

## I. Kiểm thử và phát hành

- [x] Unit test chunking, taxonomy, ranking, lỗi AI, embedding runtime và extractors.
- [x] Test SQLite migration và sqlite-vec.
- [x] Test đường dẫn dữ liệu local.
- [x] ESLint đạt.
- [x] Production build đạt trên phiên bản đã hợp nhất cuối cùng.
- [x] Desktop standalone smoke test đạt.
- [x] Packaged desktop smoke test đạt.
- [x] Tạo lại `ScholarFlow-Setup-0.1.0.exe` từ source đã hợp nhất.
- [x] Tạo nhánh lưu trữ bản web/Docker: `archive/web-docker-before-desktop-2026-08-08`.
- [x] Chia thay đổi thành các commit desktop, cleanup và docs.
- [x] Đẩy nhánh `desktop-app` lên GitHub.
- [x] Tạo Pull Request để nhóm xem trước khi gộp vào `main`.
- [x] Đưa bộ cài vào GitHub Releases, không commit file `.exe`.

## J. Tài liệu bàn giao

- [x] README mô tả cách chạy, kiểm thử và đóng gói desktop.
- [x] PRD phản ánh đúng chức năng hiện tại và giới hạn.
- [x] Implementation Plan không còn kế hoạch Docker/web admin/Supabase.
- [x] Ghi rõ dashboard quản trị desktop là hạng mục chưa hoàn thành.
- [ ] Chuẩn bị kịch bản demo và câu hỏi phản biện cho báo cáo.
