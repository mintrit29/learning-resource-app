# ScholarFlow OCR regression fixtures

Bộ này kiểm tra pipeline OCR đang dùng trong app bằng dữ liệu cố định, tránh đánh giá chất lượng theo cảm giác:

1. Ảnh nên đi qua OCR chữ/công thức hay bị loại vì không có nội dung hữu ích?
2. OCR có giữ đúng marker tiếng Việt/Anh, bảng, biểu đồ, sơ đồ và code không?
3. Khi các ảnh được nhúng trong DOCX, extractor hiện tại có giữ đủ nội dung không?

## Thành phần

- `manifest.json`: ground truth cho các ảnh kiểm soát.
- `formula_*.png`: công thức một dòng, phân số, nhiều dòng, ký tự Hy Lạp và công thức có chú thích.
- `text_*`, `table_*`, `chart_*`, `diagram_*`, `code_*`, `noise_*`: các ca đối chứng không được gửi nhầm sang model công thức.
- `hybrid_content_stress.docx`: text/bảng native và 11 ảnh nhúng lấy từ bộ trên.
- `routing-report.json`: kết quả router và OCR marker gần nhất.
- `document-extraction-report.json`: kết quả extractor trên DOCX gần nhất.

Ba crop `formula_04a`, `formula_04b`, `formula_06a` dùng để kiểm tra công thức nhỏ hoặc nằm trong ảnh có nhiều dòng/chú thích.

## Chạy lại

```powershell
npm run fixtures:hybrid-ocr
npm run test:hybrid-ocr-routing
npm run test:hybrid-document-extraction
```

Để biến marker OCR còn thiếu thành lỗi test thay vì cảnh báo:

```powershell
$env:STRICT_OCR_MARKERS='1'
npm run test:hybrid-ocr-routing
```

`test:technical-ocr-modes` so sánh Tesseract tiếng Anh với `AUTO`, `SPARSE_TEXT` và `SINGLE_BLOCK`; đây là benchmark chẩn đoán, không thuộc test unit mặc định.

## Baseline và quyết định công nghệ

- Router: đúng 24/24 khi có thêm tám ảnh thực tế cục bộ; trên clean checkout chỉ chạy 16 fixture kiểm soát.
- Tesseract chính: đúng 24/32 marker ở mười ca OCR. Các marker thiếu là `documents`, `Cạnh âm`, `Tháng 1`, `R1-R4` và `Infinity`.
- RapidOCR bổ sung được sáu trong tám marker thiếu nhưng vẫn không lấy đúng `documents`/`Cạnh âm`, làm mất nhiều dấu Việt và sinh ký tự trên ảnh nhiễu; chưa đủ lý do để thêm model/runtime mới.
- Tesseract tiếng Anh raw đọc đúng `documents` và `Infinity`; lỗi hiện tại nằm một phần ở bước merge chỉ thay dòng công thức.
- CodeFormula và RapidOCR từng được benchmark nhưng không được tích hợp vào app vì tăng runtime/model mà không cải thiện ổn định trên toàn bộ tập test.
- DOCX stress: đủ 8/8 marker native, nhưng chỉ entropy đạt nhóm marker công thức ảnh; năm nhóm công thức ảnh còn lại không được trích xuất đúng.

## Giới hạn đã chốt

- Router không có false positive trên bảng/biểu đồ/sơ đồ/code/nhiễu và không bỏ công thức thực tế.
- Tesseract Việt/Anh được merge theo dòng/vị trí để không làm mất bản tiếng Anh đúng hoặc lặp text.
- PDF, DOCX, PPTX, EPUB đều lấy được ảnh công thức nhúng trước khi gọi model; không phụ thuộc layout label `formula` vì ảnh thực tế thường bị gắn `picture`.
- Không thay OCR/model chỉ vì một ảnh riêng lẻ tốt hơn; mọi thay đổi phải chạy lại toàn bộ bộ test và cải thiện tổng thể mà không làm tăng đáng kể dung lượng hoặc thời gian xử lý.
