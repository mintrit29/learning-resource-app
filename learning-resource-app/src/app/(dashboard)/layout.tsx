import Link from "next/link";
import { BookOpenText, HardDrive } from "lucide-react";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { ProjectFooter } from "@/components/layout/project-footer";
import { ProjectHeader } from "@/components/layout/project-header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="app-brand" href="/dashboard">
          <span><BookOpenText size={21} /></span>
          <strong>ScholarFlow</strong>
        </Link>
        <SidebarNav />
        <div className="user-summary">
          <span className="avatar"><HardDrive size={18} /></span>
          <div>
            <strong>Thư viện trên máy</strong>
            <small>Dữ liệu được lưu cục bộ</small>
          </div>
        </div>
      </aside>
      <div className="app-content-shell">
        <ProjectHeader />
        <main className="app-main">{children}</main>
        <ProjectFooter />
      </div>
    </div>
  );
}
