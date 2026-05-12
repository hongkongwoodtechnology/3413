type OverviewKpiItem = {
  label: string;
  value: string;
  tone?: 'default' | 'warning' | 'success';
};

type OverviewKpiGridProps = {
  items: OverviewKpiItem[];
};

export function OverviewKpiGrid({ items }: OverviewKpiGridProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className={`rounded-3xl border p-5 ${
            item.tone === 'warning'
              ? 'border-amber-500/30 bg-amber-500/10'
              : item.tone === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/10'
                : 'border-neutral-800 bg-neutral-900/70'
          }`}
        >
          <div className="text-sm text-neutral-400">{item.label}</div>
          <div className="mt-3 text-3xl font-black text-white">{item.value}</div>
        </div>
      ))}
    </div>
  );
}
