import type { Metadata } from "next";
import { headers } from "next/headers";

export async function quizMetadata(path: string, authenticated = false): Promise<Metadata> {
  const fallback = { title: "Bài kiểm tra" };
  try {
    const api = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4100";
    const cookie = authenticated ? (await headers()).get("cookie") ?? "" : "";
    const response = await fetch(api + path, { cache: "no-store", headers: authenticated ? { cookie } : undefined, signal: AbortSignal.timeout(5000) });
    if (!response.ok) return fallback;
    const data = await response.json();
    return typeof data.quiz?.title === "string" ? { title: data.quiz.title } : fallback;
  } catch { return fallback; }
}
