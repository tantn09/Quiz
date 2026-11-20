const messages: Record<string, string> = {
  "invalid_request": "Dữ liệu gửi lên chưa hợp lệ.",
  "invalid_catalog_selection": "Môn học hoặc khối lớp không còn hợp lệ. Hãy chọn lại.",
  "invalid_assets": "Ảnh đề bài không còn khả dụng. Hãy chèn lại ảnh.",
  "invalid_image": "Dữ liệu ảnh không hợp lệ.",
  "invalid_image_size": "Ảnh phải có kích thước tối đa 5 MB.",
  "invalid_image_type": "Hãy chọn ảnh PNG, JPEG hoặc WebP.",
  "import_invalid": "File Excel có lỗi. Hãy kiểm tra danh sách lỗi.",
  "not_found": "Không tìm thấy dữ liệu yêu cầu.",
  "variant_not_found": "Mã đề nguồn không còn tồn tại. Hãy chọn mã khác.",
  "last_active_variant": "Hãy bật một mã đề khác trước khi tắt mã đang hoạt động cuối cùng.",
  "last_active": "Hãy bật một mã đề khác trước khi xóa mã đang hoạt động cuối cùng.",
  "last_variant": "Bài kiểm tra phải có ít nhất một mã đề.",
  "no_active_variant": "Hãy bật ít nhất một mã đề trước khi mở lại bài.",
  "quiz_already_open": "Bài kiểm tra đang mở. Hãy tải lại để xem trạng thái mới.",
  "quiz_closed": "Bài kiểm tra đã đóng. Hãy mở lại để đổi hạn link.",
  "invalid_link_expiry": "Hạn link mới phải ở tương lai.",
  "unauthorized": "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.",
  "forbidden": "Bạn không có quyền thực hiện thao tác này.",
  "invalid_json": "Nội dung yêu cầu không đúng định dạng JSON.",
  "payload_too_large": "Dữ liệu gửi lên vượt quá dung lượng cho phép.",
  "unsupported_media_type": "Định dạng dữ liệu gửi lên không được hỗ trợ.",
  "rate_limited": "Bạn thao tác quá nhanh. Hãy thử lại sau.",
  "internal_error": "Máy chủ gặp lỗi. Hãy thử lại sau."
};

type ApiIssue = { path: (string | number)[]; code: string };
export class ApiError extends Error {
  constructor(readonly status: number, readonly payload: { error?: string; issues?: ApiIssue[]; errors?: unknown; requestId?: string }) {
    super(payload.error ?? String(status));
  }
}

export async function apiFetch(input: string, init?: RequestInit) {
  const response = await fetch(input, init);
  if (response.ok) return response;
  const payload = await response.json().catch((error: unknown) => {
    if (error instanceof SyntaxError) return null;
    throw error;
  });
  throw new ApiError(response.status, payload && typeof payload === "object" ? payload : {});
}

export function reportApiError(error: unknown, fallback: string, t: (text: string) => string, show: (text: string) => void) {
  if (error instanceof Error && error.name === "AbortError") return;
  if (!(error instanceof ApiError)) { show(t(fallback)); return; }
  const statusCodes: Record<number, string> = { 401: "unauthorized", 403: "forbidden", 404: "not_found", 413: "payload_too_large", 415: "unsupported_media_type", 429: "rate_limited" };
  const code = error.payload.error ?? "";
  const known = Object.hasOwn(messages, code) ? code : statusCodes[error.status] ?? (error.status >= 500 ? "internal_error" : "");
  const issue = Array.isArray(error.payload.issues) ? error.payload.issues[0] : undefined;
  const path = Array.isArray(issue?.path) ? issue.path : [];
  const field = [...path].reverse().find((segment) => typeof segment === "string");
  const fieldNames: Record<string, string> = {
    title: "Tên bài kiểm tra", durationMinutes: "Thời lượng (phút)", assignedClass: "Lớp được giao",
    promptDocument: "Đề bài", linkExpiresAt: "Hạn dùng link", prompt: "Nội dung câu hỏi",
    points: "Điểm", correctOption: "Đáp án đúng", options: "Các lựa chọn", questions: "Câu hỏi",
  };
  const fieldLabel = typeof field === "string" && Object.hasOwn(fieldNames, field) ? t(fieldNames[field]) : "";
  const question = path[0] === "questions" && Number.isInteger(path[1]) ? `${t("Câu")} ${Number(path[1]) + 1}` : "";
  const message = t(issue?.code === "custom" && field === "correctOption" ? "Chọn đáp án đúng cho câu hỏi."
    : issue?.code === "custom" && field === "options" ? "Nhập ít nhất hai lựa chọn cho câu hỏi."
    : messages[known] ?? fallback);
  const location = [question, fieldLabel].filter(Boolean).join(" · ");
  show([location, message, error.status >= 500 ? error.payload.requestId : ""].filter(Boolean).join(" — "));
}
