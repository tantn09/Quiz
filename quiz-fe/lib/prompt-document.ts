import type { JSONContent } from "@tiptap/core";

export type PromptDocument = JSONContent;
export const emptyPrompt: PromptDocument = { type: "doc", content: [] };
export function promptImages(document: PromptDocument): string[] {
  const ids: string[] = [];
  const walk = (node: JSONContent) => { if (node.type === "image" && typeof node.attrs?.src === "string") ids.push(node.attrs.src.split("/").pop()!); node.content?.forEach(walk); };
  walk(document);
  return [...new Set(ids)];
}
