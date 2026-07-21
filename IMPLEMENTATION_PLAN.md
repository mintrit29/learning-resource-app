# Implementation Plan - Nâng Cấp Smart Learning Resources Management System

## 1. Định Hướng Triển Khai

Dự án được rewrite thành web app mới bằng `Next.js + PostgreSQL + Prisma + Auth.js + pgvector`. Demo Streamlit và SQLite cũ đã được loại bỏ sau khi app mới ổn định.

Kiến trúc mục tiêu:

```text
Next.js App Router
  -> UI pages + API routes/server actions
  -> Auth.js authentication
  -> Prisma ORM
  -> PostgreSQL + pgvector
  -> Document processing pipeline
  -> AI provider abstraction
```

## 2. Kiến Trúc Hệ Thống

### 2.1. Tech stack

- Framework: Next.js App Router.
- Language: TypeScript.
- Styling: Tailwind CSS + component system riêng hoặc shadcn/ui.
- Auth: Auth.js với Prisma adapter.
- Database: PostgreSQL.
- ORM: Prisma.
- Vector search: pgvector.
- Default embedding model: `BAAI/bge-m3` chạy local.
- Embedding runtime: Python service dùng `FlagEmbedding` hoặc giao diện tương thích `sentence-transformers`.
- File storage MVP: local filesystem trong thư mục uploads.
- Background processing MVP: job status trong database + API/server task đơn giản.
- AI integration: provider abstraction dùng giao thức chat completions phổ biến khi có thể.
- Local deployment: Docker Compose điều phối web app, PostgreSQL/pgvector và embedding service.

### 2.2. Module chính

- Auth module.
- Dashboard module.
- Document upload module.
- Text extraction module.
- Chunking module.
- Embedding module.
- LLM analysis module.
- Taxonomy/tag normalization module.
- Semantic search module.
- AI provider settings module.
- Evaluation module.

## 3. Data Model Đề Xuất

### 3.1. User

Lưu tài khoản người dùng.

Fields chính:

- `id`
- `name`
- `email`
- `passwordHash`
- `createdAt`
- `updatedAt`

Nếu dùng Auth.js Prisma adapter, cần thêm các bảng/session fields theo yêu cầu Auth.js.

### 3.2. Document

Lưu metadata cấp tài liệu.

Fields chính:

- `id`
- `userId`
- `title`
- `originalFileName`
- `fileType`
- `filePath`
- `fileSize`
- `textContent`
- `language`
- `primaryTopic`
- `difficulty`
- `summary`
- `keywords`
- `analysisReason`
- `status`
- `createdAt`
- `updatedAt`

`status` gồm:

- `UPLOADED`
- `EXTRACTING`
- `EXTRACTED`
- `ANALYZING`
- `READY`
- `FAILED`

### 3.3. DocumentChunk

Lưu các chunk đã cắt từ document và embedding tương ứng.

Fields chính:

- `id`
- `documentId`
- `chunkIndex`
- `content`
- `tokenCount`
- `pageNumber`
- `sourceLabel`
- `embedding`
- `createdAt`

`embedding` dùng type pgvector `vector(1024)` theo output mặc định của `BGE-M3`. Trong MVP, kích thước này được khóa cố định để schema và index đơn giản, ổn định.

### 3.4. AiProvider

Lưu cấu hình provider của từng user.

Fields chính:

- `id`
- `userId`
- `type`
- `displayName`
- `baseUrl`
- `apiKeyEncrypted`
- `defaultChatModel`
- `defaultEmbeddingModel`
- `isActive`
- `authStatus`
- `createdAt`
- `updatedAt`

`type` gồm:

- `OPENROUTER`
- `OLLAMA`
- `CUSTOM`

### 3.5. Tag

Lưu canonical tags/subtopics đã được chuẩn hóa.

Fields chính:

- `id`
- `name`
- `normalizedName`
- `description`
- `embedding`
- `createdByUserId`
- `createdAt`
- `updatedAt`

Ví dụ:

```text
name: Retrieval Augmented Generation
normalizedName: retrieval augmented generation
```

### 3.6. TagAlias

Lưu các tên biến thể trỏ về một canonical tag.

Fields chính:

- `id`
- `tagId`
- `alias`
- `normalizedAlias`
- `createdAt`

Ví dụ:

```text
tag: Retrieval Augmented Generation
aliases: RAG, retrieval-augmented generation, retrieval augmented generation systems
```

### 3.7. DocumentTag

Lưu quan hệ nhiều-nhiều giữa document và tag.

Fields chính:

- `documentId`
- `tagId`
- `confidence`
- `source`
- `createdAt`

`source` gồm:

- `AI`
- `USER`
- `MERGED`

### 3.8. TagMergeReview

Lưu các trường hợp tag mới gần giống tag cũ nhưng chưa đủ chắc để tự gộp.

Fields chính:

- `id`
- `candidateTagName`
- `candidateNormalizedName`
- `candidateEmbedding`
- `suggestedTagId`
- `similarity`
- `status`
- `createdAt`
- `resolvedAt`

`status` gồm:

- `PENDING`
- `APPROVED`
- `REJECTED`

### 3.9. AnalysisJob

Theo dõi quá trình xử lý tài liệu.

Fields chính:

- `id`
- `documentId`
- `type`
- `status`
- `progress`
- `errorMessage`
- `startedAt`
- `finishedAt`

`type` gồm:

- `EXTRACT_TEXT`
- `ANALYZE_DOCUMENT`
- `EMBED_DOCUMENT`

### 3.10. Project/Recommendation legacy

Project và Recommendation từng được thử nghiệm để gom tài liệu theo đề tài, nhưng đã bị loại khỏi MVP vì trùng với luồng Hỏi tài liệu + AI chọn giúp. Schema có thể còn tồn tại trong migration cũ để tránh phá dữ liệu, nhưng route/UI/API chính không còn dùng.

### 3.12. SearchLog

Lưu log truy vấn để phục vụ evaluation và báo cáo.

Fields chính:

- `id`
- `userId`
- `query`
- `filters`
- `resultDocumentIds`
- `createdAt`

## 4. Pipeline Xử Lý Tài Liệu

### 4.1. Upload

Flow:

```text
User upload file
-> Validate file type/size
-> Save file vào uploads
-> Tạo Document với status UPLOADED
-> Tạo AnalysisJob EXTRACT_TEXT
```

Định dạng hỗ trợ:

- `.pdf`
- `.pptx`
- `.docx`
- `.epub`

Giới hạn upload MVP: tối đa 25 MB/file. Mức này được chọn để OCR và embedding không chạy quá lâu trên Docker/local. Nếu sau này có queue/worker production ổn định hơn, có thể tăng lên 50 MB.

