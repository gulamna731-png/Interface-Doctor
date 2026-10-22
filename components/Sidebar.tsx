import { Logo } from "@/components/Logo";
import { AiStatusBadge } from "@/components/AiStatusBadge";
import type { AiStatusResponse } from "@/lib/types";

const NAV_ITEMS = [
  { label: "Dashboard", href: "#top", icon: "grid" },
  { label: "New diagnosis", href: "#upload", icon: "upload" },
  { label: "Recent projects", href: "#recent", icon: "clock" },
] as const;

function NavIcon({ icon }: { icon: string }) {
  const common = "h-4 w-4";
  switch (icon) {
    case "upload":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={common} aria-hidden="true">
          <path d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "clock":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={common} aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={common} aria-hidden="true">
          <rect x="4" y="4" width="7" height="7" rx="1" />
          <rect x="13" y="4" width="7" height="7" rx="1" />
          <rect x="4" y="13" width="7" height="7" rx="1" />
          <rect x="13" y="13" width="7" height="7" rx="1" />
        </svg>
      );
  }
}

export function Sidebar({ aiStatus }: { aiStatus: AiStatusResponse | null }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-ink-800 bg-ink-900 px-5 py-6 lg:flex">
      <Logo />

      <nav aria-label="Primary" className="mt-10">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item, i) => (
            <li key={item.label}>
              <a
                href={item.href}
                aria-current={i === 0 ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  i === 0
                    ? "bg-ink-800 text-white"
                    : "text-ink-400 hover:bg-ink-800/60 hover:text-ink-100"
                }`}
              >
                <NavIcon icon={item.icon} />
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-auto space-y-4">
        <div className="rounded-xl border border-ink-800 bg-ink-800/50 p-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-ink-500">
            System status
          </p>
          <AiStatusBadge status={aiStatus} />
        </div>
        <p className="text-[11px] leading-relaxed text-ink-500">
          Interface Doctor AI · Team DebugMD
          <br />
          Hackathon build · Phases 1–7
        </p>
      </div>
    </aside>
  );
}
