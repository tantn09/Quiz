# Triển khai trên Windows bằng Hyper-V và Cloudflare Tunnel

Máy Windows 11 Pro/Enterprise chạy Ubuntu VM (khởi đầu: 2 vCPU, 6 GB RAM, 60 GB đĩa). Trong VM, Docker Compose chạy PostgreSQL, API, web và Nginx; `cloudflared` chạy dưới systemd. DNS của subdomain phải thuộc Cloudflare. Máy chủ cần bật liên tục. Học sinh truy cập subdomain trực tiếp, không bật Cloudflare Access cho toàn bộ ứng dụng.

## 1. Chuẩn bị Windows và VM

Bật Hyper-V trong **Turn Windows features on or off**, khởi động lại Windows, rồi tạo Ubuntu VM Generation 2 bằng Hyper-V Manager. Tạo virtual switch có kết nối Internet. Cài Ubuntu Server và bật OpenSSH khi cài đặt. Trong PowerShell chạy với quyền Administrator, đặt tên VM đúng với tên đã tạo:

```powershell
Set-VM -Name 'Quiz-Ubuntu' -AutomaticStartAction Start -AutomaticStartDelay 30 -AutomaticStopAction ShutDown
Set-VMProcessor -VMName 'Quiz-Ubuntu' -Count 2
Set-VMMemory -VMName 'Quiz-Ubuntu' -DynamicMemoryEnabled $false -StartupBytes 6GB
```

Kiểm tra dung lượng đĩa ảo tối thiểu 60 GB và bật tự khởi động sau khi Windows reboot. Cấu hình Windows để không tự ngủ khi cần phục vụ liên tục. Giữ Ubuntu được cập nhật và chỉ cho phép SSH từ mạng quản trị của bạn.

## 2. Cài Docker và lấy mã nguồn trong Ubuntu

### Cách nhanh: một script trong Ubuntu VM

Sau khi tạo VM và [tạo remotely managed tunnel trong Cloudflare](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/), clone repo rồi chạy:

```sh
git clone <URL-cua-repo> ~/quiz
cd ~/quiz
sudo bash scripts/deploy-ubuntu.sh https://quiz.example.com
```

Lần đầu script hỏi mật khẩu admin và tunnel token (nhập ẩn), tự tạo `.env`, cài Docker Engine/Compose và `cloudflared`, build bốn container, chạy migration và seed admin, rồi kiểm tra health nội bộ. Mật khẩu admin chấp nhận chữ, số và `. _ @ % + -`, dài ít nhất 12 ký tự. Sau đó trong Cloudflare Dashboard thêm public hostname `quiz.example.com` trỏ tới **HTTP** `localhost:8080`; kiểm tra `https://quiz.example.com/api/health`. Script không thể tự tạo DNS route vì tunnel token không có quyền quản lý Cloudflare DNS. Chạy lại cùng lệnh để cập nhật từ checkout hiện tại (script không tự `git pull` hoặc ghi đè `.env`). Trước khi cập nhật, dùng quy trình sao lưu ở mục 6. Script cần Ubuntu có Internet và quyền `sudo`; không tạo VM hay bật Hyper-V trên Windows.

### Cài thủ công

