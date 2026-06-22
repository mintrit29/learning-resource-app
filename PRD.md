# PRD - Hệ Thống Quản Lý Học Liệu Thông Minh

## 1. Tổng Quan Sản Phẩm

**Tên đề tài:** Hệ thống quản lý học liệu thông minh sử dụng NLP và Semantic Search  
**Tên tiếng Anh gợi ý:** Smart Learning Resources Management System using NLP and Semantic Search

**Mô tả ngắn:**  
Hệ thống giúp sinh viên quản lý, phân loại, tìm kiếm và gợi ý tài liệu học tập/nghiên cứu. Người dùng có thể upload eBooks, slides và tài liệu nghiên cứu; hệ thống sẽ trích xuất nội dung, dùng AI/NLP để phân tích chủ đề, độ khó, từ khóa, tóm tắt và hỗ trợ tìm kiếm theo ngữ nghĩa.

**Bối cảnh hiện tại:**  
Demo hiện tại đang dùng `Streamlit + Python + SQLite`, có các chức năng:

- Upload PDF.
- Trích xuất text bằng PyMuPDF.
- Lưu text vào SQLite.
- Gọi AI qua OpenRouter, Ollama hoặc Custom API để tạo `topic`, `difficulty`, `summary`, `keywords`.
- Tìm kiếm cơ bản bằng keyword/fuzzy matching.

**Hướng nâng cấp:**  
Chuyển thành web app thật, chuyên nghiệp hơn cho đồ án cuối khóa:

- Frontend/backend: `Next.js + TypeScript`.
- Database: `PostgreSQL`.
- ORM: `Prisma`.
- Auth: `Auth.js`.
- Semantic search: `pgvector`.
- AI providers hiện tại: `OpenRouter`, `Ollama`, `Custom API`.

## 2. Vấn Đề Cần Giải Quyết

Sinh viên thường có nhiều tài liệu học tập và nghiên cứu nằm rải rác ở các định dạng khác nhau như PDF, PPTX, DOCX, EPUB. Khi làm Research Project, sinh viên gặp các vấn đề:

- Khó biết tài liệu nào phù hợp với đề tài.
- Khó phân biệt tài liệu thuộc chủ đề nào.
- Khó đánh giá tài liệu đó phù hợp với người mới học hay người đã có nền tảng.
- Tìm kiếm keyword thường không đủ tốt, vì có trường hợp người dùng hỏi theo ý nghĩa thay vì dùng đúng từ khóa trong tài liệu.
- Không có dashboard tổng hợp tài liệu theo chủ đề, độ khó và loại file.

Hệ thống cần giải quyết các vấn đề trên bằng một pipeline rõ ràng: upload tài liệu, trích xuất nội dung, phân tích AI, tạo vector embedding, tìm kiếm semantic và gợi ý tài liệu theo project topic.

## 3. Mục Tiêu Sản Phẩm

### 3.1. Mục tiêu chính

Xây dựng một web app giúp sinh viên:

- Upload và quản lý tài liệu học tập/nghiên cứu.
- Tự động phân loại tài liệu theo chủ đề.
- Tự động đánh giá độ khó: `Beginner`, `Intermediate`, `Advanced`.
- Tự động tạo tóm tắt và keywords.
- Tìm kiếm tài liệu bằng keyword và semantic search.
- Gợi ý tài liệu phù hợp với Research Project.
- Cấu hình nhiều AI provider tùy theo nhu cầu: subscription, local model, OpenRouter hoặc custom API.

### 3.2. Mục tiêu đồ án

Sản phẩm cần đủ rõ để trình bày như một đề án cuối khóa:

- Có kiến trúc hệ thống đầy đủ.
- Có pipeline NLP/LLM giải thích được.
- Có database schema rõ ràng.
- Có dashboard và UI quản lý tài liệu.
- Có đánh giá kết quả bằng dataset nhỏ.
- Có demo end-to-end chạy được.

