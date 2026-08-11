# Tương thích giữa ScholarFlow Desktop và Docker

## Kết luận

Không merge toàn bộ nhánh `desktop-app` vào `main`. Hai nhánh là hai biến thể triển khai khác nhau của ScholarFlow:

| Thành phần | `desktop-app` | `main` Docker |
| --- | --- | --- |
| Runtime | Electron + Next.js nội bộ | Next.js web container |
| Database | SQLite | PostgreSQL |
| Vector store | sqlite-vec | pgvector |
| Embedding | Transformers.js chạy local | Python embedding service |
| Lưu file | `%APPDATA%\ScholarFlow` | Docker volume |
| Local AI | Ollama trên máy người dùng | Ollama phải được expose vào container/host |

`origin/main` hiện là tổ tiên của `desktop-app`, vì vậy merge có thể là fast-forward và không báo conflict. Tuy nhiên các commit desktop đã xóa Dockerfile, compose, PostgreSQL adapter và Python embedding service. Docker sẽ biến mất sau merge.

## Các lỗi nếu chỉ chép Dockerfile cũ vào app desktop

1. Dockerfile cũ chạy `npm run start`, trong khi bản desktop không còn script `start`.
2. Compose cũ truyền `DATABASE_URL=postgresql://...`, nhưng Prisma của desktop chỉ chấp nhận SQLite.
3. Compose tham chiếu `learning-resource-app/docker/postgres/init.sql` và `embedding-service`, hai phần đã bị xóa khỏi nhánh desktop.
4. `src/lib/db.ts`, migration, vector store và generated Prisma client của hai bản không thể thay thế lẫn nhau.
5. Ollama `localhost` bên trong container là container, không phải máy Windows của người dùng. Local AI phải dùng `host.docker.internal` và cấu hình Ollama cho phép truy cập từ Docker nếu muốn hỗ trợ.

## Cách đưa tính năng mới sang Docker an toàn

1. Tạo branch tích hợp từ Docker:

   ```bash
   git switch main
   git pull origin main
   git switch -c integrate/desktop-ui-into-docker
   ```

2. Chuyển thủ công các phần dùng chung như header/footer, danh sách môn học và CSS. Không cherry-pick các commit chuyển database hoặc xóa Docker.
3. Giữ phiên bản Docker của các vùng sau:

   - `docker-compose*.yml`, `Dockerfile`, `.dockerignore`, `embedding-service/**`;
   - `prisma/schema.prisma`, migrations và generated Prisma client;
   - `src/lib/db.ts`, vector store, embedding client;
   - dependencies PostgreSQL và các script `dev`, `start` trong `package.json`.

4. Với màn hình AI Provider:

   - OpenRouter và Custom API có thể port sang Docker.
   - Không hiển thị tính năng tự đọc cấu hình máy người dùng trong web container.
   - Nếu hỗ trợ Ollama trên máy host, dùng URL do người dùng nhập, thường là `http://host.docker.internal:11434`, không dùng `localhost`.

5. Chạy trước khi tạo pull request:

   ```bash
   npm ci
   npm run lint
   npm run test:unit
   npm run build
   docker compose build web
   docker compose up -d
   docker compose ps
   ```

## Nếu đã merge nhầm

Không sửa bằng cách chọn toàn bộ “ours” hoặc “theirs”. Tạo branch cứu hộ từ commit Docker gần nhất, sau đó port lại tính năng dùng chung:

```bash
git branch backup/merged-state
git switch -c recover/docker origin/main
```

Nếu PR được nhập bằng merge commit và đã push vào `main`, ưu tiên nút **Revert** trên GitHub hoặc:

```bash
git switch main
git pull origin main
git revert -m 1 <merge-commit>
git push origin main
```

Nếu PR được squash thành một commit, dùng `git revert <squash-commit>` thay vì tùy chọn `-m`. Không dùng `git reset --hard` hoặc force-push trên nhánh chung khi chưa thống nhất với cả nhóm.
