# Checklist Tiến Độ Đồ Án

**Đề tài:** Hệ thống quản lý học liệu thông minh sử dụng NLP và Semantic Search
**Nhóm:** 2 thành viên
**Deadline:** 20/09/2026
**Cập nhật gần nhất:** 03/07/2026

## Quy Ước Trạng Thái

- `[ ]` Chưa bắt đầu
- `[-]` Đang thực hiện
- `[x]` Đã hoàn thành
- `[!]` Đang bị chặn hoặc cần quyết định

## Tổng Quan

- [x] Làm rõ mục tiêu và phạm vi đề tài
- [x] Hoàn thành PRD
- [x] Hoàn thành implementation plan
- [x] Chốt taxonomy chủ đề theo hướng hybrid
- [x] Chốt Vector RAG cho MVP, GraphRAG là hướng phát triển
- [x] Chốt BGE-M3 local làm embedding model mặc định
- [x] Hoàn thành nền tảng Next.js và database
- [x] Hoàn thành pipeline xử lý tài liệu
- [x] Hoàn thành semantic search và recommendation
- [x] Hoàn thành AI provider settings
- [x] Đồng bộ primary topics và lưu ngôn ngữ tài liệu theo PRD
- [ ] Hoàn thành evaluation dataset và đánh giá
- [ ] Hoàn thành báo cáo và demo bảo vệ

## Tuần 1-2: Nền Tảng Ứng Dụng

- [x] Tạo project Next.js + TypeScript
- [x] Thiết lập Tailwind CSS và component system
- [x] Tạo cấu trúc thư mục theo module
- [x] Cài đặt PostgreSQL và pgvector
- [x] Cài đặt Prisma
- [x] Tạo Prisma schema ban đầu
- [x] Cài đặt Auth.js
- [x] Làm đăng ký tài khoản
- [x] Làm đăng nhập và đăng xuất
- [x] Bảo vệ các route cần đăng nhập
- [x] Tạo layout dashboard
- [x] Kiểm tra build và chạy ứng dụng

## Tuần 3-4: Upload Và Trích Xuất Nội Dung

- [x] Tạo trang upload tài liệu
- [x] Validate định dạng và kích thước file
- [x] Lưu file vào thư mục uploads
- [x] Tạo record Document trong PostgreSQL
- [x] Trích xuất nội dung PDF
- [x] Trích xuất nội dung PPTX
- [x] Trích xuất nội dung DOCX
- [x] Trích xuất nội dung EPUB
- [x] Lưu toàn bộ text của tài liệu
- [x] Tạo trạng thái xử lý và AnalysisJob
- [x] Hiển thị lỗi khi không trích xuất được text
- [x] Tạo trang danh sách tài liệu
- [x] Tạo trang chi tiết tài liệu

## Tuần 5-6: Chunking, BGE-M3 Và Semantic Search

- [x] Tạo schema DocumentChunk
- [x] Chia tài liệu thành chunk 300-500 tokens
- [x] Thiết lập overlap 10-15%
- [x] Tạo Python embedding service
- [x] Tích hợp model BAAI/bge-m3
- [x] Tạo vector 1024 chiều cho từng chunk
- [x] Lưu vector vào pgvector
- [x] Tạo vector index
- [x] Cache embedding, không tạo lại khi nội dung không đổi
- [x] Benchmark CPU với batch size 2, 4 và 8
- [x] Benchmark GPU với Quadro T2000 4 GiB, CUDA batch size 2
- [x] Ghi lại thời gian, RAM và VRAM sử dụng trong `embedding-service/BENCHMARK_REPORT.md`
- [x] Tạo API semantic search
- [x] Tạo giao diện tìm kiếm
- [x] Hiển thị tài liệu và chunk khớp với truy vấn
- [x] Lưu vị trí nguồn cho chunk: trang PDF, slide PPTX, chương EPUB, heading DOCX
- [x] Hiển thị vị trí trong kết quả semantic search
- [x] Điều hướng tới matched chunk trên trang chi tiết
- [x] Mở file PDF gốc tại đúng trang bằng `#page=N`
- [x] Khóa BGE-M3 làm embedding model duy nhất; GPU chính và CPU fallback không cần re-embed

## Tuần 7-8: Phân Tích AI Và Provider Settings

- [x] Tạo interface chung cho chat providers
- [x] Tách chat provider và embedding provider
- [x] Tích hợp OpenRouter (đã smoke test giao thức models/chat)
- [x] Tích hợp Ollama (đã smoke test giao thức tags/chat)
- [x] Tích hợp Custom API (đã smoke test giao thức models/chat)
- [x] Làm form thêm, sửa và xóa provider
- [x] Làm chức năng test connection
- [x] Mã hóa API key trước khi lưu
- [x] Chuyển prompt phân tích từ Streamlit
- [x] Phân loại primary topic
- [x] Sinh subtopics/tags và lưu kết quả thô để chuẩn hóa ở bước taxonomy
- [x] Đánh giá difficulty
- [x] Sinh summary
- [x] Sinh keywords
- [x] Lưu lý do phân loại
- [x] Parse và validate JSON từ LLM
- [x] Cho phép xử lý lại theo bước còn thiếu/lỗi mà không chạy lại phần đã thành công
- [x] Cho phép người dùng sửa kết quả phân loại

