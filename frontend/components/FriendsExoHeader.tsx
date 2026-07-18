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

export function FriendsHeader({ lang, onToggleLang, current, wallet }: {
  lang: Language;
  onToggleLang?: () => void;
  current: Current;
  wallet?: WalletProps;
}) {
  return <nav className="sticky top-0 z-50 border-b border-fuchsia-400/20 bg-[#090313]/85 shadow-[0_8px_30px_rgba(124,58,237,0.12)] backdrop-blur-xl">
    <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
      <a href="/private-vault-rules.html" className="group flex shrink-0 items-center gap-3" aria-label="OCP Friends">
        <img src="/logo.png" alt="OCP" className="h-8 w-8 rounded-md object-contain transition-transform group-hover:rotate-6 group-hover:scale-110" />
        <span className="font-display text-lg font-bold tracking-wide text-text sm:text-xl">OCP<span className="friends-gradient-text">/</span><FriendsBrand gradient /></span>
      </a>
      <div className="flex items-center gap-1 sm:gap-2">
        {LINKS.map((link) => {
          const active = current === link.id || (current === "vault" && link.id === "browse");
          return <a key={link.id} href={link.href} className={`rounded-lg px-2.5 py-2 text-xs font-bold transition sm:px-3 ${active ? "bg-gradient-to-r from-[#ff7628] via-[#ff3cac] to-[#8257f5] text-white shadow-[0_0_20px_rgba(255,118,40,0.28)]" : "text-text-muted hover:bg-fuchsia-400/10 hover:text-fuchsia-300"}`}>{lang === "zh" ? link.zh : link.en}</a>;
        })}
        {onToggleLang && <button onClick={onToggleLang} className="flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-xs font-bold text-text-muted transition hover:border-border hover:text-accent" aria-label={lang === "zh" ? "Switch to English" : "切换到中文"}>{lang === "zh" ? "EN" : "中"}</button>}
        {wallet && <div className="hidden md:block"><WalletButton lang={lang} connected={wallet.connected} address={wallet.address} chainId={wallet.chainId} onTargetNetwork={wallet.onTargetNetwork} targetChainId={wallet.targetChainId} onConnect={wallet.connectWallet} onDisconnect={wallet.disconnectWallet} /></div>}
      </div>
    </div>
  </nav>;
}
