import ExcelJS from "exceljs";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireTeacherAccess } from "../auth.js";
import { quizInput } from "./quizzes.js";

type ImportError = { sheet: string; row: number; column: string; message: string };
const quizFields = ["title", "description", "durationMinutes", "linkExpiresAt", "promptText"] as const;
const questionColumns = ["type", "prompt", "points", ...Array.from({ length: 8 }, (_, i) => `option${i + 1}`), "correctOption"];
const uploadBody = z.object({ filename: z.string(), data: z.string().max(2_800_000) });

function text(cell: ExcelJS.Cell, sheet: string, row: number, column: string, errors: ImportError[]): string {
  if (cell.type === ExcelJS.ValueType.Formula) {
    errors.push({ sheet, row, column, message: "Không dùng công thức trong file import." });
    return "";
  }
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  errors.push({ sheet, row, column, message: "Ô cần chứa văn bản hoặc số." });
  return "";
}

export async function quizImportRoutes(app: FastifyInstance): Promise<void> {
  app.get("/teacher/quizzes/import-template.xlsx", { preHandler: [requireTeacherAccess] }, async (_request, reply) => {
    const workbook = new ExcelJS.Workbook();
    const info = workbook.addWorksheet("Quiz");
    info.addRow(["field", "value"]);
    info.addRows([["title", ""], ["description", ""], ["durationMinutes", 30], ["linkExpiresAt", ""], ["promptText", ""]]);
    info.getColumn(1).width = 24; info.getColumn(2).width = 46;
    const questions = workbook.addWorksheet("Questions");
    questions.addRow(questionColumns);
    questions.getColumn(1).width = 14; questions.getColumn(2).width = 48;
    for (let i = 3; i <= 12; i++) questions.getColumn(i).width = 16;
    for (let row = 2; row <= 201; row++) {
      questions.getCell(`A${row}`).dataValidation = { type: "list", allowBlank: true, formulae: ['"choice,essay"'] };
      questions.getCell(`C${row}`).dataValidation = { type: "whole", operator: "between", allowBlank: true, formulae: [0, 1000] };
      questions.getCell(`L${row}`).dataValidation = { type: "whole", operator: "between", allowBlank: true, formulae: [1, 8] };
    }
    const guide = workbook.addWorksheet("Hướng dẫn");
    guide.addRows([
      ["HƯỚNG DẪN NHẬP QUIZ", "Điền sheet Quiz và Questions, sau đó tải file này lên ở mục Nhập Excel."],
      ["Quiz", "title: tên quiz (bắt buộc); description: mô tả; durationMinutes: số phút từ 1 đến 1440."],
      ["Quiz", "linkExpiresAt: để trống nếu không hết hạn; nếu điền, dùng ISO 8601 có múi giờ, ví dụ 2026-12-31T23:59:00+07:00."],
      ["Quiz", "promptText: nội dung đề bài chung, có thể để trống."],
      ["Questions", "Mỗi dòng là một câu hỏi. type chọn choice (trắc nghiệm) hoặc essay (tự luận); prompt là nội dung câu hỏi; points là điểm số."],
      ["Trắc nghiệm", "Điền liên tiếp option1, option2... (2 đến 8 đáp án). correctOption là SỐ THỨ TỰ đáp án đúng, bắt đầu từ 1."],
      ["Tự luận", "Để trống option1–option8 và correctOption."],
      ["Ví dụ trắc nghiệm", "type=choice | prompt=2 + 2 bằng bao nhiêu? | points=1 | option1=3 | option2=4 | option3=5 | correctOption=2"],
      ["Ví dụ tự luận", "type=essay | prompt=Giải thích cách em tìm đáp án. | points=2"],
      ["Lưu ý", "Không dùng công thức. Tối đa 200 câu hỏi và file 2 MB. Ảnh đề bài được thêm trong modal sau khi import."],
      ["Môn học và lớp", "Sau khi import, chọn môn học và thêm lớp cùng hạn truy cập trong modal tạo quiz."],
    ]);
    guide.getColumn(1).width = 23; guide.getColumn(2).width = 110;
    for (const sheet of [info, questions, guide]) { sheet.views = [{ state: "frozen", ySplit: 1 }]; sheet.getRow(1).font = { bold: true }; sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEAF0FF" } }; }
    questions.autoFilter = { from: "A1", to: "L1" };
    return reply.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").header("Content-Disposition", 'attachment; filename="quiz-import-template.xlsx"').send(Buffer.from(await workbook.xlsx.writeBuffer()));
  });

  app.post("/teacher/quizzes/import-preview", { preHandler: [requireTeacherAccess], bodyLimit: 3_000_000 }, async (request, reply) => {
    const body = uploadBody.safeParse(request.body);
    if (!body.success || !body.data.filename.toLowerCase().endsWith(".xlsx")) return reply.code(400).send({ errors: [{ sheet: "File", row: 0, column: "file", message: "Chỉ nhận file .xlsx tối đa 2 MB." }] });
    const bytes = Buffer.from(body.data.data, "base64");
    if (bytes.length > 2_000_000 || bytes.length < 4 || bytes.toString("ascii", 0, 2) !== "PK") return reply.code(400).send({ errors: [{ sheet: "File", row: 0, column: "file", message: "File .xlsx không hợp lệ hoặc quá 2 MB." }] });
    const workbook = new ExcelJS.Workbook();
    try { await workbook.xlsx.load(bytes as unknown as Parameters<typeof workbook.xlsx.load>[0]); }
    catch { return reply.code(400).send({ errors: [{ sheet: "File", row: 0, column: "file", message: "Không đọc được file .xlsx." }] }); }
    const errors: ImportError[] = [];
    const info = workbook.getWorksheet("Quiz");
    const questionSheet = workbook.getWorksheet("Questions");
    if (!info) errors.push({ sheet: "Quiz", row: 0, column: "sheet", message: "Thiếu sheet Quiz." });
    if (!questionSheet) errors.push({ sheet: "Questions", row: 0, column: "sheet", message: "Thiếu sheet Questions." });
    if (errors.length) return reply.code(400).send({ errors });

    const fields: Record<string, string> = {};
    if (text(info!.getRow(1).getCell(1), "Quiz", 1, "A", errors) !== "field" || text(info!.getRow(1).getCell(2), "Quiz", 1, "B", errors) !== "value") errors.push({ sheet: "Quiz", row: 1, column: "A:B", message: "Tiêu đề cột phải là field, value." });
    for (let row = 2; row <= info!.rowCount; row++) {
      const key = text(info!.getRow(row).getCell(1), "Quiz", row, "A", errors);
      if (!key) continue;
      if (!quizFields.includes(key as typeof quizFields[number])) { errors.push({ sheet: "Quiz", row, column: "A", message: `Trường không hỗ trợ: ${key}.` }); continue; }
      if (key in fields) errors.push({ sheet: "Quiz", row, column: "A", message: `Trường ${key} bị lặp.` });
      fields[key] = text(info!.getRow(row).getCell(2), "Quiz", row, "B", errors);
    }
    const headers = questionColumns.map((_, index) => text(questionSheet!.getRow(1).getCell(index + 1), "Questions", 1, questionColumns[index], errors));
    questionColumns.forEach((name, index) => { if (headers[index] !== name) errors.push({ sheet: "Questions", row: 1, column: name, message: `Cột ${name} không đúng hoặc bị thiếu.` }); });
    const parsedQuestions: Array<{ type: string; prompt: string; points: number; options: string[]; correctOption: number | null }> = [];
    for (let row = 2; row <= questionSheet!.rowCount; row++) {
      const values = questionColumns.map((name, index) => text(questionSheet!.getRow(row).getCell(index + 1), "Questions", row, name, errors));
      if (values.every((value) => !value)) continue;
      const [type, prompt, pointsText, ...rest] = values;
      const optionsRaw = rest.slice(0, 8);
      const options = optionsRaw.filter(Boolean);
      if (options.some((_, index) => !optionsRaw[index])) errors.push({ sheet: "Questions", row, column: "option1–option8", message: "Các lựa chọn cần liền nhau, không bỏ trống ở giữa." });
      const points = pointsText === "" ? 1 : Number(pointsText);
      const answer = rest[8] === "" ? null : Number(rest[8]);
      if (!Number.isInteger(points)) errors.push({ sheet: "Questions", row, column: "points", message: "Điểm cần là số nguyên." });
      if (answer !== null && !Number.isInteger(answer)) errors.push({ sheet: "Questions", row, column: "correctOption", message: "Đáp án cần là số nguyên từ 1." });
      if (type === "essay" && (options.length || answer !== null)) errors.push({ sheet: "Questions", row, column: "correctOption", message: "Câu tự luận không có lựa chọn hoặc đáp án." });
      parsedQuestions.push({ type, prompt, points, options, correctOption: answer === null ? null : answer - 1 });
    }
    const duration = Number(fields.durationMinutes);
    if (!Number.isInteger(duration)) errors.push({ sheet: "Quiz", row: 4, column: "durationMinutes", message: "Thời lượng cần là số nguyên." });
    const linkExpiresAt = fields.linkExpiresAt ? new Date(fields.linkExpiresAt) : null;
    if (fields.linkExpiresAt && (!/([+-]\d{2}:\d{2}|Z)$/.test(fields.linkExpiresAt) || Number.isNaN(linkExpiresAt!.getTime()))) errors.push({ sheet: "Quiz", row: 5, column: "linkExpiresAt", message: "Hạn link cần là ISO 8601 có múi giờ." });
    const draft = { title: fields.title ?? "", description: fields.description ?? "", promptText: fields.promptText ?? "", promptImages: [], durationMinutes: duration, linkExpiresAt: linkExpiresAt && !Number.isNaN(linkExpiresAt.getTime()) ? linkExpiresAt.toISOString() : null, questions: parsedQuestions };
    const validated = quizInput.safeParse(draft);
    if (!validated.success) for (const issue of validated.error.issues) {
      const [root, index, field] = issue.path;
      errors.push({ sheet: root === "questions" ? "Questions" : "Quiz", row: root === "questions" ? Number(index) + 2 : Math.max(2, quizFields.indexOf(String(root) as typeof quizFields[number]) + 2), column: String(field ?? root), message: issue.message });
    }
    if (errors.length) return reply.code(400).send({ errors });
    return { draft: validated.data };
  });
}
