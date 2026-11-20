import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { useSortable } from "@dnd-kit/react/sortable";
import { Input, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/modal";
import { useLocale } from "@/lib/i18n";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock3, Copy, EllipsisVertical, GripVertical, Trash2 } from "lucide-react";

export type QuestionDraft = { id: string; type: "choice" | "essay"; prompt: string; options: string[]; correctOption: number; points: number };
export type QuizRow = { id: string; title: string; description: string; status: string; durationMinutes: number; linkToken: string; linkExpiresAt: string | null; subject: string | null; gradeLevel: string | null; assignedClass: string | null };
export type QuizActionsProps = { quiz: QuizRow; t: (value: string) => string; copyLink: (quiz: QuizRow) => Promise<void>; edit: (quiz: QuizRow) => Promise<void>; openLinkExpiry: (quiz: QuizRow) => void; extendAttempts: (quiz: QuizRow) => void; stop: (quiz: QuizRow) => Promise<void>; deleteQuiz: (quiz: QuizRow) => Promise<void>; cloneQuiz: (quiz: QuizRow) => void };

export const localDateTime = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const pickerPanel = "quiz-select-content absolute top-full z-[110] mt-2 w-full border border-line bg-surface p-2";

export function TimeFirstDateTime({ label, value, onChange, required = false, invalid = false, t }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; invalid?: boolean; t: (value: string) => string }) {
  const [date = "", time = ""] = value.split("T");
  const id = useId();
  const locale = useLocale() === "vi" ? "vi-VN" : "en-GB";
  const [popup, setPopup] = useState<"time" | "date" | null>(null);
  const [view, setView] = useState(() => new Date());
  const pickerRef = useRef<HTMLFieldSetElement>(null);
  const timeInput = useRef<HTMLInputElement>(null);
  const dateButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!popup) return;
    const close = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setPopup(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [popup]);

  const selected = date ? new Date(`${date}T12:00:00`) : null;
  const firstDay = new Date(view.getFullYear(), view.getMonth(), 1).getDay();
  const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const setTime = (next: string) => onChange(next || date ? `${date || localDateTime(new Date()).slice(0, 10)}T${next}` : "");
  const chooseDate = (day: number) => {
    const next = localDateTime(new Date(view.getFullYear(), view.getMonth(), day)).slice(0, 10);
    onChange(`${next}T${time || "08:00"}`);
    setPopup(null);
    dateButton.current?.focus();
  };
  const timeOptions = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`)
    .filter((item) => !time || item.includes(time) || time.length >= 5);

  return <fieldset ref={pickerRef} className="@container min-w-0" onKeyDown={(event) => {
    if (event.key !== "Escape" || !popup) return;
    event.preventDefault();
    (popup === "time" ? timeInput.current : dateButton.current)?.focus();
    setPopup(null);
  }}>
    <legend className="text-sm font-medium text-content">{label}{required ? " *" : ""}</legend>
    <div className="mt-2 grid gap-3 @min-[36rem]:grid-cols-2">
      <div className="relative min-w-0" onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPopup((current) => current === "time" ? null : current);
      }}>
        <label htmlFor={`${id}-time`} className="mb-2 block text-sm font-medium text-content-muted">{t("Giờ")}</label>
        <div className="relative">
          <Clock3 size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-brand" aria-hidden="true" />
          <Input ref={timeInput} id={`${id}-time`} type="text" inputMode="numeric" placeholder="HH:MM" pattern="(?:[01][0-9]|2[0-3]):[0-5][0-9]" required={required || Boolean(date)} value={time}
            onFocus={() => setPopup("time")} onClick={() => setPopup("time")} onChange={(event) => { setTime(event.target.value); setPopup("time"); }}
            onKeyDown={(event) => {
              if (event.key !== "ArrowDown") return;
              event.preventDefault();
              if (popup !== "time") setPopup("time");
              else document.getElementById(`${id}-times`)?.querySelector("button")?.focus();
            }}
            aria-invalid={invalid || undefined} aria-controls={popup === "time" && timeOptions.length ? `${id}-times` : undefined} className="quiz-time-input" />
        </div>
        {popup === "time" && timeOptions.length > 0 && <div id={`${id}-times`} className={`${pickerPanel} left-0 max-h-56 overflow-y-auto`}>
          {timeOptions.map((item) => <button key={item} type="button" onClick={() => {
            setTime(item);
            timeInput.current?.focus();
            setPopup(null);
          }} aria-pressed={time === item} className="quiz-picker-option flex min-h-11 w-full items-center rounded-xl border border-transparent px-4 text-left text-sm">{item}</button>)}
        </div>}
      </div>
      <div className="relative min-w-0" onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPopup((current) => current === "date" ? null : current);
      }}>
        <span id={`${id}-date-label`} className="mb-2 block text-sm font-medium text-content-muted">{t("Ngày")}</span>
        <Button ref={dateButton} type="button" variant="outline" aria-labelledby={`${id}-date-label ${id}-date-value`} aria-expanded={popup === "date"} aria-controls={popup === "date" ? `${id}-calendar` : undefined} aria-invalid={invalid || undefined}
          onClick={() => { if (popup !== "date") setView(selected ?? new Date()); setPopup(popup === "date" ? null : "date"); }}
          className="quiz-select-trigger w-full justify-start gap-3 whitespace-normal text-left font-normal">
          <CalendarDays size={18} className="shrink-0 text-brand" aria-hidden="true" /><span id={`${id}-date-value`}>{selected ? selected.toLocaleDateString(locale) : t("Chọn ngày")}</span>
        </Button>
        {popup === "date" && <div id={`${id}-calendar`} className={`${pickerPanel} right-0`}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <Button type="button" variant="ghost" size="icon" aria-label={t("Tháng trước")} onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}><ChevronLeft size={18} aria-hidden="true" /></Button>
            <strong aria-live="polite" className="text-center text-xs">{view.toLocaleDateString(locale, { month: "long", year: "numeric" })}</strong>
            <Button type="button" variant="ghost" size="icon" aria-label={t("Tháng sau")} onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}><ChevronRight size={18} aria-hidden="true" /></Button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-xs text-content-muted">
            {Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 7 + i).toLocaleDateString(locale, { weekday: "short" })).map((name) => <span key={name} className="py-1">{name}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: firstDay }, (_, i) => <span key={`empty-${i}`} />)}
            {Array.from({ length: days }, (_, i) => {
              const day = new Date(view.getFullYear(), view.getMonth(), i + 1);
              return <button key={i} type="button" onClick={() => chooseDate(i + 1)} aria-label={day.toLocaleDateString(locale, { dateStyle: "long" })} aria-pressed={selected?.toDateString() === day.toDateString()}
                className="quiz-picker-option min-h-11 rounded-xl border border-transparent text-xs">{i + 1}</button>;
            })}
          </div>
        </div>}
      </div>
    </div>
  </fieldset>;
}
export function QuizSurface({ fullPage, title, onClose, children }: { fullPage: boolean; title: string; onClose: () => void; children: ReactNode }) {
  if (!fullPage) return <Modal title={title} closeLabel="Đóng" onClose={onClose} wide>{children}</Modal>;
  return <section className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-8">{children}</section>;
}

export function QuestionEditor({ question, index, count, collapsed, toggle, error, t, update, remove, duplicate }: { question: QuestionDraft; index: number; count: number; collapsed: boolean; toggle: () => void; error?: string; t: (value: string) => string; update: (changes: Partial<QuestionDraft>) => void; remove: () => void; duplicate: () => void }) {
  const { ref, handleRef, isDragging, isDropTarget } = useSortable({ id: question.id, index });
  const updateOption = (optionIndex: number, value: string) => update({ options: question.options.map((option, i) => i === optionIndex ? value : option) });
  const removeOption = (optionIndex: number) => update({ options: question.options.filter((_, i) => i !== optionIndex), correctOption: question.correctOption === optionIndex ? -1 : question.correctOption > optionIndex ? question.correctOption - 1 : question.correctOption });
  return <section ref={ref} id={`question-${index}`} className={`rounded-2xl border bg-surface p-3 @min-[36rem]:p-5 ${error ? "border-error" : "border-line"} ${isDragging ? "opacity-60 ring-2 ring-brand" : ""} ${isDropTarget ? "ring-2 ring-focus" : ""}`}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-lg font-bold">{t("Câu")} {index + 1}</h3>
        {collapsed && <p className="truncate text-sm text-content-muted">{question.prompt || (question.type === "choice" ? t("Trắc nghiệm") : t("Tự luận"))}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="icon" onClick={toggle} aria-expanded={!collapsed} aria-label={`${collapsed ? t("Mở rộng") : t("Thu gọn")} ${t("Câu")} ${index + 1}`}>{collapsed ? <ChevronDown size={18} aria-hidden="true" /> : <ChevronUp size={18} aria-hidden="true" />}</Button>
        <Button ref={handleRef} type="button" variant="outline" size="icon" aria-label={`${t("Kéo để đổi thứ tự")} ${t("Câu")} ${index + 1}`} aria-roledescription={t("Tay nắm sắp xếp câu hỏi")} title={t("Kéo để đổi thứ tự")} className="touch-none cursor-grab active:cursor-grabbing"><GripVertical size={18} aria-hidden="true" /></Button>
        <Button type="button" variant="outline" size="icon" onClick={duplicate} disabled={count >= 200} aria-label={`${t("Nhân bản")} ${t("Câu")} ${index + 1}`} title={t("Nhân bản")}><Copy size={18} aria-hidden="true" /></Button>
        {count > 1 && <Button type="button" variant="outline" size="icon" onClick={remove} aria-label={`${t("Xóa câu")} ${index + 1}`} title={t("Xóa câu")} className="text-error"><Trash2 size={18} aria-hidden="true" /></Button>}
      </div>
    </div>
    {!collapsed && <div id={`question-body-${question.id}`}>
    <div className="mt-4 grid gap-4 @min-[36rem]:grid-cols-[minmax(0,1fr)_8rem]">
      <label className="text-sm font-semibold">{t("Loại câu hỏi")}<Select value={question.type} onValueChange={(value) => update({ type: value as QuestionDraft["type"] })} ariaLabel={t("Loại câu hỏi")} options={[{ value: "choice", label: t("Trắc nghiệm") }, { value: "essay", label: t("Tự luận") }]} className="mt-2" /></label>
      <label className="text-sm font-semibold">{t("Điểm")}<Input type="number" min={0} max={1000} step={0.25} required value={question.points} onChange={(event) => update({ points: Number(event.target.value) })} className="mt-2" /></label>
    </div>
    <label className="mt-4 block text-sm font-semibold">{t("Nội dung câu hỏi")}<Textarea required value={question.prompt} onChange={(event) => update({ prompt: event.target.value })} rows={3} className="mt-2" /></label>
    {question.type === "choice" && <fieldset className="mt-5 min-w-0 rounded-xl border border-line bg-surface-subtle p-2 @min-[36rem]:p-4"><legend className="px-1 text-sm font-semibold">{t("Các lựa chọn")}</legend><p className="mb-3 text-sm text-content-muted">{t("Nhập từng đáp án và chọn một đáp án đúng.")}</p>
      <div className="space-y-3">
        {question.options.map((option, optionIndex) => {
          const letter = String.fromCharCode(65 + optionIndex);
          return <div key={optionIndex} className="flex items-center gap-2">
            <label className="quiz-answer-choice flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-xl border border-line bg-surface px-1 text-sm font-semibold" title={t("Đáp án đúng")}>
              <input type="radio" name={`correct-option-${question.id}`} checked={question.correctOption === optionIndex} onChange={() => update({ correctOption: optionIndex })} className="size-4 accent-brand" aria-label={`${t("Chọn đáp án đúng")}: ${letter}`} />
              <span>{letter}</span>
            </label>
            <Input maxLength={500} value={option} onChange={(event) => updateOption(optionIndex, event.target.value)} aria-label={`${t("Lựa chọn")} ${letter}`} className="min-w-0 flex-1" />
            <Button type="button" variant="outline" size="icon" disabled={question.options.length <= 2} onClick={() => removeOption(optionIndex)} aria-label={`${t("Xóa đáp án")} ${letter}`} className="shrink-0 text-error"><Trash2 size={18} aria-hidden="true" /></Button>
          </div>;
        })}
      </div>
      <Button type="button" variant="outline" disabled={question.options.length >= 8} onClick={() => update({ options: [...question.options, ""] })} className="mt-4">{t("+ Thêm đáp án")}</Button>
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
