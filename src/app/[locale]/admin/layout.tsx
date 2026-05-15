import React from 'react';
import { LocalizedLink as Link } from "@/components/LocalizedLink"
import { LayoutDashboard, LineChart, Shield, Users, Wallet, Hexagon } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/admin', label: '總覽', icon: LayoutDashboard },
  { href: '/admin/markets', label: '市場與賽事', icon: LineChart },
  { href: '/admin/finance', label: '財務與派彩', icon: Wallet },
  { href: '/admin/users', label: '用戶與推薦', icon: Users },
  { href: '/admin/secure-audit-logs', label: '安全與系統', icon: Shield },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-neutral-950 text-neutral-100 font-sans">
      <aside className="flex w-72 flex-col border-r border-neutral-800 bg-neutral-900/80 backdrop-blur">
        <div className="flex items-center gap-3 border-b border-neutral-800 p-6">
          <div className="rounded-xl bg-primary-purple/20 p-2 text-primary-purple">
            <Hexagon size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white">PolyBall Admin</h2>
            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-neutral-500">Back Office</p>
          </div>
        </div>
        <nav className="flex-1 space-y-2 overflow-y-auto p-4">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-3 rounded-xl border border-transparent px-4 py-3 text-sm font-medium text-neutral-400 transition-all duration-200 hover:border-neutral-800 hover:bg-neutral-800/80 hover:text-white"
            >
              <Icon size={18} className="transition-transform duration-200 group-hover:scale-110" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="border-t border-neutral-800 p-4">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-4">
            <div className="mb-1 text-xs uppercase tracking-[0.2em] text-neutral-500">Admin Role</div>
            <div className="text-sm font-bold text-white">Super Admin</div>
            <div className="mt-2 text-xs text-neutral-400">統一後台入口與模組導航</div>
          </div>
        </div>
      </aside>

      <main className="flex-1 bg-neutral-950">
        <div className="sticky top-0 z-20 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-4">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">Control Center</div>
              <h1 className="mt-1 text-xl font-semibold tracking-tight text-white">管理員控制台</h1>
            </div>
            <div className="rounded-full border border-primary-purple/30 bg-primary-purple/10 px-4 py-2 text-sm font-medium text-primary-purple">
              Role: Super Admin
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-[1440px] px-6 py-6">{children}</div>
      </main>
    </div>
  );
}