## Tuần 9: Taxonomy

- [x] Tạo schema Tag, TagAlias và DocumentTag
- [x] Tạo hàm normalize tên tag
- [x] Kiểm tra exact canonical tag
- [x] Kiểm tra alias dictionary
- [x] So sánh tag bằng embedding similarity
- [x] Tạo TagMergeReview
- [x] Tạo trang quản lý canonical tags
- [x] Cho phép approve/reject đề xuất gộp tag
- [x] Cho phép gộp thủ công hai canonical tags

## Tuần 10: Research Project Và Recommendation

- [x] Tạo schema Project
- [x] Tạo trang danh sách project
- [x] Tạo form nhập topic, mô tả và độ khó mục tiêu
- [x] Tạo embedding cho project
- [x] Tìm các chunks gần nghĩa bằng pgvector
- [x] Gom kết quả theo document
- [x] Kết hợp topic, difficulty và canonical tags khi xếp hạng
- [x] Dùng LLM sinh lý do gợi ý
- [x] Lưu Recommendation
- [x] Hiển thị danh sách tài liệu được gợi ý

## Tuần 11: Dataset Và Evaluation

- [ ] Chuẩn bị 40-60 tài liệu mẫu thuộc Computer Science/IT
- [x] Tạo file nhãn thủ công cho dataset
- [ ] Gắn expected primary topic
- [ ] Gắn expected difficulty
- [ ] Chuẩn bị ít nhất 10 semantic search queries
- [x] Tạo script sinh template evaluation từ dữ liệu hiện có
- [x] Tạo script chạy classification trên toàn bộ dataset sau khi có nhãn
- [x] Tạo script tính primary topic accuracy
- [x] Tạo script tính difficulty accuracy
- [x] Tạo script đánh giá search top-k relevance
- [x] Tạo script kiểm tra các cặp tag/alias mẫu
- [x] Tạo script so sánh semantic search với keyword search
- [x] Tạo script lưu bảng kết quả cho báo cáo
- [ ] Chạy evaluation cuối cùng sau khi hoàn tất dataset/nhãn thủ công

## Tuần 12: Hoàn Thiện Sản Phẩm

- [x] Hoàn thiện dashboard và biểu đồ thống kê
- [x] Thêm filter quản lý ở trang Tài liệu theo topic, độ khó, loại file và status
- [x] Hoàn thiện loading và progress states
- [x] Hoàn thiện thông báo lỗi
- [x] Thêm nút thử lại cho extraction, chunking và embedding bị lỗi
- [x] Thêm chức năng xóa tài liệu
- [x] Thêm chức năng re-analyze
- [x] Kiểm tra responsive desktop/mobile
- [x] Kiểm tra bảo mật upload và API key
- [x] Chạy unit tests
- [x] Chạy integration tests
- [x] Sửa lỗi end-to-end
- [x] Docker hóa Next.js web app
- [x] Docker hóa embedding service với model cache volume
- [x] Tạo root Docker Compose cho web + PostgreSQL/pgvector + embedding service
- [x] Cấu hình CPU mặc định và CUDA profile tùy chọn
- [x] Ghi rõ cách chạy GPU: phải dùng `docker compose -f docker-compose.yml -f docker-compose.cuda.yml up --build`; lệnh compose mặc định chỉ chạy CPU
- [x] Xác minh máy mới chạy được bằng `docker compose up --build`

## Tuần 13: Báo Cáo Và Bảo Vệ

- [ ] Hoàn thiện tài liệu báo cáo
- [ ] Vẽ sơ đồ kiến trúc hệ thống
- [ ] Vẽ pipeline xử lý tài liệu
- [ ] Giải thích chunking, embedding và pgvector
- [ ] Giải thích Vector RAG và lý do chưa dùng GraphRAG
- [ ] Thêm bảng evaluation vào báo cáo
- [ ] Chuẩn bị ảnh chụp giao diện
- [ ] Chuẩn bị dữ liệu demo ổn định
- [ ] Viết kịch bản demo từng bước
- [ ] Chuẩn bị phương án khi API hoặc mạng lỗi
- [ ] Chạy thử demo hoàn chỉnh
- [ ] Phân chia phần thuyết trình cho hai thành viên
- [ ] Luyện trả lời câu hỏi phản biện
- [ ] Đóng gói source code và tài liệu nộp

## Các Quyết Định Đã Chốt

