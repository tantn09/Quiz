import { z } from "zod";
import type { PromptDocument } from "./db/schema.js";

const uuid = z.string().uuid();
const nodes = new Set(["paragraph", "heading", "bulletList", "orderedList", "listItem", "blockquote", "table", "tableRow", "tableCell", "tableHeader", "text", "image", "hardBreak"]);
const marks = new Set(["bold", "italic", "underline", "strike", "link", "textStyle"]);
export const promptDocumentSchema = z.custom<PromptDocument>((value) => {
  if (!value || typeof value !== "object" || JSON.stringify(value).length > 100_000) return false;
  const doc = value as { type?: unknown; content?: unknown };
  if (doc.type !== "doc" || !Array.isArray(doc.content)) return false;
  let images = 0;
  function valid(node: unknown, depth: number): boolean {
    if (depth > 12 || !node || typeof node !== "object") return false;
    const item = node as Record<string, unknown>;
    if (typeof item.type !== "string" || !nodes.has(item.type)) return false;
    if (item.type === "text" && (typeof item.text !== "string" || item.text.length > 30000)) return false;
    if (item.type === "image") {
      images++;
      const attrs = item.attrs as Record<string, unknown> | undefined;
      if (!attrs || typeof attrs.src !== "string" || !/^\/api\/public\/assets\/[0-9a-f-]{36}$/i.test(attrs.src) || !uuid.safeParse(attrs.src.split("/").pop()).success || typeof attrs.alt !== "string" || !attrs.alt.trim() || attrs.alt.length > 200) return false;
    }
    if (item.marks !== undefined && (!Array.isArray(item.marks) || !item.marks.every((mark: unknown) => {
      if (!mark || typeof mark !== "object") return false;
      const m = mark as Record<string, unknown>;
      if (typeof m.type !== "string" || !marks.has(m.type)) return false;
      if (m.type === "link") { const href = (m.attrs as Record<string, unknown> | undefined)?.href; return typeof href === "string" && /^(https?:\/\/|mailto:)/i.test(href); }
      if (m.type === "textStyle") { const color = (m.attrs as Record<string, unknown> | undefined)?.color; return color === undefined || typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color); }
      return true;
    }))) return false;
    return item.content === undefined || Array.isArray(item.content) && item.content.every((child) => valid(child, depth + 1));
  }
  return doc.content.every((node) => valid(node, 0)) && images <= 10;
});

export function promptImageIds(doc: PromptDocument): string[] {
  const ids: string[] = [];
  function walk(value: unknown): void {
    if (!value || typeof value !== "object") return;
    const node = value as { type?: string; attrs?: { src?: string }; content?: unknown[] };
    if (node.type === "image" && node.attrs?.src) ids.push(node.attrs.src.split("/").pop()!);
    node.content?.forEach(walk);
  }
  doc.content.forEach(walk);
  return ids;
}
