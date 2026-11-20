# Quiz API errors

Quiz management, Excel import and templates, prompt image upload and reservation, teacher catalogs, and the account lookup used by quiz drafts return JSON errors. Use `error` to identify the failure and `requestId` to correlate it with server logs. The API supplies a Vietnamese `message`. The web app localizes known codes in Vietnamese and English.

For example, trying to disable the last active variant returns HTTP 409.

```json
{
  "error": "last_active_variant",
  "message": "Hãy bật một mã đề khác trước khi tắt mã đang hoạt động cuối cùng.",
  "requestId": "req-42"
}
```

Validation errors use HTTP 400 and can include `issues` with `source`, `path`, `code`, and `message`. Array indices in paths start at zero. Existing clients can still read `details`. Excel import errors retain the `errors` array with sheet, row, column, and message.

HTTP 401 indicates that the caller must sign in, 403 indicates insufficient permissions, and 404 covers missing and inaccessible quizzes. HTTP 409 describes a state conflict. Unexpected server failures return a generic message and a request ID. Successful responses retain their existing payloads and status codes.
