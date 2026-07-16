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

Luồng UI đã kiểm tra trên desktop:

1. Search `API error response và HTTP status code` chỉ trả tài liệu REST API và mở đúng Slide 2.
2. Search `stack và queue khác nhau thế nào cho người mới` trả một card EPUB; `Trả lời từ kết quả` dùng được cả Mục 2 và Mục 3 để so sánh.
3. Query tiếng Việt tìm đúng tài liệu nghiên cứu tiếng Anh ở vị trí đầu.
4. Mở tài liệu rồi quay lại vẫn giữ query, kết quả và câu trả lời; `Xóa kết quả` dọn kết quả/câu trả lời nhưng giữ nội dung ô hỏi.
5. PDF dùng nhãn Trang, PPTX dùng Slide, DOCX/EPUB dùng Mục.

Kết quả benchmark 28 query trên bộ demo 6 tài liệu:

| Pipeline | Precision@5 | Recall@5 | MRR | Trung bình |
|---|---:|---:|---:|---:|
| Semantic baseline | 0.20 | 1.00 | 0.936 | ~86 ms |
| Hybrid + rerank | 0.895 | 1.00 | 0.936 | ~84 ms |

Đây là smoke benchmark nhỏ để kiểm tra regression, không thay thế evaluation trên tập tài liệu thật. API answer trả thêm `usage.contextChunks`, `usage.contextCharacters` và `usage.estimatedContextTokens`; token là ước lượng vì provider hiện tại không bảo đảm trả usage theo cùng một schema.
