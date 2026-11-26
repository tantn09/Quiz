import { SaxesParser } from "saxes";
import yauzl from "yauzl";
import { quizInput } from "./quizzes.js";

export type ImportError = { sheet: string; row: number; column: string; message: string };
const namespace = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const xmlLimit = 2_000_000;
type Inline = { type: "text"; text: string; marks?: { type: string }[] } | { type: "hardBreak" };
type Paragraph = { row: number; table: boolean; align?: string; content: Inline[]; unsupported: boolean };

function readDocument(bytes: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(bytes, { lazyEntries: true, validateEntrySizes: true }, (error, zip) => {
      if (error || !zip) return reject(error);
      let document: Buffer | undefined;
      function fail(error: unknown) { zip!.close(); reject(error); }
      zip.on("error", fail);
      zip.on("end", () => {
        zip.close();
        if (document) resolve(document);
        else reject(new Error("Missing Word document"));
      });
      zip.on("entry", (entry: yauzl.Entry) => {
        if (entry.fileName !== "word/document.xml") return zip.readEntry();
        if (document || entry.uncompressedSize > xmlLimit) return fail(new Error("Invalid Word document entry"));
        zip.openReadStream(entry, async (streamError, stream) => {
          if (streamError || !stream) return fail(streamError);
          try {
            const chunks: Buffer[] = [];
            let size = 0;
            for await (const chunk of stream) {
              size += chunk.length;
              if (size > xmlLimit) throw new Error("Word document is too large");
              chunks.push(chunk);
            }
            document = Buffer.concat(chunks);
            zip.readEntry();
          } catch (error) { fail(error); }
        });
      });
      zip.readEntry();
    });
  });
}

function readParagraphs(xml: string): Paragraph[] {
  const parser = new SaxesParser({ xmlns: true });
  const paragraphs: Paragraph[] = [];
  const stack: string[] = [];
  let paragraph: Paragraph | undefined;
  let marks: { type: string }[] = [];
  let superscript = false;
  let body = false;
  let ignoredDepth = 0;
  parser.on("doctype", () => { throw new Error("Unexpected document type"); });
  parser.on("opentag", (tag) => {
    const name = tag.uri === namespace ? tag.local : "";
    stack.push(name);
    if (stack.length > 128) throw new Error("Word document is nested too deeply");
    if (name === "body" && stack.join("/") === "document/body") body = true;
    if (!body || ignoredDepth) return;
    if (["drawing", "pict", "object", "del", "moveFrom"].includes(name)) {
      if (paragraph && name === "object") paragraph.unsupported = true;
      ignoredDepth = stack.length;
      return;
    }
    if (name === "p") {
      paragraph = { row: paragraphs.length + 1, table: stack.includes("tbl"), content: [], unsupported: false };
      paragraphs.push(paragraph);
    }
    if (!paragraph) return;
    const value = Object.values(tag.attributes).find((attr) => attr.uri === namespace && attr.local === "val")?.value;
    const parent = stack.at(-2);
    if (name === "jc" && parent === "pPr") paragraph.align = ({ both: "justify", center: "center", right: "right", left: "left" } as Record<string, string>)[value ?? ""];
    if (name === "r") { marks = []; superscript = false; }
    if (parent === "rPr" && stack.at(-3) === "r") {
      if (name === "vertAlign") superscript = value === "superscript";
      const mark = ({ b: "bold", i: "italic", u: "underline", strike: "strike" } as Record<string, string>)[name];
      if (mark && !["0", "false", "off", "none"].includes(value ?? "")) marks.push({ type: mark });
    }
    if (name === "tab") paragraph.content.push({ type: "text", text: " " });
    const breakType = Object.values(tag.attributes).find((attr) => attr.uri === namespace && attr.local === "type")?.value;
    if (name === "cr" || (name === "br" && (!breakType || breakType === "textWrapping"))) paragraph.content.push({ type: "hardBreak" });
  });
  parser.on("text", (value) => {
    if (!paragraph || ignoredDepth || stack.at(-1) !== "t") return;
    const text = superscript ? value.replace(/[0-9]/g, (digit) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(digit)]) : value;
    if (text) paragraph.content.push({ type: "text", text, ...(marks.length && { marks: [...marks] }) });
  });
  parser.on("closetag", (tag) => {
    if (ignoredDepth) {
      if (paragraph && ["blip", "imagedata", "txbxContent", "textbox", "oleObj"].includes(tag.local)) paragraph.unsupported = true;
      if (ignoredDepth === stack.length) ignoredDepth = 0;
    } else {
      if (stack.at(-1) === "p") paragraph = undefined;
      if (stack.length === 2 && stack.at(-1) === "body") body = false;
    }
    stack.pop();
  });
  parser.write(xml).close();
  return paragraphs;
}

function plainText(paragraph: Paragraph) {
  return paragraph.content.map((node) => node.type === "text" ? node.text : "\n").join("").trim();
}

const score = "(\\d+(?:[,.]\\d+)?)";
const scoreSuffix = `\\(\\s*${score}\\s*điểm\\s*\\)`;
const readingHeading = new RegExp(`^I\\.\\s*ĐỌC HIỂU(?:\\s*${scoreSuffix})?$`, "iu");
const writingHeading = new RegExp(`^II\\.\\s*VIẾT\\s*${scoreSuffix}$`, "iu");
const questionHeading = new RegExp(`^Câu\\s+(\\d+)\\s*${scoreSuffix}\\s*[.:]?\\s*`, "iu");
const number = (value: string) => Number(value.replace(",", "."));

