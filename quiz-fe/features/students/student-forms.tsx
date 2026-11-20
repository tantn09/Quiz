import { useErrorToast } from "@/components/ui/toast";
import { type FormEvent, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { Modal } from "@/components/modal";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

export type Student = { id: string; name: string; className: string };

type Upload = { filename: string; data: string };

export function StudentForm({ draft, setDraft, save, close, busy, teacherName }: {
  draft: Student; setDraft: (draft: Student) => void; save: (event: FormEvent<HTMLFormElement>) => void;
  close: () => void; busy: boolean; teacherName?: string;
}) {
  const t = useTranslation();
  return <Modal title={t(draft.id ? "Sửa thông tin học sinh" : "Thêm học sinh")} closeLabel={t("Đóng")} onClose={() => !busy && close()}><form onSubmit={save} className="grid gap-4">
      {teacherName && <p className="text-sm text-content-muted">{t("Giáo viên")} · {teacherName}</p>}
      <label className="text-sm font-medium">{t("Họ và tên")}<Input required maxLength={160} className="mt-2" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
      <label className="text-sm font-medium">{t("Lớp")}<Input required maxLength={80} className="mt-2" value={draft.className} onChange={(event) => setDraft({ ...draft, className: event.target.value })} /></label>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={close}>{t("Hủy")}</Button>
        <Button type="submit" disabled={busy}>{t(busy ? "Đang lưu…" : "Lưu thông tin")}</Button>
      </div>
    </form></Modal>;
}

export function StudentImport({ endpoint, suffix, teacherName, busy, setBusy, close, onImported }: {
  endpoint: string; suffix: string; teacherName?: string; busy: boolean; setBusy: (busy: boolean) => void; close: () => void; onImported: (count: number) => Promise<void>;
}) {
  const t = useTranslation();
  const showError = useErrorToast();
  const [upload, setUpload] = useState<Upload | null>(null);
  const [filename, setFilename] = useState("");
  const [count, setCount] = useState(0);
  const [errors, setErrors] = useState<{ row: number; message: string }[]>([]);
  async function importFile(file: Upload, confirm: boolean) {
    setBusy(true);
    setCount(0);
    setErrors([]);
    try {
      const response = await fetch(endpoint + "/import" + suffix, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...file, confirm }) });
      const result = await response.json();
      if (!response.ok && !result.errors) throw new Error();
      setCount(response.ok ? result.count ?? 0 : 0);
      const issues: { row: number; message: string }[] = result.errors ?? [];
      if (!response.ok) showError(t(issues[0]?.message ?? "Không nhập được danh sách học sinh."));
      setErrors(issues.filter((issue) => issue.row > 0));
      if (response.ok && confirm) {
        setUpload(null);
        await onImported(result.count);
      }
    } catch { showError(t("Không nhập được danh sách học sinh.")); }
    finally { setBusy(false); }
  }

  async function selectFile(file?: File) {
    setUpload(null);
    setCount(0);
    setErrors([]);
    if (!file) return;
    setFilename(file.name);
    if (file.size > 2_000_000 || !file.name.toLowerCase().endsWith(".xlsx")) {
      setErrors([{ row: 0, message: "Chỉ nhận file .xlsx hợp lệ tối đa 2 MB." }]);
      return;
    }
    setBusy(true);
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    const data = { filename: file.name, data: btoa(binary) };
    setUpload(data);
    await importFile(data, false);
  }

  return <Modal title={t("Nhập Excel")} closeLabel={t("Đóng")} onClose={() => !busy && close()}>
    <div className="space-y-4">
      {teacherName && <p className="text-sm text-content-muted">{t("Giáo viên")} · {teacherName}</p>}
      <p className="text-sm text-content-muted">{t("Chọn file .xlsx tối đa 2 MB.")}</p>
      <Button asChild variant="outline" size="sm"><a href={endpoint + "/template.xlsx"}>{t("Tải Excel mẫu")}</a></Button>
      <label className="block text-sm font-medium">{t("Chọn file Excel")}
        <Input disabled={busy} type="file" accept=".xlsx" className="mt-2" onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (!file) return;
          void selectFile(file).catch(() => {
            setErrors([{ row: 0, message: "Không đọc được file .xlsx." }]);
            setBusy(false);
          });
        }} />
      </label>
      {filename && <p className="break-all text-sm font-medium">{filename}</p>}
      {busy && <p role="status" className="text-sm text-content-muted">{t("Đang xử lý file Excel…")}</p>}
      {!busy && upload && <p role="status" className="text-sm">{t("Số dòng hợp lệ")} {count}</p>}
      {!!errors.length && <Alert tone="error"><ul className="max-h-48 list-disc space-y-1 overflow-y-auto pl-5">
        {errors.map((error, index) => <li key={index}>{error.row ? t("Dòng") + " " + error.row + " · " : ""}{t(error.message)}</li>)}
      </ul></Alert>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={close}>{t("Hủy")}</Button>
        <Button type="button" disabled={busy || !upload || count < 1 || errors.length > 0} onClick={() => { if (upload) void importFile(upload, true); }}>{t("Xác nhận nhập")}</Button>
      </div>
    </div>
  </Modal>;
}
