# Implementation Plan - Nâng Cấp Smart Learning Resources Management System

## 1. Định Hướng Triển Khai

Dự án sẽ được nâng cấp theo hướng rewrite thành web app mới bằng `Next.js + PostgreSQL + Prisma + Auth.js + pgvector`, giữ demo Streamlit hiện tại làm reference.

Không sửa ngay `app.py` trong giai đoạn đầu. Thay vào đó:

- Giữ `app.py` và `documents.db` làm demo cũ.
- Tạo app Next.js mới trong repository.
- Sau khi app mới ổn định, viết script import dữ liệu từ SQLite sang PostgreSQL.

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
- AI integration: provider abstraction dùng OpenAI-compatible interface khi có thể.

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
- Recommendation module.
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

- `OPENAI_CODEX`
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

### 3.10. Project

Lưu Research Project của user.

Fields chính:

- `id`
- `userId`
- `title`
- `description`
- `keywords`
- `targetDifficulty`
- `createdAt`
- `updatedAt`

### 3.11. Recommendation

Lưu kết quả gợi ý tài liệu cho project.

Fields chính:

- `id`
- `projectId`
- `documentId`
- `score`
- `reason`
- `createdAt`

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

### 4.2. Extract text

Flow:

```text
Document status EXTRACTING
-> Chọn extractor theo fileType
-> Extract text
-> Lưu textContent
-> Document status EXTRACTED
```

Thư viện đề xuất:

- PDF: `pdf-parse` hoặc gọi Python extractor riêng nếu parser Node không ổn.
- PPTX: `pptx-parser` hoặc mammoth/unzip XML parser tùy khả dụng.
- DOCX: `mammoth`.
- EPUB: `epub2` hoặc unzip + parse XHTML.

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

Nếu Node extractor không ổn định, có thể tạo Python micro-script cho extraction và gọi từ Next.js bằng child process. Đây là phương án dự phòng, không phải kiến trúc chính.

### 4.3. Chunking

Mục tiêu chunking:

- Tài liệu dài không gửi thẳng toàn bộ vào LLM.
- Semantic search cần tìm theo đoạn nhỏ, không chỉ theo document.
- Recommendation cần dựa trên nội dung liên quan nhất.

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

Tất cả provider cần được wrap qua interface này để các module analysis/search/recommendation không phụ thuộc trực tiếp vào OpenRouter/Ollama/Custom.

### 5.2. OpenRouter provider

UI fields:

- Display name.
- API key.
- Default chat model.
- Default embedding model.
- Base URL mặc định: `https://openrouter.ai/api/v1`.

Behavior:

- Dùng OpenAI-compatible chat completions.
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

- Giả định provider tương thích OpenAI API.
- Cho phép dùng Custom OpenAI-compatible API.
- Nếu provider không có embedding endpoint, search semantic sẽ báo thiếu embedding provider.

### 5.5. OpenAI Codex provider

Mục tiêu sản phẩm:

- Cho phép người dùng đăng nhập OpenAI/Codex để thực hiện tác vụ AI tương tự flow OAuth/sign-in trong các app AI provider settings.
- UI có card `OpenAI Codex` với nút `Sign in with OpenAI Codex`.

Kế hoạch kỹ thuật:

- Tách thành spike riêng trong tuần 9.
- Xác minh cách lấy token/session hợp lệ, phạm vi sử dụng, giới hạn, và khả năng gọi tác vụ AI từ web app.
- Nếu không có API/OAuth public phù hợp cho web app bên thứ ba, fallback thành `OpenAI API provider` dùng API key hoặc ẩn tính năng Codex sau feature flag.

Quy tắc PRD:

- Vẫn giữ `OpenAI Codex` là provider mục tiêu theo yêu cầu sản phẩm.
- Không để nó chặn MVP; OpenRouter/Ollama/Custom phải chạy được trước.

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

### 6.6. Projects and Recommendations

Routes:

- `/projects`
- `/projects/[id]`

Chức năng:

- Tạo project.
- Nhập topic/description.
- Chạy recommendation.
- Hiện danh sách tài liệu gợi ý.
- Hiện lý do AI đề xuất.

### 6.7. AI Provider Settings

Route:

- `/settings/ai-providers`

UI cần có:

