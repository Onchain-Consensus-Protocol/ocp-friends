import React, { useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import type { Language } from "../types";

export function ErrorDialog({ message, lang, onClose }: { message: string; lang: Language; onClose: () => void }) {
  const zh = lang === "zh";

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  if (!message) return null;

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#05010b]/75 p-4 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-labelledby="error-dialog-title">
    <div className="relative w-full max-w-md rounded-2xl border border-danger/70 bg-[#160820] p-6 text-left shadow-[0_0_55px_rgba(255,79,163,0.25)] sm:p-7">
      <button type="button" onClick={onClose} className="absolute right-3 top-3 rounded-lg p-2 text-text-muted transition hover:bg-white/5 hover:text-text" aria-label={zh ? "关闭错误提示" : "Close error message"}>
        <X className="h-5 w-5" />
      </button>
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-danger/40 bg-danger/10 text-danger">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h2 id="error-dialog-title" className="mt-4 pr-8 font-display text-xl font-bold text-text">{zh ? "操作未完成" : "Action not completed"}</h2>
      <p className="mt-3 break-words text-sm leading-6 text-danger">{message}</p>
      <button type="button" onClick={onClose} className="mt-6 w-full rounded-xl border border-danger/50 bg-danger/10 px-4 py-3 text-sm font-bold text-danger transition hover:bg-danger/15">
        {zh ? "我知道了" : "Got it"}
      </button>
    </div>
  </div>;
}
