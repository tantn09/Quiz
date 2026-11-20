import { useErrorToast } from "@/components/ui/toast";
import { type FormEvent, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

type Question = { id: string; position: number; type: "choice" | "essay"; prompt: string; options: string[]; correctOption: number | null; points: number };
type Answer = { questionId: string; answer: string | null; awardedPoints: number | null; isCorrect: boolean | null };
type Detail = { submission: { id: string; studentName: string; studentClass: string; quizTitle: string; score: number | null; maxScore: number; variantCode: number; gradingStatus: string; questionSnapshot: Question[] }; answers: Answer[] };

export function useGradingDialog(load: () => Promise<void>, setNotice: (message: string) => void) {
  const t = useTranslation();
  const showError = useErrorToast();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [index, setIndex] = useState(0);
  const [grade, setGrade] = useState("");
  const [gradeError, setGradeError] = useState("");
  const [grading, setGrading] = useState(false);
  function move(data: Detail, next: number) {
    const question = data.submission.questionSnapshot[next];
    setIndex(next);
    setGrade(String(data.answers.find((answer) => answer.questionId === question.id)?.awardedPoints ?? ""));
    setGradeError("");
    requestAnimationFrame(() => document.getElementById("grading-question")?.focus());
  }

  function ungraded(data: Detail) {
    return data.submission.questionSnapshot.findIndex((question) => question.type === "essay" && data.answers.find((answer) => answer.questionId === question.id)?.awardedPoints == null);
  }

  async function openResult(id: string) {
    try {
      const response = await fetch(`/api/teacher/results/${id}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data = await response.json() as Detail;
      setDetail(data);
      move(data, Math.max(0, ungraded(data)));
    } catch { showError(t("Không mở được bài nộp.")); }
  }

  const question = detail?.submission.questionSnapshot[index];
  const answer = detail?.answers.find((entry) => entry.questionId === question?.id);
  async function saveGrade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || question?.type !== "essay" || grade.trim() === "") return;
    const awardedPoints = Number(grade.replace(",", "."));
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(grade.trim()) || !Number.isInteger(awardedPoints * 4) || awardedPoints < 0 || awardedPoints > question.points) {
      setGradeError(t("Nhập điểm theo bước 0.25 và trong giới hạn của câu."));
      return;
    }
    setGrading(true);
    setGradeError("");
    try {
      const response = await fetch(`/api/teacher/results/${detail.submission.id}/grade`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ scores: { [question.id]: awardedPoints } }) });
      if (!response.ok) throw new Error();
      const { score, gradingStatus } = await response.json();
      const saved: Detail = {
        submission: { ...detail.submission, score, gradingStatus },
        answers: [...detail.answers.filter((entry) => entry.questionId !== question.id), { questionId: question.id, answer: answer?.answer ?? null, isCorrect: null, awardedPoints }],
      };
      setDetail(saved);
      const following = index + 1 < saved.submission.questionSnapshot.length ? index + 1 : ungraded(saved);
      if (following >= 0) move(saved, following);
      setNotice(t("Đã lưu điểm."));
      void load().catch(() => showError(t("Không tải được kết quả.")));
    } catch { showError(t("Không lưu được điểm. Hãy thử lại.")); }
    finally { setGrading(false); }
  }

  const gradingDialog = detail && question && <Modal title={detail.submission.studentName + " · " + detail.submission.studentClass} onClose={() => !grading && setDetail(null)}>
      <p aria-live="polite" className="mb-4 text-sm text-content-muted">{detail.submission.quizTitle} · {t("Mã đề")} {detail.submission.variantCode} · {detail.submission.score ?? "—"}/{detail.submission.maxScore}</p>
      <form onSubmit={saveGrade} className="space-y-4">
        <h3 id="grading-question" tabIndex={-1} className="font-semibold">{t("Câu")} {index + 1}/{detail.submission.questionSnapshot.length} · {question.points} {t("điểm")}</h3>
        <p className="whitespace-pre-wrap">{question.prompt}</p>
        <div className="whitespace-pre-wrap break-words rounded-lg bg-surface-subtle p-3">
          <p>{t("Trả lời:")} {question.type === "choice" && answer?.answer ? question.options[Number(answer.answer)] ?? t("Chưa trả lời") : answer?.answer || t("Chưa trả lời")}</p>
          {question.type === "choice" && <p>{t("Đáp án đúng")} · {question.options[question.correctOption ?? -1]} · {answer?.awardedPoints ?? 0}/{question.points}</p>}
        </div>
        {question.type === "essay" && <label className="block">{t("Điểm tự luận")}<Input disabled={grading} inputMode="decimal" value={grade} onChange={(event) => setGrade(event.target.value)} className="mt-2 block w-32 rounded-lg border border-line bg-surface p-2" /></label>}
        {gradeError && <p role="alert">{gradeError}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={grading || index === 0} onClick={() => move(detail, index - 1)}>{t("Câu trước")}</Button>
          <Button type="button" variant="outline" disabled={grading || index + 1 === detail.submission.questionSnapshot.length} onClick={() => move(detail, index + 1)}>{t("Câu sau")}</Button>
          <Button type="button" variant="outline" disabled={grading || ungraded(detail) < 0} onClick={() => move(detail, ungraded(detail))}>{t("Đến câu chưa chấm")}</Button>
          {question.type === "essay" && <Button type="submit" disabled={grading || grade.trim() === ""}>{t("Lưu và tiếp tục")}</Button>}
        </div>
      </form>
    </Modal>;
  return { openResult, closeResult: () => setDetail(null), gradingDialog };
}
