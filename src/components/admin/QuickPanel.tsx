"use client";

import { LocalizedLink as Link } from "@/components/LocalizedLink";
import { ArrowRight, ShieldCheck, TriangleAlert } from 'lucide-react';

type QuickPanelCard = {
  label: string;
  value: string;
  tone?: 'default' | 'warning' | 'success';
};

type QuickPanelProps = {
  cards: QuickPanelCard[];
};

const SHORTCUTS = [
  { href: '/admin/markets', label: '市場與賽事' },
  { href: '/admin/finance', label: '財務與派彩' },
  { href: '/admin/users', label: '用戶與推薦' },
  { href: '/admin/secure-audit-logs', label: '安全與系統' },
];

export function QuickPanel({ cards }: QuickPanelProps) {
  return (
    <section className="rounded-3xl border border-neutral-800 bg-neutral-900/70 p-6 backdrop-blur">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-primary-purple">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-[0.2em]">Admin Summary</span>
          </div>
          <h2 className="text-2xl font-black text-white">Admin Quick Panel</h2>
          <p className="mt-2 text-sm text-neutral-400">首頁只保留摘要與快捷入口，完整操作請進入後台。</p>
        </div>
        <Link
          href="/admin"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary-purple/30 bg-primary-purple/10 px-4 py-2 text-sm font-bold text-primary-purple transition-colors hover:bg-primary-purple hover:text-white"
        >
          進入完整後台
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className={`rounded-2xl border p-4 ${
              card.tone === 'warning'
                ? 'border-amber-500/30 bg-amber-500/10'
                : card.tone === 'success'
                  ? 'border-emerald-500/30 bg-emerald-500/10'
                  : 'border-neutral-800 bg-neutral-950/70'
            }`}
          >
            <div className="text-sm text-neutral-400">{card.label}</div>
            <div className="mt-2 text-2xl font-black text-white">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-950/70 p-4">
        <div className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
          <TriangleAlert className="h-4 w-4 text-amber-400" />
          快捷入口
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {SHORTCUTS.map((shortcut) => (
            <Link
              key={shortcut.href}
              href={shortcut.href}
              className="rounded-xl border border-neutral-800 bg-neutral-900/80 px-4 py-3 text-sm font-medium text-neutral-300 transition-colors hover:border-primary-purple/30 hover:bg-neutral-800 hover:text-white"
            >
              {shortcut.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
