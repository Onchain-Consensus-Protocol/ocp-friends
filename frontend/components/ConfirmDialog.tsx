import React, { useEffect } from "react";
import { HelpCircle, X } from "lucide-react";
import type { Language } from "../types";

export function ConfirmDialog({ message, lang, onCancel, onConfirm }: { message: string; lang: Language; onCancel: () => void; onConfirm: () => void }) {
  const zh = lang === "zh";

  useEffect(() => {
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", cancelOnEscape);
    return () => window.removeEventListener("keydown", cancelOnEscape);
  }, [onCancel]);

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#05010b]/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
    <div className="relative w-full max-w-md rounded-2xl border border-fuchsia-400/60 bg-[#160820] p-6 text-left shadow-[0_0_55px_rgba(217,70,239,0.24)] sm:p-7">
      <button type="button" onClick={onCancel} className="absolute right-3 top-3 rounded-lg p-2 text-text-muted transition hover:bg-white/5 hover:text-text" aria-label={zh ? "取消操作" : "Cancel action"}>
        <X className="h-5 w-5" />
      </button>
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-300">
        <HelpCircle className="h-6 w-6" />
      </div>
      <h2 id="confirm-dialog-title" className="mt-4 pr-8 font-display text-xl font-bold text-text">{zh ? "请确认操作" : "Confirm action"}</h2>
      <p className="mt-3 break-words text-sm leading-6 text-text-muted">{message}</p>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <button type="button" onClick={onCancel} className="rounded-xl border border-border px-4 py-3 text-sm font-bold text-text-muted transition hover:border-fuchsia-300/50 hover:text-text">{zh ? "取消" : "Cancel"}</button>
        <button type="button" onClick={onConfirm} className="rounded-xl bg-gradient-to-r from-[#ff7628] via-[#ff3cac] to-[#8257f5] px-4 py-3 text-sm font-bold text-white shadow-[0_0_22px_rgba(255,60,172,0.2)]">{zh ? "确认" : "Confirm"}</button>
      </div>
    </div>
  </div>;
}
