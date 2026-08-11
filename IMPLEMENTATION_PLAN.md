# Implementation Plan — ScholarFlow Desktop

**Cập nhật:** 10/08/2026
**Quyết định kiến trúc:** chỉ phát triển và phát hành ứng dụng desktop Windows.

## 1. Kiến trúc đích

```text
ScholarFlow.exe
  ├─ Electron main process
  │   ├─ quản lý cửa sổ và chính sách bảo mật
  │   ├─ chọn cổng loopback ngẫu nhiên
  │   ├─ khởi động/dừng Next.js standalone
  │   └─ khởi động/dừng embedding runtime
  ├─ Next.js application server — chỉ 127.0.0.1
  ├─ SQLite database
  ├─ sqlite-vec index — 1024 dimensions
  ├─ BGE-M3 — Transformers.js + ONNX Runtime
  └─ thư mục dữ liệu trong %APPDATA%\ScholarFlow
```

Đây là kiến trúc desktop đóng gói. Next.js được dùng làm lớp giao diện/API nội bộ, không được triển khai thành một sản phẩm web riêng.

## 2. Nguyên tắc kỹ thuật

- Một source of truth nằm trong thư mục `learning-resource-app`.
- Không duy trì Dockerfile, Docker Compose hoặc container service.
- Không dùng PostgreSQL, pgvector hoặc Python embedding service.
- Dữ liệu tài liệu, vector, cấu hình AI và log nằm trên máy người dùng.
- BGE-M3 local chịu trách nhiệm embedding; Ollama chỉ là một tùy chọn phân tích AI.
- Mỗi thay đổi lớn phải có test và một commit riêng dễ review/revert.
- File cài đặt phát hành qua GitHub Releases, không commit vào source.

## 3. Giai đoạn 1 — Hợp nhất desktop MVP

**Trạng thái:** đã triển khai, đang kiểm thử cuối.

### Electron shell

- Dùng single-instance lock.
- Bật sandbox, context isolation và chặn điều hướng ngoài.
- Chờ health check trước khi mở cửa sổ.
- Dừng toàn bộ process tree khi thoát ứng dụng.
- Ghi log chẩn đoán vào `%APPDATA%\ScholarFlow\logs`.

### Local data layer

- Prisma dùng SQLite.
- Migration được áp dụng tự động và idempotent.
- sqlite-vec lưu index vector tách khỏi metadata Prisma.
- Uploads, database và vector thuộc cùng thư mục dữ liệu người dùng.
- Không chuyển dữ liệu từ database Docker cũ theo quyết định của nhóm.

### Local embedding

- Runtime Node riêng sử dụng `@huggingface/transformers`.
- Model cố định `BAAI/bge-m3`, vector 1.024 chiều.
- Electron cấp URL embedding động cho Next.js nội bộ.
- Model cache được dùng lại giữa các lần mở.
- Embedding chạy CPU mặc định để tương thích nhiều máy Windows.

### AI providers

- Chuẩn hóa cấu hình OpenRouter, Ollama và Custom API.
- API key được mã hóa trước khi lưu.
- Có test kết nối/model và xử lý lỗi an toàn.
- Không trả raw provider body, HTML hoặc stack trace lên giao diện.

### Search

- Semantic retrieval từ sqlite-vec.
- Keyword retrieval không phân biệt dấu cho truy vấn tiếng Việt.
- Rerank theo vector, từ khóa, metadata và tiêu chí suy ra từ câu hỏi.
- Relevance gate loại kết quả yếu.
- Kết quả giữ `pageNumber`/`sourceLabel` để quay lại nguồn.

## 4. Giai đoạn 2 — Dọn repo và phát hành thống nhất

**Trạng thái:** đang thực hiện trên nhánh `desktop-app`.

1. Lưu bản cũ tại `archive/web-docker-before-desktop-2026-08-08`.
2. Đồng bộ với `origin/main` mới nhất.
3. Xóa Docker, Python service và PostgreSQL scripts.
4. Chuyển các smoke/report script còn hữu ích sang SQLite.
5. Xóa feature “đề xuất gộp chủ đề” khỏi UI, API và schema mới.
6. Cố định danh mục 27 môn CNTT NTTU; AI chỉ phân loại vào môn hiện có hoặc để “Chưa phân loại”.
7. Cập nhật CI cho môi trường Windows desktop.
8. Chạy unit test, lint, production build và packaged smoke test.
9. Chia commit theo nhóm chức năng.
10. Đẩy nhánh và tạo Pull Request.
11. Tạo GitHub Release kèm bộ cài Windows.

