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
6. Vào `Hỏi tài liệu`, chọn `Tìm tài liệu`, nhập một từ khóa/chủ đề và kiểm tra kết quả không tự gọi AI.
7. Chuyển sang `Hỏi tài liệu`, đặt câu hỏi cụ thể và kiểm tra câu trả lời có citation.
8. Bấm kết quả search, app phải mở đúng matched chunk; quay lại vẫn giữ query, kết quả và câu trả lời.
9. Bấm `Xóa kết quả`, app dọn kết quả/câu trả lời nhưng giữ nội dung ô nhập.

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
2. Chế độ `Hỏi tài liệu` với `stack và queue khác nhau thế nào cho người mới` tự retrieval rồi dùng được cả Mục 2 và Mục 3 để trả lời.
3. Query tiếng Việt tìm đúng tài liệu nghiên cứu tiếng Anh ở vị trí đầu.
4. Mở tài liệu rồi quay lại vẫn giữ query, kết quả và câu trả lời; `Xóa kết quả` dọn kết quả/câu trả lời nhưng giữ nội dung ô hỏi.
5. PDF dùng nhãn Trang, PPTX dùng Slide, DOCX/EPUB dùng Mục.

Kết quả benchmark 28 query trên bộ demo 6 tài liệu:

| Pipeline | Precision@5 | Recall@5 | MRR | Trung bình |
|---|---:|---:|---:|---:|
| Semantic baseline | 0.20 | 1.00 | 0.936 | ~86 ms |
| Hybrid + relevance gate + rerank | 0.982 | 1.00 | 1.00 | ~83 ms |

Đây là smoke benchmark nhỏ để kiểm tra regression, không thay thế evaluation trên tập tài liệu thật. API answer trả thêm `usage.contextChunks`, `usage.contextCharacters` và `usage.estimatedContextTokens`; token là ước lượng vì provider hiện tại không bảo đảm trả usage theo cùng một schema.

## Search Relevance Gate - cập nhật 21/07/2026

Các case bắt buộc:

1. `tôi tìm khóa học trung cấp` không được trả tài liệu Cơ bản chỉ vì tiêu đề có chữ Course.
2. `database` trả ebook Database nhưng ưu tiên chương nội dung, không ưu tiên Copyright/Table of Contents/About the Book.
3. `Data inconsistency và data isolation là gì?` trả lời từ đúng chương Database, có citation hợp lệ và chỉ hiển thị tài liệu thực sự được trích dẫn.
4. 10 negative/out-of-scope queries trong evaluation phải đạt rejection rate tối thiểu 90%; kết quả hiện tại là 100% trên demo fixture.
5. 28 positive queries phải giữ Recall@5 = 1.00; kết quả hiện tại đạt MRR = 1.00.
6. Search thuần không gọi chat provider; chế độ Hỏi mới gọi provider sau khi retrieval có bằng chứng đạt ngưỡng.
7. Kiểm tra desktop/mobile, mở đúng chunk, back navigation, session persistence, Clear và browser console.
