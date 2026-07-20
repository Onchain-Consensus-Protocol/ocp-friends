import React from "react";
import type { Language } from "../types";
import { WalletButton } from "./WalletButton";
import { FriendsBrand } from "./FriendsBrand";

type Current = "play" | "create" | "browse" | "vault";
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
  { id: "play", href: "/private-vault-rules.html", zh: "玩法", en: "How to Play" },
  { id: "create", href: "/create-private-vault.html", zh: "创建", en: "Create" },
  { id: "browse", href: "/browse-private-vault.html", zh: "浏览", en: "Browse" },
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
  return <nav className="sticky top-0 z-50 border-b border-fuchsia-400/20 bg-[#090313]/85 shadow-[0_8px_30px_rgba(124,58,237,0.12)] backdrop-blur-xl">
    <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 sm:px-6 md:flex-nowrap md:py-0 lg:px-8">
      <a href="/private-vault-rules.html" onClick={(event) => navigate(event, "/private-vault-rules.html")} className="group flex shrink-0 items-center gap-2 sm:gap-3" aria-label="OCP Friends">
        <img src="/logo.png" alt="OCP" className="h-8 w-8 rounded-md object-contain transition-transform group-hover:rotate-6 group-hover:scale-110" />
        <span className="font-display text-base font-bold tracking-wide text-text sm:text-xl">OCP<span className="friends-gradient-text">/</span><FriendsBrand gradient /></span>
      </a>
      {onToggleLang && <button onClick={onToggleLang} className="order-2 ml-auto flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-xs font-bold text-text-muted transition hover:border-border hover:text-accent md:order-none md:ml-0" aria-label={lang === "zh" ? "切换到英文" : "Switch to Chinese"}>{lang === "zh" ? "EN" : "中"}</button>}
      <div className="order-3 flex w-full min-w-0 items-center gap-2 md:order-none md:ml-auto md:w-auto">
        <div className="grid min-w-0 flex-1 grid-cols-3 gap-1 md:flex md:flex-none md:items-center md:gap-2">{LINKS.map((link) => {
          const active = current === link.id || (current === "vault" && link.id === "browse");
          return <a key={link.id} href={link.href} onClick={(event) => navigate(event, link.href)} className={`truncate rounded-lg px-2 py-2 text-center text-xs font-bold transition sm:px-3 ${active ? "bg-gradient-to-r from-[#ff7628] via-[#ff3cac] to-[#8257f5] text-white shadow-[0_0_20px_rgba(255,118,40,0.28)]" : "text-text-muted hover:bg-fuchsia-400/10 hover:text-fuchsia-300"}`}>{lang === "zh" ? link.zh : link.en}</a>;
        })}</div>
        {wallet && <div className="shrink-0"><WalletButton lang={lang} connected={wallet.connected} address={wallet.address} chainId={wallet.chainId} onTargetNetwork={wallet.onTargetNetwork} targetChainId={wallet.targetChainId} onConnect={wallet.connectWallet} onDisconnect={wallet.disconnectWallet} /></div>}
      </div>
    </div>
  </nav>;
}
