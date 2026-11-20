import { apiFetch, reportApiError } from "@/lib/api-request";
import { useErrorToast } from "@/components/ui/toast";
import { type Dispatch, type FormEvent, type SetStateAction, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { localDateTime, type QuizRow } from "./quiz-controls";
import type { QuizDetail } from "./quiz-detail-panels";

export function useQuizLink({ load, setDetail, setNotice }: {
  load: () => Promise<void>;
  setDetail: Dispatch<SetStateAction<QuizDetail | null>>;
  setNotice: (notice: string) => void;
}) {
  const t = useTranslation();
  const showError = useErrorToast();
  const [linkQuiz, setLinkQuiz] = useState<QuizRow | null>(null);
  const [newLinkExpiry, setNewLinkExpiry] = useState("");
  const [linkError, setLinkError] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);

  function openLinkExpiry(quiz: QuizRow) {
    setLinkQuiz(quiz);
    setNewLinkExpiry(localDateTime(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)));
    setLinkError("");
  }

  async function extendLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!linkQuiz) return;
    const date = new Date(newLinkExpiry);
    if (!newLinkExpiry || Number.isNaN(date.getTime()) || date <= new Date()) { setLinkError(t("Hạn link mới phải ở tương lai.")); return; }
    setLinkBusy(true);
    setLinkError("");
    try {
      await apiFetch(`/api/teacher/quizzes/${linkQuiz.id}/${linkQuiz.status === "inactive" ? "reopen" : "extend-link"}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ linkExpiresAt: date.toISOString() }) });
      setNotice(linkQuiz.status === "inactive" ? t("Đã mở lại và gia hạn bài kiểm tra.") : t("Đã gia hạn link."));
      setLinkQuiz(null);
      setDetail((current) => current?.quiz.id === linkQuiz.id ? { ...current, quiz: { ...current.quiz, status: "active", linkExpiresAt: date.toISOString() } } : current);
      await load();
    } catch (error) { reportApiError(error, "Không gia hạn được link. Vui lòng thử lại.", t, showError); }
    finally { setLinkBusy(false); }
  }

  async function copyLink(quiz: QuizRow) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/q/${quiz.linkToken}`);
      setNotice(t("Đã sao chép link bài kiểm tra."));
    } catch (error) { reportApiError(error, "Không sao chép được link.", t, showError); }
  }

  return { linkQuiz, setLinkQuiz, newLinkExpiry, setNewLinkExpiry, linkError, setLinkError, linkBusy, openLinkExpiry, extendLink, copyLink };
}
