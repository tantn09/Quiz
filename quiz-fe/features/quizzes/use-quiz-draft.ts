import { useErrorToast } from "@/components/ui/toast";
import { useEffect, useState } from "react";
import { promptImages, type PromptDocument } from "@/components/prompt-editor";
import type { QuestionDraft } from "./quiz-controls";

export type SavedDraft = { savedAt: number; title: string; description: string; promptDocument: PromptDocument; duration: number; expiresAt: string; subject: string; gradeLevel: string; questions: QuestionDraft[] };
const DRAFT_TTL = 30 * 24 * 60 * 60 * 1000;

type DraftOptions = Omit<SavedDraft, "savedAt"> & {
  mode: "list" | "create" | "view" | "edit";
  quizId?: string;
  formOpen: boolean;
};

export function useQuizDraft({ mode, quizId, formOpen, title, description, promptDocument, duration, expiresAt, subject, gradeLevel, questions }: DraftOptions) {
  const showError = useErrorToast();
  const [draftOwner, setDraftOwner] = useState<string | null>(null);
  const [draftCandidate, setDraftCandidate] = useState<SavedDraft | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [draftStatus, setDraftStatus] = useState("");
  const draftKey = draftOwner && (mode === "create" || mode === "edit" && quizId) ? `quiz-draft:${draftOwner}:${mode === "create" ? "new" : quizId}` : null;
  useEffect(() => { if (mode !== "create" && mode !== "edit") return; void fetch("/api/auth/me", { cache: "no-store" }).then(async (response) => { if (!response.ok) throw new Error(); setDraftOwner((await response.json()).user.id); }).catch(() => showError("Không tải được thông tin tài khoản để lưu bản nháp.")); }, [mode, showError]);
  useEffect(() => {
    if (!draftKey || !formOpen) return;
    setDraftReady(false);
    try {
      if (mode === "create" && sessionStorage.getItem("quiz-import-override")) { sessionStorage.removeItem("quiz-import-override"); localStorage.removeItem(draftKey); setDraftReady(true); return; }
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const draft = JSON.parse(raw) as SavedDraft;
        if (draft.savedAt > Date.now() - DRAFT_TTL && Array.isArray(draft.questions) && draft.promptDocument?.type === "doc") setDraftCandidate(draft);
        else localStorage.removeItem(draftKey);
      }
    } catch { localStorage.removeItem(draftKey); }
    setDraftReady(true);
  }, [draftKey, formOpen]);
  useEffect(() => {
    if (!draftKey || !formOpen || !draftReady || draftCandidate) return;
    const draft: SavedDraft = { savedAt: Date.now(), title, description, promptDocument, duration, expiresAt, subject, gradeLevel, questions };
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify(draft));
        setDraftStatus("Đã lưu bản nháp");
        if (promptImages(promptDocument).length) void fetch("/api/teacher/assets/reserve", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: promptImages(promptDocument) }) }).then((response) => { if (!response.ok) showError("Đã lưu bản nháp, nhưng chưa giữ được ảnh tạm."); }).catch(() => showError("Đã lưu bản nháp, nhưng chưa giữ được ảnh tạm."));
      } catch { setDraftStatus("Không lưu được bản nháp trên trình duyệt."); }
    }, 800);
    return () => clearTimeout(timer);
  }, [draftKey, formOpen, draftReady, draftCandidate, title, description, promptDocument, duration, expiresAt, subject, gradeLevel, questions]);
  useEffect(() => {
    if (!draftKey || !formOpen || !draftReady || draftCandidate) return;
    const flush = () => { try { localStorage.setItem(draftKey, JSON.stringify({ savedAt: Date.now(), title, description, promptDocument, duration, expiresAt, subject, gradeLevel, questions } satisfies SavedDraft)); } catch { /* The visible status reports quota errors during autosave. */ } };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [draftKey, formOpen, draftReady, draftCandidate, title, description, promptDocument, duration, expiresAt, subject, gradeLevel, questions]);
  function discardDraft() { if (draftKey) localStorage.removeItem(draftKey); setDraftCandidate(null); setDraftStatus(""); }
  return { draftKey, draftCandidate, draftReady, draftStatus, setDraftCandidate, setDraftStatus, discardDraft };
}
