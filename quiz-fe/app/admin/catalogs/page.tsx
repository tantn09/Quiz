"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { DashboardNav } from "@/components/dashboard-nav";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

type Item = { id: string; name: string };
type Kind = "subjects" | "grade-levels" | "workplaces";

export default function CatalogPage() {
  const [subjects, setSubjects] = useState<Item[]>([]);
  const [gradeLevels, setGradeLevels] = useState<Item[]>([]);
  const [workplaces, setWorkplaces] = useState<Item[]>([]);
  const [draft, setDraft] = useState<Record<Kind, string>>({ subjects: "", "grade-levels": "", workplaces: "" });
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/teacher/catalogs", { cache: "no-store" });
    if (response.ok) { const data = await response.json(); setSubjects(data.subjects); setGradeLevels(data.gradeLevels); setWorkplaces(data.workplaces); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function save(event: FormEvent, kind: Kind, id?: string) {
    event.preventDefault();
    const name = id ? (event.currentTarget as HTMLFormElement).querySelector<HTMLInputElement>("input")?.value ?? "" : draft[kind];
    const response = await fetch(`/api/admin/catalogs/${kind}${id ? `/${id}` : ""}`, { method: id ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
    if (!response.ok) { setError(response.status === 409 ? "Tên đã tồn tại." : "Không lưu được danh mục."); return; }
    setError(""); setDraft((current) => ({ ...current, [kind]: "" })); await load();
  }
  async function remove(kind: Kind, item: Item) {
    if (!window.confirm(`Xóa ${item.name}? Dữ liệu đã lưu vẫn giữ tên này.`)) return;
    const response = await fetch(`/api/admin/catalogs/${kind}/${item.id}`, { method: "DELETE" });
    if (!response.ok) { setError("Không xóa được mục này."); return; }
    setError(""); await load();
  }
  return <><DashboardNav admin /><main id="page-content" className="min-h-screen px-4 pb-8 pt-20 sm:ml-64 sm:px-8 sm:pt-8"><div className="mx-auto max-w-5xl"><PageHeader eyebrow="QUẢN TRỊ" title="Danh mục" description="Quản lý các lựa chọn khi tạo bài kiểm tra và tài khoản giáo viên." />{error && <p role="alert" className="mt-5 rounded-xl ds-error p-3">{error}</p>}<div className="mt-6 grid gap-6 lg:grid-cols-2">{([ ["subjects", "Môn học", subjects], ["grade-levels", "Khối lớp", gradeLevels], ["workplaces", "Nơi công tác", workplaces] ] as const).map(([kind, title, items]) => <section key={kind} className="rounded-2xl border border-line bg-surface p-5"><h2 className="text-lg font-bold">{title}</h2><form onSubmit={(event) => void save(event, kind)} className="mt-4 flex gap-2"><input required maxLength={120} value={draft[kind]} onChange={(event) => setDraft((current) => ({ ...current, [kind]: event.target.value }))} aria-label={`Thêm ${title.toLowerCase()}`} className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2" /><Button type="submit">Thêm</Button></form><div className="mt-4 space-y-2">{items.map((item) => <form key={item.id} onSubmit={(event) => void save(event, kind, item.id)} className="flex gap-2"><input required maxLength={120} key={`${item.id}:${item.name}`} defaultValue={item.name} aria-label={`Sửa ${item.name}`} className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2" /><Button type="submit" variant="outline">Lưu</Button><Button type="button" variant="outline" onClick={() => void remove(kind, item)}>Xóa</Button></form>)}</div></section>)}</div></div></main></>;
}
