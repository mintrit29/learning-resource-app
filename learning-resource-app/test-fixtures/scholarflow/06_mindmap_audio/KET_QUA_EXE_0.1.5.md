# Kiểm thử EXE 0.1.5 — 28/08/2026

## Trạng thái

> Báo cáo lịch sử. Sau lượt kiểm này, người dùng yêu cầu chốt bản dev trước và gỡ EXE. Bản cài trên máy đã được gỡ, database/model giữ nguyên; GitHub Releases đang chờ xác nhận xóa. Không dùng các liên kết phát hành dưới đây làm hướng dẫn tải bản hiện hành.

Commit sửa lỗi: `e6c3ca0fb4e0587f2725646c5b08708c2f445bd1`. Lint, toàn bộ `test:unit` và TypeScript `--noEmit` trên máy phát triển đã đạt. [CI bản mới](https://github.com/mintrit29/learning-resource-app/actions/runs/33137087513) đã đạt lint/unit/build/package/standalone và kiểm bản cài thật.

- [Release 0.1.5](https://github.com/mintrit29/learning-resource-app/releases/tag/v0.1.5-desktop), prerelease để nhóm nghiệm thu.
- [Workflow phát hành](https://github.com/mintrit29/learning-resource-app/actions/runs/33138010706) thành công; dùng chính installer qua CI, không build lại.
- File `ScholarFlow-Setup-0.1.5.exe`: 295.577.403 byte; đã tải lại từ GitHub và kiểm SHA-256 `6b8453561b9a0d35eb0343e31f5da49a05cf70819df42a0f2ab5855c5edad696`.
- [Báo cáo CI đính kèm](https://github.com/mintrit29/learning-resource-app/releases/download/v0.1.5-desktop/release-report.md): 12 fixture qua extraction/vector thật/search; OCR XMind Việt/Anh/công thức, reextract, GUI nguồn/Back/zoom/đổi sơ đồ, PDF trang 2/pan, lưu cấu hình/restart và toàn bộ ca API mới đạt.
- Đã nâng bản cài trên máy người dùng lên 0.1.5.0. Chỉ mở bằng profile QA riêng; thư viện và API key thật không được dùng hay thay đổi.

## Lỗi tái hiện trên bản cài 0.1.4 và bản sửa

- Kiểm tra kết nối Custom API báo thành công với HTTP 200 nhưng nội dung HTML hoặc JSON rỗng. Đã sửa: phải có phản hồi chat với nội dung thật; phản hồi không hợp lệ báo lỗi dễ hiểu.
- Multipart upload bị hỏng trả HTTP 500. Đã sửa thành JSON 400 và hướng dẫn chọn lại file.
- Footer hiển thị 0.1.3 dù EXE là 0.1.4. Đã lấy version từ package để tránh lệch khi phát hành.
- Mô tả viewer còn nói chưa hiển thị ảnh XMind dù ảnh đã được hỗ trợ. Đã sửa nội dung hướng dẫn.
- Cập nhật tương thích `nanoid` 3.3.18 và `undici` 7.29.0; không ép thay major Prisma.

Unit mới thử HTTP server thật trả HTML, JSON rỗng, content trắng, HTTP 401/429/500 và phản hồi chat hợp lệ. Baseline trước sửa thất bại đúng ở trường hợp HTML; sau sửa đạt.

## Kiểm trực tiếp trên máy người dùng

Được người dùng cho phép điều khiển máy. Chỉ dùng profile QA riêng, không dùng database, tài liệu hay API key thật. Bản cài lúc tái hiện là EXE 0.1.4.

- GUI upload `09_xmind_anh_nhung.xmind`: trích xuất 1.029 ký tự, tạo 14 đoạn, embedding thật hoàn thành. Có ảnh và cảnh báo từng ảnh trắng/hỏng/thiếu/URL ngoài; không mất phần chữ khác.
- Gõ `OSPF` tự tìm được nguồn từ OCR ảnh. Mở nguồn tô đúng nhánh ảnh Việt; quay lại giữ query/kết quả.
- GUI mở file 09 trong tìm bằng ảnh/file, khoanh trực tiếp ảnh Việt: có OCR và kết quả tìm kiếm. Mở nguồn rồi quay lại giữ ảnh, vùng chọn, query, kết quả và vị trí cuộn; không OCR nhầm thanh bên.
- Đổi sang sơ đồ 2: ảnh dùng lại hiển thị, query/vùng chọn/kết quả cũ được xóa.
- Mở `04_mindmap_text.pdf`, chuyển trang 2/2, zoom 110%, kéo ngang/dọc: nội dung dịch chuyển được, không bôi chữ hay tạo vùng OCR nhầm trong chế độ kéo.
- API của EXE: tìm kiếm JSON hỏng/query rỗng trả 400; file sai định dạng, rỗng, giả PDF và 26 MB bị chặn; thêm/sửa môn học, chặn trùng và xóa đúng môn QA đạt.
- API của EXE: tạo/sửa Custom API với key giả, để trống key khi sửa vẫn giữ key, không trả key ra danh sách; HTTP 401/429 báo lỗi. Các ca HTML/JSON rỗng và multipart hỏng thất bại đúng như lỗi nêu trên, cần kiểm lại trên 0.1.5.

### Kiểm lại sau cài 0.1.5

- GUI hiện đúng version 0.1.5 và giữ tài liệu QA đã thêm trước nâng cấp; BGE-M3, Docling và Whisper đều báo sẵn sàng sau nâng cấp.
- Chạy lại API regression trên EXE mới: HTML/JSON rỗng không còn báo kết nối thành công; multipart hỏng trả JSON 400. Tất cả các ca API ở trên đã đạt.
- Ca môn học lần đầu vượt timeout 30 giây của test. Database xác nhận thao tác vẫn hoàn tất với vector 4.096 byte (1.024 float), khoảng 207 giây sau lúc gửi. Lượt kế tiếp chờ phần xử lý còn lại và hoàn thành thêm/sửa trong 93,8 giây; lượt model đã chạy ổn định chỉ mất 315 ms.
- Đây là hạn chế hiệu năng lần inference đầu, chưa xác định nguyên nhân sâu hơn (không kết luận do antivirus/RAM/model). Không phải bằng chứng mọi máy chỉ cần vài giây. Bộ test bổ sung thời gian đo và giới hạn 240 giây riêng cho thao tác cần embedding; các HTTP check khác vẫn 30 giây. Không đổi code app/installer để che timeout.
- Môn QA của yêu cầu timeout đã được dọn đúng tên/ID do test tạo; không đụng môn/tài liệu của người dùng.

## Bộ kiểm thử giữ lại

- `scripts/test-ai-provider-connection.mjs`: kiểm phản hồi thật của HTTP mock server, không gọi dịch vụ trả phí.
- `scripts/release-api-regression.mjs`: kiểm API của EXE trên profile riêng; chỉ xóa provider/môn do chính test tạo.
- `scripts/test-local-release-api.mjs`: bắt buộc opt-in profile QA cụ thể, không nhận URL thư viện thật.
- `scripts/test-installed-release.mjs`: CI-only trên Windows GitHub-hosted, cài NSIS thật, tải model thật, pipeline 12 file, hồi quy GUI XMind/PDF, lưu cấu hình và restart; đã bổ sung các ca API ở trên cùng kiểm version footer.
- Giữ nguyên fixture 09/10 và hướng dẫn `TEST_ANH_NHUNG_XMIND.md`; không xóa bộ test dùng chung của nhóm.

## Giới hạn / không tuyên bố quá mức

- OCR vẫn có thể sai dấu (mẫu `tuyến` thành `tuyên`), công thức/bảng phức tạp không bảo đảm hoàn hảo. Hiểu chữ trên ảnh không đồng nghĩa hiểu biểu đồ; bố cục XMind được tự sắp xếp.
- Lần upload đầu trên máy QA ở 0.1.4: extraction khoảng 3,8 giây; embedding 14 đoạn khoảng 101 giây. Lần inference đầu sau cài 0.1.5 có ca tạo môn mất khoảng 207 giây như ghi trên; chưa tối ưu/xác định nguyên nhân sâu hơn. Đây là số đo từng ca, không phải cam kết tốc độ cho mọi máy/tài liệu.
- Không cấu hình AI thì bước phân loại/tóm tắt có thể báo thiếu provider; extraction và tìm kiếm vẫn hoạt động. Chưa thử provider trả phí thật hoặc mọi cấu hình Ollama trong lượt này.
- `npm audit --omit=dev` sau bản vá còn 3 mục high của cùng chuỗi `deepmerge-ts → @prisma/config → prisma`. Chưa ép nâng major/downgrade Prisma. Không thấy các thư mục package này trong resources của EXE 0.1.4 đã cài; điều đó không thay thế kiểm toán toàn bộ code được bundle, không tuyên bố audit sạch.
- Timeout CI từng xuất hiện trong bản trước chưa xác định nguyên nhân; xem báo cáo 0.1.4. Không được suy luận một lượt pass là mọi lỗi đã hết.
- Kiểm thử có phạm vi trên fixture và các thao tác ghi ở đây; không bảo đảm mọi file, mọi máy hoặc mọi nút đều không có bug.
