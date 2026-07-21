import React from "react";
import type { Language } from "../types";
import { WalletButton } from "./WalletButton";
import { FriendsBrand } from "./FriendsBrand";

type Current = "home" | "play" | "create" | "browse" | "vault";
type WalletProps = {
  connected: boolean;
  address: string;
  chainId: number | null;
  onTargetNetwork: boolean;
  targetChainId: number;
  connectWallet: () => void;
  disconnectWallet: () => void;
};

const LINKS = [
  { id: "play", href: "/friends-market-rules.html", zh: "玩法", en: "How to Play" },
  { id: "create", href: "/create-friends-market.html", zh: "创建", en: "Create" },
  { id: "browse", href: "/browse-friends-market.html", zh: "浏览", en: "Browse" },
] as const;

export function FriendsHeader({ lang, onToggleLang, current, wallet, onNavigate }: {
  lang: Language;
  onToggleLang?: () => void;
  current: Current;
  wallet?: WalletProps;
  onNavigate?: (href: string) => void;
}) {
  const navigate = (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!onNavigate || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate(href);
  };
  return <>
    <nav className="sticky top-0 z-50 border-b border-fuchsia-400/20 bg-[#090313]/90 shadow-[0_8px_30px_rgba(124,58,237,0.12)] backdrop-blur-xl">
      <div className="mx-auto grid min-h-16 w-full max-w-7xl grid-cols-[minmax(0,1fr)_2.25rem_auto] items-center gap-2 px-2 py-2 sm:px-6 md:flex md:gap-3 md:py-0 lg:px-8">
        <a href="/" onClick={(event) => navigate(event, "/")} className="group flex min-w-0 items-center gap-1.5 overflow-hidden sm:gap-3 md:shrink-0" aria-label="OCP Friends home">
          <img src="/logo.png" alt="OCP" className="h-7 w-7 shrink-0 rounded-md object-contain transition-transform group-hover:rotate-6 group-hover:scale-110 sm:h-8 sm:w-8" />
          <span className="truncate whitespace-nowrap font-display text-[13px] font-bold tracking-wide text-text sm:text-xl">OCP<span className="friends-gradient-text">/</span><FriendsBrand gradient /></span>
        </a>
        <div className="ml-auto hidden items-center gap-2 md:flex">{LINKS.map((link) => {
          const active = current === link.id || (current === "vault" && link.id === "browse");
          return <a key={link.id} href={link.href} onClick={(event) => navigate(event, link.href)} className={`rounded-lg px-3 py-2 text-center text-xs font-bold transition ${active ? "bg-gradient-to-r from-[#ff7628] via-[#ff3cac] to-[#8257f5] text-white shadow-[0_0_20px_rgba(255,118,40,0.28)]" : "text-text-muted hover:bg-fuchsia-400/10 hover:text-fuchsia-300"}`}>{lang === "zh" ? link.zh : link.en}</a>;
        })}</div>
        {onToggleLang && <button onClick={onToggleLang} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-transparent text-xs font-bold text-text-muted transition hover:border-border hover:text-accent" aria-label={lang === "zh" ? "切换到英文" : "Switch to Chinese"}>{lang === "zh" ? "EN" : "中"}</button>}
        {wallet && <div className="shrink-0"><WalletButton lang={lang} connected={wallet.connected} address={wallet.address} chainId={wallet.chainId} onTargetNetwork={wallet.onTargetNetwork} targetChainId={wallet.targetChainId} onConnect={wallet.connectWallet} onDisconnect={wallet.disconnectWallet} /></div>}
      </div>
    </nav>
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-fuchsia-400/25 bg-[#090313]/95 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-10px_35px_rgba(9,3,19,0.72)] backdrop-blur-xl md:hidden" aria-label={lang === "zh" ? "页面导航" : "Page navigation"}>
      <div className="mx-auto grid max-w-md grid-cols-3 gap-2">{LINKS.map((link) => {
        const active = current === link.id || (current === "vault" && link.id === "browse");
        return <a key={link.id} href={link.href} onClick={(event) => navigate(event, link.href)} aria-current={active ? "page" : undefined} className={`rounded-xl px-2 py-2.5 text-center text-xs font-bold transition ${active ? "bg-gradient-to-r from-[#ff7628] via-[#ff3cac] to-[#8257f5] text-white shadow-[0_0_20px_rgba(255,60,172,0.25)]" : "text-text-muted hover:bg-fuchsia-400/10 hover:text-fuchsia-200"}`}>{lang === "zh" ? link.zh : link.en}</a>;
      })}</div>
    </nav>
  </>;
}
