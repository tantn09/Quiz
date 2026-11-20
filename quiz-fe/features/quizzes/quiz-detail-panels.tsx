import { NativeSelect } from "@/components/ui/field";
import { PromptView } from "@/components/prompt-view";
import { QuizVariants } from "@/components/quiz-variants";
import { useTranslation } from "@/lib/i18n";
import type { PromptDocument } from "@/components/prompt-editor";
import type { QuizRow } from "./quiz-controls";

type DetailQuestion = { id: string; type: "choice" | "essay"; prompt: string; options: string[]; correctOption: number | null; points: number };
export type QuizDetail = { quiz: QuizRow & { promptDocument?: PromptDocument }; questions: DetailQuestion[]; variants: { id: string; code: number; active: boolean; questions: DetailQuestion[] }[] };
export const formatTimeFirst = (value: string) => { const date = new Date(value); return `${date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} · ${date.toLocaleDateString("vi-VN")}`; };

export function QuizDetailPanels({ detail, detailTab, contentVariant, contentQuestions, selectVariant }: {
  detail: QuizDetail; detailTab: "overview" | "content" | "variants";
  contentVariant?: QuizDetail["variants"][number]; contentQuestions: DetailQuestion[];
  selectVariant: (id: string) => void;
}) {
  const t = useTranslation();
  return <>
        {detailTab === "overview" && <div role="tabpanel" className="space-y-6">
        <div><h3 className="text-xl font-bold">{detail.quiz.title}</h3><p className="mt-2 whitespace-pre-wrap text-sm text-content-muted">{detail.quiz.description || t("Chưa có mô tả.")}</p></div>
        {detail.quiz.subject && <p className="text-sm"><strong>{t("Môn học")}:</strong> {detail.quiz.subject}</p>}
        {detail.quiz.assignedClass && <p className="text-sm"><strong>Lớp được giao:</strong> {detail.quiz.assignedClass}</p>}
        {detail.quiz.gradeLevel && <p className="text-sm"><strong>{t("Khối lớp")}:</strong> {detail.quiz.gradeLevel}</p>}
        <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-surface-subtle p-4"><p className="text-sm text-content-muted">{t("Trạng thái")}</p><p className="mt-1 font-semibold">{detail.quiz.status === "active" ? t("Đang mở") : t("Đã ngừng")}</p></div><div className="rounded-xl bg-surface-subtle p-4"><p className="text-sm text-content-muted">{t("Thời lượng")}</p><p className="mt-1 font-semibold">{detail.quiz.durationMinutes} {t("phút")}</p></div><div className="rounded-xl bg-surface-subtle p-4"><p className="text-sm text-content-muted">{t("Hạn dùng link")}</p><p className="mt-1 font-semibold">{detail.quiz.linkExpiresAt ? formatTimeFirst(detail.quiz.linkExpiresAt) : t("Không có hạn")}</p></div></div>
        <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-line p-4"><p className="text-sm text-content-muted">Nội dung</p><p className="mt-1 font-semibold">{detail.questions.length} câu hỏi · {detail.questions.reduce((total, question) => total + question.points, 0)} điểm mã chính</p></div><div className="rounded-xl border border-line p-4"><p className="text-sm text-content-muted">Lớp được giao</p><p className="mt-1 font-semibold">{detail.quiz.assignedClass ?? "Chưa gắn lớp"}</p></div></div>
        </div>}
        {detailTab === "content" && <div role="tabpanel" className="space-y-6">
        <div className="flex flex-wrap items-center gap-3"><label htmlFor="content-variant" className="text-sm font-semibold">Xem mã đề</label><NativeSelect id="content-variant" value={contentVariant?.id ?? ""} onChange={(event) => selectVariant(event.target.value)} className="min-h-11 rounded-xl border border-line bg-surface px-3">{detail.variants?.map((variant) => <option key={variant.id} value={variant.id}>Mã {variant.code}{variant.active ? "" : " · Tắt"}</option>)}</NativeSelect><span className="text-sm text-content-muted">{contentQuestions.length} câu · {contentQuestions.reduce((sum, question) => sum + question.points, 0)} điểm</span></div>
        {Boolean(detail.quiz.promptDocument?.content?.length) && <section><h4 className="font-semibold">{t("Đề bài")}</h4><PromptView document={detail.quiz.promptDocument!} /></section>}
        <section><h4 className="font-semibold">{t("Câu hỏi")} ({detail.questions.length})</h4><div className="mt-3 space-y-3">{contentQuestions.map((question, index) => <div key={question.id} className="rounded-xl border border-line p-4"><p className="text-sm font-semibold text-content-muted">{t("Câu")} {index + 1} · {question.type === "choice" ? t("Trắc nghiệm") : t("Tự luận")} · {question.points} {t("điểm")}</p><p className="mt-2 whitespace-pre-wrap font-medium">{question.prompt}</p>{question.type === "choice" && <ol className="mt-3 space-y-1 pl-5 text-sm">{question.options.map((option, optionIndex) => <li key={optionIndex} className={`list-decimal ${optionIndex === question.correctOption ? "font-semibold text-emerald-700" : ""}`}>{option}{optionIndex === question.correctOption ? ` · ${t("Đáp án đúng")}` : ""}</li>)}</ol>}</div>)}</div></section>
        </div>}
        {detailTab === "variants" && <div role="tabpanel"><QuizVariants quizId={detail.quiz.id} /></div>}
  </>;
}
