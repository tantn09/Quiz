import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { useTranslation } from "@/lib/i18n";
import { QuizActions, type QuizActionsProps, type QuizRow } from "./quiz-controls";
import { formatTimeFirst } from "./quiz-detail-panels";

type Props = Omit<QuizActionsProps, "quiz" | "t"> & {
  loadState: "loading" | "ready" | "error";
  retry: () => void;
  quizzes: QuizRow[]; search: string; status: string;
  setSearch: (value: string) => void; setStatus: (value: string) => void;
  openDetail: (quiz: QuizRow) => Promise<void>;
};

export function QuizList({ loadState, retry, quizzes, search, status, setSearch, setStatus, openDetail, ...actions }: Props) {
  const t = useTranslation();
  return <section className="mt-8 rounded-2xl border border-line bg-surface p-5 sm:p-7"><div className="flex flex-col gap-3 sm:flex-row"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("Tìm bài kiểm tra")} className="min-w-0 flex-1 rounded-xl border border-line px-4 py-3" /><Select value={status} onValueChange={setStatus} ariaLabel={t("Tất cả trạng thái")} options={[{ value: "", label: t("Tất cả trạng thái") }, { value: "active", label: t("Đang mở") }, { value: "inactive", label: t("Đã ngừng") }]} className="sm:w-56" /></div>
      <div className="mt-5 grid gap-3">{loadState === "loading" && <p role="status">{t("Đang tải chi tiết…")}</p>}{loadState === "error" && <Alert role="alert">{t("Không tải được danh sách bài kiểm tra.")} <Button type="button" variant="outline" onClick={retry}>{t("Thử lại")}</Button></Alert>}{loadState === "ready" && quizzes.map((quiz) => <article key={quiz.id} className="flex flex-col justify-between gap-4 rounded-xl border border-line p-4 sm:flex-row sm:items-center"><button type="button" onClick={() => void openDetail(quiz)} className="min-w-0 flex-1 rounded-lg text-left hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" aria-label={`${t("Xem chi tiết bài kiểm tra")}: ${quiz.title}`}><h3 className="font-bold">{quiz.title}</h3><p className="mt-1 text-sm text-content-muted">{quiz.durationMinutes} {t("phút")} · {quiz.status === "active" ? t("Đang mở") : t("Đã ngừng")}{quiz.linkExpiresAt ? ` · ${t("Hết link")} ${formatTimeFirst(quiz.linkExpiresAt)}` : ""}</p><span className="mt-2 block text-xs font-medium text-brand">{t("Xem chi tiết")}</span></button><QuizActions {...actions} quiz={quiz} t={t} /></article>)}{loadState === "ready" && quizzes.length === 0 && <EmptyState title={t("Chưa có bài kiểm tra.")} />}</div>
    </section>;
}
