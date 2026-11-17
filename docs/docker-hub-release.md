# Phát hành Quiz qua Docker Hub

Hai image cần phát hành là `quiz-api` và `quiz-web`. PostgreSQL và Nginx dùng image công khai có sẵn. File `docker-compose.release.yml` ghi đè image cho API/web; giữ `docker-compose.yml`, `infra/nginx.conf` và `.env` trên máy đích. Không đưa `.env`, PostgreSQL hay ảnh tải lên vào image.

Bản phát hành hiện tại: `tantn09/quiz-api:2026-11-17` và `tantn09/quiz-web:2026-11-17` (Linux `amd64`).

## Máy phát hành

Đăng nhập Docker Hub bằng `docker login`. Thay `TEN_DOCKER_HUB` và tag phiên bản, rồi chạy tại thư mục repo:

```powershell
docker build -f quiz-be/Dockerfile -t TEN_DOCKER_HUB/quiz-api:1.0.0 .
docker build -f quiz-fe/Dockerfile -t TEN_DOCKER_HUB/quiz-web:1.0.0 .
docker push TEN_DOCKER_HUB/quiz-api:1.0.0
docker push TEN_DOCKER_HUB/quiz-web:1.0.0
```

Dùng tag phiên bản cố định thay vì `latest`; nếu image riêng tư, máy đích cần `docker login` có quyền pull.

## Máy đích

Chép `docker-compose.yml`, `docker-compose.release.yml`, `infra/nginx.conf`, `.env.example` vào cùng cấu trúc thư mục. Tạo `.env` và đặt `POSTGRES_PASSWORD`, `SESSION_SECRET`, `ADMIN_INITIAL_PASSWORD`, `COOKIE_SECURE=true`, `WEB_ORIGIN=https://<hostname>`, `QUIZ_IMAGE_NAMESPACE=tantn09`, `QUIZ_IMAGE_TAG=2026-11-17`. Sau đó:

```powershell
docker compose -f docker-compose.yml -f docker-compose.release.yml pull
docker compose -f docker-compose.yml -f docker-compose.release.yml up -d --no-build
docker compose -f docker-compose.yml -f docker-compose.release.yml exec api node dist/db/seed-admin.js
Invoke-RestMethod http://localhost:8080/api/health
```

Lệnh seed admin chỉ cần chạy một lần. Khi cập nhật, sao lưu PostgreSQL và volume ảnh trước; đổi `QUIZ_IMAGE_TAG`, rồi chạy lại `pull` và `up -d --no-build`. Compose giữ các volume hiện có. Cloudflare Tunnel và DNS vẫn cấu hình riêng trên máy đích.
