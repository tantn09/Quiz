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
