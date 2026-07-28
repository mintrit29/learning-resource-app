# Implementation Plan — Electron local-first và Web Admin

**Cập nhật:** 28/07/2026
**Trạng thái:** Chưa bắt đầu triển khai desktop
**Mục tiêu:** Đưa ScholarFlow thành app desktop Windows không cần Docker cho người dùng; không có chi phí AI/cloud thường xuyên.

## 1. Quyết định kiến trúc đã chốt

| Hạng mục | Quyết định |
|---|---|
| Ứng dụng người dùng | Electron + giao diện Next.js hiện có chạy local. |
| Hệ điều hành MVP | Windows 10/11. |
| File, chunk, embedding, search | Lưu và xử lý local trên máy người dùng; không đồng bộ lên cloud. |
| Embedding | Ollama local với `bge-m3`; app kiểm tra Ollama và hướng dẫn `ollama pull bge-m3` khi cần. |
| Phân loại tài liệu | Ollama local với model người dùng đã cài/cấu hình. Không bắt buộc AI cloud. |
| Database desktop | SQLite file trong thư mục app data; vector search dùng `sqlite-vec`. |
| Auth + web admin | Supabase Free. Chỉ lưu identity/profile/role/trạng thái user, không lưu tài liệu. |
| Admin | Next.js web riêng, chỉ quản lý tài khoản. |
| Docker | Giữ nguyên cho dev, test và demo nội bộ; không bắt user cuối cài Docker. |

`bge-m3` có thể chạy local qua Ollama và trả embedding 1024 chiều, nên không cần đóng gói Python/FastAPI/BGE-M3 Docker vào installer. Người dùng phải tải model khoảng 1.2 GB ở lần đầu.

## 2. Kiến trúc đích

```text
Electron desktop (Windows)
  -> Electron main: khởi động Next standalone local + quản lý lifecycle
  -> Next UI/API: chỉ bind 127.0.0.1
  -> SQLite + sqlite-vec: userData/ScholarFlow/<user-id>/library.db
  -> uploads local: userData/ScholarFlow/<user-id>/uploads
  -> Ollama local: localhost:11434, bge-m3 + model phân loại

Admin web (Next.js deploy)
  -> Supabase Auth + profiles/roles
  -> chỉ xem/quản lý tài khoản, không đọc file hay embedding user
```

## 3. Các giai đoạn triển khai

### Giai đoạn A — Chuẩn bị và proof of architecture

1. Tạo nhánh `codex/desktop-local-first`.
2. Thêm Electron Forge hoặc electron-builder; target đầu tiên là installer Windows NSIS.
3. Build Next theo chế độ standalone; Electron main khởi động server local, chờ health check rồi mới mở `BrowserWindow`.
4. Cấu hình security: `contextIsolation: true`, `nodeIntegration: false`, preload chỉ expose API desktop tối thiểu.
5. Kiểm tra đóng/mở app không để process Next còn treo.

**Nghiệm thu:** cài installer trên Windows sạch, mở được UI hiện có mà không cần Docker.

### Giai đoạn B — Chuyển data layer sang local không Docker

1. Tách schema/domain khỏi Postgres-specific code.
2. Chuyển Prisma datasource desktop sang SQLite; mỗi Supabase user có database tại `app.getPath('userData')/ScholarFlow/<user-id>/library.db`.
3. Chuyển uploads sang thư mục user data theo `<user-id>`, không dùng Docker volume.
4. Thay query `pgvector` bằng `sqlite-vec`; giữ hybrid vector + keyword + rerank hiện có.
5. Viết migration/công cụ import một thư viện local từ bản Docker cho developer; không cần migrate dữ liệu người dùng cuối ở MVP.
6. Đặt backup/export manual: zip database + uploads.

**Nghiệm thu:** upload, xử lý, search và mở chunk chạy khi Docker đã tắt.

### Giai đoạn C — AI local qua Ollama

1. Thêm `Local AI readiness` ở onboarding/settings: phát hiện Ollama tại `http://127.0.0.1:11434`.
2. Kiểm tra model embedding `bge-m3`; nếu thiếu, hiển thị đúng lệnh cài thay vì tự tải ngầm.
3. Đổi embedding client desktop từ FastAPI service sang Ollama `/api/embed`; xác nhận kích thước vector tương thích là 1024.
4. Tạo preset `Local-only`: embedding dùng `bge-m3`; phân tích tài liệu dùng model Ollama người dùng chọn.
5. Hiển thị trạng thái rõ khi thiếu Ollama/model và có nút refresh; không gửi nội dung tài liệu ra cloud.
6. Chạy lại re-embed cho thư viện desktop nếu model embedding bị đổi.

**Nghiệm thu:** app hoạt động offline sau khi Ollama/model đã cài; không còn phụ thuộc embedding Docker service.

### Giai đoạn D — Supabase Auth và Web Admin

1. Tạo Supabase project Free; tạo `profiles` gồm `id`, `email`, `role`, `status`, `created_at`, `last_seen_at`.
2. Dùng Supabase Auth cho desktop đăng ký/đăng nhập; thay Auth.js local session trong desktop.
3. Bật RLS cho mọi bảng cloud; user chỉ đọc/sửa profile của mình.
4. Tạo role `admin` bằng server-side process; tuyệt đối không để service-role key trong Electron renderer hoặc browser client.
5. Tạo admin web tối giản: đăng nhập admin, danh sách user, xem trạng thái, khóa/mở tài khoản và đổi role.
6. Khi desktop login/logout/cập nhật hoạt động, chỉ đồng bộ profile/status lên Supabase; tuyệt đối không sync document metadata, file, chunk hay embedding.

**Nghiệm thu:** một account đăng nhập được cả desktop và web admin; admin không thể xem tài liệu local của user.

### Giai đoạn E — Đóng gói, kiểm thử và bàn giao

1. Tạo installer Windows, versioning, icon, auto-update **chưa làm** ở MVP.
2. Test máy không có Docker/Postgres/Python, có và không có Ollama/model.
3. Test quyền account thường/admin, session expired, mạng mất, Supabase unavailable.
4. Test upload 4 định dạng, AI classify, hybrid search, filter, mở chunk và backup/export.
5. Chạy unit, integration, lint, production build, package smoke test và manual test bản cài đặt.
6. Viết hướng dẫn cài Ollama, tải `bge-m3`, backup/xóa dữ liệu local và chính sách riêng tư.

## 4. Không làm trong đợt desktop đầu

- Đồng bộ hoặc chia sẻ tài liệu giữa thiết bị.
- AI cloud mặc định hoặc server chạy BGE-M3 trả phí.
- macOS/Linux installer.
- Auto-update, thanh toán/quota, collaboration hoặc mobile app.
- Gửi document content lên Supabase/Admin web.

## 5. Rủi ro cần kiểm soát

| Rủi ro | Cách xử lý |
|---|---|
| User chưa cài Ollama/model | Onboarding kiểm tra và hướng dẫn cài; không che giấu lỗi. |
| Model tốn ~1.2 GB và dùng CPU/RAM | Báo trước khi cài; xử lý tuần tự và có tiến độ. |
| Native SQLite extension khó package | Chỉ target Windows trước, test installer trên máy sạch ngay ở Giai đoạn B. |
| Supabase Free bị pause khi không dùng | Desktop vẫn xem/tìm tài liệu local; chỉ login/admin tạm không dùng được cho đến khi project hoạt động lại. |
| Mất máy/mất file local | Có export/backup rõ ràng; không hứa hẹn cloud recovery. |
