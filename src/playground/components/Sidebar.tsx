import { Link, useRouterState } from "@tanstack/react-router";
import { Moon, Sun, Boxes } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/themes/theme-provider";
import { NAV_GROUPS } from "../nav";

export function Sidebar() {
  const { theme, toggleTheme } = useTheme();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex size-9 items-center justify-center rounded-lg [background-image:var(--gradient-brand)] text-primary-foreground shadow-sm">
          <Boxes className="size-5" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="font-sans text-base font-bold tracking-tight">Forge</span>
          <span className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
            component lab
          </span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="px-3 pb-1.5 font-mono text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              {group.label}
            </p>
            <ul className="flex flex-col gap-0.5">
              {group.links.map((link) => {
                const active = pathname === link.to;
                const Icon = link.icon;
                return (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-4 shrink-0 transition-colors",
                          active ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <button
          type="button"
          onClick={toggleTheme}
          className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground"
        >
          <span className="flex items-center gap-2.5">
            {theme === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />}
            {theme === "dark" ? "Dark" : "Light"} theme
          </span>
          <span className="kbd">⌥T</span>
        </button>
      </div>
    </aside>
  );
}
