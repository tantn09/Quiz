import { apiFetch } from "@/lib/api-request";
import type { PromptDocument } from "@/components/prompt-editor";

export type ImportIssue = { sheet: string; row: number; column: string; message: string };
export type ImportDraft = { title: string; description: string; promptDocument: PromptDocument; durationMinutes: number; linkExpiresAt: string | null; questions: { type: "choice" | "essay"; prompt: string; points: number; options: string[]; correctOption: number | null }[] };

export async function previewQuizImport(file: File) {
  const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.onerror = reject; reader.readAsDataURL(file); });
  const response = await apiFetch("/api/teacher/quizzes/import-preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ filename: file.name, data }) });
  return await response.json() as { draft: ImportDraft };
}
