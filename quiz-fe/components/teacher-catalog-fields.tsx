"use client";

import { LoadingScreen } from "@/components/ui/loading-screen";
import { useErrorToast } from "@/components/ui/toast";
import { Select } from "@/components/ui/select";
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
      <CatalogSelect key={current} name={name} label={t(label)} placeholder={t(placeholder)} current={current} items={options ?? []} />
      {options?.length === 0 && <p className="mt-1 text-xs text-content-muted">{t("Danh mục chưa có lựa chọn.")} {manageCatalogs && <a className="text-brand underline" href="/admin/catalogs">{t("Quản lý danh mục")}</a>}</p>}
    </div>)}
    {!catalogs && !failed && <LoadingScreen />}
  </>;
}


function CatalogSelect({ name, label, placeholder, current, items }: {
  name: string;
  label: string;
  placeholder: string;
  current: string;
  items: CatalogItem[];
}) {
  const [value, setValue] = useState(current);
  const options = [
    { value: "", label: placeholder },
    ...(current && !items.some((item) => item.name === current) ? [{ value: current, label: current }] : []),
    ...items.map((item) => ({ value: item.name, label: item.name })),
  ];

  return <>
    <span className="block text-sm font-medium">{label}</span>
    <Select value={value} onValueChange={setValue} ariaLabel={label} options={options} className="mt-2" />
    <input type="hidden" name={name} value={value} />
  </>;
}
