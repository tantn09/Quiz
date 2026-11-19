# Bộ cài Quiz cho Windows 11 Pro

Gửi nguyên thư mục `release` cho máy đích. Bộ này chứa cấu hình, script và file `.env` đã tạo cho `https://quiz.tantn.dev`; ứng dụng được kéo từ Docker Hub dưới tag `latest`. Máy đích cần Docker Desktop đang chạy ở chế độ **Linux containers**, có Internet và PowerShell. Nếu hai image Docker Hub là private, chạy `docker login` trên máy đích trước. **Giữ ZIP và `.env` riêng tư** vì chúng chứa mật khẩu thật. Trước lần cài đầu với file Compose này, hãy chạy lệnh phát hành ở máy có source để tạo tag `latest` trên Docker Hub.

## Cài đặt

1. Trong Cloudflare Dashboard, tạo một remotely managed Tunnel và chuẩn bị hostname công khai, ví dụ `quiz.example.com`. Có thể triển khai nội bộ trước rồi thêm tunnel sau.
2. Mở PowerShell tại thư mục `release` trên máy đích. Thay hostname bằng tên miền thật:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy.ps1 -PublicOrigin https://quiz.tantn.dev -EnableTunnel
```

File `.env` đã chứa mật khẩu PostgreSQL, session secret và mật khẩu admin ngẫu nhiên. Script hỏi tunnel token (nhập ẩn), kéo image, chạy bốn container ứng dụng và container tunnel, áp dụng migration, tạo admin, rồi kiểm tra API nội bộ. Đăng nhập bằng username `admin` và giá trị `ADMIN_INITIAL_PASSWORD` trong `.env`. Không commit `.env` vào Git; sau khi chuyển bộ cài sang máy đích, xóa bản sao ZIP ở nơi không còn cần thiết.

Nếu chưa có tunnel, bỏ `-EnableTunnel` để kiểm tra nội bộ trước. Khi đã có tunnel, chạy lại lệnh với `-EnableTunnel`; script sẽ hỏi token và thêm dịch vụ tunnel. Có thể chạy lại script để kéo và khởi động lại bản phát hành hiện tại; script không xóa database hay ảnh.

Trong Cloudflare Dashboard, tạo public hostname `quiz.tantn.dev` với service **HTTP `http://proxy:80`**. Đây là tên service Docker trong cùng Compose network, không phải `localhost:8080`. Trình duyệt truy cập HTTPS tại `https://quiz.tantn.dev`; kiểm tra `https://quiz.tantn.dev/api/health` trả `{"status":"ok"}`. Nginx cũng mở `http://127.0.0.1:8080` trên máy đích để kiểm tra nội bộ. Không mở cổng router.

## File trong bộ cài

- `compose.yaml`: PostgreSQL, API, web, Nginx và Cloudflare Tunnel tùy chọn; dùng image từ Docker Hub, không build mã nguồn.
- `nginx.conf`: chuyển `/api/` tới API và giữ đúng giao thức HTTPS qua proxy.
- `.env`: cấu hình và secret thật cho máy đích; `.env.example` là mẫu để tham khảo.
- `deploy.ps1`: lệnh cài đặt và kiểm tra.

Database và ảnh nằm trong Docker volumes `quiz_quiz-postgres` và `quiz_quiz-assets` trên máy đích. Sao lưu cả hai trước khi cập nhật; không chạy `docker compose down -v`. `compose.yaml` dùng tag `latest`, nên sau lần thay file Compose đầu tiên không cần sửa tag cho các bản cập nhật tiếp theo.

## Phát hành bản mới từ máy có source

Đăng nhập Docker Hub trên máy build, rồi chạy ở thư mục gốc repo:

```powershell
pnpm release:publish
pnpm release:publish:api
pnpm release:publish:web
```

Lệnh đầu phát hành cả hai image; hai lệnh sau chỉ phát hành API hoặc web. Mỗi lần chạy tạo tag phiên bản theo thời gian UTC **và** cập nhật tag `latest` cho image tương ứng, build/push cho `linux/amd64`. Tag phiên bản dùng khi cần quay lại bản cũ. Có thể chọn tag rõ nghĩa bằng `pnpm release:publish --tag v1.1.0`; xem trước bằng `pnpm release:publish:web --dry-run`. Không dùng lại một tag phiên bản đã phát hành.

Trên máy đích, sao lưu database và volume ảnh. **Một lần duy nhất**, chép file `compose.yaml` dùng `:latest` vào thư mục `release` hiện có và giữ nguyên `.env` cùng tunnel token. Sau mỗi lần publish, chạy:

```powershell
docker compose -f compose.yaml pull
docker compose -f compose.yaml up -d --no-build
Invoke-RestMethod http://127.0.0.1:8080/api/health
```

Nếu chỉ phát hành API hoặc web, thay hai lệnh `pull` và `up` bằng lệnh có tên service tương ứng, ví dụ `docker compose -f compose.yaml pull web` rồi `docker compose -f compose.yaml up -d --no-build web`. Container tunnel đang chạy vẫn giữ nguyên. API tự chạy migration lúc khởi động. Kiểm tra `https://quiz.tantn.dev/api/health` và đăng nhập sau khi cập nhật. Không gửi lại ZIP cũ có `.env` vì nó chứa secret.

Docker Desktop trên Windows chỉ có tùy chọn tự khởi động **khi người dùng đăng nhập**, nên website có thể chưa hoạt động ngay sau reboot nếu chưa đăng nhập. [Tài liệu Docker Desktop](https://docs.docker.com/desktop/settings-and-maintenance/settings/). Nếu cần phục vụ trước khi đăng nhập, dùng Ubuntu VM trong Hyper-V.