- Danh sách providers đã thêm.
- Provider active.
- Nút add provider.
- Modal chọn provider type.
- Form riêng cho OpenRouter/Ollama/Custom/Codex.
- Nút test connection.
- Nút set active.

Flow tham khảo:

```text
Add Provider
-> Chọn OpenAI Codex / OpenRouter / Ollama / Custom
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

## 7. Migration Từ Demo Hiện Tại

### 7.1. Giữ demo cũ

Không xóa:

- `app.py`
- `documents.db`

Lý do:

- Làm baseline demo.
- Làm reference prompt/logic parse AI JSON.
- Làm nguồn import dữ liệu ban đầu.

### 7.2. Tạo app mới

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

### 7.3. Import SQLite sang PostgreSQL

Sau khi Prisma schema ổn định:

- Viết script đọc `documents.db`.
- Tạo user demo.
- Import mỗi row trong bảng `documents` thành `Document`.
- Nếu chưa có chunks/embeddings thì enqueue job tạo chunks và embeddings.

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

### Tuần 9: OpenAI Codex provider spike

- Thiết kế UI `Sign in with OpenAI Codex`.
- Kiểm tra khả năng tích hợp auth thực tế.
- Tạo kết luận kỹ thuật:
  - Implement được.
  - Cần API key fallback.
  - Hoặc để feature flag/future work.
- Không để spike này làm trễ MVP.

### Tuần 10: Recommendation

- Tạo Project schema và UI.
- Tạo project embedding.
- Tìm tài liệu liên quan bằng pgvector.
- Kết hợp document chunks, primary topic và canonical tags khi xếp hạng.
- Dùng LLM sinh lý do gợi ý.
- Lưu Recommendation.

### Tuần 11: Evaluation

- Tạo evaluation dataset 40-60 tài liệu.
- Tạo form/import nhãn thủ công.
- Tính primary topic accuracy.
- Tính difficulty accuracy.
- Tạo 10 query search mẫu và ghi kết quả.

### Tuần 12: Polish và error handling

- Cải thiện dashboard.
- Cải thiện loading/progress states.
- Cải thiện thông báo lỗi provider/file extraction.
- Thêm delete/re-analyze/edit metadata.
- Kiểm tra UI responsive.

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
- Recommendation -> trả về tài liệu liên quan.

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
9. User tạo project "Deep learning for image classification".
10. Hệ thống gợi ý tài liệu liên quan.

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

### 10.1. OpenAI Codex provider có thể không có public OAuth/API phù hợp

Cách xử lý:

- Tách thành spike riêng.
- Không để nó chặn MVP.
- Có fallback OpenAI-compatible API key hoặc tạm đánh dấu future work.

### 10.2. Extract text từ file lỗi

Cách xử lý:

- Hiện lỗi rõ cho user.
- Ghi status FAILED.
- Chỉ hỗ trợ file có text layer trong MVP.
- OCR để future work.

### 10.3. Giữ embedding model đồng nhất

Cách xử lý:

- MVP khóa model mặc định là BGE-M3 và cột vector ở `1024` chiều.
- Chat provider không quyết định embedding model; embedding provider được cấu hình riêng.
- CPU và GPU tạo vector bằng cùng BGE-M3 nên có thể chuyển thiết bị mà không cần migration hoặc re-embedding.
- MVP không hỗ trợ đổi embedding model để tránh trộn kích thước vector trong cùng index.

### 10.4. LLM trả về JSON lỗi

Cách xử lý:

- Clean markdown/code fence.
- Retry một lần với prompt sửa lỗi JSON.
- Nếu vẫn lỗi, lưu job FAILED và cho user re-analyze.

### 10.5. Dự án bị rộng

Cách xử lý:

- Ưu tiên pipeline end-to-end trước.
- Knowledge Graph, GraphRAG, chatbot RAG nâng cao và OCR để future work.
- OpenRouter/Ollama/Custom provider cần chạy trước Codex provider.

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
- Recommendation theo project topic hoạt động.
- AI Provider settings có OpenRouter, Ollama, Custom và UI cho OpenAI Codex.
- Có evaluation dataset và kết quả đo lường.
- Có demo script cho ngày bảo vệ.
- Streamlit demo cũ vẫn được giữ làm reference.
