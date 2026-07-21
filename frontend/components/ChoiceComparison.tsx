import React from "react";

export function ChoiceComparison({ yes, no, compact = false }: { yes: bigint; no: bigint; compact?: boolean }) {
  const total = yes + no;
  const yesPercent = total > 0n ? Number(yes * 1000n / total) / 10 : 0;
  const noPercent = total > 0n ? Math.round((100 - yesPercent) * 10) / 10 : 0;

  return <div aria-label={`YES ${yesPercent}%, NO ${noPercent}%`}>
    <div className={`flex items-center justify-between font-mono font-bold ${compact ? "mb-1.5 text-[9px]" : "mb-2 text-xs"}`}>
      <span className="text-success">YES · {yesPercent.toFixed(1)}%</span>
      <span className="text-danger">{noPercent.toFixed(1)}% · NO</span>
    </div>
    <div className={`relative overflow-hidden rounded-full border border-white/10 bg-white/5 shadow-inner ${compact ? "h-3" : "h-5"}`}>
      {total > 0n ? <div className="flex h-full w-full">
        <div className="h-full bg-gradient-to-r from-emerald-500 to-[#39f58a] transition-[width] duration-500" style={{ width: `${yesPercent}%` }} />
        <div className="h-full bg-gradient-to-r from-[#ff4fa3] to-fuchsia-600 transition-[width] duration-500" style={{ width: `${noPercent}%` }} />
      </div> : <div className="h-full w-full bg-white/5" />}
      <span className={`absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-[#120921] font-display font-bold text-white shadow-[0_0_14px_rgba(255,255,255,0.12)] ${compact ? "h-5 w-5 text-[7px]" : "h-7 w-7 text-[9px]"}`}>VS</span>
    </div>
  </div>;
}