### 4.2. Extract text

Flow:

```text
Document status EXTRACTING
-> Chọn extractor theo fileType
-> Extract text
-> Lưu textContent
-> Document status EXTRACTED
```

Thư viện/parser chốt cho MVP:

- PDF: `unpdf` để đọc text layer; fallback OCR từng trang/toàn file bằng Poppler + Tesseract khi text layer thiếu.
- PPTX: `jszip` + `cheerio` để đọc text trong slide XML.
- DOCX: `mammoth`.
- EPUB: `jszip` + `cheerio` để đọc XHTML/text trong EPUB.

Extractor trả về `sections[]` thay vì chỉ một chuỗi text:

```text
section.text
section.pageNumber  // PDF page hoặc PPTX slide
section.sourceLabel // "Trang 12", "Slide 5", "Chương 3", "Heading: ..."
```

Mapping vị trí:

- PDF: mỗi page là một section, `pageNumber` bắt đầu từ 1.
- PPTX: mỗi slide là một section, `pageNumber` lưu số slide.
- EPUB: mỗi spine item/chapter là một section; ưu tiên heading đầu tiên làm `sourceLabel`.
- DOCX: nhóm paragraphs theo heading gần nhất; lưu heading vào `sourceLabel`.

Parser hiện tại được giữ cho MVP vì đã đủ cho PDF/PPTX/DOCX/EPUB và có OCR fallback cho PDF scan/ảnh. Chỉ đổi thư viện nếu test tài liệu thật cho thấy một định dạng bị miss nội dung đáng kể.

### 4.3. Chunking

Mục tiêu chunking:

- Tài liệu dài không gửi thẳng toàn bộ vào LLM.
- Semantic search cần tìm theo đoạn nhỏ, không chỉ theo document.
- AI chọn giúp cần dựa trên các kết quả semantic search liên quan nhất.

Quy tắc MVP:

- Chunk theo character hoặc token gần đúng.
- Mỗi chunk khoảng 300-500 tokens; nếu parser chưa có tokenizer thì dùng giới hạn ký tự gần đúng và đo lại bằng benchmark.
- Overlap khoảng 10-15%.
- Chunk trong phạm vi từng section để không làm mất vị trí nguồn.
- Lưu `chunkIndex`, `content`, `pageNumber`, `sourceLabel`.

### 4.4. Embedding

Model mặc định của MVP là `BAAI/bge-m3`. Đây là model embedding đa ngôn ngữ chạy local, phù hợp với tài liệu tiếng Việt và tiếng Anh. `sentence-transformers` là thư viện/runtime, không phải một model riêng; implementation có thể dùng `FlagEmbedding` hoặc giao diện tương thích `sentence-transformers` tùy kết quả spike kỹ thuật.

Flow:

```text
For each chunk
-> Next.js gửi batch sang Python embedding service
-> BGE-M3 tạo vector 1024 chiều
-> Lưu vector vào DocumentChunk.embedding
-> Tạo pgvector index
```

Thứ tự ưu tiên:

- Mặc định: local `BGE-M3` qua Python embedding service.
- MVP không chuyển sang embedding model khác. Khi CUDA không khả dụng, cùng model BGE-M3 tự chạy bằng CPU.

Cần tách chat model và embedding model trong `AiProvider`, vì không phải model chat nào cũng tạo embedding tốt.

#### Cấu hình cho máy phát triển hiện tại

Máy phát triển: Intel Core i7-10850H, RAM 16 GB, NVIDIA Quadro T2000 4 GB VRAM.

- Máy đủ chạy BGE-M3 để phát triển, tạo dataset và demo đồ án.
- Ưu tiên CUDA trên máy phát triển sau khi benchmark xác nhận BGE-M3 dùng khoảng 2,27 GiB/4 GiB VRAM ở batch size 2.
- Chunk mục tiêu: khoảng 300-500 tokens, overlap 10-15%.
- Cấu hình đã chốt: GPU batch size `2`; CPU batch size `4` làm fallback.
- Lưu ý vận hành Docker: `docker compose up --build` dùng cấu hình CPU mặc định. Muốn ưu tiên GPU phải chạy `docker compose -f docker-compose.yml -f docker-compose.cuda.yml up --build`; nếu không dùng file override CUDA thì embedding service sẽ khởi động với `EMBEDDING_DEVICE=cpu`.
- Kết quả trên 525 chunks: GPU batch 2 `490,629` giây, CPU batch 2 `863,022` giây; GPU nhanh hơn khoảng `43,1%` (1,76 lần).
- Tạo embedding ở background khi upload; không tạo lại nếu nội dung và model không thay đổi.
- Không chạy đồng thời BGE-M3 với LLM local lớn nếu thiếu RAM/VRAM.

#### Phạm vi RAG

MVP dùng Vector RAG:

```text
Query -> query embedding -> pgvector tìm chunks gần nghĩa -> LLM nhận context khi cần
```

RAG không bắt buộc phải có Knowledge Graph. GraphRAG là phương án mở rộng kết hợp vector retrieval với graph traversal để trả lời các câu hỏi về quan hệ giữa thực thể. Phần này làm tăng đáng kể khối lượng trích xuất thực thể, chuẩn hóa quan hệ, kiểm tra sai lệch và vận hành graph database, nên chỉ đưa vào future work.

### 4.5. LLM analysis

LLM analysis tạo metadata cấp document.

Input:

- Tên file.
- Text đại diện: abstract/heading/chunks đầu + chunks có nội dung đầy đủ.
- Một số chunks search-representative nếu cần.

Output JSON:

```json
{
  "primaryTopic": "Machine Learning",
  "subtopics": ["Supervised Learning", "Model Evaluation"],
  "difficulty": "Intermediate",
  "summary": "Tóm tắt bằng tiếng Việt...",
  "keywords": ["keyword 1", "keyword 2"],
  "language": "English",
  "reason": "Lý do chọn primary topic và difficulty..."
}
```

Sau khi có output:

- Validate primaryTopic/difficulty theo enum.
- Đưa subtopics qua taxonomy/tag normalization module.
- Lưu vào Document.
- Cho user sửa lại nếu AI sai.

### 4.5.1. Resume và retry theo từng bước

