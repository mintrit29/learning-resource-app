# Checklist — Electron local-first và Web Admin

**Cập nhật:** 28/07/2026
**Nguyên tắc:** Tài liệu, AI và search là local. Supabase chỉ chứa account/admin metadata.

## A. Chuẩn bị

- [ ] Tạo nhánh `codex/desktop-local-first`.
- [ ] Chốt Windows 10/11 là platform MVP.
- [ ] Tạo tài khoản/project Supabase Free riêng cho ScholarFlow.
- [ ] Tạo tài liệu kiến trúc và threat model ngắn: dữ liệu nào local, dữ liệu nào cloud.
- [ ] Không copy service-role key vào Electron hoặc source frontend.

## B. Electron shell

- [ ] Cài Electron tooling và cấu hình build installer Windows.
- [ ] Chạy Next standalone server từ Electron main process.
- [ ] Server chỉ listen `127.0.0.1`; không mở ra LAN.
- [ ] Chờ health check trước khi tạo cửa sổ app.
- [ ] Đóng app thì dừng toàn bộ child processes.
- [ ] Bật `contextIsolation`; tắt `nodeIntegration`.
- [ ] Preload chỉ expose API được allowlist.
- [ ] Package và mở installer trên máy test không cài Docker.

## C. Data local

- [ ] Tạo SQLite database riêng trong `app.getPath('userData')/ScholarFlow/<user-id>/library.db`.
- [ ] Chuyển schema Prisma desktop từ PostgreSQL sang SQLite.
- [ ] Tạo migration cho database rỗng.
- [ ] Lưu file upload trong `userData/ScholarFlow/<user-id>/uploads`.
- [ ] Tích hợp `sqlite-vec` và index vector 1024 chiều.
- [ ] Chuyển vector search Postgres sang SQLite nhưng giữ hybrid rerank hiện tại.
- [ ] Kiểm thử isolation theo local account/library.
- [ ] Thêm export/backup database + uploads và hướng dẫn restore.

## D. Embedding BGE-M3 local độc lập

- [ ] Đóng gói Python runtime + embedding worker BGE-M3 thành Electron sidecar.
- [ ] Electron main khởi động, health-check và dừng embedding worker đúng lifecycle.
- [ ] Tạo model cache BGE-M3 local tách khỏi Ollama model store.
- [ ] Có màn hình đồng ý tải model và progress ở lần đầu.
- [ ] Giữ embedding client tương thích FastAPI service hiện tại.
- [ ] Kiểm tra dimension BGE-M3 là 1024 và cập nhật schema/index tương ứng.
- [ ] CPU là default; CUDA chỉ là tùy chọn theo máy.
- [ ] Hiển thị tiến độ/queue khi upload nhiều file.
- [ ] Xử lý worker lỗi, model thiếu, hết RAM/VRAM.
- [ ] Chạy re-embed cho thư viện test và kiểm tra chất lượng search không regression.

## E. AI phân loại qua Ollama (tùy chọn)

- [ ] Thêm kiểm tra Ollama tại `127.0.0.1:11434` và refresh model list.
- [ ] Cho user chọn model Ollama local để phân loại tài liệu.
- [ ] Khi Ollama/model thiếu: vẫn extract/chunk/embed/search; chỉ đánh dấu AI analysis `Cần cấu hình`.
- [ ] Tắt Ollama không được làm lỗi search hoặc thư viện đã xử lý.

## F. Supabase Auth và Admin web

- [ ] Thiết kế bảng `profiles` và role `user`/`admin`.
- [ ] Bật RLS và policies cho profile.
- [ ] Tích hợp Supabase sign-up/sign-in/sign-out vào Electron.
- [ ] Chuyển/loại Auth.js session local khỏi build desktop.
- [ ] Ghi `last_seen_at` khi desktop hoạt động.
- [ ] Tạo admin web login bắt buộc role `admin`.
- [ ] Trang admin: list user, search user, trạng thái, role, khóa/mở account.
- [ ] Admin API chạy server-side; service-role key chỉ ở environment server.
- [ ] Xác nhận Supabase không có file, document, chunk hoặc embedding user.

## G. Kiểm thử và bàn giao

- [ ] Test installer Windows sạch: không Docker/Postgres/Python.
- [ ] Test onboarding khi BGE-M3 chưa tải hoặc embedding worker chưa chạy.
- [ ] Test Ollama tắt nhưng search vẫn hoạt động.
- [ ] Test offline sau khi đã đăng nhập và BGE-M3 đã cache.
- [ ] Test upload PDF/PPTX/DOCX/EPUB, classify, filter, search, mở chunk.
- [ ] Test 28 positive queries + 10 negative queries sau khi chuyển data layer.
- [ ] Test user thường không vào được admin; admin không xem được tài liệu local.
- [ ] Test session hết hạn, Supabase tạm unavailable và backup/restore.
- [ ] Chạy unit, integration, lint, build, package smoke test.
- [ ] Cập nhật README: cài Electron app, tải BGE-M3 worker/model cache, Ollama tùy chọn, backup và privacy.
- [ ] Viết test report trước khi phát hành installer MVP.
