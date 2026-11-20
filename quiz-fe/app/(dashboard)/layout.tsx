import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";

export default async function Layout({ children }: { children: ReactNode }) {
  const role = (await headers()).get("x-dashboard-role");
  if (role !== "admin" && role !== "teacher") redirect("/login");
  return <DashboardShell admin={role === "admin"}>{children}</DashboardShell>;
}