- Nút `Xử lý phần còn thiếu` gọi endpoint cấp document; UI không cần chọn job kỹ thuật.
- Backend kiểm tra text, chunks, embedding còn null và metadata AI để tìm bước cần chạy.
- Nếu embedding đã đủ nhưng AI lỗi, chỉ tạo lại `ANALYZE_DOCUMENT`.
- Nếu embedding còn thiếu, tiếp tục các chunk null rồi mới chạy AI nếu cần.
- Tài liệu cũ chưa có text/chunks được chạy lại từ bước sớm nhất cần thiết.
- Giữ lịch sử job cũ; mỗi lần retry tạo job mới và bị chặn nếu còn job đang chạy.

### 4.6. Taxonomy và tag normalization

Mục tiêu:

- Giữ primary topic cố định để dễ filter, dashboard và evaluation.
- Cho AI sinh subtopics/tags linh hoạt.
- Tránh việc AI tạo nhiều tag khác tên nhưng cùng nghĩa.

Flow xử lý tag mới:

```text
AI sinh subtopics/tags
-> Normalize text bằng TypeScript function
-> Check exact match với Tag.normalizedName
-> Check TagAlias.normalizedAlias
-> Nếu chưa khớp, tạo embedding cho tag mới
-> So sánh với Tag.embedding bằng pgvector
-> similarity >= 0.90: gợi ý dùng canonical tag cũ
-> 0.78 <= similarity < 0.90: tạo TagMergeReview PENDING
-> similarity < 0.78: tạo Tag mới
-> Tạo DocumentTag
```

Normalize function cần xử lý:

- Lowercase.
- Bỏ dấu tiếng Việt.
- Bỏ ký tự đặc biệt.
- Chuẩn hóa khoảng trắng.
- Chuẩn hóa alias phổ biến nếu có trong dictionary.

Alias dictionary seed ban đầu:

```text
AI -> Artificial Intelligence
ML -> Machine Learning
DL -> Deep Learning
NLP -> Natural Language Processing
RAG -> Retrieval Augmented Generation
DBMS -> Database Management System
OS -> Operating Systems
CV -> Computer Vision
```

Không nên dùng LLM để tự merge tất cả tags. LLM chỉ nên hỗ trợ các trường hợp mơ hồ, hoặc dùng trong UI để giải thích vì sao hai tag có thể liên quan. Quyết định merge cuối cùng nên do rule + embedding threshold + user/admin review.

## 5. AI Provider Abstraction

### 5.1. Interface chung

Cần tạo interface logic:

```text
chat(messages, options) -> text/json
embed(texts, options) -> vectors
testConnection() -> status
listModels()? -> models
```

Tất cả provider cần được wrap qua interface này để các module analysis/search/AI chọn giúp không phụ thuộc trực tiếp vào OpenRouter/Ollama/Custom.

### 5.2. OpenRouter provider

UI fields:

- Display name.
- API key.
- Default chat model.
- Default embedding model.
- Base URL mặc định: `https://openrouter.ai/api/v1`.

Behavior:

- Dùng chat completions API của OpenRouter.
- Test connection bằng request nhỏ.
- Hiện trạng thái connected/error.

### 5.3. Ollama provider

UI fields:

- Display name.
- Base URL mặc định: `http://localhost:11434`.
- Default chat model.
- Default embedding model.

Behavior:

- API key không bắt buộc.
- Có nút refresh/list models.
- Cần thông báo rõ: Ollama local chỉ hoạt động nếu app server truy cập được máy đang chạy Ollama.

### 5.4. Custom provider

UI fields:

- Display name.
- API key.
- Base URL.
- Default chat model.
- Default embedding model.

Behavior:

- Custom API cần cung cấp endpoint `models` và `chat/completions` theo giao thức ứng dụng hỗ trợ.
- Nếu provider không có embedding endpoint, search semantic sẽ báo thiếu embedding provider.

## 6. UI/UX Pages

### 6.1. Auth

Routes:

- `/login`
- `/register`

Chức năng:

- Đăng nhập email/password.
- Đăng ký tài khoản.
- Hiện lỗi đăng nhập rõ ràng.

### 6.2. Dashboard

Route:

- `/dashboard`

Nội dung:

- Cards thống kê tổng quan.
- Chart tài liệu theo primary topic.
- Chart tài liệu theo difficulty.
- Bảng tài liệu mới upload.
- Trạng thái provider active.

### 6.3. Upload

Route:

- `/upload`

Nội dung:

- Drag/drop upload.
- Hiện file type/size.
- Hiện status xử lý.
- Link sang document detail sau khi upload.

### 6.4. Documents

Routes:

- `/documents`
- `/documents/[id]`

List page:

- Search box.
- Filters: primary topic, difficulty, file type, status.
- Table/list tài liệu.

Detail page:

- Metadata.
- Summary.
- Keywords.
- Primary topic/difficulty.
- Subtopics/tags.
- Preview text.
- Chunks liên quan.
- Nút re-analyze.
- Nút delete.
- Form edit primary topic/difficulty.

### 6.5. Semantic Search

Route:

- `/search`

Nội dung:

- Query input.
- Filters.
- Kết quả có score.
- Hiện snippet chunk liên quan.
- Hiện `sourceLabel` của chunk và link tới `/documents/[id]?chunk=[chunkId]#matched-chunk`.
- Trang document detail hiển thị matched chunk riêng và làm nổi bật vị trí.
- Route file bảo mật `/api/documents/[id]/file` chỉ phục vụ file của user đang đăng nhập; PDF hỗ trợ fragment `#page=N`.
- Link sang document detail.
- Có nút AI đọc nhanh các kết quả semantic search hiện tại và chia thành `nên đọc trước`, `đọc thêm nếu cần`, `có thể bỏ qua`.
- AI lọc kết quả dùng chung active chat provider với module phân tích tài liệu; nếu provider lỗi thì semantic search gốc vẫn hoạt động.

### 6.6. AI chọn giúp kết quả tìm kiếm

Routes:

- `/search`
- `/api/search/curate`

Chức năng:

- Sau khi semantic search có kết quả, dùng active chat provider đọc top kết quả.
- Phân nhóm kết quả thành nên đọc trước, đọc thêm hoặc có thể bỏ qua.
- Hiện lý do ngắn gọn để người dùng đỡ phải tự đọc từng đoạn không liên quan.

### 6.7. AI Provider Settings

Route:

- `/settings/ai-providers`

UI cần có:

- Danh sách providers đã thêm.
- Provider active.
- Nút add provider.
- Modal chọn provider type.
- Form riêng cho OpenRouter, Ollama và Custom API.
- Nút test connection.
- Nút set active.

Flow tham khảo:

```text
Add Provider
-> Chọn OpenRouter / Ollama / Custom
-> Điền thông tin hoặc Sign in
-> Test connection
-> Save
-> Set active
```

### 6.8. Tag Management

Route:

- `/settings/tags`

Chức năng MVP:

