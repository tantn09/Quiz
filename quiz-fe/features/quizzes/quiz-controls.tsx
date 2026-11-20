import { type ReactNode, useEffect, useRef, useState } from "react";
import { useSortable } from "@dnd-kit/react/sortable";
import { Input, Textarea } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/modal";
import { ArrowDown, ArrowUp, CalendarDays, ChevronDown, ChevronUp, Clock3, Copy, EllipsisVertical, GripVertical, Trash2 } from "lucide-react";

export type QuestionDraft = { id: string; type: "choice" | "essay"; prompt: string; options: string[]; correctOption: number; points: number };
export type QuizRow = { id: string; title: string; description: string; status: string; durationMinutes: number; linkToken: string; linkExpiresAt: string | null; subject: string | null; gradeLevel: string | null; assignedClass: string | null };
export type QuizActionsProps = { quiz: QuizRow; t: (value: string) => string; copyLink: (quiz: QuizRow) => Promise<void>; edit: (quiz: QuizRow) => Promise<void>; openLinkExpiry: (quiz: QuizRow) => void; extendAttempts: (quiz: QuizRow) => void; stop: (quiz: QuizRow) => Promise<void>; deleteQuiz: (quiz: QuizRow) => Promise<void>; cloneQuiz: (quiz: QuizRow) => void };

export const localDateTime = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
export function TimeFirstDateTime({ label, value, onChange, required = false, t }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; t: (value: string) => string }) {
  const [date = "", time = ""] = value.split("T");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const timeRef = useRef<HTMLDivElement>(null);
  const [month, setMonth] = useState(() => new Date());
  const calendarRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!calendarOpen) return; const close = (event: PointerEvent) => { if (!calendarRef.current?.contains(event.target as Node)) setCalendarOpen(false); }; document.addEventListener("pointerdown", close); return () => document.removeEventListener("pointerdown", close); }, [calendarOpen]);
  useEffect(() => { if (!timeOpen) return; const close = (event: PointerEvent) => { if (!timeRef.current?.contains(event.target as Node)) setTimeOpen(false); }; document.addEventListener("pointerdown", close); return () => document.removeEventListener("pointerdown", close); }, [timeOpen]);
  const selected = date ? new Date(`${date}T12:00:00`) : null;
  const view = month;
  const firstDay = new Date(view.getFullYear(), view.getMonth(), 1).getDay();
  const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const chooseDate = (day: number) => { const next = `${view.getFullYear()}-${String(view.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`; onChange(`${next}T${time || "08:00"}`); setCalendarOpen(false); };
  return <fieldset className="min-w-0"><legend className="text-sm font-medium text-content">{label}{required ? " *" : ""}</legend><div className="mt-2 grid gap-3 sm:grid-cols-2"><div ref={timeRef} className="relative min-w-0"><label htmlFor="quiz-time-input" className="mb-1.5 block text-sm font-medium text-content-muted">{t("Giờ")}</label><span className="relative block"><Clock3 size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-brand" aria-hidden="true" /><Input id="quiz-time-input" type="text" inputMode="numeric" placeholder="HH:MM" pattern="(?:[01][0-9]|2[0-3]):[0-5][0-9]" required={required || Boolean(date)} value={time} onFocus={() => setTimeOpen(true)} onKeyDown={(event) => { if (event.key === "Escape") setTimeOpen(false); }} onChange={(event) => onChange(`${date || localDateTime(new Date()).slice(0, 10)}T${event.target.value}`)} aria-label={t("Giờ")} aria-expanded={timeOpen} className="quiz-datetime-input min-h-11 w-full rounded-xl border border-line py-2 pl-10 pr-3 text-sm" /></span>{timeOpen && <div className="quiz-select-content absolute left-0 top-full z-[110] mt-2 max-h-56 w-full overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 shadow-xl">{Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`).filter((item) => !time || item.includes(time) || time.length >= 5).map((item) => <button key={item} type="button" onClick={() => { onChange(`${date || localDateTime(new Date()).slice(0, 10)}T${item}`); setTimeOpen(false); }} aria-pressed={time === item} className="flex min-h-10 w-full items-center rounded-xl border border-transparent px-3 text-left text-sm hover:border-line hover:bg-surface-accent aria-pressed:border-brand aria-pressed:bg-surface-accent aria-pressed:font-semibold aria-pressed:text-brand">{item}</button>)}</div>}</div><div ref={calendarRef} className="relative min-w-0"><span className="mb-1.5 block text-sm font-medium text-content-muted">{t("Ngày")}</span><button type="button" aria-label={t("Ngày")} aria-expanded={calendarOpen} onClick={() => { if (!calendarOpen) setMonth(selected ?? new Date()); setCalendarOpen(!calendarOpen); }} className="quiz-select-trigger flex min-h-11 w-full items-center gap-3 rounded-xl border border-line px-4 py-2 text-left text-sm hover:border-brand focus-visible:ring-2 focus-visible:ring-focus"><CalendarDays size={18} className="text-brand" aria-hidden="true" />{selected ? selected.toLocaleDateString("vi-VN") : t("Chọn ngày")}</button>{calendarOpen && <div className="quiz-select-content absolute right-0 top-full z-[110] mt-2 w-full rounded-2xl border border-line bg-surface p-2 shadow-xl"><div className="mb-2 flex items-center justify-between"><button type="button" aria-label="Tháng trước" onClick={() => setMonth(new Date(view.getFullYear(), view.getMonth() - 1, 1))} className="rounded-lg px-2 py-1 hover:bg-surface-accent">‹</button><strong className="text-xs">{view.toLocaleDateString("vi-VN", { month: "long", year: "numeric" })}</strong><button type="button" aria-label="Tháng sau" onClick={() => setMonth(new Date(view.getFullYear(), view.getMonth() + 1, 1))} className="rounded-lg px-2 py-1 hover:bg-surface-accent">›</button></div><div className="grid grid-cols-7 gap-0.5 text-center text-xs text-content-muted">{["CN", "T2", "T3", "T4", "T5", "T6", "T7"].map((name) => <span key={name} className="py-1">{name}</span>)}</div><div className="grid grid-cols-7 gap-0.5">{Array.from({ length: firstDay }, (_, i) => <span key={`empty-${i}`} />)}{Array.from({ length: days }, (_, i) => <button key={i} type="button" onClick={() => chooseDate(i + 1)} aria-label={`${i + 1}/${view.getMonth() + 1}/${view.getFullYear()}`} aria-pressed={selected?.getDate() === i + 1 && selected.getMonth() === view.getMonth() && selected.getFullYear() === view.getFullYear()} className="flex aspect-square w-full items-center justify-center rounded-lg text-xs hover:bg-surface-accent aria-pressed:bg-brand aria-pressed:text-white">{i + 1}</button>)}</div></div>}</div></div></fieldset>;
}
export function QuizSurface({ fullPage, title, onClose, children }: { fullPage: boolean; title: string; onClose: () => void; children: ReactNode }) {
  if (!fullPage) return <Modal title={title} closeLabel="Đóng" onClose={onClose} wide>{children}</Modal>;
  return <section className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-8">{children}</section>;
}

