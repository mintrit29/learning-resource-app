# Test nhanh tìm bằng giọng nói

Cập nhật 28/08/2026. Giữ file này cùng bộ test, không xóa khi dọn cache. Chức năng hiện nằm trên bản dev, chưa có EXE mới.

## Bạn thử khoảng 3 phút

1. Đóng cửa sổ test dùng mic giả (nếu còn mở), mở app bằng `npm run dev` trong `learning-resource-app`.
2. Vào **Cài đặt → Thành phần cục bộ**: Whisper Base cần sẵn sàng. Không cần cài model mới nếu đã dùng audio.
3. Vào **Tìm tài liệu → Nhập mô tả**, bấm nút mic cạnh ô nhập. Nói: **“Tìm tài liệu về mạng máy tính và cơ sở dữ liệu”**, rồi bấm **Dừng**.
4. Chờ chữ xuất hiện trong ô nhập; app tự tìm sau khoảng nửa giây. Có thể sửa chữ nhận sai, app tìm lại như khi gõ. Có kết quả hay không phụ thuộc tài liệu trong thư viện; đây không phải trợ lý giải bài.
5. Bấm mic lần nữa, nói vài chữ rồi bấm **Hủy** hoặc **Esc**: câu cũ phải còn, không có câu mới chen vào.
6. Bấm mic, sau đó chuyển sang **Ảnh hoặc file** hoặc sang **Tài liệu**, rồi quay lại: mic phải tắt. Gõ vào ô khi đang chờ chép lời cũng phải hủy tác vụ cũ.
7. Bấm mic và không nói: sau khi Dừng phải báo chưa nghe rõ, không tự tạo một câu truy vấn từ im lặng. Nếu có tiếng TV/nhạc/nói chuyện, model có thể nhận nội dung đó — không coi đó là im lặng.
8. Thử câu tiếng Anh: **“Find documents about computer networks”**. Tên riêng, ký hiệu và thuật ngữ có thể sai, hãy sửa trực tiếp trong ô.

Muốn có tài liệu để tìm: thêm `../01_library/01_mang_may_tinh_ospf.docx` và `../01_library/02_co_so_du_lieu_text.pdf`. Không phải thêm file ghi âm vào thư viện để dùng mic.

Nếu Windows chặn mic: bật quyền microphone cho ứng dụng desktop trong cài đặt Windows; thử mic trong phần cài đặt âm thanh. App không cấp quyền camera.

## Đã tự kiểm tra

- Test lifecycle: thành công, thiếu model, từ chối quyền, hủy ở từng giai đoạn, quyền trả về muộn, chép lời trả về muộn, retry, tự dừng, ngắt thiết bị, giới hạn dung lượng.
- Test API + FFmpeg thật: chỉ same-origin loopback, WebM hợp lệ, rỗng/hỏng, im lặng, quá 32 giây (30 giây ghi + biên độ codec/timer), lỗi được trả JSON dễ hiểu.
- Chạy thật `02_audio_tieng_viet.mp3` qua WebM → Whisper: khoảng 8,39 giây, nội dung mạng máy tính/cơ sở dữ liệu đúng; tên ScholarFlow thành “Cô la foam”.
- Chạy thật `03_audio_tieng_anh.wav` qua WebM → Whisper: khoảng 3,08 giây, có “computer networks and databases”. Đây là thời gian của hai mẫu trên máy test, không phải cam kết tốc độ.
- Electron dev dùng Chromium fake microphone với file WAV: ghi và tự dừng 30 giây, chép lời thật, điền query, gọi `/api/search`. File mic giả lặp lại nên câu bị lặp theo đúng âm thanh đầu vào. Embedding mock dùng riêng cho test luồng UI, không dùng kết quả này để kết luận chất lượng xếp hạng.
- Test UI bắt được lỗi Next dev dùng URL nội bộ khác HTTP Host; đã sửa và thêm test hồi quy.
- Full unit suite hiện có đã qua; các giới hạn OCR bảng/công thức/sơ đồ đã ghi trước đây vẫn còn, không được coi là đã sửa bởi tính năng mic.
- Chưa xác nhận mic vật lý của người dùng, các giọng vùng miền hoặc môi trường ồn. Test thao tác Dừng/Hủy có unit lifecycle; cần người dùng thử thêm theo các bước trên.

## Lệnh cho người phát triển

Trong `learning-resource-app`:

```powershell
npm run test:voice-search
# Cũng chạy tự động trước test:unit; không cần model cho nhóm test mặc định.
$env:VOICE_TEST_MODEL_CACHE = "$env:APPDATA\ScholarFlow\models"
node --import tsx scripts/test-voice-search-runtime.mjs
Remove-Item Env:VOICE_TEST_MODEL_CACHE
```

Bài test thật chỉ đọc model có sẵn, không tải ngầm, không thêm tài liệu hoặc sửa database. Đường dẫn model có thể đổi sang bản sao dùng cho QA.

## Giới hạn và riêng tư

- Không live-stream chữ từng từ: nói xong mới chép lời. Mỗi lượt tối đa 30 giây, 2 MB, query tối đa 500 ký tự.
- Whisper Base dùng chung hàng đợi inference với embedding; lần đầu nạp model hoặc máy bận có thể chậm. Quá 120 giây sẽ báo thử lại.
- Hủy sẽ tắt mic và bỏ kết quả; phép tính ONNX đang chạy có thể còn cần kết thúc lượt hiện tại trước khi nhường CPU.
- Âm thanh chỉ xử lý local trong RAM, không lưu thành tài liệu; câu chữ tìm kiếm vẫn theo cơ chế lịch sử/query hiện có của app.
- Ghi âm chỉ bắt đầu khi bấm mic, dừng khi hủy/rời trang/đổi tab/ẩn ứng dụng. Không cần kết nối AI cloud hay Qwen/Ollama.
