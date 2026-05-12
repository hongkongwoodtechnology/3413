import Link from 'next/link';

type OverviewShortcutItem = {
  label: string;
  href: string;
};

type OverviewShortcutsProps = {
  items: OverviewShortcutItem[];
};

export function OverviewShortcuts({ items }: OverviewShortcutsProps) {
  return (
    <div className="rounded-3xl border border-neutral-800 bg-neutral-900/70 p-5">
      <div className="mb-4 text-lg font-bold text-white">快捷入口</div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-2xl border border-neutral-800 bg-neutral-950/80 px-4 py-3 text-sm font-medium text-neutral-300 transition-colors hover:border-primary-purple/30 hover:bg-neutral-800 hover:text-white"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
