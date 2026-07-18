import React, { useCallback, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { Contract, JsonRpcProvider } from "ethers";
import { ArrowRight, Clock3, Gift, KeyRound, PartyPopper, RefreshCw, Sparkles, UsersRound } from "lucide-react";
import "./index.css";
import { FriendsHeader } from "./components/FriendsExoHeader";
import { FriendsBrand } from "./components/FriendsBrand";
import { Button } from "./components/Button";
import { config, PRIVATE_VAULT_ABI, PRIVATE_VAULT_FACTORY_ABI } from "./config";
import { useWallet } from "./useWallet";
import type { Language } from "./types";

type VaultStage = "invited" | "active" | "settlement" | "claimable" | "ended";
type MyVault = {
  address: string;
  claim: string;
  mode: number;
  outcome: number;
  stakeEnd: number;
  stage: VaultStage;
};

const STAGE_ORDER: Record<VaultStage, number> = { claimable: 0, settlement: 1, active: 2, invited: 3, ended: 4 };

function BrowsePrivateVault() {
  const wallet = useWallet();
  const [lang, setLang] = useState<Language>("en");
  const [myVaults, setMyVaults] = useState<MyVault[]>([]);
  const [loadingVaults, setLoadingVaults] = useState(false);
  const [vaultsError, setVaultsError] = useState("");
  const zh = lang === "zh";

  const loadMyVaults = useCallback(async () => {
    if (!wallet.address) {
      setMyVaults([]);
      setVaultsError("");
      return;
    }
    setLoadingVaults(true);
    setVaultsError("");
    try {
      const provider = new JsonRpcProvider(config.rpcUrl);
      const factory = new Contract(config.privateVaultFactoryAddress, PRIVATE_VAULT_FACTORY_ABI, provider);
      const allAddresses = await factory.getAllPrivateVaults() as string[];
      const now = Math.floor(Date.now() / 1000);
      const results = await Promise.all(allAddresses.map(async (vaultAddress): Promise<MyVault | null> => {
        try {
          const vault = new Contract(vaultAddress, PRIVATE_VAULT_ABI, provider);
          if (!await vault.allowedWallets(wallet.address)) return null;
          const [participated, finalized, claimed, stakeEndRaw, modeRaw, outcomeRaw, meta] = await Promise.all([
            vault.hasParticipated(wallet.address), vault.finalized(), vault.hasClaimed(wallet.address),
            vault.stakeEndTime(), vault.resolutionMode(), vault.resolvedOutcome(), factory.getPrivateVaultMeta(vaultAddress),
          ]);
          const stakeEnd = Number(stakeEndRaw);
          let stage: VaultStage;
          if (finalized && participated && !claimed) stage = "claimable";
          else if (finalized) stage = "ended";
          else if (now >= stakeEnd) stage = "settlement";
          else if (participated) stage = "active";
          else stage = "invited";
          return { address: vaultAddress, claim: String(meta[0]) || "Private Vault", mode: Number(modeRaw), outcome: Number(outcomeRaw), stakeEnd, stage };
        } catch { return null; }
      }));
      setMyVaults(results.filter((item): item is MyVault => item !== null).sort((a, b) => STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage] || b.stakeEnd - a.stakeEnd));
    } catch (reason) {
      setMyVaults([]);
      setVaultsError(reason instanceof Error ? reason.message : String(reason));
    } finally { setLoadingVaults(false); }
  }, [wallet.address]);

  useEffect(() => { void loadMyVaults(); }, [loadMyVaults]);

  return <div className="friends-page min-h-screen text-text">
    <FriendsHeader lang={lang} onToggleLang={() => setLang((v) => v === "zh" ? "en" : "zh")} current="browse" wallet={wallet} />
    <main className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="friends-orb friends-orb-one" /><div className="friends-orb friends-orb-two" />
      <section className="friends-hero relative overflow-hidden rounded-[2rem] p-7 sm:p-12">
        <div className="relative z-10 max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-fuchsia-300/30 bg-white/10 px-4 py-2 text-xs font-bold text-fuchsia-200 shadow-[0_0_18px_rgba(217,70,239,0.2)]"><PartyPopper className="h-4 w-4" />{zh ? "朋友局，都在这里" : "Every friends-only Vault in one place"}</div>
          <h1 className="font-display text-4xl font-bold leading-tight sm:text-6xl">{zh ? <>我的 <FriendsBrand gradient /> Vaults</> : <>My <FriendsBrand gradient /> Vaults</>}</h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-text-muted sm:text-base">{zh ? "连接钱包后，自动找到你受邀或参与过的所有私人金库。无需保存每一条邀请链接。" : "Connect your wallet to find every Private Vault you were invited to or joined—no need to save every invite link."}</p>
        </div>
        <Sparkles className="absolute right-8 top-8 h-12 w-12 text-fuchsia-400/60" />
      </section>

      <section className="friends-card relative z-10 mt-8 rounded-3xl border border-fuchsia-400/25 bg-[#120921]/95 p-6 shadow-[0_0_55px_rgba(139,92,246,0.22)] backdrop-blur sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3"><div className="rounded-2xl bg-gradient-to-br from-[#ff7628] via-[#ff3cac] to-[#8257f5] p-3 text-white"><UsersRound className="h-6 w-6" /></div><div><h2 className="font-display text-xl font-bold">{zh ? "我的金库" : "My Vaults"}</h2><p className="mt-1 text-xs text-text-muted">{zh ? "只显示当前钱包有权限进入的金库" : "Only Vaults available to the connected wallet"}</p></div></div>
          {wallet.connected && <Button onClick={() => void loadMyVaults()} disabled={loadingVaults} variant="outline" size="sm"><RefreshCw className={`h-3.5 w-3.5 ${loadingVaults ? "animate-spin" : ""}`} />{zh ? "刷新" : "Refresh"}</Button>}
        </div>

        {!wallet.connected ? <div className="mt-7 rounded-2xl border border-fuchsia-400/20 bg-white/5 p-7 text-center"><KeyRound className="mx-auto h-8 w-8 text-fuchsia-300" /><p className="mt-3 text-sm text-text-muted">{zh ? "连接钱包后自动加载你的金库。" : "Connect your wallet to load your Vaults."}</p><Button onClick={wallet.connectWallet} variant="primary" className="mt-5 !rounded-xl !bg-gradient-to-r !from-[#ff7628] !via-[#ff3cac] !to-[#8257f5]">{zh ? "连接钱包" : "Connect wallet"}</Button></div>
        : loadingVaults ? <div className="mt-8 text-center text-sm text-text-muted">{zh ? "正在链上查找你的金库…" : "Finding your Vaults onchain…"}</div>
        : vaultsError ? <div role="alert" className="mt-6 rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">{vaultsError}</div>
        : myVaults.length === 0 ? <div className="mt-7 rounded-2xl border border-dashed border-fuchsia-400/25 p-7 text-center"><p className="font-bold">{zh ? "还没有找到你的金库" : "No Vaults found yet"}</p><p className="mt-2 text-xs text-text-muted">{zh ? "让创建者把当前钱包加入邀请名单，受邀后会自动显示在这里。" : "Ask the creator to invite this wallet. Invited Vaults will appear here automatically."}</p></div>
        : <div className="mt-7 grid gap-6 md:grid-cols-2">{myVaults.map((vault) => <VaultCard key={vault.address} vault={vault} zh={zh} />)}</div>}
      </section>
    </main>
  </div>;
}

