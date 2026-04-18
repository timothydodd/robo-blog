import { NavLink, Outlet } from "react-router-dom";
import { FileText, Files, Tag, Image, Settings, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { BuildPanel } from "./BuildPanel";

const nav = [
  { to: "/posts", label: "Posts", icon: FileText },
  { to: "/pages", label: "Pages", icon: Files },
  { to: "/tags", label: "Tags", icon: Tag },
  { to: "/images", label: "Images", icon: Image },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Layout() {
  return (
    <div className="h-full flex">
      <aside className="w-56 shrink-0 border-r border-zinc-200 bg-white flex flex-col">
        <div className="h-14 flex items-center px-4 border-b border-zinc-200">
          <Home size={16} className="text-[color:var(--color-brand)] mr-2" />
          <span className="font-semibold tracking-tight">robo-blog</span>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition",
                  isActive
                    ? "bg-[#891A43]/10 text-[color:var(--color-brand)]"
                    : "text-zinc-700 hover:bg-zinc-100"
                )
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
        <BuildPanel />
        <div className="p-3 text-xs text-zinc-400 border-t border-zinc-200">
          Local editor · not deployed
        </div>
      </aside>
      <main className="flex-1 min-w-0 overflow-auto scrollbar-thin">
        <Outlet />
      </main>
    </div>
  );
}
