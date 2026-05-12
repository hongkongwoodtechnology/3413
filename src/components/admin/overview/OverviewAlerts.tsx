type OverviewAlert = {
  title: string;
  description: string;
  tone?: 'default' | 'warning' | 'success';
};

type OverviewAlertsProps = {
  alerts: OverviewAlert[];
};

export function OverviewAlerts({ alerts }: OverviewAlertsProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {alerts.map((alert) => (
        <div
          key={alert.title}
          className={`rounded-3xl border p-5 ${
            alert.tone === 'warning'
              ? 'border-amber-500/30 bg-amber-500/10'
              : alert.tone === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/10'
                : 'border-neutral-800 bg-neutral-900/70'
          }`}
        >
          <div className="text-base font-bold text-white">{alert.title}</div>
          <p className="mt-2 text-sm leading-6 text-neutral-300">{alert.description}</p>
        </div>
      ))}
    </div>
  );
}