## 4. Đối Tượng Người Dùng

### 4.1. Sinh viên

Người dùng chính của hệ thống. Sinh viên cần upload tài liệu, tìm tài liệu theo đề tài, xem tóm tắt, lọc theo độ khó và chọn tài liệu phù hợp để làm research/project.

### 4.2. Nhóm làm Research Project

Nhóm sinh viên cần gom tài liệu tham khảo, phân loại theo chủ đề, gợi ý tài liệu nên đọc trước, và tìm tài liệu liên quan theo project topic.

### 4.3. Giảng viên hoặc người quản lý tài liệu

Có thể dùng hệ thống để quản lý tập tài liệu học tập, kiểm tra phân loại AI và xem thống kê theo chủ đề/độ khó.

## 5. Phạm Vi MVP

### 5.1. Trong phạm vi

MVP cần có các chức năng sau:

- Đăng ký, đăng nhập.
- Dashboard tổng quan.
- Upload tài liệu với 4 định dạng: `PDF`, `PPTX`, `DOCX`, `EPUB`.
- Trích xuất text từ tài liệu.
- Chia text thành chunks.
- Giữ metadata vị trí nguồn cho từng chunk: trang PDF, slide PPTX, chương EPUB hoặc heading DOCX.
- Tạo embeddings cho chunks bằng `BGE-M3` làm model mặc định.
- Lưu vectors bằng `pgvector`.
- LLM phân tích tài liệu:
  - Primary topic.
  - Subtopics/tags.
  - Difficulty.
  - Summary.
  - Keywords.
- Quản lý danh sách tài liệu.
- Xem chi tiết tài liệu.
- Lọc theo primary topic, difficulty, file type.
- Semantic search.
- Gợi ý tài liệu theo Research Project topic.
- Màn hình cấu hình AI providers.
- Cho phép người dùng sửa lại primary topic/difficulty nếu AI phân loại sai.
- Quản lý tags ở mức cơ bản để gộp các subtopics/tags bị trùng nghĩa.

### 5.2. Ngoài phạm vi MVP

Các chức năng sau không làm trong MVP, chỉ ghi là hướng phát triển:

- Knowledge Graph đầy đủ.
- GraphRAG kết hợp Knowledge Graph và vector retrieval.
- Chatbot RAG phức tạp trên toàn bộ thư viện tài liệu.
- OCR cho PDF scan ảnh.
- Mobile app.
- Realtime collaboration.
- Train model NLP riêng từ đầu.
- Phân quyền nâng cao nhiều vai trò.

## 6. Chức Năng Chi Tiết

### 6.1. Authentication

Người dùng có thể:

- Đăng ký tài khoản bằng email/password.
- Đăng nhập/đăng xuất.
- Truy cập dashboard riêng của mình.
- Chỉ xem và quản lý tài liệu do mình upload.

### 6.2. Dashboard

Dashboard hiển thị:

- Tổng số tài liệu.
- Số tài liệu theo primary topic.
- Số tài liệu theo difficulty.
- Số tài liệu theo file type.
- Tài liệu mới upload gần đây.
- Số tài liệu đã phân tích thành công/thất bại.
- Trạng thái AI provider đang active.

### 6.3. Upload tài liệu

Người dùng có thể upload:

- PDF.
- PPTX.
- DOCX.
- EPUB.

Sau khi upload, hệ thống lưu file, tạo record document và bắt đầu pipeline xử lý.

### 6.4. Extract text

Hệ thống trích xuất text từ tài liệu:

- PDF: dùng thư viện PDF parser.
- PPTX: đọc text từ slides.
- DOCX: đọc paragraphs/tables cơ bản.
- EPUB: đọc HTML/text từ ebook.

Ngoài toàn bộ text, extractor cần trả về các section có vị trí:

- PDF: số trang.
- PPTX: số slide.
- EPUB: tên chương và đường dẫn section trong ebook.
- DOCX: heading/phần gần nhất; nếu không có heading thì dùng `Nội dung tài liệu`.

