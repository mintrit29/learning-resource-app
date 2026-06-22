# Checklist Tiến Độ Đồ Án

**Đề tài:** Hệ thống quản lý học liệu thông minh sử dụng NLP và Semantic Search  
**Nhóm:** 2 thành viên  
**Deadline:** 20/09/2026  
**Cập nhật gần nhất:** 20/06/2026

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
- [-] Hoàn thành nền tảng Next.js và database
- [-] Hoàn thành pipeline xử lý tài liệu
- [ ] Hoàn thành semantic search và recommendation
- [ ] Hoàn thành AI provider settings
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
- [ ] Tích hợp OpenRouter
- [ ] Tích hợp Ollama
- [ ] Tích hợp Custom OpenAI-compatible API
- [ ] Hỗ trợ custom provider như 9Router
- [x] Làm form thêm, sửa và xóa provider
- [x] Làm chức năng test connection
- [x] Mã hóa API key trước khi lưu
- [x] Chuyển prompt phân tích từ Streamlit
- [x] Phân loại primary topic
- [ ] Sinh subtopics/tags
- [x] Đánh giá difficulty
- [x] Sinh summary
- [x] Sinh keywords
- [x] Lưu lý do phân loại
- [x] Parse và validate JSON từ LLM
- [x] Cho phép xử lý lại theo bước còn thiếu/lỗi mà không chạy lại phần đã thành công
- [ ] Cho phép người dùng sửa kết quả phân loại

## Tuần 9: Taxonomy Và OpenAI Codex Spike

- [ ] Tạo schema Tag, TagAlias và DocumentTag
- [ ] Tạo hàm normalize tên tag
- [ ] Kiểm tra exact canonical tag
- [ ] Kiểm tra alias dictionary
- [ ] So sánh tag bằng embedding similarity
- [ ] Tạo TagMergeReview
- [ ] Tạo trang quản lý canonical tags
- [ ] Cho phép approve/reject đề xuất gộp tag
- [ ] Thiết kế giao diện Sign in with OpenAI Codex
- [ ] Kiểm tra tài liệu và khả năng tích hợp auth thực tế
- [ ] Thực hiện proof of concept nếu khả thi
- [ ] Ghi kết luận: hỗ trợ, fallback hoặc future work

## Tuần 10: Research Project Và Recommendation

- [ ] Tạo schema Project
- [ ] Tạo trang danh sách project
- [ ] Tạo form nhập topic, mô tả và độ khó mục tiêu
- [ ] Tạo embedding cho project
- [ ] Tìm các chunks gần nghĩa bằng pgvector
- [ ] Gom kết quả theo document
- [ ] Kết hợp topic, difficulty và canonical tags khi xếp hạng
- [ ] Dùng LLM sinh lý do gợi ý
- [ ] Lưu Recommendation
- [ ] Hiển thị danh sách tài liệu được gợi ý

## Tuần 11: Dataset Và Evaluation

- [ ] Chuẩn bị 40-60 tài liệu mẫu thuộc Computer Science/IT
- [ ] Tạo file nhãn thủ công cho dataset
- [ ] Gắn expected primary topic
- [ ] Gắn expected difficulty
- [ ] Chuẩn bị ít nhất 10 semantic search queries
- [ ] Chạy classification trên toàn bộ dataset
- [ ] Tính primary topic accuracy
- [ ] Tính difficulty accuracy
- [ ] Đánh giá search top-k relevance
- [ ] Kiểm tra các cặp tag/alias mẫu
- [ ] So sánh semantic search với keyword search
- [ ] Lưu bảng kết quả cho báo cáo

## Tuần 12: Hoàn Thiện Sản Phẩm

- [ ] Hoàn thiện dashboard và biểu đồ thống kê
- [ ] Thêm filter theo topic, difficulty, file type và status
- [ ] Hoàn thiện loading và progress states
- [ ] Hoàn thiện thông báo lỗi
- [x] Thêm nút thử lại cho extraction, chunking và embedding bị lỗi
- [x] Thêm chức năng xóa tài liệu
- [ ] Thêm chức năng re-analyze
- [ ] Kiểm tra responsive desktop/mobile
- [ ] Kiểm tra bảo mật upload và API key
- [ ] Chạy unit tests
- [ ] Chạy integration tests
- [ ] Sửa lỗi end-to-end

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

## Vấn Đề Cần Theo Dõi

- [ ] Xác minh OpenAI Codex auth có thể dùng hợp lệ trong web app bên thứ ba
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
|  | MVP chạy end-to-end | Chưa bắt đầu |  |
|  | Hoàn thành evaluation | Chưa bắt đầu |  |
| 20/09/2026 | Nộp đồ án | Chưa hoàn thành | Deadline |

## Tiến Độ Hiện Tại

**Giai đoạn hiện tại:** Semantic search đã hoạt động end-to-end, gồm snippet, vị trí nguồn và điều hướng đúng chunk/trang PDF.  
**Bước tiếp theo:** Triển khai LLM analysis và AI Provider Settings cho OpenRouter, Ollama và Custom API.
