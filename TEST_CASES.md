# ScholarFlow Test Cases

## Tài khoản demo

- Email: `demo@scholarflow.local`
- Mật khẩu: `demo123456`
- Tạo dữ liệu demo: `cd learning-resource-app && npm run demo:seed`

## Smoke test cho user

1. Đăng ký hoặc đăng nhập bằng tài khoản demo.
2. Vào `Kết nối AI`, thêm provider OpenRouter/Ollama/Custom và bấm kiểm tra kết nối.
3. Vào `Thêm tài liệu`, upload PDF/DOCX/PPTX/EPUB.
4. Mở chi tiết tài liệu, kiểm tra:
   - Tiến trình xử lý chỉ có 4 dòng cố định.
   - Có khu `File gốc`.
   - PDF preview được trong app.
   - DOCX/PPTX/EPUB có nút tải file rõ ràng.
5. Nếu tài liệu lỗi, bấm `Xử lý phần còn thiếu`.
6. Vào `Hỏi tài liệu`, hỏi một câu tự nhiên.
7. Bật bộ lọc nâng cao và thử lọc theo tài liệu, chủ đề, loại file, ngày.
8. Bấm kết quả search, app phải mở đúng matched chunk.
9. Vào `Đề tài`, tạo project và bấm tạo lại gợi ý.
10. Mở chi tiết project, kiểm tra outline đọc tài liệu và danh sách tài liệu liên quan.

## Kiểm tra kỹ thuật

```powershell
cd learning-resource-app
npm run lint
npm run test:unit
npm run build
```

Docker CPU:

```powershell
docker compose up --build
```

Docker GPU:

```powershell
docker compose -f docker-compose.yml -f docker-compose.cuda.yml up --build
```