- [x] Stack: Next.js, TypeScript, PostgreSQL, Prisma, Auth.js, pgvector
- [x] Định dạng MVP: PDF, PPTX, DOCX, EPUB
- [x] Primary topics cố định trong lĩnh vực Computer Science/IT
- [x] Subtopics/tags do AI sinh và được chuẩn hóa
- [x] Embedding mặc định: BAAI/bge-m3 local
- [x] Vector dimension: 1024
- [x] Chunk size: 300-500 tokens, overlap 10-15%
- [x] Vector RAG thuộc phạm vi MVP
- [x] Knowledge Graph và GraphRAG thuộc future work
- [x] Không dùng embedding model fallback; BGE-M3 chạy GPU hoặc CPU
- [x] Không huấn luyện hoặc fine-tune model trong MVP
- [x] Không làm quota/usage provider, admin/storage dashboard, import/export dữ liệu, multi-user/phân quyền/chia sẻ nâng cao

## Roadmap Sau MVP

- [x] Cải thiện UI theo luồng dễ hiểu cho người mới
- [x] Preview/mở file gốc tốt hơn
- [x] Chuẩn bị OCR cho PDF scan/ảnh/tài liệu không có text layer
- [x] Thêm OCR engine đầy đủ
- [x] Cố định tiến trình xử lý, chạy lại chỉ đổi trạng thái thay vì thêm dòng mới
- [x] Nút chạy lại phần lỗi/còn thiếu trong pipeline
- [x] Cải thiện test kết nối/model và thông báo lỗi AI provider
- [x] Tối ưu embedding CPU/GPU, batch size và ước tính thời gian
- [x] Bỏ bộ lọc nâng cao khỏi trang Hỏi tài liệu để UX đơn giản hơn
- [x] Lưu lịch sử truy vấn semantic search phục vụ evaluation/báo cáo
- [x] Thêm AI lọc kết quả semantic search theo mức nên đọc trước/đọc thêm/có thể bỏ qua
- [x] Chuẩn hóa nhãn độ khó trên UI sang Cơ bản/Trung cấp/Nâng cao
- [x] Cải thiện hỏi đáp với tài liệu, trích dẫn nguồn và mở đúng trang/chunk
- [x] Cải thiện project/recommendation: outline và tài liệu liên quan
- [x] Chuẩn hóa test/release: test case demo, seed demo và CI build Docker

## Vấn Đề Cần Theo Dõi

- [ ] Chọn thư viện trích xuất tốt nhất cho từng định dạng
- [ ] Benchmark BGE-M3 thực tế trên máy phát triển
- [ ] Chốt giới hạn kích thước file upload
- [ ] Chốt cách chạy background jobs khi triển khai production
- [ ] Chốt nơi lưu file khi deploy

## Nhật Ký Mốc Quan Trọng

| Ngày | Mốc | Trạng thái | Ghi chú |
|---|---|---|---|
| 18/06/2026 | Bắt đầu làm rõ đề tài | Hoàn thành | Chốt phạm vi web app và stack mục tiêu |
| 20/06/2026 | Hoàn thiện tài liệu kế hoạch | Hoàn thành | Có PRD, implementation plan và checklist |
| 20/06/2026 | Hoàn thành nền tảng Tuần 1-2 | Hoàn thành | Next.js, PostgreSQL, pgvector, Prisma, Auth.js và dashboard |
| 20/06/2026 | Hoàn thành upload và extraction cơ bản | Hoàn thành | Parser PDF, PPTX, DOCX, EPUB đã qua smoke test |
| 20/06/2026 | Hoàn thành background job và chunking | Hoàn thành | Backfill tài liệu thật thành 341 chunks |
| 21/06/2026 | BGE-M3 và semantic search hoạt động | Hoàn thành | 341 chunks trong 615 giây; truy vấn mẫu trả đúng đoạn decision tree |
| 21/06/2026 | Source-aware semantic search | Hoàn thành | 525/525 chunks có vị trí; query decision tree trả về Trang 11 |
| 03/07/2026 | MVP chạy end-to-end | Hoàn thành | Upload, extract, AI analysis, embedding, semantic search, recommendation, Docker |
|  | Hoàn thành evaluation | Chưa bắt đầu |  |
| 20/09/2026 | Nộp đồ án | Chưa hoàn thành | Deadline |

## Tiến Độ Hiện Tại

**Giai đoạn hiện tại:** App/product roadmap sau MVP đã hoàn thành; còn lại chủ yếu là dataset/evaluation thủ công và báo cáo/demo bảo vệ.
**Bước tiếp theo:** Người phụ trách nội dung chuẩn bị dataset, nhãn đánh giá, báo cáo và kịch bản demo.
# UX Simplification: Giao diện dễ dùng

- [x] Đổi wording/menu sang ngôn ngữ đời thường
- [x] Thêm dashboard onboarding 3 bước
- [x] Cải thiện empty state và CTA chính
- [x] Cải thiện trang thêm tài liệu
- [x] Cải thiện trang hỏi/tìm tài liệu
- [x] Cải thiện trang đề tài
- [x] Cải thiện trang kết nối AI/provider
- [x] Kiểm tra lại UI bằng browser sau khi build