- Xem danh sách canonical tags.
- Xem aliases của từng tag.
- Đổi tên canonical tag.
- Merge hai tag.
- Duyệt danh sách TagMergeReview.
- Approve/reject tag merge suggestions.

## 7. Ứng Dụng Hiện Tại

### 7.1. Cấu trúc ứng dụng

Tạo project Next.js mới trong repo, ví dụ:

```text
learning-resource-app/
```

App mới sẽ chứa:

- Next.js source.
- Prisma schema.
- Upload pipeline.
- AI providers.
- Dashboard.

## 8. Roadmap Theo Tuần

Deadline: 20/09. Mốc bắt đầu: 18/06. Tổng thời gian khoảng 13 tuần.

### Tuần 1-2: Nền tảng app mới

- Scaffold Next.js + TypeScript.
- Cài Tailwind/component system.
- Cài Prisma + PostgreSQL.
- Cài Auth.js.
- Tạo layout dashboard.
- Tạo schema ban đầu cho User, Document, AiProvider.

### Tuần 3-4: Upload và extract text

- Làm upload page.
- Lưu file local.
- Hỗ trợ PDF, PPTX, DOCX, EPUB.
- Lưu textContent.
- Tạo status/job tracking.
- Hiện document detail có preview text.

### Tuần 5-6: Chunking, embeddings, pgvector

- Thêm DocumentChunk schema.
- Cài pgvector extension và index.
- Làm chunking.
- Làm embedding provider interface.
- Tạo Python embedding service chạy BGE-M3.
- Benchmark BGE-M3 trên CPU/GPU với batch size `2`, `4`, `8`; ghi thời gian và mức dùng RAM/VRAM. Đã chốt GPU batch 2, CPU batch 4 fallback.
- Tạo embeddings cho chunks.
- Làm semantic search API.
- Làm search UI.

### Tuần 7-8: LLM analysis và provider settings

- Làm provider abstraction.
- Làm OpenRouter provider.
- Làm Ollama provider.
- Làm Custom provider.
- Làm UI add/edit/test provider.
- Chuyển prompt phân tích từ demo Streamlit sang TypeScript.
- Lưu primaryTopic/difficulty/summary/keywords/reason.
- Lưu subtopics/tags từ AI.
- Làm taxonomy/tag normalization cơ bản.

### Tuần 9: Taxonomy

- Hoàn thiện canonical tags, aliases và document tags.
- So sánh tag bằng embedding similarity.
- Tạo hàng đợi review và giao diện approve/reject đề xuất gộp tag.

### Tuần 10: Đơn giản hóa luồng tìm tài liệu

- Loại Project/Đề tài khỏi UI vì trùng với Hỏi tài liệu.
- Giữ trọng tâm vào semantic search và AI chọn giúp kết quả top đầu.
- Không xóa schema legacy ngay để tránh migration rủi ro.

### Tuần 11: Evaluation

- Tạo evaluation dataset 40-60 tài liệu.
- Tạo file nhãn thủ công trong `learning-resource-app/evaluation/labels.json`.
- Dùng `npm run eval:template` để sinh file nhãn từ tài liệu đã xử lý trong database.
- Người thực hiện dự án duyệt thủ công `expectedPrimaryTopic`, `expectedDifficulty` và danh sách relevant documents/chunks cho search queries.
- Dùng `npm run eval:week11` để tính primary topic accuracy, difficulty accuracy, search top-k relevance, semantic-vs-keyword comparison và tag/alias normalization samples.
- Lưu kết quả vào `learning-resource-app/evaluation/results/week11-evaluation-report.md` và `.json` để đưa vào báo cáo.

### Tuần 12: Polish và error handling

- Cải thiện dashboard.
- Cải thiện loading/progress states.
- Cải thiện thông báo lỗi provider/file extraction.
- Thêm delete/re-analyze/edit metadata.
- Kiểm tra UI responsive.
- Docker hóa web app và embedding service.
- Tạo root Docker Compose chạy web + PostgreSQL/pgvector + embedding service bằng một lệnh.
- Dùng volume cho uploads, database và BGE-M3 model cache.
- Cấu hình CPU mặc định và CUDA profile tùy chọn.

### Tuần 13: Báo cáo và demo

- Chuẩn bị demo script.
- Chuẩn bị screenshots.
- Chuẩn bị bảng evaluation.
- Viết phần giải thích NLP/LLM/semantic search.
- Fix bugs cuối.

## 9. Test Plan

### 9.1. Unit tests

Cần test:

- Chunking không mất nội dung.
- Chunk overlap đúng.
- Parse AI JSON xử lý được response có markdown/code fence.
- Normalize primaryTopic/difficulty đúng enum.
- Normalize tag text đúng.
- Check alias dictionary đúng.
- Tag similarity threshold tạo đúng kết quả merge/review/new tag.
- Provider validation cho OpenRouter/Ollama/Custom.

### 9.2. Integration tests

Cần test:

- Upload PDF -> extract -> lưu Document.
- Upload PPTX -> extract -> lưu Document.
- Upload DOCX -> extract -> lưu Document.
- Upload EPUB -> extract -> lưu Document.
- Analyze document -> lưu metadata.
- Embed chunks -> lưu vector.
- AI sinh subtopics -> hệ thống tạo canonical tags/document tags.
- Tag gần giống alias cũ -> hệ thống gắn vào tag cũ.
- Tag similarity lưng chừng -> hệ thống tạo TagMergeReview.
- Semantic search -> trả về kết quả.
- Search result trả đúng page/slide/chapter/heading và điều hướng đúng matched chunk.
- AI chọn giúp -> phân nhóm kết quả thành nên đọc trước, đọc thêm nếu cần hoặc có thể bỏ qua.

### 9.3. Acceptance tests

Kịch bản demo:

1. User đăng ký tài khoản.
2. User đăng nhập.
3. User thêm OpenRouter provider.
4. User upload một PDF về SQL.
5. Hệ thống extract text và analyze.
6. Dashboard hiện document mới.
7. User search "tài liệu dễ hiểu về SQL cho người mới".
8. Hệ thống trả về tài liệu SQL với difficulty phù hợp.
9. User bấm `AI chọn giúp` sau khi có kết quả semantic search.
10. Hệ thống gợi ý kết quả nên đọc trước, đọc thêm nếu cần hoặc có thể bỏ qua.

### 9.4. Evaluation tests

Cần chuẩn bị:

- 40-60 tài liệu test.
- File label thủ công có cột:
  - `file_name`
  - `expected_primary_topic`
  - `expected_difficulty`