Thực hiện [hướng dẫn chính thức của Docker cho Ubuntu](https://docs.docker.com/engine/install/ubuntu/): gỡ các gói Docker xung đột, thêm kho apt chính thức, cài `docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin`. Sau đó:

```sh
sudo systemctl enable --now docker
sudo docker compose version
git clone <URL-cua-repo> ~/quiz
cd ~/quiz
cp .env.example .env
```

Sửa `.env` (không commit file này). Dùng mật khẩu PostgreSQL dài, ngẫu nhiên, **chỉ gồm ký tự an toàn trong URL** (ví dụ chữ, số, `_`, `-`) vì Compose ghép vào `DATABASE_URL`. Đặt `SESSION_SECRET` ngẫu nhiên tối thiểu 32 ký tự, `ADMIN_INITIAL_PASSWORD` mạnh, `COOKIE_SECURE=true`, và `WEB_ORIGIN=https://quiz.example.com` với subdomain thật. Giữ `NEXT_PUBLIC_API_BASE_URL=/api`. Ví dụ tạo các giá trị bằng `openssl rand -base64 48` cho secret và `openssl rand -hex 32` cho mật khẩu PostgreSQL. Giới hạn quyền truy cập file: `chmod 600 .env`. Dữ liệu triển khai này bắt đầu mới.

```sh
sudo docker compose up -d --build
sudo docker compose ps
sudo docker compose logs api --tail=100
curl -fsS http://localhost:8080/api/health
sudo docker compose exec api node dist/db/seed-admin.js
```

API áp dụng migration khi khởi động. Lệnh seed admin chỉ cần chạy một lần; chạy lại không thay mật khẩu admin hiện có. Giữ `ADMIN_INITIAL_PASSWORD` trong `.env` để Compose khởi động lại được, bảo vệ file này và đổi mật khẩu admin trong ứng dụng sau khi đăng nhập. PostgreSQL và proxy chỉ bind vào `127.0.0.1` của VM; không chuyển tiếp cổng trên router.

## 3. Cloudflare Tunnel

Trong Cloudflare Zero Trust, tạo **remotely managed tunnel**, chọn Linux và sao chép lệnh cài connector/token do Cloudflare cung cấp. Chạy lệnh cài `cloudflared` và `sudo cloudflared service install <TUNNEL_TOKEN>` **trong Ubuntu VM**, theo [hướng dẫn Cloudflare](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/). Giữ token ngoài Git và giới hạn quyền đọc. Trong tunnel, thêm public hostname `quiz.example.com` với service **HTTP** `localhost:8080`; Cloudflare sẽ cấp HTTPS công khai. Kiểm tra DNS route theo [hướng dẫn publish ứng dụng](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/routing-to-tunnel/).

```sh
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared
curl -fsS https://quiz.example.com/api/health
```

`WEB_ORIGIN` phải đúng chính xác origin công khai (gồm `https://`, không có path hoặc dấu `/` cuối). Nginx chuyển `X-Forwarded-Proto: https` từ tunnel tới API và web. Nếu đổi hostname, sửa cả route Cloudflare và `.env`, rồi chạy `sudo docker compose up -d` để tạo lại API.

## 4. Kiểm tra sử dụng và tự khởi động

- `sudo docker compose ps` phải có bốn container đang chạy; `sudo systemctl is-active docker cloudflared` phải trả `active`.
- `curl -fsS http://localhost:8080/api/health` và `curl -fsS https://quiz.example.com/api/health` phải trả `{"status":"ok"}`.
- Qua HTTPS: đăng nhập admin; tạo giáo viên và quiz; mở link học sinh, nộp bài, xem kết quả, xuất Excel và tải ảnh đề bài.
- Reboot Windows rồi **chưa đăng nhập**. Từ máy khác, kiểm tra subdomain HTTPS; sau đó kiểm tra VM, bốn container và dịch vụ `cloudflared`.
- Khôi phục thử một bản sao lưu trên VM/môi trường riêng trước khi coi quy trình sao lưu là hoàn tất.

## 5. Cập nhật

Sao lưu trước khi cập nhật. Trong VM:

```sh
cd ~/quiz
git pull --ff-only
sudo docker compose up -d --build
sudo docker compose ps
sudo docker compose logs api --tail=100
curl -fsS http://localhost:8080/api/health
```

Migration tự chạy khi API khởi động. Nếu API lỗi migration, xem log và khôi phục từ bản sao lưu đã xác nhận; không sửa migration đã áp dụng.

## 6. Sao lưu PostgreSQL và ảnh

Chạy trong `~/quiz`. Tạo thư mục riêng chỉ người quản trị đọc được; giữ hai file cùng một mốc thời gian và chép ra nơi lưu trữ khác VM. Để có snapshot nhất quán, tạm dừng web/API trong lúc sao lưu; tunnel vẫn có thể chạy và sẽ báo ứng dụng tạm ngừng.

```sh
mkdir -p ~/quiz-backups && chmod 700 ~/quiz-backups
sudo docker compose stop web api
sudo docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > ~/quiz-backups/quiz.dump
sudo docker compose run --rm --no-deps -v "$HOME/quiz-backups:/backup" --entrypoint tar api -C /workspace/quiz-be/uploads -czf /backup/quiz-assets.tar.gz .
sudo docker compose up -d
```

Kiểm tra file bằng `ls -lh ~/quiz-backups/` và `tar -tzf ~/quiz-backups/quiz-assets.tar.gz | head`.

## 7. Khôi phục trên môi trường riêng

Dùng cùng phiên bản mã nguồn hoặc phiên bản tương thích với bản dump. Tạo `.env` riêng, chạy `sudo docker compose up -d postgres` để tạo volume database trống, rồi khôi phục database và ảnh trước khi khởi động API/web. **Không dùng `docker compose down -v` trên hệ thống đang phục vụ.**

```sh
cd ~/quiz
sudo docker compose up -d postgres
sudo docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' < ~/quiz-backups/quiz.dump
sudo docker compose run --rm --no-deps -v "$HOME/quiz-backups:/backup:ro" --entrypoint sh api -c 'tar -C /workspace/quiz-be/uploads -xzf /backup/quiz-assets.tar.gz'
sudo docker compose up -d --build
curl -fsS http://localhost:8080/api/health
```

Chỉ khôi phục vào database trống hoặc bản sao thử nghiệm đã tách biệt. Xác nhận đăng nhập, quiz, kết quả và ảnh sau khi khôi phục. Bản dump chứa dữ liệu cá nhân; bảo vệ và mã hóa khi lưu ngoài VM.
