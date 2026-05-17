"use client";

type StaleMatchToastProps = {
  open: boolean;
  isRefreshing?: boolean;
  onRefresh: () => void;
  onClose: () => void;
};

export function StaleMatchToast({
  open,
  isRefreshing = false,
  onRefresh,
  onClose,
}: StaleMatchToastProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-x-4 bottom-4 z-[95] flex justify-center sm:inset-x-auto sm:right-4 sm:bottom-6">
      <div className="w-full max-w-sm rounded-2xl border border-white/12 bg-neutral-900/92 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <div className="mt-1 h-2.5 w-2.5 rounded-full bg-warning shadow-[0_0_16px_rgba(251,191,36,0.65)]" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">賽事已結束</p>
            <p className="mt-1 text-sm text-neutral-300">請刷新頁面後再試</p>
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="inline-flex h-9 items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRefreshing ? "刷新中..." : "立即刷新"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 items-center justify-center rounded-xl border border-white/12 px-3 text-sm text-neutral-300 transition hover:bg-white/5 hover:text-white"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StaleMatchToast;