- Chạy AI analysis trên dataset.
- Tính:
  - Primary topic accuracy.
  - Difficulty accuracy.
  - Search top-k relevance.

## 10. Rủi Ro Và Cách Xử Lý

### 10.1. Extract text từ file lỗi

Cách xử lý:

- Hiện lỗi rõ cho user.
- Ghi status FAILED.
- Chỉ hỗ trợ file có text layer trong MVP.
- Nếu PDF có trang nhưng gần như không có text, báo rõ là tài liệu scan/ảnh cần OCR.
- OCR cho PDF scan đã có trong web container bằng Poppler + Tesseract. Text layer vẫn được ưu tiên; OCR chỉ chạy khi PDF gần như không có text.
- OCR hiện giới hạn bằng `OCR_MAX_PAGES` để tránh treo app với PDF scan quá dài; mặc định dùng `OCR_LANGS=vie+eng`.

### 10.2. Giữ embedding model đồng nhất

Cách xử lý:

- MVP khóa model mặc định là BGE-M3 và cột vector ở `1024` chiều.
- Chat provider không quyết định embedding model; embedding provider được cấu hình riêng.
- CPU và GPU tạo vector bằng cùng BGE-M3 nên có thể chuyển thiết bị mà không cần migration hoặc re-embedding.
- MVP không hỗ trợ đổi embedding model để tránh trộn kích thước vector trong cùng index.

### 10.3. LLM trả về JSON lỗi

Cách xử lý:

- Clean markdown/code fence.
- Retry một lần với prompt sửa lỗi JSON.
- Nếu vẫn lỗi, lưu job FAILED và cho user re-analyze.

### 10.4. Docker GPU không hoạt động trên mọi máy

Cách xử lý:

- Compose mặc định dùng CPU để chạy được trên đa số máy.
- CUDA được tách thành profile tùy chọn và yêu cầu NVIDIA Container Toolkit/WSL2.
- CPU và GPU dùng cùng BGE-M3 nên không cần migration hoặc re-embed.

### 10.5. Dự án bị rộng

Cách xử lý:

- Ưu tiên pipeline end-to-end trước.
- Knowledge Graph, GraphRAG và chatbot RAG nâng cao để future work.
- Giữ đúng ba chat provider: OpenRouter, Ollama và Custom API.

### 10.6. Các hướng không làm tiếp

Không đưa vào roadmap hiện tại:

- Quota/usage provider.
- Admin/storage dashboard để xem dung lượng hoặc quản trị storage.
- Import/export, backup dữ liệu, export notes/summary/flashcards/mindmap.
- Multi-user nâng cao, phân quyền nhiều vai trò hoặc chia sẻ project/tài liệu.

### 10.7. Roadmap cải tiến sau MVP

Ưu tiên phát triển tiếp theo:

1. Làm giao diện dễ dùng hơn theo luồng `Tải tài liệu -> AI phân tích -> Hỏi/tìm kiếm -> mở đoạn gốc`.
2. Cải thiện preview/mở file gốc, đặc biệt PDF mở trực tiếp và DOCX/PPTX có hướng dẫn rõ khi trình duyệt tải file.
3. Tối ưu OCR cho PDF scan/ảnh/tài liệu không có text layer nếu cần xử lý tài liệu scan dài.
4. Giữ tiến trình xử lý cố định; khi chạy lại chỉ đổi trạng thái/màu, không sinh thêm dòng dài.
5. Cho phép chạy lại đúng phần lỗi/còn thiếu: extraction, AI analysis, embedding hoặc search metadata.
6. Cải thiện AI Provider settings: test kết nối/model và thông báo lỗi dễ hiểu.
7. Tối ưu embedding CPU/GPU, batch size và ước tính thời gian xử lý.
8. Cải thiện semantic search: ưu tiên hỏi tự nhiên, AI chọn giúp top kết quả và không hiện bộ lọc nâng cao ở UI chính.
9. Cải thiện hỏi đáp với tài liệu: trích dẫn nguồn rõ và mở đúng trang/chunk.
10. Loại Project/Đề tài khỏi UI, tập trung vào Hỏi tài liệu + AI chọn giúp.
11. Chuẩn hóa test/release: test case demo, seed demo và CI build Docker.

## 11. Definition of Done

Dự án nâng cấp được xem là hoàn thành khi:

- App Next.js chạy được.
- PostgreSQL + Prisma schema ổn định.
- Auth.js login/register hoạt động.
- Upload 4 định dạng hoạt động ở mức MVP.
- AI analysis tạo được primaryTopic/difficulty/summary/keywords/subtopics.
- Canonical tags/aliases/document tags hoạt động ở mức cơ bản.
- Embedding và pgvector semantic search hoạt động.
- BGE-M3 local là embedding mặc định, có benchmark trên máy phát triển và có fallback được tài liệu hóa.
- AI chọn giúp kết quả tìm kiếm hoạt động.
- `docker compose up --build` khởi động được toàn bộ hệ thống trên cấu hình CPU mặc định.
- AI Provider settings có OpenRouter, Ollama và Custom.
- Có evaluation dataset và kết quả đo lường.
- Có demo script cho ngày bảo vệ.

## 12. Cập nhật triển khai tuần 12

- Dashboard đã có cards tổng quan, biểu đồ phân bổ topic/difficulty/status và trạng thái AI provider active.
- Trang tài liệu đã có filter theo từ khóa, topic, difficulty, file type và status.
- Trang chi tiết tài liệu đã có khu `File gốc`: PDF xem trực tiếp trong app; DOCX/PPTX/EPUB dùng nút tải rõ ràng vì trình duyệt thường không preview inline.
- PDF scan/ảnh có thể fallback sang OCR bằng Poppler + Tesseract trong Docker web container.
- Semantic search API vẫn hỗ trợ filter nội bộ khi cần, nhưng UI Hỏi tài liệu đã bỏ bộ lọc nâng cao để người dùng phổ thông dễ dùng hơn.
- Trang chi tiết tài liệu có hai luồng riêng:
  - `Xử lý phần còn thiếu`: chỉ chạy lại extraction/chunking/embedding/AI nếu bước đó thiếu hoặc lỗi.
  - `Phân tích AI lại`: giữ nguyên text/chunk/embedding và chỉ chạy lại AI analysis.