Nếu file không trích xuất được text, hệ thống hiển thị trạng thái lỗi và thông báo rõ lý do.

### 6.5. AI analysis

Hệ thống dùng LLM để tạo metadata cấp document:

- `primaryTopic`: một trong danh sách topic chính cố định.
- `subtopics`: các chủ đề con do AI đề xuất.
- `difficulty`: `Beginner`, `Intermediate`, `Advanced`.
- `summary`: tóm tắt bằng tiếng Việt.
- `keywords`: danh sách từ khóa liên quan.
- `language`: ngôn ngữ chính của tài liệu.
- `reason`: lý do ngắn gọn vì sao AI chọn primary topic/difficulty.

Trang chi tiết tài liệu phải có nút `Xử lý phần còn thiếu` khi extraction, chunking, embedding hoặc AI analysis chưa hoàn tất. Retry tiếp tục từ bước đầu tiên còn thiếu/lỗi, không xóa hay chạy lại chunk/embedding đã thành công chỉ vì AI analysis lỗi. Tài liệu cũ phải backfill được bằng nút này mà không cần upload lại. Mỗi tài liệu chỉ có một pipeline hoạt động tại một thời điểm.

### 6.5.1. Chiến lược topic/taxonomy

Hệ thống không để AI tự do tạo topic chính hoàn toàn, vì dễ sinh ra nhiều tên khác nhau cho cùng một chủ đề và làm dashboard/filter/evaluation bị rối. Hệ thống cũng không cố định quá cứng toàn bộ nội dung, vì tài liệu thực tế có nhiều chủ đề con chi tiết.

Chiến lược được chọn là **hybrid taxonomy**:

```text
Primary topic: cố định trong lĩnh vực Computer Science / Information Technology
Subtopics/tags: AI tự sinh, sau đó hệ thống chuẩn hóa
Keywords: AI tự sinh
Difficulty: cố định
```

Primary topic được dùng cho:

- Filter.
- Dashboard.
- Thống kê.
- Evaluation accuracy.
- Báo cáo đồ án.

Subtopics/tags được dùng cho:

- Mô tả tài liệu chi tiết hơn.
- Semantic search.
- Recommendation.
- Liên kết các tài liệu cùng chủ đề con.

### 6.5.2. Danh sách primary topics mặc định

MVP tập trung vào tài liệu thuộc lĩnh vực Computer Science / Information Technology, không mở rộng sang mọi lĩnh vực tổng quát. Danh sách primary topics mặc định:

- Artificial Intelligence.
- Machine Learning.
- Natural Language Processing.
- Computer Vision.
- Database.
- Cybersecurity.
- Web Development.
- Mobile Development.
- Software Engineering.
- Computer Networks.
- Operating Systems.
- Cloud Computing.
- Mathematics for Computing.
- Data Science.
- Other.

`Other` dùng cho tài liệu nằm ngoài phạm vi CNTT hoặc tài liệu không đủ thông tin để phân loại chắc chắn.

### 6.5.3. Chuẩn hóa subtopics/tags

Vì AI có thể sinh ra nhiều tên khác nhau cho cùng một khái niệm, hệ thống cần cơ chế canonical tag.

Ví dụ AI có thể sinh:

```text
RAG
Retrieval Augmented Generation
retrieval-augmented generation
retrieval augmented generation systems
```

Các tag trên cần được gom về một tag chuẩn:

```text
Canonical tag: Retrieval Augmented Generation
Aliases: RAG, retrieval-augmented generation, retrieval augmented generation systems
```

Quy tắc xử lý tag:

- Normalize bằng code: lowercase, bỏ dấu, bỏ ký tự đặc biệt, bỏ khoảng trắng thừa.
- Check alias dictionary trong database.
- Dùng embedding similarity với pgvector để phát hiện tag gần nghĩa.
- Nếu độ tương đồng rất cao, hệ thống có thể gợi ý dùng tag cũ.
- Nếu độ tương đồng lưng chừng, đưa vào danh sách cần người dùng/admin review.
- Không auto-merge quá mạnh để tránh gộp nhầm các khái niệm liên quan nhưng không giống nhau, ví dụ `Machine Learning` và `Deep Learning`.

