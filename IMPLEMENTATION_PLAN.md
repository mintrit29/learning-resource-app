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
| Embedding | Giữ embedding service BGE-M3 local độc lập; Electron khởi động worker nội bộ, model được tải/cache trên máy khi cần. Không phụ thuộc Ollama. |
| Phân loại tài liệu | Ollama local với model người dùng đã cài/cấu hình. Không bắt buộc AI cloud và không ảnh hưởng search nếu Ollama tắt. |
| Database desktop | SQLite file trong thư mục app data; vector search dùng `sqlite-vec`. |
| Auth + web admin | Supabase Free. Chỉ lưu identity/profile/role/trạng thái user, không lưu tài liệu. |
| Admin | Next.js web riêng, chỉ quản lý tài khoản. |
| Docker | Giữ nguyên cho dev, test và demo nội bộ; không bắt user cuối cài Docker. |

Embedding là nền tảng của search nên được tách riêng khỏi LLM. Electron sẽ khởi động embedding worker BGE-M3 local tương thích service hiện tại; model được tải/cache trên máy ở lần đầu. Ollama chỉ là provider tùy chọn để phân tích metadata tài liệu.

## 2. Kiến trúc đích

```text
Electron desktop (Windows)
  -> Electron main: khởi động Next standalone local + quản lý lifecycle
  -> Next UI/API: chỉ bind 127.0.0.1
  -> SQLite + sqlite-vec: userData/ScholarFlow/<user-id>/library.db
  -> uploads local: userData/ScholarFlow/<user-id>/uploads
  -> embedding worker BGE-M3 local + model cache riêng
  -> Ollama local (tùy chọn): chỉ model phân loại

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

### Giai đoạn C — Embedding BGE-M3 local độc lập

1. Đóng gói Python runtime/embedding worker thành Electron sidecar; không yêu cầu user cài Docker hay Python.
2. Electron main khởi động/health-check worker loopback trước khi mở tính năng upload/search và dừng worker lúc thoát app.
3. Khi chưa có model, tải BGE-M3 vào model cache local với màn hình đồng ý tải và progress rõ ràng; không dùng Ollama model store.
4. Giữ embedding client/API hiện tại tương thích FastAPI; xác nhận vector BGE-M3 là 1024 chiều.
5. Cho CPU là mặc định, CUDA là tùy chọn nếu máy hỗ trợ; không chạy nhiều embedding job song song khi thiếu tài nguyên.
6. Chạy lại re-embed cho thư viện desktop khi model embedding hoặc version embedding worker thay đổi.

**Nghiệm thu:** app upload/search offline sau khi BGE-M3 đã cache, kể cả khi Ollama tắt hoặc chưa cài; không còn phụ thuộc embedding Docker service.

### Giai đoạn D — AI phân loại tài liệu qua Ollama (tùy chọn)

1. Thêm `AI analysis readiness` ở settings: phát hiện Ollama tại `http://127.0.0.1:11434` và refresh model list.
2. User chọn model Ollama local cho phân tích topic, difficulty, tag và summary.
3. Nếu Ollama/model không có, document vẫn extract/chunk/embed/search được; trạng thái AI là `Cần cấu hình` và user có thể thêm metadata thủ công hoặc phân tích lại sau.
4. Hiển thị lỗi Ollama/model tắt rõ ràng, không làm hỏng data hay search pipeline.

**Nghiệm thu:** tắt Ollama vẫn tìm kiếm được thư viện đã upload; bật lại Ollama thì có thể phân tích/re-analyze metadata.

### Giai đoạn E — Supabase Auth và Web Admin

1. Tạo Supabase project Free; tạo `profiles` gồm `id`, `email`, `role`, `status`, `created_at`, `last_seen_at`.
2. Dùng Supabase Auth cho desktop đăng ký/đăng nhập; thay Auth.js local session trong desktop.
3. Bật RLS cho mọi bảng cloud; user chỉ đọc/sửa profile của mình.
4. Tạo role `admin` bằng server-side process; tuyệt đối không để service-role key trong Electron renderer hoặc browser client.
5. Tạo admin web tối giản: đăng nhập admin, danh sách user, xem trạng thái, khóa/mở tài khoản và đổi role.
6. Khi desktop login/logout/cập nhật hoạt động, chỉ đồng bộ profile/status lên Supabase; tuyệt đối không sync document metadata, file, chunk hay embedding.

**Nghiệm thu:** một account đăng nhập được cả desktop và web admin; admin không thể xem tài liệu local của user.

### Giai đoạn F — Đóng gói, kiểm thử và bàn giao

1. Tạo installer Windows, versioning, icon, auto-update **chưa làm** ở MVP.
2. Test máy không có Docker/Postgres/Python, có và không có Ollama/model.
3. Test quyền account thường/admin, session expired, mạng mất, Supabase unavailable.
4. Test upload 4 định dạng, AI classify, hybrid search, filter, mở chunk và backup/export.
5. Chạy unit, integration, lint, production build, package smoke test và manual test bản cài đặt.
6. Viết hướng dẫn tải BGE-M3 worker/model cache, cài Ollama tùy chọn cho AI classify, backup/xóa dữ liệu local và chính sách riêng tư.

## 4. Không làm trong đợt desktop đầu

- Đồng bộ hoặc chia sẻ tài liệu giữa thiết bị.
- AI cloud mặc định hoặc server chạy BGE-M3 trả phí.
- macOS/Linux installer.
- Auto-update, thanh toán/quota, collaboration hoặc mobile app.
- Gửi document content lên Supabase/Admin web.

## 5. Rủi ro cần kiểm soát

| Rủi ro | Cách xử lý |
|---|---|
| BGE-M3 chưa tải hoặc worker lỗi | Onboarding kiểm tra/tải model riêng và báo rõ embedding chưa sẵn sàng. |
| Ollama/model phân loại không có | Chỉ mất AI classify; upload/search vẫn dùng BGE-M3 worker bình thường. |
| Model BGE-M3 tốn dung lượng và dùng CPU/RAM | Báo trước khi tải; xử lý tuần tự và có tiến độ. |
| Native SQLite extension khó package | Chỉ target Windows trước, test installer trên máy sạch ngay ở Giai đoạn B. |
| Supabase Free bị pause khi không dùng | Desktop vẫn xem/tìm tài liệu local; chỉ login/admin tạm không dùng được cho đến khi project hoạt động lại. |
| Mất máy/mất file local | Có export/backup rõ ràng; không hứa hẹn cloud recovery. |
