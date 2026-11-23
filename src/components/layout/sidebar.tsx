"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { isNavItemActive, NAV_ITEMS } from "@/lib/navigation";
import { Logo } from "@/components/brand/logo";
import { MenuIcon, NavIcon } from "@/components/layout/icons";

const SIDEBAR_COOKIE = "v11_sidebar";
const MOBILE_NAV = "(max-width: 56.25rem)";

export function Sidebar({ initialCollapsed = false, initialRole = "" }: { initialCollapsed?: boolean; initialRole?: string }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  function setMenuOpen(open: boolean) {
    setMobileOpen(open);
    document.body.classList.toggle("nav-open", open);
  }

  function toggle() {
    if (window.matchMedia(MOBILE_NAV).matches) {
      setMenuOpen(!mobileOpen);
      return;
    }

    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
  }

  function closeMobile() {
    if (mobileOpen) setMenuOpen(false);
  }

  return (
    <>
      <button
        type="button"
        className="mobile-menu"
        onClick={() => setMenuOpen(true)}
        aria-label="Open menu"
        aria-expanded={mobileOpen}
      >
        <MenuIcon width={22} height={22} />
      </button>
      {mobileOpen ? (
        <button type="button" className="sidebar-backdrop" aria-label="Close menu" onClick={closeMobile} />
      ) : null}
    <aside className={cn("sidebar", collapsed && "is-collapsed", mobileOpen && "is-open")}>
      <div className="sidebar-header">
        <button
          type="button"
          className="sidebar-toggle"
          onClick={toggle}
          aria-label={mobileOpen ? "Close menu" : collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={mobileOpen || !collapsed}
        >
          <MenuIcon width={22} height={22} />
        </button>
        <Logo />
      </div>
      <nav aria-label="Workspace">
        <ul className="nav-list">
          {NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(initialRole)).map((item) => {
            const active = isNavItemActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn("nav-link", active && "is-active")}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                  onClick={closeMobile}
                >
                  <span className="nav-icon">
                    <NavIcon name={item.icon} />
                  </span>
                  <span className="nav-label">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
    </>
  );
}