function VaultCard({ vault, zh }: { key?: React.Key; vault: MyVault; zh: boolean }) {
  const stageLabel: Record<VaultStage, string> = {
    invited: zh ? "受邀未参与" : "Invited",
    active: zh ? "进行中" : "Active",
    settlement: zh ? "待结算" : "Settlement",
    claimable: zh ? "可领取" : "Claimable",
    ended: zh ? "已结束" : "Ended",
  };
  const stageStyle: Record<VaultStage, string> = {
    invited: "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-200",
    active: "border-success/40 bg-success/10 text-success",
    settlement: "border-orange-400/40 bg-orange-400/10 text-orange-300",
    claimable: "border-success/50 bg-success/15 text-success shadow-[0_0_18px_rgba(57,245,138,0.12)]",
    ended: "border-white/10 bg-white/5 text-text-muted",
  };
  const outcome = ["—", "YES", "NO", "INVALID"][vault.outcome] ?? "—";
  return <a href={`/private-vault.html?vault=${vault.address}`} className="friends-card group rounded-2xl border border-fuchsia-400/20 bg-[#0d0618]/80 p-5 hover:border-fuchsia-400/50">
    <div className="flex items-start justify-between gap-3"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${stageStyle[vault.stage]}`}>{stageLabel[vault.stage]}</span><ArrowRight className="h-4 w-4 text-text-muted transition-transform group-hover:translate-x-1 group-hover:text-fuchsia-300" /></div>
    <h3 className="mt-4 line-clamp-2 font-display text-lg font-bold">{vault.claim}</h3>
    <div className="mt-4 flex flex-wrap gap-2 text-[10px] text-text-muted"><span className="rounded-md border border-border px-2 py-1">{vault.mode === 0 ? "OCP Core Rules" : "Creator Resolved"}</span>{vault.outcome > 0 && <span className="rounded-md border border-border px-2 py-1">{zh ? "结果" : "Result"}: {outcome}</span>}</div>
    <div className="mt-4 flex items-center gap-2 text-xs text-text-muted">{vault.stage === "claimable" ? <Gift className="h-4 w-4 text-success" /> : <Clock3 className="h-4 w-4" />}<span>{vault.stage === "ended" || vault.stage === "claimable" ? (zh ? "点击查看详情" : "Open details") : `${zh ? "参与截止" : "Stake ends"}: ${new Date(vault.stakeEnd * 1000).toLocaleString()}`}</span></div>
    <div className="mt-3 truncate font-mono text-[10px] text-text-muted">{vault.address}</div>
  </a>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><BrowsePrivateVault /></React.StrictMode>);
