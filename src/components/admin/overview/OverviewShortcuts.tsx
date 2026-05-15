type ShortcutItem = {
  title: string;
  description: string;
  icon: string;
  href: string;
};

type OverviewShortcutsProps = {
  shortcuts?: ShortcutItem[];
};

export function OverviewShortcuts({ shortcuts = defaultShortcuts }: OverviewShortcutsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {shortcuts.map((shortcut) => (
        <a
          key={shortcut.title}
          href={shortcut.href}
          className="group rounded-3xl border border-neutral-800 bg-neutral-900/70 p-5 transition-colors hover:border-neutral-700 hover:bg-neutral-900"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-neutral-800 group-hover:bg-neutral-700">
              <span className="text-lg">{shortcut.icon}</span>
            </div>
            <div>
              <div className="text-base font-bold text-white">{shortcut.title}</div>
              <p className="mt-1 text-sm text-neutral-400">{shortcut.description}</p>
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}

const defaultShortcuts: ShortcutItem[] = [
  {
    title: '市場管理',
    description: '查看和編輯體育市場',
    icon: '📊',
    href: '/admin/markets',
  },
  {
    title: '財務報表',
    description: '查看收入和支出報告',
    icon: '💰',
    href: '/admin/finance',
  },
  {
    title: '用戶管理',
    description: '管理用戶帳戶和權限',
    icon: '👥',
    href: '/admin/users',
  },
  {
    title: '分析儀表板',
    description: '查看平台數據分析',
    icon: '📈',
    href: '/admin/analytics',
  },
  {
    title: '安全日誌',
    description: '審計系統安全事件',
    icon: '🔒',
    href: '/admin/secure-audit-logs',
  },
  {
    title: '系統設置',
    description: '配置平台參數',
    icon: '⚙️',
    href: '/admin/settings',
  },
];