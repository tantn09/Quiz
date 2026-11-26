"use client";

import { useErrorToast } from "@/components/ui/toast";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BarChart3, BookOpenCheck, DoorOpen, GraduationCap, LayoutDashboard, Menu, Settings, Users, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export function DashboardNav({ admin }: { admin: boolean }) {
  const showError = useErrorToast();
  const t = useTranslation();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 639px)");
    const updateViewport = () => setIsMobile(media.matches);
    updateViewport();
    media.addEventListener("change", updateViewport);
    return () => media.removeEventListener("change", updateViewport);
  }, []);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const focusContent = useRef(false);

  useEffect(() => {
    if (!open || !isMobile) return;
    const sidebar = sidebarRef.current;
    const main = document.getElementById("page-content");
    const previousInert = main?.inert ?? false;
    const previousOverflow = document.body.style.overflow;
    if (main) main.inert = true;
    document.body.style.overflow = "hidden";
    sidebar?.querySelector<HTMLElement>("button")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        setOpen(false);
      }
      if (event.key !== "Tab" || !sidebar) return;
      const items = [...sidebar.querySelectorAll<HTMLElement>("a[href], button:not(:disabled)")];
      const active = document.activeElement;
      if (!items.length) { event.preventDefault(); return; }
      if (!items.includes(active as HTMLElement) || (event.shiftKey ? active === items[0] : active === items.at(-1))) {
        event.preventDefault();
        (event.shiftKey ? items.at(-1) : items[0])?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (main) main.inert = previousInert;
      document.body.style.overflow = previousOverflow;
      const trigger = triggerRef.current;
      if (focusContent.current) main?.focus();
      else if (trigger?.getClientRects().length) trigger.focus();
      focusContent.current = false;
    };
  }, [open, isMobile]);

  useEffect(() => { if (!isMobile) setOpen(false); }, [isMobile]);

  function navigate() {
    if (open && isMobile) focusContent.current = true;
    setOpen(false);
  }

  async function logout() {
    setBusy(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error();
      window.location.assign("/login");
    } catch {
      showError(t("Không thể đăng xuất."));
      setBusy(false);
    }
  }

  const itemClass = "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-content-muted transition-colors hover:bg-surface-subtle hover:text-content aria-[current=page]:bg-surface-accent aria-[current=page]:font-semibold aria-[current=page]:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";
  const links = [
    { href: admin ? "/admin" : "/teacher", label: t("Tổng quan"), icon: LayoutDashboard },
    ...(admin ? [{ href: "/admin/teachers", label: t("Giáo viên"), icon: Users }] : []),
    ...(admin ? [{ href: "/admin/catalogs", label: t("Danh mục"), icon: GraduationCap }] : []),
      { href: admin ? "/admin/quiz" : "/teacher/quiz", label: t("Bài kiểm tra"), icon: BookOpenCheck },
      { href: admin ? "/admin/students" : "/teacher/students", label: t("Học sinh"), icon: Users },
      { href: admin ? "/admin/results" : "/teacher/results", label: t("Kết quả"), icon: BarChart3 },
    { href: "/settings", label: t("Cài đặt"), icon: Settings },
  ];

  return <>
    <a inert={open && isMobile} href="#page-content" className="fixed left-3 top-3 z-[60] -translate-y-20 rounded-lg bg-surface px-4 py-3 font-semibold text-brand shadow focus:translate-y-0">{t("Bỏ qua điều hướng")}</a>
    <button
      ref={triggerRef}
      inert={open && isMobile}
      type="button"
      aria-label={t("Mở menu")}
      aria-expanded={open}
      aria-controls="dashboard-sidebar"
      onClick={() => setOpen(true)}
      className="fixed left-4 top-4 z-40 flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface text-content shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:hidden"
    >
      <Menu size={20} aria-hidden="true" />
    </button>

    {open && <button type="button" tabIndex={-1} aria-hidden="true" aria-label={t("Đóng menu")} onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-slate-950/40 sm:hidden" />}

    <aside
      ref={sidebarRef}
      role={isMobile && open ? "dialog" : undefined}
      aria-modal={isMobile && open ? true : undefined}
      id="dashboard-sidebar"
      aria-label={t("Điều hướng chính")}
      aria-hidden={isMobile && !open}
      inert={isMobile && !open}
      className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-full flex-col overflow-y-auto border-r border-line bg-surface px-4 py-5 shadow-xl backdrop-blur-xl transition-transform duration-200 ease-out sm:z-30 sm:w-64 sm:translate-x-0 sm:shadow-none ${open ? "translate-x-0" : "-translate-x-full"}`}
    >
      <div className="flex items-center justify-between px-2">
        <Link href={admin ? "/admin" : "/teacher"} onClick={navigate} className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl ds-gradient text-white"><GraduationCap size={22} aria-hidden="true" /></span>
          <span><span className="block text-sm font-bold tracking-wide text-content">CLASSROOM</span><span className="block text-xs text-content-muted">{t("Bài kiểm tra lớp học")}</span></span>
        </Link>
        <button type="button" onClick={() => setOpen(false)} aria-label={t("Đóng menu")} className="flex h-10 w-10 items-center justify-center rounded-lg text-content-muted hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:hidden"><X size={20} aria-hidden="true" /></button>
      </div>

      <p className="mb-2 mt-9 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{t(admin ? "Quản trị" : "Giáo viên")}</p>
      <nav className="flex flex-col gap-1" aria-label={t("Điều hướng chính")}>
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/admin" && href !== "/teacher" && pathname.startsWith(`${href}/`));
          return <Link key={href} href={href} onClick={navigate} aria-current={active ? "page" : undefined} className={itemClass}>
            <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
            <span>{label}</span>
          </Link>;
        })}
      </nav>

      <div className="mt-auto border-t border-line pt-4">
        <button disabled={busy} onClick={() => void logout()} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-content-muted transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-60">
          <DoorOpen size={18} strokeWidth={1.8} aria-hidden="true" />
          <span>{busy ? t("Đang thoát…") : t("Đăng xuất")}</span>
        </button>
      </div>
    </aside>
  </>;
}