export async function previewWordImport(bytes: Buffer, filename: string) {
  const errors: ImportError[] = [];
  const issue = (row: number, column: string, message: string) => errors.push({ sheet: "Word", row, column, message });
  let paragraphs: Paragraph[];
  try {
    const xml = await readDocument(bytes);
    paragraphs = readParagraphs(new TextDecoder("utf-8", { fatal: true }).decode(xml));
  } catch {
    issue(0, "file", "Không đọc được file Word.");
    return { errors };
  }

  const normalized = paragraphs.map((paragraph) => plainText(paragraph).normalize("NFC").replace(/\s+/gu, " "));
  const start = normalized.findIndex((text) => readingHeading.test(text));
  const questionsStart = normalized.findIndex((text, index) => index > start && /^Thực hiện các yêu cầu\s*:?$/iu.test(text));
  if (start < 0 || questionsStart < 0) {
    issue(0, "promptDocument", "Thiếu tiêu đề I. ĐỌC HIỂU hoặc dòng Thực hiện các yêu cầu.");
    return { errors };
  }
  const writing = normalized.findIndex((text, index) => index > questionsStart && /^II\.\s*VIẾT\b/iu.test(text));
  const extra = normalized.findIndex((text, index) => index > questionsStart && /^BÀI ĐỌC THÊM\s*:?$/iu.test(text));
  if (writing >= 0 && extra >= 0 && writing > extra) {
    issue(paragraphs[writing].row, "questions", "Phần viết phải đứng trước bài đọc thêm.");
    return { errors };
  }
  for (const paragraph of paragraphs.slice(start)) {
    if (paragraph.unsupported || paragraph.table) issue(paragraph.row, "promptDocument", "Chưa hỗ trợ ảnh, hộp văn bản hoặc bảng trong nội dung đề Word.");
  }
  const header = normalized.slice(0, start);
  const title = header.find((text) => /^ĐỀ\s/iu.test(text)) ?? filename.replace(/^.*[/\\]/, "").replace(/\.docx$/i, "");
  const durationLine = header.find((text) => /^Thời gian làm bài\b/iu.test(text));
  const durationMinutes = durationLine ? Number(durationLine.match(/:\s*(\d+)\s*phút\b/iu)?.[1]) : 30;

  const questions: { type: "essay"; prompt: string; points: number; row: number }[] = [];
  for (const paragraph of paragraphs.slice(questionsStart + 1, writing >= 0 ? writing : extra >= 0 ? extra : undefined)) {
    const text = plainText(paragraph);
    if (!text) continue;
    const match = questionHeading.exec(text);
    if (match) {
      if (Number(match[1]) !== questions.length + 1) issue(paragraph.row, "questions", "Số thứ tự câu đọc hiểu phải liên tiếp, bắt đầu từ 1.");
      questions.push({ type: "essay", prompt: text.slice(match[0].length), points: number(match[2]), row: paragraph.row });
    } else if (/^Câu\s+\d/iu.test(text) || !questions.length) {
      issue(paragraph.row, "questions", "Câu đọc hiểu cần có dạng Câu N (x điểm).");
    } else {
      const question = questions[questions.length - 1];
      question.prompt = [question.prompt, text].filter(Boolean).join("\n");
    }
  }
  const readingPoints = readingHeading.exec(normalized[start])?.[1];
  if (!questions.length || (readingPoints && number(readingPoints) !== questions.reduce((sum, question) => sum + question.points, 0))) {
    issue(paragraphs[start].row, "points", "Thiếu câu đọc hiểu hoặc tổng điểm đọc hiểu không khớp.");
  }
  if (writing >= 0) {
    const points = writingHeading.exec(normalized[writing])?.[1];
    const lines = paragraphs.slice(writing + 1, extra >= 0 ? extra : undefined).map(plainText).filter(Boolean);
    const options = lines.flatMap((line, index) => {
      const match = /^Đề\s+(\d+)\s*[.:]\s*/iu.exec(line);
      return match ? [{ number: Number(match[1]), index, text: line.slice(match[0].length) }] : [];
    });
    if (!points || options.length !== 2 || options[0].number !== 1 || options[1].number !== 2
      || options.some((option, index) => !option.text && option.index + 1 === (options[index + 1]?.index ?? lines.length))) {
      issue(paragraphs[writing].row, "questions", "Phần viết cần ghi điểm và có đủ Đề 1, Đề 2.");
    } else {
      const hasInstruction = /^Chọn một trong hai đề sau\s*:?$/iu.test(lines[0]);
      questions.push({ type: "essay", prompt: ["II. VIẾT", ...(!hasInstruction ? ["Chọn một trong hai đề sau:"] : []), ...lines].join("\n\n"), points: number(points), row: paragraphs[writing].row });
    }
  }

  const passage = paragraphs.slice(start, questionsStart);
  if (!passage.slice(1).some((paragraph) => plainText(paragraph) && !/^Đọc văn bản sau\s*:?$/iu.test(plainText(paragraph)))) {
    issue(paragraphs[start].row, "promptDocument", "Thiếu văn bản đọc hiểu.");
  }
  const promptDocument = { type: "doc", content: [...passage, ...(extra >= 0 ? paragraphs.slice(extra) : [])]
    .filter((paragraph) => plainText(paragraph))
    .map(({ align, content }) => ({ type: "paragraph", ...(align && { attrs: { textAlign: align } }), content })) };
  const validated = quizInput.safeParse({ title, durationMinutes, promptDocument, questions });
  if (!validated.success) {
    for (const problem of validated.error.issues) {
      const [field, index, key] = problem.path;
      issue(typeof index === "number" ? questions[index]?.row ?? 0 : 0, String(key ?? field), problem.message);
    }
    return { errors };
  }
  return errors.length ? { errors } : { draft: validated.data };
}