- Tiến trình xử lý hiển thị cố định 4 bước; chạy lại chỉ reset/update job theo type thay vì thêm dòng mới trên UI.
- AI Provider test/model loading đã parse lỗi HTTP/provider thành thông báo dễ hiểu hơn: API key, quyền model/quota, sai endpoint/model, rate limit hoặc lỗi server.
- Trang chi tiết tài liệu hiển thị ước tính thời gian embedding theo CPU/GPU và batch size hiện tại.
- Danh sách primary topic trong code đã đồng bộ với PRD; AI analysis hiện trả về và lưu `language` của tài liệu.
- Semantic search đã lưu `SearchLog` gồm query, filter nội bộ nếu có và danh sách document trả về để hỗ trợ evaluation/báo cáo.
- Semantic search có nút AI lọc kết quả: dùng provider đang active để gợi ý kết quả nên đọc trước, đọc thêm hoặc có thể bỏ qua.
- Trang quản lý tags đã có gộp tag thủ công: chuyển aliases/tài liệu sang tag giữ lại rồi xóa tag nguồn.
- Kết quả hỏi/tìm tài liệu hiển thị citation rõ (`Nguồn: tài liệu · trang/slide/chương`) và CTA mở đúng matched chunk.
- Project/Đề tài đã được gỡ khỏi UI/API chính vì trùng với Hỏi tài liệu; app tập trung vào AI chọn giúp kết quả tìm kiếm.
- Test/release đã có `TEST_CASES.md`, script `npm run demo:seed` và GitHub Actions CI chạy lint, unit tests, build, Docker build web.
- Upload kiểm tra thêm chữ ký file, không chỉ dựa vào phần mở rộng.
- Unit test được gom vào `npm run test:unit`; integration smoke tests được gom vào `npm run test:integration`.
- Docker deployment:
  - Root `docker-compose.yml` chạy web + PostgreSQL/pgvector + embedding service bằng CPU mặc định.
  - `docker-compose.cuda.yml` là override tùy chọn cho máy có NVIDIA GPU.
  - Khi muốn dùng GPU, luôn chạy kèm cả hai file compose: `docker compose -f docker-compose.yml -f docker-compose.cuda.yml up --build`.
  - Web app và embedding service đều có Dockerfile riêng, uploads/database/model cache dùng Docker volume.
- Bước xác minh dài còn lại: chạy `docker compose up --build`, kiểm tra responsive bằng browser và chạy integration/e2e sau khi services sẵn sàng.

### 12.1. Xác minh tuần 12 đã hoàn tất

- `npm.cmd run lint` pass.
- `npm.cmd run test:unit` pass.
- `npm.cmd run test:integration` pass trên DB Docker sạch với smoke tests tự seed/dọn dữ liệu.
- `npm.cmd run build` pass.
- `docker compose build web` pass sau khi bổ sung OpenSSL/CA certificates cho Prisma trong container.
- `docker compose up -d web` khởi động web + PostgreSQL/pgvector + embedding service thành công.
- HTTP `localhost:3000` trả 200.
- Embedding health ready với `BAAI/bge-m3`, CPU, batch 4, 1024 dimensions.
- Browser check pass cho dashboard, search filters và responsive mobile DOM.

## Cập nhật 16/07/2026 - Implementation plan cho Evidence Search

> **Trạng thái tài liệu:** Đây là change plan cho bản nâng cấp trên search MVP hiện tại, không phải plan cho module độc lập. Các API, component và schema hiện có phải được ưu tiên tái sử dụng. Sau khi hoàn thành và kiểm thử, phần này sẽ được hợp nhất vào các mục pipeline search, UI search, test plan và Definition of Done chính.

### 1. Nguyên tắc triển khai

Giữ nguyên pipeline upload, chunking, BGE-M3 và pgvector. Chỉ nâng cấp lớp search/retrieval và thêm bước trả lời có dẫn chứng. Không gửi toàn bộ tài liệu vào LLM.

### 2. Pipeline mới

```text
POST /api/search
-> parse query
-> query understanding (optional metadata extraction)
-> vector candidates từ pgvector
-> keyword candidates từ PostgreSQL full-text search
-> merge bằng Reciprocal Rank Fusion hoặc weighted score
-> deduplicate và group theo document
-> rerank top 20
-> trả top 40 result chunks cho UI

POST /api/search/answer
-> nhận query và top results đã kiểm chứng
-> chọn tối đa 8 chunks làm context
-> gọi active chat provider
-> parse JSON answer + citations
-> validate citation chỉ trỏ tới chunk đã gửi
```

### 3. Backend modules

- Tạo hàm `searchByVector` chứa truy vấn pgvector hiện tại.
- Tạo hàm `searchByKeyword` dùng PostgreSQL `tsvector`/`tsquery` hoặc cơ chế full-text tương đương.
- Tạo hàm `mergeSearchCandidates` để hợp nhất hai danh sách và loại trùng chunk.
- Tạo hàm `rankSearchResults` với điểm thành phần rõ ràng; không coi điểm là accuracy.
- Tạo schema request/response cho `/api/search/answer`.
- Tạo prompt bắt buộc LLM chỉ dùng context, trả `answer`, `citations`, `confidence`, `notEnoughEvidence`.
- Validate mọi citation bằng `chunkId` trong tập context đã gửi.
- Giữ `SearchLog`, bổ sung mode, candidate count và answer generation status nếu cần.

### 4. UI/UX

- Giữ ô hỏi tự nhiên hiện tại.
- Hiển thị các tiêu chí query được suy ra dưới dạng chip chỉnh được; nếu chưa làm query understanding tự động thì để sau rerank.
- Đổi cách hiển thị `87%` thành `Mức phù hợp` hoặc thanh điểm không gây hiểu nhầm là độ chính xác.
- Thêm nút `Trả lời có dẫn chứng` sau khi có kết quả.
- Hiển thị answer ở đầu, citation bên dưới mỗi ý và link mở đúng chunk/trang.
- Có trạng thái `Không đủ bằng chứng trong thư viện`.
- Cho phép chuyển giữa `Kết quả theo đoạn` và `Kết quả theo tài liệu`.

### 5. Thứ tự làm để giảm rủi ro

1. Sửa nhãn score và kiểm tra retrieval hiện tại.
2. Thêm keyword search và merge với vector search.
3. Thêm rerank/group theo document.
4. Thêm answer API có citation.
5. Tích hợp UI, loading, lỗi provider và empty state.
6. Chạy evaluation so sánh search cũ và mới.

### 6. Không làm trong đợt này

- Không đưa nguyên tài liệu vào prompt.
- Không làm GraphRAG/knowledge graph.
- Không fine-tune hoặc train model.
- Không xây chatbot hội thoại dài hạn.
- Không thêm recommendation/project workspace riêng.
# UX Simplification - Cải tiến giao diện dễ dùng

Mục tiêu của đợt cải tiến này là đổi app từ giao diện thiên về kỹ thuật sang luồng thao tác dễ hiểu cho người không rành AI/NLP.

