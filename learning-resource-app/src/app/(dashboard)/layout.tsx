import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpenText, LogOut } from "lucide-react";
import { auth, signOut } from "@/auth";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { ProjectFooter } from "@/components/layout/project-footer";
import { ProjectHeader } from "@/components/layout/project-header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="app-brand" href="/dashboard">
          <span><BookOpenText size={21} /></span>
          <strong>ScholarFlow</strong>
        </Link>
        <SidebarNav />
        <form
          className="mobile-logout"
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button aria-label="Đăng xuất" title="Đăng xuất" type="submit">
            <LogOut size={19} />
          </button>
        </form>
        <div className="user-summary">
          <span className="avatar">{session.user.name?.slice(0, 1).toUpperCase() ?? "U"}</span>
          <div>
            <strong>{session.user.name ?? "Người dùng"}</strong>
            <small>{session.user.email}</small>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="icon-button" title="Đăng xuất" type="submit">
              <LogOut size={18} />
            </button>
          </form>
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
