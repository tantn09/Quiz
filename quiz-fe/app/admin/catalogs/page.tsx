"use client";

import { LoadingScreen } from "@/components/ui/loading-screen";
import { useErrorToast } from "@/components/ui/toast";
import { type FormEvent, type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { DashboardLayout } from "@/components/page-layouts";
import { Modal } from "@/components/modal";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Table } from "@/components/ui/table";
import { useLocale, useTranslation } from "@/lib/i18n";

const tabs = [
  { key: "subjects", endpoint: "subjects", label: "Môn học" },
  { key: "gradeLevels", endpoint: "grade-levels", label: "Khối lớp" },
  { key: "workplaces", endpoint: "workplaces", label: "Nơi công tác" },
] as const;
type Item = { id: string; name: string };
type Catalogs = Record<typeof tabs[number]["key"], Item[]>;
type Dialog = { action: "add" | "edit" | "remove"; item?: Item };

export default function CatalogPage() {
  const t = useTranslation();
  const showError = useErrorToast();
  const locale = useLocale();
  const [catalogs, setCatalogs] = useState<Catalogs | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [active, setActive] = useState(0);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const addRef = useRef<HTMLButtonElement>(null);
  const tab = tabs[active];
  const items = catalogs?.[tab.key];

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoadError(false);
    try {
      const response = await fetch("/api/teacher/catalogs", { cache: "no-store", signal });
      if (!response.ok) throw new Error();
      const data: Catalogs = await response.json();
      if (!signal?.aborted) setCatalogs(data);
    } catch {
      if (!signal?.aborted) { setLoadError(true); showError(t("Không tải được danh mục.")); }
    }
  }, [showError, t]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === "ArrowRight" ? (index + 1) % tabs.length
      : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length
      : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    setActive(next);
    tabRefs.current[next]?.focus();
  }

  function open(action: Dialog["action"], item?: Item) {
    setError("");
    setName(item?.name ?? "");
    setDialog({ action, item });
  }

  async function mutate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dialog || busy) return;
    const { action, item } = dialog;
    const deleting = action === "remove";
    const value = name.trim();
    if (!deleting && !value) { setError("Vui lòng nhập tên danh mục."); return; }

    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/catalogs/" + tab.endpoint + (item ? "/" + item.id : ""), {
        method: deleting ? "DELETE" : item ? "PUT" : "POST",
        headers: deleting ? undefined : { "content-type": "application/json" },
        body: deleting ? undefined : JSON.stringify({ name: value }),
      });
      if (response.status === 409) { showError(t("Tên đã tồn tại.")); return; }
      if (!response.ok) throw new Error();
      const saved: Item | undefined = deleting ? undefined : (await response.json()).item;
      setCatalogs((current) => {
        if (!current) return current;
        const updated = current[tab.key].filter((row) => row.id !== item?.id);
        if (saved) updated.push(saved);
        updated.sort((a, b) => a.name.localeCompare(b.name, locale === "en" ? "en" : "vi"));
        return { ...current, [tab.key]: updated };
      });
      setDialog(null);
      if (deleting) requestAnimationFrame(() => addRef.current?.focus());
    } catch {
      showError(t(deleting ? "Không xóa được mục này." : "Không lưu được danh mục."));
    } finally { setBusy(false); }
  }

  if (!catalogs && !loadError) return <LoadingScreen />;

  return <DashboardLayout admin compact>
    <PageHeader title={t("Danh mục")} description={t("Quản lý các lựa chọn khi tạo bài kiểm tra và tài khoản giáo viên.")} />
    <section className="mt-7 min-w-0 rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div role="tablist" aria-label={t("Danh mục")} className="flex flex-wrap gap-2 border-b border-line pb-3">
        {tabs.map((item, index) => <Button
          key={item.key} ref={(element) => { tabRefs.current[index] = element; }}
          id={"catalog-tab-" + item.key} role="tab" type="button" size="sm"
          variant={index === active ? "default" : "ghost"}
          aria-selected={index === active} aria-controls={"catalog-panel-" + item.key}
          tabIndex={index === active ? 0 : -1}
          onClick={() => setActive(index)} onKeyDown={(event) => handleTabKey(event, index)}
        >{t(item.label)}</Button>)}
      </div>
      {tabs.map((item, index) => <div key={item.key} id={"catalog-panel-" + item.key} role="tabpanel"
        aria-labelledby={"catalog-tab-" + item.key} hidden={index !== active} className="pt-4">
        {index === active && <>
          <div className="mb-4 flex justify-end"><Button ref={addRef} type="button" disabled={!items || busy} onClick={() => open("add")}>{t("Thêm")}</Button></div>
          {items && (items.length === 0 ? <EmptyState title={t("Danh mục chưa có lựa chọn.")} />
            : <Table>
              <thead><tr><th scope="col">{t("Tên")}</th><th scope="col" className="w-px">{t("Thao tác")}</th></tr></thead>
              <tbody>{items.map((row) => <tr key={row.id} className="border-b border-line last:border-b-0">
                <th scope="row" className="py-2 text-left font-medium [overflow-wrap:anywhere]">{row.name}</th>
                <td className="py-2"><div className="flex gap-2">
                  <Button type="button" disabled={busy} variant="outline" size="sm" aria-label={t("Sửa") + " " + row.name} onClick={() => open("edit", row)}>{t("Sửa")}</Button>
                  <Button type="button" disabled={busy} variant="outline" size="sm" aria-label={t("Xóa") + " " + row.name} onClick={() => open("remove", row)}>{t("Xóa")}</Button>
                </div></td>
              </tr>)}</tbody>
            </Table>)}
        </>}
      </div>)}
    </section>
    {dialog && <Modal title={t(dialog.action === "remove" ? "Xóa mục danh mục" : dialog.action === "edit" ? "Sửa mục danh mục" : "Thêm mục danh mục")}
      closeLabel={t("Đóng")} onClose={() => { if (!busy) setDialog(null); }}>
      <form onSubmit={mutate} className="space-y-4">
        {dialog.action === "remove" ? <>
          <p className="font-semibold [overflow-wrap:anywhere]">{dialog.item?.name}</p>
          <p className="text-sm text-content-muted">{t("Bài kiểm tra và hồ sơ đã lưu vẫn giữ tên cũ.")}</p>
          {error && <Alert tone="error">{t(error)}</Alert>}
        </> : <label className="block text-sm font-medium">{t("Tên")}
          <Input className="mt-2" required maxLength={120} value={name} disabled={busy}
            aria-invalid={Boolean(error)} aria-describedby={error ? "catalog-name-error" : undefined}
            onChange={(event) => { setName(event.target.value); setError(""); }} />
          {error && <span id="catalog-name-error" role="alert" className="mt-2 block text-error">{t(error)}</span>}
        </label>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={() => setDialog(null)}>{t("Hủy")}</Button>
          <Button type="submit" disabled={busy} variant={dialog.action === "remove" ? "destructive" : "default"}>
            {t(dialog.action === "remove" ? "Xác nhận xóa" : "Lưu")}
          </Button>
        </div>
      </form>
    </Modal>}
  </DashboardLayout>;
}