Nguyên tắc:

- Người dùng mới phải hiểu ngay 3 việc chính: kết nối AI, thêm tài liệu, hỏi/tìm trong tài liệu.
- Mỗi trang chỉ nên có một hành động chính nổi bật.
- Các thuật ngữ kỹ thuật được đổi thành tiếng Việt gần gũi hoặc đưa xuống mô tả phụ.
- Empty state phải hướng dẫn rõ “bấm gì tiếp”.
- Không thêm tính năng backend mới nếu chỉ cần cải thiện luồng và wording.

Phạm vi triển khai trước:

- Đổi label sidebar: `Tải lên` thành `Thêm tài liệu`, `Tìm kiếm` thành `Hỏi tài liệu`; bỏ `Đề tài` khỏi sidebar.
- Dashboard thêm khối checklist 3 bước và CTA theo trạng thái hiện tại.
- Trang upload đổi wording thành “Thêm tài liệu”, giải thích sau khi tải app sẽ tự đọc nội dung và phân tích.
- Trang search đổi wording thành “Hỏi tài liệu”, thêm ví dụ mẫu, bỏ bộ lọc nâng cao khỏi UI để người dùng chỉ tập trung vào câu hỏi tự nhiên và nút “AI chọn giúp”.
- Chuẩn hóa nhãn độ khó trên UI sang tiếng Việt: `Cơ bản`, `Trung cấp`, `Nâng cao`; chỉ giữ `BEGINNER/INTERMEDIATE/ADVANCED` ở schema, API và prompt kỹ thuật.
- Gỡ trang projects/Đề tài khỏi MVP để UI gọn và tránh trùng chức năng với Hỏi tài liệu.
- Trang settings/provider đổi wording thành “Kết nối AI”, giải thích OpenRouter/Ollama/Custom theo ngôn ngữ dễ hiểu.
- Sửa các chuỗi tiếng Việt bị lỗi mã hóa ở các màn hình chính được chỉnh sửa.

Phạm vi sau:

- Gộp upload vào trang tài liệu bằng modal hoặc panel nội tuyến.
- Thêm guided tour ngắn lần đầu mở app.
- Làm provider wizard nhiều bước nếu modal hiện tại vẫn quá dày.
- Tối ưu responsive/mobile sau khi chốt desktop UX.

## Cập nhật 10/07/2026 - Open topic taxonomy

Quyết định mới: `primaryTopic` không còn là enum cố định trong Computer Science/IT. App dùng cơ chế chủ đề mở có canonical name và alias:

- AI analysis trả về `topic` và `topicAliases`.
- Prompt gửi kèm danh sách topic đã có trong thư viện để AI ưu tiên dùng lại tên chuẩn cũ.
- Backend chạy normalize bằng code: viết thường, bỏ dấu, dọn ký tự đặc biệt, chuẩn hóa khoảng trắng.
- Backend kiểm tra `Tag.normalizedName` và `TagAlias.normalizedAlias`.
- Nếu khớp topic/alias đã có, `Document.primaryTopic` lưu tên chuẩn cũ.
- Nếu không khớp, backend tạo canonical tag mới, lưu embedding và lưu alias do AI đề xuất.
- User vẫn có thể sửa topic thủ công trong trang chi tiết; topic sửa tay cũng đi qua canonicalizer.
- `subtopics` và `keywords` đã bị loại khỏi schema/app chính để UI không rối; app chỉ giữ `primaryTopic` và alias chủ đề.

Luồng triển khai:

```text
AI phân tích tài liệu
-> trả topic + topicAliases + difficulty + summary + subtopics + keywords
-> script normalize/check alias
-> nếu khớp: dùng canonical topic cũ
-> nếu chưa khớp: tạo canonical topic mới
-> lưu primaryTopic theo tên chuẩn
-> sync topic/subtopics vào Tag/DocumentTag
```

Ví dụ:

```text
AI trả "Ngữ văn"
TagAlias đã có "Ngữ văn" -> canonical tag "Văn học"
Document.primaryTopic = "Văn học"
```

## Cập nhật 12/07/2026 - Search result controls và alias collapse

- `/api/search` nhận `chunksPerDocument` để giới hạn số chunk tối đa cho mỗi tài liệu.
- UI `/search` chỉ cho người dùng chỉnh `Mỗi tài liệu tối đa`: 1, 2, 3 hoặc 5 đoạn.
- Không hiển thị tùy chọn tổng số đoạn; API dùng giới hạn nội bộ để tránh trả quá nhiều chunk trong một lần tìm.
- Giới hạn nội bộ hiện là 40 chunk/search. Khi số kết quả vượt 40 chunk, backend ưu tiên các kết quả có điểm semantic cao hơn; tài liệu/đoạn điểm thấp có thể không xuất hiện.
- Search API vẫn lấy candidate bằng pgvector rồi lọc theo số chunk/tài liệu trước khi trả kết quả.
- `SearchLog.filters` lưu `chunksPerDocument` và giới hạn nội bộ để phục vụ evaluation/debug.
- Trang `/settings/tags` thu gọn alias: mặc định hiện 6 alias đầu, alias còn lại hiển thị bằng nút `+n tên khác`.
- Không triển khai runtime UI cho GPU/CPU batch trong đợt này; batch tiếp tục là cấu hình vận hành Docker/env.

## Cập nhật 21/07/2026 - Search Relevance Gate và tách luồng tìm/hỏi

> **Quan hệ với bản cũ:** Đây là đợt hoàn thiện tiếp theo của Evidence Search ngày 16/07/2026. Không tạo module search mới và không thay đổi pipeline upload, extraction, chunking, BGE-M3 hoặc pgvector. Sau khi hoàn thành, phần này phải được gộp vào implementation plan chính của search để tài liệu chỉ mô tả một phiên bản cuối cùng.

### 1. Vấn đề cần sửa

- Retrieval hiện tại luôn giữ lại ứng viên tốt nhất trong thư viện, kể cả khi ứng viên đó có độ liên quan tuyệt đối thấp. Vì vậy truy vấn ngoài phạm vi như `tôi tìm khóa học trung cấp` vẫn có thể trả về một tài liệu Database không liên quan.
- Ngưỡng hiện tại phụ thuộc vào điểm cao nhất của chính lần tìm (`bestScore - 0.25`) và có sàn khá rộng, nên chỉ loại kết quả yếu hơn tương đối chứ chưa trả lời được câu hỏi quan trọng: kết quả tốt nhất có thực sự phù hợp hay không.
- Các đoạn bản quyền, mục lục, giới thiệu hoặc thông tin xuất bản có thể được đẩy lên do chứa tên/chủ đề tài liệu nhưng không cung cấp nội dung học thuật hữu ích.
- UI hiện gộp hai nhu cầu `tìm tài liệu` và `hỏi để lấy câu trả lời`, khiến nút `Trả lời từ kết quả` xuất hiện cả khi người dùng chỉ nhập một từ khóa chung.

