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

## D. Local AI bằng Ollama

- [ ] Thêm kiểm tra Ollama tại `127.0.0.1:11434`.
- [ ] Kiểm tra model `bge-m3`; hướng dẫn `ollama pull bge-m3` nếu thiếu.
- [ ] Chuyển embedding client desktop sang Ollama `/api/embed`.
- [ ] Kiểm tra dimension `bge-m3` là 1024 và cập nhật schema/index tương ứng.
- [ ] Thêm lựa chọn model Ollama local dùng để phân loại tài liệu.
- [ ] Hiển thị tiến độ/queue khi upload nhiều file.
- [ ] Xử lý lỗi Ollama tắt, model thiếu, hết RAM/VRAM.
- [ ] Chạy re-embed cho thư viện test và kiểm tra chất lượng search không regression.

## E. Supabase Auth và Admin web

- [ ] Thiết kế bảng `profiles` và role `user`/`admin`.
- [ ] Bật RLS và policies cho profile.
- [ ] Tích hợp Supabase sign-up/sign-in/sign-out vào Electron.
- [ ] Chuyển/loại Auth.js session local khỏi build desktop.
- [ ] Ghi `last_seen_at` khi desktop hoạt động.
- [ ] Tạo admin web login bắt buộc role `admin`.
- [ ] Trang admin: list user, search user, trạng thái, role, khóa/mở account.
- [ ] Admin API chạy server-side; service-role key chỉ ở environment server.
- [ ] Xác nhận Supabase không có file, document, chunk hoặc embedding user.

## F. Kiểm thử và bàn giao

- [ ] Test installer Windows sạch: không Docker/Postgres/Python.
- [ ] Test onboarding khi Ollama/model chưa có.
- [ ] Test offline sau khi đã đăng nhập và cài model.
- [ ] Test upload PDF/PPTX/DOCX/EPUB, classify, filter, search, mở chunk.
- [ ] Test 28 positive queries + 10 negative queries sau khi chuyển data layer.
- [ ] Test user thường không vào được admin; admin không xem được tài liệu local.
- [ ] Test session hết hạn, Supabase tạm unavailable và backup/restore.
- [ ] Chạy unit, integration, lint, build, package smoke test.
- [ ] Cập nhật README: cài Electron app, Ollama, `bge-m3`, backup và privacy.
- [ ] Viết test report trước khi phát hành installer MVP.