## 5. Giai đoạn 3 — Dashboard quản trị desktop

**Mức ưu tiên:** cao theo yêu cầu nhóm trưởng.
**Trạng thái:** chưa triển khai.

Phạm vi đề xuất:

- Thêm role `USER` và `ADMIN` trong SQLite.
- Tài khoản đầu tiên hoặc tài khoản seed được gán admin theo quy tắc rõ ràng.
- Middleware/API kiểm tra role ở server nội bộ, không chỉ ẩn nút trên UI.
- Dashboard hiển thị tổng số tài khoản và trạng thái.
- Tìm kiếm, xem, thêm, sửa, khóa/mở và xóa tài khoản cục bộ.
- Không cho admin xóa chính mình hoặc xóa admin cuối cùng.
- Ghi audit log cho thao tác quản trị.
- Test quyền truy cập cho user thường và admin.

Giới hạn: dashboard này chỉ quản lý tài khoản trong cùng bản cài/database. Quản lý xuyên nhiều thiết bị cần backend trung tâm và là một quyết định kiến trúc khác.

## 6. Giai đoạn 4 — Cải thiện sau MVP

- [Đã triển khai] Chọn nhiều file/thư mục và queue tuần tự toàn bộ pipeline tài liệu.
- [Đã triển khai] Khởi tạo 27 môn CNTT NTTU, cho người dùng quản lý danh sách và giới hạn AI chỉ được chọn môn hiện có với ngưỡng tin cậy 75%.
- Hiển thị tiến độ tải model lần đầu.
- Backup/restore database và uploads trong giao diện.
- [Đã triển khai] Phân loại PDF bằng pdf-inspector và OCR fallback bằng Docling; giữ Tesseract/Poppler làm fallback môi trường cũ.
- Đo chất lượng tìm kiếm trên bộ dữ liệu đồ án cố định.
- Ký số bộ cài và tự động hóa release khi có chứng chỉ phù hợp.

## 7. Chiến lược kiểm thử

### Mỗi commit

- ESLint.
- Unit test liên quan.
- Kiểm tra không còn secret hoặc file build bị stage.

### Trước Pull Request

- Toàn bộ `test:unit`.
- Production build.
- Desktop standalone runtime test.
- Kiểm tra các đường dẫn API và schema SQLite.

### Trước Release

- Tạo bản unpacked và chạy packaged smoke test.
- Cài bằng NSIS trên Windows.
- Mở app khi các dịch vụ Docker cũ đã dừng/gỡ bỏ.
- Thêm tài liệu, xử lý, tìm kiếm, mở nguồn và khởi động lại app.
- Kiểm tra OpenRouter/Ollama/Custom API với cả trường hợp thành công và lỗi.
- Xác nhận file `.exe`, database, uploads và model cache không nằm trong commit.

## 8. Chiến lược Git

- `main`: phiên bản đã được nhóm duyệt.
- `archive/web-docker-before-desktop-2026-08-08`: ảnh chụp bản web/Docker cũ.
- `desktop-app`: nhánh hợp nhất desktop để review.

Nhóm commit đề xuất:

1. `feat(desktop): add standalone Electron and local embedding runtime`
2. `refactor(storage): migrate application data and vectors to SQLite`
3. `fix(app): improve AI connections, processing feedback and tag management`
4. `chore: remove Docker, PostgreSQL and obsolete web artifacts`
5. `docs: align project documents with desktop-only scope`

Pull Request phải mô tả thay đổi kiến trúc, cách kiểm thử, giới hạn CPU/model download và vị trí GitHub Release.

## 9. Điều kiện hoàn thành

Phiên bản desktop được coi là sẵn sàng để gộp khi:

- Không còn code hoặc workflow yêu cầu Docker/PostgreSQL/Python.
- Tất cả tài liệu mô tả cùng một phạm vi desktop-only.
- Unit test, lint, build và packaged smoke test đạt.
- Có nhánh lưu trữ bản cũ và Pull Request để nhóm review.
- Bộ cài chạy độc lập và được phát hành ngoài source tree.