### 2. Mục tiêu

- Giữ hybrid retrieval hiện có: vector search + keyword search.
- Thêm relevance gate tuyệt đối để kết quả yếu được trả về dưới dạng `không tìm thấy tài liệu phù hợp`.
- Rerank ứng viên bằng tín hiệu dễ giải thích và không phụ thuộc LLM: semantic score, keyword coverage, phrase match, metadata match và content quality.
- Phạt hoặc loại boilerplate như copyright, license, table of contents, about the book và publisher information khi có đoạn nội dung tốt hơn.
- Tách rõ hai trải nghiệm: `Tìm tài liệu` và `Hỏi tài liệu`.
- Không làm tăng đáng kể latency, chi phí AI hoặc VRAM của thao tác tìm kiếm.

### 3. Luồng retrieval mục tiêu

```text
Query
-> lấy tối đa 30 vector candidates và 30 keyword candidates
-> merge + deduplicate theo chunkId
-> tính semantic, keyword coverage, phrase và metadata signals
-> tính content-quality penalty cho boilerplate
-> rerank top candidates
-> relevance gate tuyệt đối
-> không đạt: trả empty result + reason code
-> đạt: group theo document và trả các tài liệu phù hợp
```

Luồng hỏi đáp dùng chung retrieval ở trên:

```text
Câu hỏi
-> retrieval + relevance gate
-> không có bằng chứng đạt ngưỡng: không gọi LLM
-> có bằng chứng: chọn tối đa 8 chunks
-> LLM trả lời chỉ từ context
-> validate citations
```

### 4. Thiết kế backend

1. Ghi lại baseline của 28 positive queries hiện có trước khi đổi thuật toán.
2. Bổ sung negative/out-of-scope queries, ví dụ tìm khóa học, thời tiết hoặc nội dung không tồn tại trong thư viện.
3. Tách scoring thành các hàm có thể unit test:
   - semantic relevance;
   - keyword/phrase coverage;
   - topic, difficulty và file type match;
   - boilerplate/content-quality penalty;
   - final acceptance decision.
4. Chỉ coi keyword là bằng chứng mạnh khi từ khóa khớp nội dung/chủ đề có ý nghĩa; không để việc lặp tên tài liệu trong boilerplate chi phối toàn bộ điểm.
5. Đặt ngưỡng tuyệt đối bằng kết quả evaluation, không chọn ngưỡng chỉ từ một ảnh hoặc một truy vấn đơn lẻ.
6. `/api/search` trả thêm trạng thái máy đọc được như `OK` hoặc `NO_RELEVANT_RESULTS`; không trả kết quả yếu chỉ để danh sách không bị rỗng.
7. `/api/search/answer` chỉ được gọi với các chunk đã vượt relevance gate; tiếp tục giữ cơ chế `notEnoughEvidence` ở lớp LLM như hàng rào thứ hai.
8. Giữ SearchLog và bổ sung thông tin cần cho debug/evaluation: query mode, best score, acceptance threshold và rejection reason. Không hiển thị các giá trị kỹ thuật này trên UI chính.

### 5. Thiết kế UI/UX

- Tạo hai chế độ rõ ràng trên cùng trang:
  - `Tìm tài liệu`: dành cho từ khóa/chủ đề như `database`, trả danh sách tài liệu và đoạn liên quan; không tạo câu trả lời AI.
  - `Hỏi tài liệu`: dành cho câu hỏi cụ thể; tự retrieval rồi tạo câu trả lời có citation nếu bằng chứng đạt ngưỡng.
- Đổi CTA theo chế độ thành `Tìm tài liệu` hoặc `Hỏi tài liệu`; bỏ nút trung gian `Trả lời từ kết quả`.
- Mỗi chế độ có placeholder và ví dụ riêng để người dùng hiểu cách nhập.
- Empty state phải phân biệt:
  - thư viện chưa có tài liệu;
  - không có kết quả đủ liên quan;
  - có tài liệu nhưng chưa đủ bằng chứng để trả lời;
  - AI provider chưa sẵn sàng.
- Giữ session persistence, mở đúng chunk/trang và nút `Xóa kết quả` đã có.

### 6. Evaluation và tiêu chí nghiệm thu

- Bộ positive queries hiện tại vẫn đạt Recall@5 bằng hoặc tốt hơn baseline đã lưu.
- Thêm tối thiểu 10 negative/out-of-scope queries; tỷ lệ từ chối đúng mục tiêu tối thiểu 90%.
- Query `tôi tìm khóa học trung cấp` không được trả tài liệu Database nếu thư viện không có tài liệu phù hợp.
- Query từ khóa như `database` được phép trả tài liệu để đọc nhưng không tự tạo câu trả lời AI.
- Câu hỏi cụ thể như `Database transaction rollback hoạt động thế nào?` phải tìm đúng đoạn trước khi gọi LLM.
- Boilerplate không đứng đầu nếu có chunk nội dung liên quan tốt hơn trong cùng tài liệu.
- Search thuần không gọi chat provider và không tăng đáng kể thời gian phản hồi so với hybrid search hiện tại.
- Unit test, integration/smoke test, lint, build Docker và browser test đều pass trước khi bàn giao.

### 7. Không làm trong đợt này

- Không thêm agent, HyDE, multi-query hoặc knowledge graph.
- Không thêm cross-encoder/model reranker riêng trong lần đầu vì máy hiện tại chạy embedding chủ yếu bằng CPU và cần giữ tài nguyên nhẹ.
- Không dùng LLM để quyết định mọi kết quả search.
- Không thay đổi embedding model hoặc re-embed toàn bộ tài liệu.
- Không mở rộng app thành công cụ tìm khóa học hoặc tìm dữ liệu trên Internet.
## Điều chỉnh sau kiểm thử UX: hợp nhất tìm kiếm - 21/07/2026

1. Bỏ hai tab tìm/hỏi khỏi giao diện.
2. Giữ hybrid retrieval keyword + vector cho mọi truy vấn.
3. Nhận diện câu hỏi ở server để chỉ gọi bước trả lời AI khi cần.
4. Giữ nguyên relevance gate, trích nguồn, lưu trạng thái và nút xóa kết quả.
5. Chạy unit, integration, lint, build và kiểm thử lại trên trình duyệt.
