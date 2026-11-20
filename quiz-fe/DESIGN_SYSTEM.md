# Quiz FE design system

## Hướng thiết kế

Giao diện lớp học dùng xanh dương–indigo làm điểm nhấn. Gradient chỉ xuất hiện ở hành động chính, nhận diện và vùng giới thiệu. Bề mặt chứa form, bảng và nội dung dùng màu đồng nhất để giữ độ tương phản. Theme sáng/tối chia sẻ cùng tên token; ngôn ngữ giao diện lấy từ `useTranslation`.

## Token

Token ngữ nghĩa đặt trong `app/globals.css`: `--background`, `--surface`, `--surface-subtle`, `--surface-accent`, `--foreground`, `--muted`, `--line`, `--primary`, `--focus`, `--gradient-start`, `--gradient-end`. Tailwind v4 ánh xạ thành `bg-page`, `bg-surface`, `text-content`, `text-content-muted`, `border-line`, `text-brand` và `ring-focus`.

Class `ds-gradient` dùng cho nút chính; `ds-gradient-soft` dùng cho hero. `ds-card`, `ds-field`, `ds-page-title`, `ds-pill` và các trạng thái `ds-info`, `ds-error`, `ds-warning`, `ds-success` là style nền tảng. Không dùng gradient làm nền cho đoạn văn dài hoặc bảng dữ liệu.

## Component

| Component | Vai trò |
| --- | --- |
| `Button` | Hành động chính, viền, ghost, nguy hiểm; hỗ trợ `asChild` cho Next Link. |
| `Input`, `Textarea`, `Field` | Form với nhãn, gợi ý và lỗi gần trường. |
| `Select` | Dropdown trong `components/ui/select.tsx`; nhận `value`, `onValueChange`, `options`, `ariaLabel`; item dùng style và điều hướng bàn phím của Radix. |
| `Card` | Nhóm nội dung trên nền trang. |
| `Badge` | Trạng thái ngắn; dùng chữ cùng màu để truyền đạt trạng thái. |
| `Alert` | Phản hồi thông tin, thành công hoặc lỗi. |
| `EmptyState` | Danh sách chưa có dữ liệu. |
| `Table` | Bảng có vùng cuộn ngang trên màn hình hẹp. |
| `PageHeader` | Tiêu đề, mô tả và hành động của trang. |
| `Modal` | Form tạo/sửa; quản lý focus, Escape và khóa cuộn nền. |

Các component nằm trong `components/ui`, riêng `Modal` ở `components/modal.tsx`. Ưu tiên dùng component và token ngữ nghĩa trước khi thêm màu trực tiếp vào trang. Kiểm tra ở 375, 768, 1024 và 1440 px, theme sáng/tối, tiếng Việt/Anh và điều hướng bàn phím.


## Layout và phạm vi áp dụng

| Route | Layout và component |
| --- | --- |
| `/` | Bố cục giới thiệu, token nhận diện và Button dùng chung |
| `/login`, `/register` | AuthLayout, form, Button và Alert |
| `/admin`, `/admin/teachers`, `/admin/catalogs`, `/settings` | DashboardLayout, PageHeader và component form/bảng |
| `/admin/quiz`, `/teacher/quiz` và các trang tạo, xem, sửa | DashboardLayout, trình soạn, chi tiết và bộ điều khiển bài kiểm tra |
| `/admin/students`, `/teacher/students` | DashboardLayout, biểu mẫu học sinh và nhập Excel |
| `/admin/results`, `/teacher/results` | DashboardLayout, bảng kết quả, duyệt yêu cầu và dialog chấm điểm |
| `/q/[token]` | AssessmentLayout, form vào bài, câu hỏi và dialog nộp bài |

`NativeSelect` dùng cho trường cần tham gia FormData hoặc thao tác chọn theo nền tảng. `Select` dùng cho lựa chọn tùy biến có điều hướng Radix. Lỗi tải danh mục dùng `ErrorToast`, thông tin cần đọc tiếp dùng `Alert`, và lỗi nhập liệu đi cùng trường. Màu trạng thái và kích thước điều khiển lấy từ token trong CSS.

Các module trong `features` quản lý logic và giao diện theo luồng. Đặt trạng thái hoàn toàn thuộc một hộp thoại hoặc biểu mẫu trong module đó. Layout và UI primitive chỉ nhận dữ liệu hoặc callback cần để hiển thị.
