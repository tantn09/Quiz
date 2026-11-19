"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/modal";

type Question = { type: "choice" | "essay"; prompt: string; options: string[]; correctOption: number | null; points: number };
type Variant = { id: string; code: number; active: boolean; questions: Question[] };
const blank = (): Question => ({ type: "choice", prompt: "Câu hỏi mới", options: ["Lựa chọn A", "Lựa chọn B"], correctOption: 0, points: 1 });

export function QuizVariants({ quizId }: { quizId: string }) {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selected, setSelected] = useState("");
  const [draft, setDraft] = useState<Question[]>([]);
  const [active, setActive] = useState(true);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  async function reload() {
    const response = await fetch(`/api/teacher/quizzes/${quizId}`, { cache: "no-store" });
    if (!response.ok) { setNotice("Không tải được mã đề."); return; }
    const data = await response.json();
    setVariants(data.variants);
    const current = data.variants.find((item: Variant) => item.id === selected) ?? data.variants[0];
    if (current) { setSelected(current.id); setDraft(current.questions.map((item: Question) => ({ ...item, options: [...item.options] }))); setActive(current.active); }
  }
  useEffect(() => { void reload(); }, [quizId]);
  function choose(variant: Variant) { setSelected(variant.id); setDraft(variant.questions.map((item) => ({ ...item, options: [...item.options] }))); setActive(variant.active); setNotice(""); }
  function update(index: number, patch: Partial<Question>) { setDraft((items) => items.map((item, i) => i === index ? { ...item, ...patch } : item)); }
  async function create(mode: "manual" | "shuffle") {
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/teacher/quizzes/${quizId}/variants`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(mode === "manual" ? { mode, questions: [blank()] } : { mode, sourceVariantId: selected }) });
      if (!response.ok) throw new Error();
      const data = await response.json();
      const detail = await fetch(`/api/teacher/quizzes/${quizId}`, { cache: "no-store" }).then((item) => item.json());
      setVariants(detail.variants); choose(detail.variants.find((item: Variant) => item.id === data.variant.id)); setNotice("Đã thêm mã đề. Hãy kiểm tra và lưu nội dung.");
    } catch { setNotice("Không thể thêm mã đề."); } finally { setBusy(false); }
  }
  async function save() {
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/teacher/quizzes/${quizId}/variants/${selected}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ active, questions: draft }) });
      if (!response.ok) throw new Error();
      setNotice("Đã lưu mã đề."); await reload();
    } catch { setNotice("Không thể lưu. Kiểm tra câu hỏi, lựa chọn, đáp án đúng và trạng thái mã."); } finally { setBusy(false); }
  }
  async function deleteVariant() {
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/teacher/quizzes/${quizId}/variants/${selected}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setNotice(data.error === "last_active" ? "Hãy bật một mã khác trước khi xóa mã đang phân cuối cùng." : data.error === "last_variant" ? "Bài kiểm tra phải có ít nhất một mã đề." : "Không thể xóa mã đề.");
        return;
      }
      setConfirmDelete(false); setSelected(""); setNotice("Đã xóa mã đề. Bài làm cũ vẫn xem và chấm được."); await reload();
    } catch { setNotice("Không thể xóa mã đề."); } finally { setBusy(false); }
  }
  return <section className="rounded-2xl border border-line p-4"><h3 className="text-lg font-bold">Mã đề</h3><div className="mt-3 flex flex-wrap gap-2">{variants.map((variant) => <Button key={variant.id} type="button" variant={selected === variant.id ? "default" : "outline"} onClick={() => choose(variant)}>Mã {variant.code}{variant.active ? "" : " · Tắt"}</Button>)}</div><div className="mt-3 flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => void create("manual")}>Thêm mã soạn riêng</Button><Button type="button" variant="outline" disabled={busy || !selected} onClick={() => void create("shuffle")}>Tạo mã đảo câu/đáp án</Button></div>
    {selected && <div className="mt-5 space-y-4"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />Phân mã này cho lượt mới</label>{draft.map((question, index) => <div key={index} className="rounded-xl border border-line p-4"><div className="flex items-center justify-between"><strong>Câu {index + 1}</strong><Button type="button" variant="outline" disabled={draft.length === 1} onClick={() => setDraft((items) => items.filter((_, i) => i !== index))}>Xóa câu</Button></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><label>Loại câu<select value={question.type} onChange={(event) => update(index, event.target.value === "essay" ? { type: "essay", options: [], correctOption: null } : { type: "choice", options: ["", ""], correctOption: 0 })} className="mt-1 block w-full rounded-lg border border-line p-2"><option value="choice">Trắc nghiệm</option><option value="essay">Tự luận</option></select></label><label>Điểm<input type="number" min={0} max={1000} step={0.25} value={question.points} onChange={(event) => update(index, { points: Number(event.target.value) })} className="mt-1 block w-full rounded-lg border border-line p-2" /></label></div><label className="mt-3 block">Nội dung<textarea value={question.prompt} onChange={(event) => update(index, { prompt: event.target.value })} className="mt-1 block w-full rounded-lg border border-line p-2" /></label>{question.type === "choice" && <div className="mt-3 space-y-2">{question.options.map((option, optionIndex) => <div key={optionIndex} className="flex items-center gap-2"><input type="radio" name={`answer-${index}`} checked={question.correctOption === optionIndex} onChange={() => update(index, { correctOption: optionIndex })} aria-label={`Đáp án đúng ${optionIndex + 1}`} /><input value={option} onChange={(event) => update(index, { options: question.options.map((item, i) => i === optionIndex ? event.target.value : item) })} className="min-w-0 flex-1 rounded-lg border border-line p-2" aria-label={`Lựa chọn ${optionIndex + 1}`} /><Button type="button" variant="outline" disabled={question.options.length <= 2} onClick={() => update(index, { options: question.options.filter((_, i) => i !== optionIndex), correctOption: question.correctOption === optionIndex ? 0 : question.correctOption !== null && question.correctOption > optionIndex ? question.correctOption - 1 : question.correctOption })}>Xóa</Button></div>)}<Button type="button" variant="outline" disabled={question.options.length >= 8} onClick={() => update(index, { options: [...question.options, ""] })}>Thêm lựa chọn</Button></div>}</div>)}<div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={draft.length >= 200} onClick={() => setDraft((items) => [...items, blank()])}>Thêm câu trắc nghiệm</Button><Button type="button" variant="outline" disabled={draft.length >= 200} onClick={() => setDraft((items) => [...items, { ...blank(), type: "essay", options: [], correctOption: null }])}>Thêm câu tự luận</Button><Button type="button" disabled={busy} onClick={() => void save()}>Lưu mã đề</Button><Button type="button" variant="outline" disabled={busy || variants.length <= 1} onClick={() => setConfirmDelete(true)}>Xóa mã đề</Button></div></div>}{notice && <p role="status" className="mt-3 text-sm">{notice}</p>}{confirmDelete && <Modal title="Xóa mã đề" onClose={() => !busy && setConfirmDelete(false)}><p>Xóa mã {variants.find((item) => item.id === selected)?.code}? Mã này sẽ không được phân cho lượt mới. Bài đang làm và bài đã nộp vẫn được giữ để xem, chấm và xuất kết quả.</p><div className="mt-5 flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setConfirmDelete(false)}>Hủy</Button><Button type="button" disabled={busy} onClick={() => void deleteVariant()}>Xác nhận xóa</Button></div></Modal>}</section>;
}
