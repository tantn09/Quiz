import type { FormEventHandler, ReactNode } from "react";
import { NativeSelect } from "@/components/ui/field";
import { useTranslation } from "@/lib/i18n";

export function QuizEditorForm({ onSubmit, creating, questionCount, children }: {
  onSubmit: FormEventHandler<HTMLFormElement>;
  creating: boolean;
  questionCount: number;
  children: ReactNode;
}) {
  const t = useTranslation();
  return <form onSubmit={onSubmit} className={creating ? "mx-auto max-w-3xl" : "lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start lg:gap-6"}>{!creating && <nav aria-label={t("Mục lục tạo bài kiểm tra")} className="mb-6 rounded-xl border border-line bg-surface-subtle p-3 lg:sticky lg:top-6 lg:mb-0"><p className="px-2 pb-2 text-sm font-bold">{t("Nội dung bài kiểm tra")}</p><NativeSelect aria-label={t("Mục lục tạo bài kiểm tra")} defaultValue="" onChange={(event) => document.getElementById(event.target.value)?.scrollIntoView({ behavior: "smooth" })} className="w-full rounded-xl border border-line px-3 py-2 lg:hidden"><option value="" disabled>{t("Chọn mục")}</option><option value="quiz-info">{t("Thông tin bài kiểm tra")}</option><option value="quiz-classes">{t("Môn học và lớp")} ()</option><option value="quiz-questions">{t("Câu hỏi")} ({questionCount})</option><option value="quiz-prompt">{t("Đề bài")}</option></NativeSelect><div className="hidden gap-1 lg:grid"><a href="#quiz-info" className="rounded-lg px-2 py-2 text-sm hover:bg-surface">{t("Thông tin bài kiểm tra")}</a><a href="#quiz-classes" className="rounded-lg px-2 py-2 text-sm hover:bg-surface">{t("Môn học và lớp")} ()</a><a href="#quiz-questions" className="rounded-lg px-2 py-2 text-sm hover:bg-surface">{t("Câu hỏi")} ({questionCount})</a><a href="#quiz-prompt" className="rounded-lg px-2 py-2 text-sm hover:bg-surface">{t("Đề bài")}</a></div></nav>}<div className="min-w-0 space-y-6">{children}</div></form>;
}
