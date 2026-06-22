"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  FolderKanban,
  LayoutDashboard,
  Search,
  Settings,
  Upload,
} from "lucide-react";

const navigation = [
  { href: "/dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/documents", label: "Tài liệu", icon: BookOpen },
  { href: "/upload", label: "Tải lên", icon: Upload },
  { href: "/search", label: "Tìm kiếm", icon: Search },
  { href: "/projects", label: "Projects", icon: FolderKanban },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="sidebar-nav" aria-label="Điều hướng chính">
      <div className="nav-group">
        <p>Workspace</p>
        {navigation.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/dashboard"
              ? pathname === item.href
              : pathname.startsWith(item.href);
          return (
            <Link
              aria-label={item.label}
              className={active ? "active" : ""}
              href={item.href}
              key={item.href}
              title={item.label}
            >
              <Icon size={19} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
      <div className="nav-group nav-bottom">
        <p>Hệ thống</p>
        <Link
          aria-label="Cài đặt"
          className={pathname.startsWith("/settings") ? "active" : ""}
          href="/settings"
          title="Cài đặt"
        >
          <Settings size={19} />
          <span>Cài đặt</span>
        </Link>
      </div>
    </nav>
  );
}
