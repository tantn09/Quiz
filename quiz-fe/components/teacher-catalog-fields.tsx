"use client";

import { LoadingScreen } from "@/components/ui/loading-screen";
import { useErrorToast } from "@/components/ui/toast";
import { NativeSelect } from "@/components/ui/field";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";

type CatalogItem = { id: string; name: string };
type Catalogs = { subjects: CatalogItem[]; workplaces: CatalogItem[] };
type Props = {
  registration?: boolean;
  manageCatalogs?: boolean;
  subject?: string | null;
  workplace?: string | null;
};

export function TeacherCatalogFields({ registration = false, manageCatalogs = false, subject, workplace }: Props) {
  const t = useTranslation();
  const showError = useErrorToast();
  const [catalogs, setCatalogs] = useState<Catalogs | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const endpoint = registration ? "/api/public/teacher-catalogs" : "/api/teacher/catalogs";
    fetch(endpoint, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data: Catalogs = await response.json();
        if (!Array.isArray(data.subjects) || !Array.isArray(data.workplaces)) throw new Error();
        if (!controller.signal.aborted) setCatalogs(data);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setFailed(true);
        showError(t("Không tải được danh mục."));
      });
    return () => {
      controller.abort();
    };
  }, [registration, showError, t]);

  const fields = [
    { name: "subject", label: "Bộ môn", placeholder: "Chọn bộ môn", current: subject ?? "", options: catalogs?.subjects },
    { name: "workplace", label: "Nơi công tác", placeholder: "Chọn nơi công tác", current: workplace ?? "", options: catalogs?.workplaces },
  ] as const;

  return <>
    {fields.map(({ name, label, placeholder, current, options }) => <div key={name}>
      <label className="block text-sm font-medium">{t(label)}
        <NativeSelect name={name} defaultValue={current} className="mt-2 min-h-11 w-full rounded-xl border border-line bg-surface px-4 py-2">
          <option value="">{t(placeholder)}</option>
          {current && !options?.some((item) => item.name === current) && <option key={current} value={current}>{current}</option>}
          {options?.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
        </NativeSelect>
      </label>
      {options?.length === 0 && <p className="mt-1 text-xs text-content-muted">{t("Danh mục chưa có lựa chọn.")} {manageCatalogs && <a className="text-brand underline" href="/admin/catalogs">{t("Quản lý danh mục")}</a>}</p>}
    </div>)}
    {!catalogs && !failed && <LoadingScreen />}
  </>;
}
