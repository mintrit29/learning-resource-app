# PRD — ScholarFlow: Hệ thống quản lý học liệu thông minh

**Phiên bản:** 1.0 (bản hiện tại)
**Cập nhật:** 28/07/2026
**Tên đề tài:** Hệ thống tự động phân loại và quản lý học liệu thông minh (Smart Learning Resources Management)

## 1. Mục đích

ScholarFlow giúp sinh viên quản lý eBooks, slides và tài liệu nghiên cứu; tự động phân loại chúng bằng NLP; rồi tìm nguồn tham khảo phù hợp cho một nhu cầu Research Project.

Sản phẩm không phải chatbot hỏi–đáp. Giá trị chính là giúp người dùng chọn **đúng tài liệu để đọc**, có đoạn nguồn và lý do phù hợp rõ ràng.

## 2. Người dùng và vấn đề

Sinh viên thường có nhiều PDF, PPTX, DOCX và EPUB nhưng khó biết:

- Tài liệu thuộc chủ đề nào và phù hợp với trình độ nào.
- Tài liệu nào nên dùng làm nguồn cho nhu cầu nghiên cứu đang có.
- Đoạn nào trong tài liệu thực sự liên quan thay vì chỉ khớp từ khóa trong mục lục hoặc copyright.

## 3. Phạm vi sản phẩm hiện tại

### 3.1 Chức năng có

1. Đăng ký, đăng nhập và thư viện riêng theo từng tài khoản.
2. Upload PDF, PPTX, DOCX, EPUB; trích xuất nội dung và lưu vị trí nguồn (trang, slide, chương hoặc heading).
3. Chia nội dung thành chunks và tạo embedding BGE-M3 local.
4. Phân tích AI khi upload: chủ đề chính, tags, độ khó, tóm tắt và keywords.
5. Quản lý thư viện, xem chi tiết tài liệu và chỉnh lại metadata khi cần.
6. Tìm tài liệu bằng câu tự nhiên, kết hợp vector search và keyword search.
7. Lọc luôn hiển thị theo chủ đề, độ khó và loại file.
8. Mỗi kết quả hiển thị một tài liệu, đoạn liên quan nhất, metadata và `Vì sao phù hợp`; mở đúng vị trí đoạn nguồn.
9. Lưu query/filter/kết quả trong phiên; `Xóa kết quả` chỉ xóa danh sách để người dùng chỉnh query và tìm lại.
10. Cấu hình AI provider để phân tích tài liệu (Ollama, OpenRouter hoặc Custom API).

### 3.2 Không có trong bản hiện tại

- Chatbot/RAG trả lời kiến thức từ kết quả tìm kiếm.
- AI Answer hoặc AI Curate trong trang search.
- Đồng bộ tài liệu giữa các máy.
- Web admin quản lý user.
- Desktop installer cho người dùng cuối.
- Chia sẻ thư viện, collaboration hoặc Knowledge Graph.

## 4. Luồng nghiệp vụ

```text
Thêm tài liệu
-> trích xuất text + chia chunk
-> embedding BGE-M3 local
-> AI phân loại chủ đề, tag, độ khó, tóm tắt
-> lưu thư viện

Tìm tài liệu
-> toàn bộ câu query thành vector
-> lấy 30 vector candidates + 30 keyword candidates
-> hybrid rerank + loại boilerplate/đoạn yếu
-> tối đa một chunk tốt nhất cho mỗi tài liệu
-> hiển thị tài liệu, đoạn nguồn và lý do phù hợp
```

Keyword chỉ bổ sung truy xuất/xếp hạng; vector luôn dùng toàn bộ câu người dùng nhập và được ưu tiên hơn keyword-only result. Search không gọi LLM.

## 5. Yêu cầu chức năng

| Mã | Yêu cầu | Tiêu chí chấp nhận |
|---|---|---|
| FR-01 | Quản lý tài liệu | User chỉ thấy và thao tác tài liệu của mình. |
| FR-02 | Phân loại tự động | Tài liệu sau xử lý có primary topic, difficulty, tags và summary. |
| FR-03 | Tìm theo ngữ nghĩa | Câu diễn đạt tự nhiên vẫn tìm được tài liệu liên quan dù không trùng nguyên văn. |
| FR-04 | Hybrid retrieval | Vector và keyword chạy song song; vector-backed result đứng trước keyword-only result. |
| FR-05 | Lọc nguồn | Filter topic, difficulty, file type chỉ trả tài liệu đúng điều kiện. |
| FR-06 | Lý do phù hợp | Mỗi card giải thích bằng rule: khớp ngữ nghĩa, từ khóa, filter và metadata; không lộ score kỹ thuật. |
| FR-07 | Truy vết nguồn | Mở card đi đến đúng tài liệu/chunk và quay lại vẫn giữ kết quả. |

## 6. Yêu cầu phi chức năng

- Giao diện tiếng Việt, dễ dùng trên desktop và mobile browser.
- Dữ liệu file và embedding hiện nằm local trong Docker volumes.
- BGE-M3 chạy local; GPU là tùy chọn, CPU là mặc định.
- Search một query không gửi toàn bộ tài liệu qua LLM.
- Kết quả không được ưu tiên boilerplate như copyright/mục lục nếu có chunk nội dung phù hợp hơn.

## 7. Kiến trúc hiện tại

```text
Next.js + TypeScript + Auth.js + Prisma
            |
PostgreSQL + pgvector (Docker)
            |
FastAPI embedding service + BGE-M3 (Docker/local)
            |
Ollama / OpenRouter / Custom API (phân tích lúc upload)
```

Docker là môi trường phát triển và demo hiện tại. Đây chưa phải bản desktop hay bản cloud production.

## 8. Đánh giá hiện có

- Hybrid search smoke test, unit test, integration test, lint, production build và Docker smoke test đã pass.
- Bộ đánh giá 28 truy vấn demo: Recall@5 = 1.00, MRR = 1.00.
- 10 truy vấn ngoài phạm vi đạt rejection rate 100% trên demo fixture.

## 9. Hướng phát triển đã chốt nhưng chưa thuộc PRD hiện tại

Phiên bản kế tiếp sẽ là Electron local-first cho Windows: tài liệu, BGE-M3, vector và search vẫn ở máy người dùng; Supabase Free chỉ xử lý đăng nhập và web admin quản lý tài khoản. Chi tiết triển khai nằm trong `IMPLEMENTATION_PLAN.md` và `PROJECT_CHECKLIST.md`.
