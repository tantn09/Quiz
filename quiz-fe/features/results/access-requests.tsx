import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

export function AccessRequests({ requests, reviewing, decide }: {
  requests: { id: string; name: string; status: string }[];
  reviewing: boolean;
  decide: (id: string, status: "approved" | "rejected") => Promise<void>;
}) {
  const t = useTranslation();
  return <ul className="space-y-2">{requests.map((item) => <li key={item.id} className="flex flex-wrap items-center gap-2 border-b border-line py-2"><span className="mr-auto">{item.name}</span>{item.status === "pending" ? <><Button disabled={reviewing} onClick={() => void decide(item.id, "approved")}>{t("Duyệt và thêm vào lớp")}</Button><Button variant="outline" disabled={reviewing} onClick={() => void decide(item.id, "rejected")}>{t("Từ chối")}</Button></> : <span>{t(item.status === "approved" ? "Đã duyệt" : "Đã từ chối")}</span>}</li>)}{!requests.length && <li>{t("Chưa có yêu cầu làm bài.")}</li>}</ul>;
}
