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

## Evidence Search - cập nhật 16/07/2026

Chuẩn bị demo và chạy kiểm tra:

```powershell
cd learning-resource-app
npm run demo:seed
npm run demo:seed-evidence
npm run test:hybrid-search
npm run eval:evidence-search
```

Luồng UI đã kiểm tra trên desktop và viewport mobile 390 x 844:

1. Search `PDF giải thích transaction và ACID cho người mới` trả đúng 3 đoạn PDF, không lẫn tài liệu Machine Learning.
2. Query không dấu tìm được nội dung tiếng Việt có dấu.
3. Chuyển `Theo tài liệu` gom 3 đoạn thành 1 tài liệu.
4. `AI chọn giúp` vẫn hoạt động sau nâng cấp.
5. `Trả lời có dẫn chứng` chỉ dùng top chunks; citation mở đúng chunk và Trang 2.
6. Mobile không có horizontal overflow; toggle và hai nút AI full-width.

Kết quả benchmark 20 query trên bộ demo 2 tài liệu:

| Pipeline | Precision@5 | Recall@5 | MRR | Trung bình |
|---|---:|---:|---:|---:|
| Semantic baseline | 0.50 | 1.00 | 0.975 | 95.45 ms |
| Hybrid + rerank | 0.95 | 1.00 | 1.00 | 81.85 ms |

Đây là smoke benchmark nhỏ để kiểm tra regression, không thay thế evaluation trên tập tài liệu thật. API answer trả thêm `usage.contextChunks`, `usage.contextCharacters` và `usage.estimatedContextTokens`; token là ước lượng vì provider hiện tại không bảo đảm trả usage theo cùng một schema.
