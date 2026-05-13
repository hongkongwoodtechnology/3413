type ReferralToolsProps = {
  airdropAddress: string;
  airdropAmount: string;
  rateAddress: string;
  commissionRate: string;
  onAirdropAddressChange: (value: string) => void;
  onAirdropAmountChange: (value: string) => void;
  onRateAddressChange: (value: string) => void;
  onCommissionRateChange: (value: string) => void;
  onAirdrop: () => void;
  onUpdateRate: () => void;
  isAirdropping: boolean;
  isUpdatingRate: boolean;
};

export function ReferralTools({
  airdropAddress,
  airdropAmount,
  rateAddress,
  commissionRate,
  onAirdropAddressChange,
  onAirdropAmountChange,
  onRateAddressChange,
  onCommissionRateChange,
  onAirdrop,
  onUpdateRate,
  isAirdropping,
  isUpdatingRate,
}: ReferralToolsProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="rounded-3xl border border-neutral-800 bg-neutral-900/70 p-5">
        <div className="text-lg font-bold text-white">推薦工具</div>
        <p className="mt-2 text-sm text-neutral-400">發送體驗金給目標地址，支援營運活動或客服補償。</p>
        <div className="mt-4 space-y-3">
          <input
            value={airdropAddress}
            onChange={(event) => onAirdropAddressChange(event.target.value)}
            placeholder="目標錢包地址"
            className="w-full rounded-xl border border-neutral-800 bg-neutral-950/80 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-primary-purple/40"
          />
          <input
            value={airdropAmount}
            onChange={(event) => onAirdropAmountChange(event.target.value)}
            placeholder="體驗金金額"
            className="w-full rounded-xl border border-neutral-800 bg-neutral-950/80 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-primary-purple/40"
          />
          <button
            onClick={onAirdrop}
            disabled={isAirdropping}
            className="rounded-xl border border-primary-purple/30 bg-primary-purple/10 px-4 py-2 text-sm font-bold text-primary-purple transition-colors hover:bg-primary-purple hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            發送體驗金
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-neutral-800 bg-neutral-900/70 p-5">
        <div className="text-lg font-bold text-white">佣金比例設定</div>
        <p className="mt-2 text-sm text-neutral-400">直接調整推薦人分成比例，適合 KOL 等級管理。</p>
        <div className="mt-4 space-y-3">
          <input
            value={rateAddress}
            onChange={(event) => onRateAddressChange(event.target.value)}
            placeholder="推薦人錢包地址"
            className="w-full rounded-xl border border-neutral-800 bg-neutral-950/80 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-primary-purple/40"
          />
          <input
            value={commissionRate}
            onChange={(event) => onCommissionRateChange(event.target.value)}
            placeholder="分成比例，例如 50"
            className="w-full rounded-xl border border-neutral-800 bg-neutral-950/80 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-primary-purple/40"
          />
          <button
            onClick={onUpdateRate}
            disabled={isUpdatingRate}
            className="rounded-xl border border-primary-blue/30 bg-primary-blue/10 px-4 py-2 text-sm font-bold text-primary-blue transition-colors hover:bg-primary-blue hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            更新分成比例
          </button>
        </div>
      </div>
    </div>
  );
}