### 6.6. Semantic search

Người dùng có thể nhập truy vấn tự nhiên, ví dụ:

- "tài liệu dễ hiểu về SQL cho người mới"
- "research paper về deep learning"
- "slides về computer networks"
- "tài liệu về bảo mật ứng dụng web"

Hệ thống sẽ:

- Tạo embedding cho query.
- Tìm các document chunks gần nghĩa nhất bằng pgvector.
- Kết hợp với metadata filters nếu có.
- Trả về danh sách tài liệu phù hợp, có score và đoạn nội dung liên quan.
- Mỗi kết quả phải hiển thị vị trí của chunk trong tài liệu, ví dụ `Trang 18`, `Slide 7` hoặc `Chương 3: Neural Networks`.
- Khi người dùng mở kết quả, trang chi tiết phải hiển thị và làm nổi bật đúng chunk đã khớp.
- Với PDF, cung cấp liên kết mở file gốc tại đúng trang khi trình duyệt hỗ trợ `#page=N`.

Quyết định embedding cho MVP:

- Model mặc định: `BAAI/bge-m3`, chạy local qua một embedding service Python.
- Trên máy phát triển có CUDA, ưu tiên Quadro T2000 với batch size `2`; CPU batch size `4` là fallback.
- Benchmark 525 chunks cho thấy GPU batch 2 mất `490,629` giây, nhanh hơn CPU batch 2 khoảng `43,1%` và dùng khoảng `2,27 GiB` VRAM.
- `BGE-M3` chỉ dùng để tạo vector; LLM dùng cho phân loại, tóm tắt và giải thích kết quả là một thành phần riêng.
- MVP khóa embedding model là `BAAI/bge-m3` với vector 1024 chiều. CPU và GPU chỉ là hai thiết bị chạy cùng model, có thể chuyển đổi mà không cần migrate hoặc re-embed.

MVP sử dụng Vector RAG: truy vấn được chuyển thành vector, tìm các chunks gần nghĩa bằng pgvector rồi cung cấp ngữ cảnh cho LLM khi cần. Knowledge Graph không phải thành phần bắt buộc của RAG và chưa cần thiết cho mục tiêu tìm kiếm/gợi ý tài liệu của phiên bản này.

### 6.7. Recommendation theo Research Project

Người dùng tạo một project với:

- Tên project.
- Mô tả đề tài.
- Keywords hoặc research question.
- Mức độ mong muốn: beginner/intermediate/advanced hoặc auto.

Hệ thống gợi ý tài liệu bằng cách:

- Tạo embedding cho project topic.
- Tìm documents/chunks gần nghĩa.
- Lọc theo primary topic/difficulty nếu phù hợp.
- Ưu tiên các tài liệu có canonical tags liên quan với project topic.
- Dùng LLM tạo lý do vì sao tài liệu được gợi ý.

### 6.8. AI Provider Settings

Người dùng có thể cấu hình nhiều provider:

#### OpenAI Codex

Provider này được định hướng theo mong muốn sản phẩm: người dùng đăng nhập bằng OpenAI/Codex auth để sử dụng tác vụ AI nhanh, tiện lợi, tương tự các ứng dụng có luồng "Sign in with provider".

Trong implementation, provider này cần được tách thành một technical spike riêng vì cần xác minh cách tích hợp thực tế, luồng auth, token, giới hạn sử dụng và mức độ hỗ trợ chính thức cho web app bên thứ ba.

#### OpenRouter

Người dùng nhập:

- Display name.
- API key.
- Default model.
- Optional base URL nếu cần.

#### Ollama

Người dùng nhập:

