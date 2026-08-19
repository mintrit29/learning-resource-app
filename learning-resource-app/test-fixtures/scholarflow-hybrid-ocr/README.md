# ScholarFlow hybrid OCR regression fixtures

Bộ này kiểm tra riêng ba câu hỏi để tránh đánh giá model bằng cảm giác:

1. Ảnh nên đi qua OCR chữ, CodeFormula hay bị loại?
2. OCR có giữ đúng marker tiếng Việt/Anh, bảng, biểu đồ, sơ đồ và code không?
3. Khi các ảnh được nhúng trong DOCX, extractor hiện tại có giữ đủ nội dung không?

## Thành phần

- `manifest.json`: ground truth cho 16 ảnh kiểm soát.
- `formula_*.png`: công thức một dòng, phân số, nhiều dòng, ký tự Hy Lạp và công thức có chú thích.
- `text_*`, `table_*`, `chart_*`, `diagram_*`, `code_*`, `noise_*`: các ca đối chứng không được gửi nhầm sang model công thức.
- `hybrid_content_stress.docx`: text/bảng native và 11 ảnh nhúng lấy từ bộ trên.
- `routing-report.json`: kết quả router và OCR marker gần nhất.
- `document-extraction-report.json`: kết quả extractor trên DOCX gần nhất.

Ba crop `formula_04a`, `formula_04b`, `formula_06a` dùng để đo xem tách công thức khỏi ảnh nhiều dòng/chú thích có cải thiện CodeFormula hay không.

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

## Baseline ngày 18/08/2026

- Router: đúng 24/24 khi có thêm tám ảnh thực tế cục bộ; trên clean checkout chỉ chạy 16 fixture kiểm soát.
- Tesseract chính: đúng 24/32 marker ở mười ca OCR. Các marker thiếu là `documents`, `Cạnh âm`, `Tháng 1`, `R1-R4` và `Infinity`.
- RapidOCR bổ sung được sáu trong tám marker thiếu nhưng vẫn không lấy đúng `documents`/`Cạnh âm`, làm mất nhiều dấu Việt và sinh ký tự trên ảnh nhiễu; chưa đủ lý do để thêm model/runtime mới.
- Tesseract tiếng Anh raw đọc đúng `documents` và `Infinity`; lỗi hiện tại nằm một phần ở bước merge chỉ thay dòng công thức.
- CodeFormula đúng bốn trong sáu ảnh công thức mới khi chạy nguyên ảnh: OLS sai phân số, ảnh entropy có chú thích timeout sau hơn ba phút. Crop entropy chạy đúng; crop OLS vẫn sai phân số.
- DOCX stress: đủ 8/8 marker native, nhưng chỉ entropy đạt nhóm marker công thức ảnh; năm nhóm công thức ảnh còn lại không được trích xuất đúng.

## Tiêu chí trước khi tích hợp production

- Router không có false positive trên bảng/biểu đồ/sơ đồ/code/nhiễu và không bỏ công thức thực tế.
- CodeFormula có timeout cứng, chạy theo crop công thức thay vì toàn ảnh có chú thích, và kết quả được phép sửa.
- Tesseract Việt/Anh được merge theo dòng/vị trí để không làm mất bản tiếng Anh đúng hoặc lặp text.
- PDF, DOCX, PPTX, EPUB đều lấy được ảnh công thức nhúng trước khi gọi model; không phụ thuộc layout label `formula` vì ảnh thực tế thường bị gắn `picture`.
