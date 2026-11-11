# Lộ trình triển khai ứng dụng Quiz

Tài liệu này chia việc xây dựng ứng dụng thành các phase theo thứ tự phụ thuộc. Yêu cầu chức năng được lấy từ [`plan.md`](plan.md); stack triển khai đã chốt là Next.js, Fastify và PostgreSQL.

## Phase 1: Nền tảng dự án

**Phạm vi:** Tạo pnpm workspace TypeScript gồm `quiz-fe` với Next.js App Router, shadcn/ui và Tailwind CSS; `quiz-be` với Fastify. Chuẩn bị PostgreSQL, Drizzle ORM và `pg`, cấu hình dùng chung, Docker Compose ban đầu và biến môi trường mẫu.

**Đầu ra:** Cấu trúc workspace chạy được ở môi trường phát triển; web và API có điểm khởi chạy riêng; kết nối cấu hình được tới PostgreSQL.

**Checklist hoàn thành:**

- [x] Workspace pnpm và TypeScript được cấu hình cho cả web và API.
- [x] Next.js App Router, shadcn/ui và Tailwind CSS được khởi tạo trong `quiz-fe`.
- [x] Fastify được khởi tạo trong `quiz-be`.
- [x] PostgreSQL, Drizzle ORM và `pg` được cấu hình; có biến môi trường mẫu không chứa bí mật.
- [x] Docker Compose khởi chạy được các dịch vụ cần thiết cho phát triển.

## Phase 2: Cơ sở dữ liệu và đăng nhập

**Phạm vi:** Thiết kế schema cho tài khoản, quiz, câu hỏi, link, lượt làm và câu trả lời; thiết lập migration. Xây dựng đăng nhập cho Admin và Teacher bằng cookie bảo mật, phân quyền ba vai trò và bảo vệ route ở phía máy chủ. Student không cần tài khoản. Lệnh khởi tạo tạo Admin đầu tiên với username `admin` và mật khẩu ban đầu `Admin@1234`; mật khẩu phải được băm trước khi lưu.

**Đầu ra:** Migration cơ sở dữ liệu, luồng phiên đăng nhập và phân quyền có thể dùng ở các phase sau, cùng lệnh khởi tạo tài khoản Admin.

**Checklist hoàn thành:**

- [x] Schema và migration bao phủ các thực thể cần thiết của ứng dụng.
- [x] Admin và Teacher đăng nhập, đăng xuất bằng cookie bảo mật.
- [x] Route `/admin` và `/teacher` được kiểm tra quyền ở máy chủ; Student không truy cập khu vực quản trị.
- [x] Tài khoản bị khóa không thể đăng nhập.
- [x] Lệnh khởi tạo tạo Admin đầu tiên và lưu mật khẩu dạng băm.

## Phase 3: Quản lý giáo viên

**Phạm vi:** Xây dựng giao diện và API để Admin quản lý thông tin và tài khoản giáo viên: tạo, sửa, tìm kiếm, lọc, khóa và đặt lại mật khẩu. Admin cũng sử dụng được các chức năng dành cho Teacher.

**Đầu ra:** Admin quản lý được tài khoản giáo viên và có thể đi vào các chức năng quản lý quiz như Teacher.

**Checklist hoàn thành:**

- [x] Admin tạo và cập nhật thông tin giáo viên.
- [x] Danh sách giáo viên hỗ trợ tìm kiếm và lọc.
- [x] Admin khóa/mở khóa tài khoản và đặt lại mật khẩu.
- [x] Quyền Admin bao gồm các chức năng của Teacher.

## Phase 4: Quản lý quiz

**Phạm vi:** Teacher tạo, sửa, tìm kiếm, lọc và ngừng sử dụng quiz. Quiz hỗ trợ câu trắc nghiệm và tự luận, link chung để chia sẻ, thời lượng làm bài và hạn sử dụng link. Hỗ trợ gia hạn thời lượng cho các lượt đang làm và gia hạn hạn link như hai thao tác riêng. Khi quiz đã có bài nộp, giữ snapshot nội dung câu hỏi để kết quả không đổi theo lần chỉnh sửa sau.

**Đầu ra:** Teacher quản lý được quiz và phát hành link để Student bắt đầu làm bài.

**Checklist hoàn thành:**

- [x] Teacher tạo, sửa và ngừng sử dụng quiz; danh sách có tìm kiếm và lọc.
- [x] Quiz có câu trắc nghiệm, câu tự luận, thời lượng và hạn link.
- [x] Link dùng chung mở đúng quiz và bị từ chối sau khi hết hạn hoặc quiz ngừng sử dụng.
- [x] Có thao tác gia hạn thời lượng và gia hạn hạn link riêng biệt.
- [x] Snapshot câu hỏi được giữ cho quiz đã có bài nộp.

## Phase 5: Luồng làm bài của Student

