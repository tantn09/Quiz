# Quiz lớp học

Ứng dụng quản lý quiz cho Admin, giáo viên và học sinh. Lộ trình chức năng nằm trong [process.md](process.md), yêu cầu tổng thể nằm trong [plan.md](plan.md).

## Stack

- `quiz-fe`: Next.js App Router, React, Tailwind CSS và cấu hình shadcn/ui.
- `quiz-be`: Fastify, Drizzle ORM và PostgreSQL (`pg`).
- pnpm workspace dùng TypeScript.

## Phát triển cục bộ

Yêu cầu Node.js 22 trở lên, pnpm 10 và Docker Compose.

```powershell
Copy-Item .env.example .env
docker compose up -d postgres
pnpm install
pnpm db:migrate
pnpm db:seed-admin
pnpm dev
```

Web chạy tại `http://localhost:3000`; Fastify chạy tại `http://127.0.0.1:4100`; PostgreSQL được bind vào `localhost:5433` mặc định (`POSTGRES_PORT` có thể đổi nếu cổng này đang bận). Tài khoản khởi tạo là `admin` / `Admin@1234`. Hãy thay `ADMIN_INITIAL_PASSWORD` trong `.env` trước khi tạo tài khoản nếu dùng dữ liệu thật. Lệnh khởi tạo chỉ tạo tài khoản một lần và lưu mật khẩu bằng scrypt.

Chạy riêng FE từ thư mục gốc bằng `pnpm --filter @quiz/web dev`. FE dùng API ở `127.0.0.1:4100`; để các trang đăng nhập/quản trị hoạt động, chạy thêm `pnpm --filter @quiz/api dev` trong cửa sổ terminal thứ hai. Có thể chạy cả hai cùng lúc bằng `pnpm dev`.

## Nhập quiz từ Excel

Trong trang **Bài quiz của tôi**, chọn **Nhập Excel**, tải file mẫu và chọn file `.xlsx` đã điền. Hệ thống kiểm tra file rồi nạp dữ liệu vào modal tạo quiz để giáo viên xem, sửa và bấm **Tạo quiz**. File có hai sheet `Quiz` (`field`, `value`) và `Questions` (`type`, `prompt`, `points`, `option1`–`option8`, `correctOption`). `correctOption` trong Excel đánh số từ 1; câu tự luận để trống các cột đáp án. Hạn link, nếu có, dùng ISO 8601 kèm múi giờ. Giới hạn file là 2 MB và 200 câu hỏi. Ảnh đề bài được thêm riêng trong modal sau khi nhập file.

## Triển khai bằng Docker Compose

Tạo `.env` từ `.env.example`, đặt `POSTGRES_PASSWORD` thành chuỗi dài, an toàn cho URL PostgreSQL và `SESSION_SECRET` thành giá trị ngẫu nhiên tối thiểu 32 ký tự. `COOKIE_SECURE=false` giúp chạy HTTP ở máy cá nhân; chuyển thành `true` khi triển khai sau HTTPS. Cập nhật `DATABASE_URL` cho môi trường chạy trực tiếp trên máy phát triển; Docker Compose tự tạo URL nội bộ từ thông tin PostgreSQL. Sau đó:

```sh
docker compose up -d --build
docker compose exec api node dist/db/seed-admin.js
```

Compose chạy PostgreSQL, API (tự áp dụng migration khi khởi động), web và Nginx reverse proxy. Proxy được bind vào `127.0.0.1:8080`; đặt reverse proxy TLS trên VPS trước địa chỉ này để cookie phiên bảo mật hoạt động. Nginx chuyển `/api/` tới Fastify cùng origin với web.

### Migration

Sau khi sửa schema, tạo migration và đưa file SQL vào Git:

```sh
pnpm db:generate
pnpm db:migrate
```

Trong Compose, migration được áp dụng khi API khởi động. Không sửa các migration đã chạy trên môi trường dùng thật; hãy tạo migration mới.

### Sao lưu và khôi phục

Tạo bản sao lưu PostgreSQL dạng custom:

```sh
docker compose exec -T postgres pg_dump -U quiz -d quiz -Fc > quiz-backup.dump
```

Khôi phục vào database trống:

```sh
docker compose exec -T postgres pg_restore -U quiz -d quiz --clean --if-exists < quiz-backup.dump
```

Lưu bản sao lưu ngoài VPS và kiểm tra quy trình khôi phục định kỳ. Dữ liệu PostgreSQL nằm trong volume `quiz-postgres`. Ảnh đề bài nằm trong volume `quiz-assets`; sao lưu cả volume này để ảnh tiếp tục hiển thị sau khi khôi phục database. Khi chạy BE trực tiếp trên máy phát triển, ảnh nằm trong `quiz-be/uploads` (hoặc thư mục `ASSET_DIR` nếu có cấu hình riêng).
