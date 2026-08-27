# Kết quả sau sửa viewer — 27/08/2026

## Phạm vi và môi trường

Kiểm trên Electron thật bằng thao tác chuột/bàn phím, cửa sổ 1267 × 810; không chỉ gọi API. Database và model thử riêng tại `.tmp/mindmap-electron-qa`; không sửa/xóa thư viện người dùng trong AppData. Bộ mẫu nằm cùng thư mục này và phải giữ lại cho nhóm test.

## Kết quả giao diện

| Ca đã thử | Kết quả |
| --- | --- |
| XMind JSON và XML | Hiển thị hộp/đường nối theo cây; ghi chú, nhãn, sơ đồ 2 và nhánh rời còn đủ |
| Chọn Dijkstra và ghi chú | Lấy đúng chữ gốc trong vùng; không OCR sai tên thuật toán, không kéo chữ ngoài vùng |
| XMind sơ đồ 2 → chọn 3NF → mở kết quả | Đi đúng sơ đồ/nhánh, có tô nổi bật nội dung liên quan |
| XMind zoom 150%, pan, mở kết quả rồi Back | Giữ nguyên zoom, viewport, vùng chọn, query và kết quả |
| XMind đổi tab chữ → ảnh/file | Khôi phục cùng viewport/vùng chọn, không bị đo kích thước sai khi tab ẩn |
| PDF chữ trang 1 OSPF → trang 2 3NF | Chuyển đúng trang; xóa vùng/query cũ, OCR đúng vùng mới |
| PDF trang 2 zoom 150%, pan → mở kết quả → Back | Giữ đúng trang 2, zoom/pan, vùng và nội dung 3NF |
| PDF chọn trước rồi zoom, cuộn bánh xe | Khung bám chữ; bánh xe chỉ cuộn viewer, không kéo cả trang ngoài |
| PDF scan chọn OSPF | Có chữ, OCR đúng ba dòng trong vùng mẫu |
| DOCX `02_visual_queries/03_bai_tap_nhieu_trang.docx` | Kéo xuống cuối được, không bôi xanh chữ; chọn câu hàm băm đọc đúng, không dính câu trước |
| Tiêu đề trang chi tiết | Đọc được tên đầy đủ; nút hành động xuống hàng, không ép tên thành cột hẹp |

Đã thay PDF iframe tìm kiếm bằng trang ảnh render cục bộ qua PDF.js, chỉ render trang đang xem. Worker đi cùng app, không lấy CDN. Ảnh crop PDF lấy từ raster trang, không chụp nhầm thanh bên. Preview chi tiết tài liệu vẫn cho xem file đầy đủ.

## Pipeline thực tế, không mock

Upload qua API của app QA rồi đọc job/database và tìm lại bằng API search:

| File | Text/chunk/embedding/search |
| --- | --- |
| `06_mindmap_hien_dai.xmind` | Đạt; 1.076 ký tự, 12 chunk; vector 1.024 chiều; tìm được tài liệu |
| `07_mindmap_legacy.xmind` | Đạt; nội dung tương đương JSON, 12 chunk; tìm được tài liệu |
| `02_audio_tieng_viet.mp3` | Whisper thật, đạt các cụm “tìm tài liệu học tập”, “mạng máy tính”, “cơ sở dữ liệu”; khoảng 6,3 giây khi runtime đã ấm |
| `03_audio_tieng_anh.wav` | Whisper thật, đạt “learning resources”, “computer networks”, “databases”; khoảng 4,2 giây khi runtime đã ấm |

Các job trích xuất/chia đoạn/embedding đều hoàn thành. QA không cấu hình AI phân loại nên job phân loại báo thiếu kết nối là dự kiến, không phải embedding hỏng. JSON chi tiết lần chạy nằm tại `.tmp/mindmap-electron-qa/mindmap-audio-live-report.json` (log tạm, không cần đưa lên Git).

Script lặp lại: `node scripts/test-mindmap-audio-live.mjs http://127.0.0.1:PORT_QA`. Chỉ chạy với Electron có `SCHOLARFLOW_USER_DATA_ROOT` trỏ tới `.tmp/mindmap-electron-qa`, đã nhập ít nhất một fixture. Script kiểm tra ID tài liệu QA trước khi upload, tạo thêm bốn tài liệu trong QA; không chạy với thư viện thật.

## Kiểm tra tự động

- Full `npm run test:unit`: đạt. Có kiểm XMind JSON/XML, dữ liệu hỏng, giới hạn giải nén, XSS, vị trí chunk/highlight, lưu draft và hình học vùng chọn.
- Chạy lại `test:visual-search` và `test:xmind` sau sửa cuối: đạt.
- PDF trích xuất toàn tài liệu: chữ native 26/26 cụm, scan 24/26. Hai lỗi dấu baseline vẫn còn, không gọi scan chính xác tuyệt đối.
- TypeScript và ESLint: đạt. `npm run desktop:build`: đạt, đã chuẩn bị standalone production.
- `npm run test:desktop-runtime`: đạt trên database mới; kiểm migration/khởi động local và `/api/pdf-worker` trả JavaScript đầy đủ trong standalone (không thiếu worker, không trả HTML lỗi).

## Giới hạn không che giấu

- XMind dựng bố cục nhánh tự động, không giữ nguyên tọa độ, màu, icon, đường nối chéo hay ranh giới nhóm từ ứng dụng XMind. Không sửa file gốc.
- Chỉ đọc chữ/ghi chú/nhãn có sẵn trong XMind. Ảnh nhúng và tập tin đính kèm chưa OCR; cần xuất PDF/PNG để đọc phần ảnh đó.
- PDF/ảnh vẫn dùng OCR: chữ nhỏ, bảng, công thức và dấu tiếng Việt có thể sai. Các test OCR cũ vẫn ghi nhận thiếu nhãn bảng/sơ đồ và công thức; bản sửa viewer không biến OCR thành hoàn hảo.
- Audio có thể phiên âm sai tên riêng: “ScholarFlow” trong mẫu Việt thành “Cô la Phông”. Không bảo đảm chép lời đúng mọi giọng, tiếng ồn hoặc bản ghi dài.
- Đã test GUI dev và pipeline mẫu; chưa thử mọi file XMind chính thức hay mọi thao tác liên tục. Chưa tạo/phát hành EXE mới trong đợt này.