**Phạm vi:** Student vào quiz bằng link, nhập họ tên và lớp; mỗi cặp tên + lớp chỉ có một lượt cho mỗi quiz. Máy chủ lưu thời điểm bắt đầu và hạn nộp. Câu trả lời được lưu trong trình duyệt, khôi phục khi mở lại và đồng bộ lên máy chủ khi có mạng. Khi hết giờ, trình duyệt chốt và tự nộp bài; nếu đang mất mạng thì gửi bản đã chốt khi kết nối lại. Không gửi đáp án đúng xuống trình duyệt trước khi nộp.

**Đầu ra:** Student hoàn thành bài trên thiết bị, có thể tiếp tục sau khi tải lại trang hoặc mất kết nối, và nhận xác nhận khi nộp.

**Checklist hoàn thành:**

- [x] Link yêu cầu nhập họ tên và lớp trước khi bắt đầu.
- [x] Mỗi tên + lớp chỉ tạo được một lượt cho một quiz.
- [x] Hạn nộp lấy từ máy chủ và đồng hồ vẫn chạy khi đóng trang hoặc mất mạng.
- [x] Câu trả lời được lưu cục bộ và khôi phục khi mở lại lượt làm.
- [x] Bài được đồng bộ khi có mạng; hết giờ thì tự chốt và nộp.
- [x] Bản đã chốt khi ngoại tuyến được gửi khi có mạng trở lại.
- [x] Student chỉ thấy xác nhận đã nộp; đáp án đúng không được gửi trước đó.

## Phase 6: Kết quả và chấm tự luận

**Phạm vi:** Tự chấm câu trắc nghiệm. Teacher xem danh sách bài nộp, mở từng bài và xem câu trả lời của Student, chấm điểm câu tự luận, lưu điểm và trạng thái chấm. Hỗ trợ tìm kiếm, lọc kết quả và xuất `.xlsx`. Student chỉ thấy xác nhận đã nộp.

**Đầu ra:** Teacher quản lý và chấm được kết quả; dữ liệu điểm và trạng thái chấm được lưu trong cơ sở dữ liệu.

**Checklist hoàn thành:**

- [x] Câu trắc nghiệm được chấm tự động theo snapshot câu hỏi.
- [x] Teacher xem danh sách bài nộp, nội dung bài và từng câu trả lời.
- [x] Teacher chấm câu tự luận và lưu điểm cùng trạng thái chấm.
- [x] Danh sách kết quả hỗ trợ tìm kiếm và lọc.
- [x] Có thể xuất kết quả ra tệp `.xlsx`.
- [x] Student không xem được đáp án hoặc kết quả chấm của người khác.

## Phase 7: Cài đặt và hoàn thiện giao diện

**Phạm vi:** Lưu ngôn ngữ và theme theo tài khoản Admin/Teacher. Hoàn thiện giao diện tiếng Việt/tiếng Anh, sáng/tối và responsive; giữ giao diện sáng sủa, dễ đọc, phù hợp cho việc làm bài quiz.

**Đầu ra:** Giao diện nhất quán trên các khu vực Admin, Teacher và Student, dùng được trên điện thoại và máy tính.

**Checklist hoàn thành:**

- [x] Admin và Teacher lưu được lựa chọn ngôn ngữ và theme theo tài khoản.
- [x] Các màn hình chính có nội dung tiếng Việt và tiếng Anh.
- [x] Theme sáng và tối hiển thị nhất quán.
- [x] Các luồng quản trị và làm bài sử dụng được trên màn hình nhỏ và lớn.

## Phase 8: Triển khai

**Phạm vi:** Hoàn thiện Docker Compose cho web, API và PostgreSQL. Cấu hình reverse proxy chuyển `/api` tới Fastify để web và API dùng cùng origin; dùng volume bền vững cho dữ liệu. Viết hướng dẫn cấu hình, migration, sao lưu và vận hành trên VPS.

**Đầu ra:** Bộ cấu hình và tài liệu để triển khai ứng dụng trên VPS, nâng cấp schema và bảo vệ dữ liệu.

**Checklist hoàn thành:**

- [x] Docker Compose chạy web, API và PostgreSQL.
- [x] Reverse proxy định tuyến `/api` tới Fastify cùng origin với web.
- [x] Dữ liệu PostgreSQL nằm trên volume bền vững.
- [x] Tài liệu hướng dẫn cấu hình môi trường, chạy migration và khởi động dịch vụ trên VPS.
- [x] Có quy trình sao lưu và khôi phục dữ liệu.

## Thứ tự phụ thuộc

Hoàn thành lần lượt Phase 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8. Phase 3 cần đăng nhập và phân quyền từ Phase 2; Phase 4 cần cơ sở dữ liệu; Phase 5 cần quiz và link; Phase 6 cần lượt làm và câu trả lời; Phase 8 đóng gói toàn bộ ứng dụng. Có thể hoàn thiện giao diện theo từng phase, còn Phase 7 tập trung vào cài đặt và rà soát nhất quán toàn sản phẩm.

## Quy ước phạm vi

- Không thêm phase riêng để viết hoặc chạy bộ kiểm thử tự động.
- Chưa chốt phiên bản dependency trước khi khởi tạo mã nguồn.
- Mật khẩu `Admin@1234` là mật khẩu ban đầu của Admin đầu tiên; chỉ lưu dưới dạng băm.