- Display name.
- Base URL, mặc định `http://localhost:11434`.
- Default model.

API key không bắt buộc.

#### Custom API

Dùng cho endpoint và provider tùy biến.

Người dùng nhập:

- Display name.
- API key.
- Base URL.
- Default chat model.
- Default embedding model nếu có.

## 7. Yêu Cầu Phi Chức Năng

### 7.1. Bảo mật

- Mật khẩu phải hash, không lưu plain text.
- API key của provider phải được mã hóa hoặc tối thiểu không hiển thị plain text sau khi lưu.
- Mỗi user chỉ truy cập dữ liệu của mình.
- Upload file cần giới hạn dung lượng và định dạng.

### 7.2. Hiệu năng

- Xử lý file lớn bằng background job hoặc async job.
- Không gọi LLM lại nếu nội dung file không đổi.
- Chunks và embeddings cần cache trong database.
- Search cần trả kết quả nhanh với index pgvector.
- Việc tạo embedding được chạy khi tài liệu được upload hoặc thay đổi; truy vấn tìm kiếm chỉ cần tạo một embedding cho câu hỏi.

### 7.3. Khả năng mở rộng

- Provider AI cần được thiết kế theo interface chung.
- Có thể thêm provider mới sau này.
- Có thể thay pgvector bằng vector database khác nếu cần.
- Có thể bổ sung Knowledge Graph/GraphRAG sau MVP để xử lý các câu hỏi cần suy luận quan hệ giữa chủ đề, tác giả, phương pháp và tài liệu.

### 7.4. Khả năng giải thích trong báo cáo

Hệ thống cần có các phần có thể giải thích rõ:

- Tại sao cần chunking.
- Embedding là gì.
- Semantic search khác keyword search thế nào.
- LLM được dùng cho phần nào.
- Vì sao không train model từ đầu.
- Cách đánh giá primary topic/difficulty/search/tag normalization.

## 8. Evaluation

Cần tạo dataset nhỏ để đánh giá:

- 40-60 tài liệu test.
- Mỗi tài liệu có nhãn thủ công:
  - File type.
  - Primary topic đúng.
  - Difficulty đúng.

Chỉ số cần đo:

- Primary topic classification accuracy.
- Difficulty classification accuracy.
- Search quality trên 10 truy vấn mẫu.
- Tag normalization quality trên một số cặp tag/alias mẫu.

Ví dụ:

- 50 tài liệu test.
- AI phân loại đúng primary topic 41 tài liệu: accuracy 82%.
- AI đánh giá đúng difficulty 38 tài liệu: accuracy 76%.
- 8/10 search queries trả về tài liệu phù hợp trong top 5.
- 15/18 tag variants được gom đúng về canonical tags.

## 9. Tiêu Chí Chấp Nhận MVP

MVP được xem là thành công khi:

- User đăng ký/đăng nhập được.
- User upload được PDF, PPTX, DOCX, EPUB.
- Hệ thống trích xuất text và lưu document.
- Hệ thống tạo summary, keywords, primary topic, subtopics/tags, difficulty bằng LLM.
- Hệ thống tạo embeddings và semantic search được.
- Kết quả semantic search chỉ rõ vị trí nguồn và điều hướng đến đúng chunk; PDF mở được đúng trang.
- BGE-M3 chạy local và tạo vector ổn định trên máy phát triển; ưu tiên CUDA batch 2, fallback CPU batch 4 và embedding provider khác khi cần.
- Dashboard hiển thị thống kê cơ bản.
- User tạo project topic và nhận gợi ý tài liệu phù hợp.
- Hệ thống chuẩn hóa được tags cơ bản bằng normalize, alias và embedding similarity.
- User cấu hình được ít nhất OpenRouter, Ollama và Custom API.
- OpenAI Codex provider có màn hình/flow được thiết kế và có spike kết luận khả thi/không khả thi rõ ràng.
- Có evaluation dataset và bảng kết quả đánh giá trong báo cáo.
