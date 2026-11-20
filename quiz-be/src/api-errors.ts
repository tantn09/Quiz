import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodError } from "zod";

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

export function validationError(error: ZodError, source: "body" | "params" | "query" = "body") {
  return {
    error: "invalid_request",
    details: error.flatten(),
    issues: error.issues.map((issue) => ({ source, path: issue.path, code: issue.code, message: issue.message })),
  };
}

function isQuizRequest(request: FastifyRequest) {
  const route = request.routeOptions.url ?? "";
  return /^\/teacher\/quizzes(?:$|\/(?:import-preview|import-template\.xlsx|:id(?:$|\/(?:clone|variants(?:\/:variantId)?|stop|extend-link|reopen|extend-attempts))$))/.test(route)
    || ["/teacher/assets", "/teacher/assets/reserve", "/teacher/catalogs", "/auth/me"].includes(route);
}

export function registerQuizErrors(app: FastifyInstance) {
  app.addHook("onSend", async (request, reply, payload) => {
    const status = reply.statusCode;
    if (status < 400 || !isQuizRequest(request)) return payload;
    let original: Record<string, unknown> = {};
    if (typeof payload === "string") {
      try { original = JSON.parse(payload) ?? {}; } catch { /* Use the HTTP fallback. */ }
    }
    const fallback = status === 401 ? "unauthorized" : status === 403 ? "forbidden"
      : status === 404 ? "not_found" : status === 413 ? "payload_too_large"
      : status === 415 ? "unsupported_media_type" : status === 429 ? "rate_limited"
      : status === 400 && /^FST_ERR_CTP_/.test(String(original.code)) ? "invalid_json" : "invalid_request";
    const error = status >= 500 ? "internal_error" : Array.isArray(original.errors) ? "import_invalid"
      : typeof original.error === "string" && Object.hasOwn(messages, original.error) ? original.error : fallback;
    // Fastify logs unhandled server errors with the same request ID before serialization.
    const { details, issues, errors } = status < 500 ? original : {};
    reply.type("application/json");
    return JSON.stringify({ error, message: messages[error], requestId: request.id, details, issues, errors });
  });
}