export function QuestionEditor({ question, index, count, collapsed, toggle, error, t, update, remove, duplicate }: { question: QuestionDraft; index: number; count: number; collapsed: boolean; toggle: () => void; error?: string; t: (value: string) => string; update: (changes: Partial<QuestionDraft>) => void; remove: () => void; duplicate: () => void }) {
  const { ref, handleRef, isDragging, isDropTarget } = useSortable({ id: question.id, index });
  const updateOption = (optionIndex: number, value: string) => update({ options: question.options.map((option, i) => i === optionIndex ? value : option) });
  const removeOption = (optionIndex: number) => update({ options: question.options.filter((_, i) => i !== optionIndex), correctOption: question.correctOption === optionIndex ? -1 : question.correctOption > optionIndex ? question.correctOption - 1 : question.correctOption });
  return <section ref={ref} id={`question-${index}`} className={`rounded-2xl border border-line bg-surface p-4 sm:p-5 ${isDragging ? "opacity-60 ring-2 ring-brand" : ""} ${isDropTarget ? "ring-2 ring-focus" : ""}`}>
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><h3 className="text-lg font-bold">{t("Câu")} {index + 1}</h3>{collapsed && <p className="truncate text-sm text-content-muted">{question.prompt || (question.type === "choice" ? t("Trắc nghiệm") : t("Tự luận"))}</p>}</div><div className="flex flex-wrap gap-1"><button type="button" onClick={toggle} aria-expanded={!collapsed} aria-label={`${collapsed ? t("Mở rộng") : t("Thu gọn")} ${t("Câu")} ${index + 1}`} className="flex min-h-11 items-center gap-1 rounded-lg px-3 text-sm font-medium text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">{collapsed ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronUp size={16} aria-hidden="true" />}</button><button ref={handleRef} type="button" aria-label={`${t("Kéo để đổi thứ tự")} ${t("Câu")} ${index + 1}`} aria-roledescription={t("Tay nắm sắp xếp câu hỏi")} title={t("Kéo để đổi thứ tự")} className="flex min-h-11 min-w-11 touch-none cursor-grab items-center justify-center rounded-lg border border-line text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus active:cursor-grabbing"><GripVertical size={18} aria-hidden="true" /></button><button type="button" onClick={duplicate} aria-label={`${t("Nhân bản")} ${t("Câu")} ${index + 1}`} title={t("Nhân bản")} className="min-h-11 rounded-lg px-3 text-sm font-medium text-brand"><Copy size={18} aria-hidden="true" /></button>{count > 1 && <button type="button" onClick={remove} aria-label={`${t("Xóa câu")} ${index + 1}`} title={t("Xóa câu")} className="min-h-11 rounded-lg px-3 text-sm font-medium text-red-700 hover:bg-red-50"><Trash2 size={18} aria-hidden="true" /></button>}</div></div>
    {!collapsed && <div id={`question-body-${question.id}`}>
    <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
      <label className="text-sm font-semibold">{t("Loại câu hỏi")}<Select value={question.type} onValueChange={(value) => update({ type: value as QuestionDraft["type"] })} ariaLabel={t("Loại câu hỏi")} options={[{ value: "choice", label: t("Trắc nghiệm") }, { value: "essay", label: t("Tự luận") }]} className="mt-2" /></label>
      <label className="text-sm font-semibold">{t("Điểm")}<Input type="number" min={0} max={1000} step={0.25} required value={question.points} onChange={(event) => update({ points: Number(event.target.value) })} className="mt-2 w-full rounded-xl border border-line px-3 py-3" /></label>
    </div>
    <label className="mt-4 block text-sm font-semibold">{t("Nội dung câu hỏi")}<Textarea required value={question.prompt} onChange={(event) => update({ prompt: event.target.value })} rows={3} className="mt-2 w-full rounded-xl border border-line px-3 py-3" /></label>
    {question.type === "choice" && <fieldset className="mt-5 rounded-xl border border-line bg-surface-subtle p-4"><legend className="px-1 text-sm font-semibold">{t("Các lựa chọn")}</legend><p className="mb-3 text-sm text-content-muted">{t("Nhập từng đáp án và chọn một đáp án đúng.")}</p>
      <div className="space-y-3">{question.options.map((option, optionIndex) => <div key={optionIndex} className="flex items-center gap-2"><label className="flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-2 text-sm" title={t("Đáp án đúng")}><input type="radio" name={`correct-option-${question.id}`} checked={question.correctOption === optionIndex} onChange={() => update({ correctOption: optionIndex })} className="h-4 w-4 accent-emerald-700" aria-label={`${t("Chọn đáp án đúng")}: ${optionIndex + 1}`} /><span className="font-semibold">{String.fromCharCode(65 + optionIndex)}</span></label><Input maxLength={500} value={option} onChange={(event) => updateOption(optionIndex, event.target.value)} aria-label={`${t("Lựa chọn")} ${String.fromCharCode(65 + optionIndex)}`} className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-3" /><button type="button" disabled={question.options.length <= 2} onClick={() => removeOption(optionIndex)} aria-label={`${t("Xóa đáp án")} ${String.fromCharCode(65 + optionIndex)}`} className="min-h-11 rounded-lg px-2 text-sm text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40">{t("Xóa")}</button></div>)}</div>
      <button type="button" disabled={question.options.length >= 8} onClick={() => update({ options: [...question.options, ""] })} className="mt-4 min-h-11 rounded-xl border border-line bg-surface px-4 text-sm font-semibold hover:bg-surface-subtle disabled:opacity-50">{t("+ Thêm đáp án")}</button>
    </fieldset>}
    {error && <p role="alert" className="mt-3 rounded-xl ds-error p-3 text-sm">{error}</p>}
    </div>}
  </section>;
}

export function QuizActions({ quiz, t, copyLink, edit, openLinkExpiry, extendAttempts, stop, deleteQuiz, cloneQuiz }: QuizActionsProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setOpen(false); };
    const closeEscape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus(); } };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => { document.removeEventListener("pointerdown", closeOutside); document.removeEventListener("keydown", closeEscape); };
  }, [open]);
  const action = (callback: () => void) => { setOpen(false); callback(); };
  const itemClass = "flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";
  return <div ref={menuRef} className="relative shrink-0 self-start">
    <button type="button" aria-label={`${t("Tùy chọn bài kiểm tra")}: ${quiz.title}`} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((current) => !current)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-line hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"><EllipsisVertical size={20} aria-hidden="true" /></button>
    {open && <div role="menu" aria-label={`${t("Tùy chọn bài kiểm tra")}: ${quiz.title}`} onKeyDown={(event) => {
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
      const current = items.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : event.key === "ArrowDown" ? (current + 1) % items.length : (current - 1 + items.length) % items.length;
      items[next]?.focus();
    }} className="absolute right-0 top-full z-20 mt-2 w-56 rounded-xl border border-line bg-surface p-1.5 shadow-xl">
      <button type="button" role="menuitem" className={itemClass} onClick={() => action(() => void copyLink(quiz))}>{t("Sao chép link")}</button>
      <button type="button" role="menuitem" className={itemClass} onClick={() => action(() => cloneQuiz(quiz))}>Clone cho lớp khác</button>
      <button type="button" role="menuitem" className={itemClass} onClick={() => action(() => void edit(quiz))}>{t("Sửa")}</button>
      <button type="button" role="menuitem" className={itemClass} onClick={() => action(() => openLinkExpiry(quiz))}>{quiz.status === "inactive" ? t("Mở lại và gia hạn") : t("Gia hạn link")}</button>
      {quiz.status === "active" && <><button type="button" role="menuitem" className={itemClass} onClick={() => action(() => void extendAttempts(quiz))}>{t("+ Thời gian làm")}</button><button type="button" role="menuitem" className={itemClass} onClick={() => action(() => void stop(quiz))}>{t("Ngừng")}</button></>}
      <div className="my-1 border-t border-line" /><button type="button" role="menuitem" className={`${itemClass} text-red-700`} onClick={() => action(() => void deleteQuiz(quiz))}>{t("Xóa bài kiểm tra")}</button>
    </div>}
  </div>;
}
