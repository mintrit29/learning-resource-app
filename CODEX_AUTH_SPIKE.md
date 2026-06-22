# OpenAI Codex Auth Spike

## Kết luận

Không triển khai nút **Sign in with OpenAI Codex** trong ScholarFlow MVP.

Tài liệu OpenAI hiện mô tả đăng nhập ChatGPT/Codex cho các sản phẩm Codex chính thức như app, CLI và IDE extension. Access token dành cho trusted automation/CI, còn ứng dụng web bên thứ ba được khuyến nghị dùng API key cho API calls. Không có OAuth public được tài liệu hóa để ScholarFlow đăng ký client và dùng quota Codex của người dùng.

Vì vậy provider của MVP vẫn chỉ gồm **OpenRouter, Ollama và Custom API**. Codex auth được giữ ở future work và chỉ xem xét lại khi OpenAI công bố OAuth/API dành cho ứng dụng bên thứ ba.

## Nguồn chính thức

- [Codex authentication](https://developers.openai.com/codex/auth)
- [Codex SDK](https://developers.openai.com/codex/sdk)
- [OpenAI API keys](https://platform.openai.com/api-keys)
