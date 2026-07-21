import React, { useCallback, useEffect, useState } from "react";
import { Contract, JsonRpcProvider, formatUnits, isAddress, parseUnits, type ContractRunner } from "ethers";
import { AlertTriangle, Copy, KeyRound, PartyPopper, ShieldCheck, Sparkles } from "lucide-react";
import { FriendsBrand } from "./components/FriendsBrand";
import { Button } from "./components/Button";
import { config, ERC20_ABI, PRIVATE_VAULT_ABI, PRIVATE_VAULT_FACTORY_ABI } from "./config";
import type { Language } from "./types";
import type { WalletController } from "./useWallet";
import { friendlyError } from "./friendly-error";
import { ErrorDialog } from "./components/ErrorDialog";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { ChoiceComparison } from "./components/ChoiceComparison";
import { decodeOutcomeMeanings } from "./outcome-metadata";

type State = {
  creator: string; mode: number; stakeEnd: number; resolutionDeadline: number; minStake: bigint;
  token: string; symbol: string; decimals: number; finalized: boolean; outcome: number;
  allowed: boolean; participated: boolean; claimed: boolean; total: bigint; yes: bigint; no: bigint; invalid: bigint;
  userYes: bigint; userNo: bigint; userInvalid: bigint; claim: string; description: string;
};
const outcomeName = (value: number) => ["UNRESOLVED", "YES", "NO", "INVALID"][value] ?? "UNKNOWN";
const formatDate = (value: number, zh: boolean) => value ? new Date(value * 1000).toLocaleString(zh ? "zh-CN" : "en-US") : (zh ? "不适用" : "Not applicable");

export function PrivateVaultPage({ lang, wallet, onNavigate }: { lang: Language; wallet: WalletController; onNavigate: (href: string) => void }) {
  const vaultAddress = new URLSearchParams(window.location.search).get("vault")?.trim() ?? "";
  const validVault = isAddress(vaultAddress);
  const [state, setState] = useState<State | null>(null);
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const [amount, setAmount] = useState("");
  const [resolveOutcome, setResolveOutcome] = useState(1);
  const [manageWallets, setManageWallets] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<{ message: string; action: () => void } | null>(null);
  const [access, setAccess] = useState<"connect" | "checking" | "denied" | "allowed" | "error">("checking");
  const zh = lang === "zh";

  useEffect(() => { const timer = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000); return () => clearInterval(timer); }, []);

  const fetchMarketState = useCallback(async (provider: ContractRunner, user: string): Promise<State> => {
    const vault = new Contract(vaultAddress, PRIVATE_VAULT_ABI, provider);
    const [creator, mode, stakeEnd, deadline, minStake, tokenAddress, finalized, outcome, participated, claimed, total, yes, no, invalid, stake, factoryAddress] = await Promise.all([
      vault.creator(), vault.resolutionMode(), vault.stakeEndTime(), vault.resolutionDeadline(), vault.minStake(), vault.stakeToken(), vault.finalized(), vault.resolvedOutcome(), vault.hasParticipated(user), vault.hasClaimed(user), vault.totalPrincipal(), vault.totalStakeYes(), vault.totalStakeNo(), vault.totalStakeInvalid(), vault.stakeOf(user), vault.factory(),
    ]);
    const token = new Contract(tokenAddress, ERC20_ABI, provider);
    const factory = new Contract(factoryAddress, PRIVATE_VAULT_FACTORY_ABI, provider);
    const [decimals, symbol, meta] = await Promise.all([token.decimals(), token.symbol(), factory.getPrivateVaultMeta(vaultAddress)]);
    return { creator, mode: Number(mode), stakeEnd: Number(stakeEnd), resolutionDeadline: Number(deadline), minStake, token: tokenAddress, symbol, decimals: Number(decimals), finalized, outcome: Number(outcome), allowed: true, participated, claimed, total, yes, no, invalid, userYes: stake[0], userNo: stake[1], userInvalid: stake[2], claim: meta[0], description: meta[1] };
  }, [vaultAddress]);

  const load = useCallback(async () => {
    if (!validVault) { setState(null); setAccess("error"); return setError(zh ? "邀请链接中的 Market 地址无效。" : "The Market address in this invite link is invalid."); }
    if (!wallet.address) { setState(null); setError(""); setAccess("connect"); return; }
    setAccess("checking");
    try {
      // 已连接时复用钱包节点，避免公共 RPC 限流导致交易成功后详情页打不开。
      const provider = wallet.signer?.provider ?? new JsonRpcProvider(config.rpcUrl);
      const vault = new Contract(vaultAddress, PRIVATE_VAULT_ABI, provider);
      const configuredFactory = new Contract(config.privateVaultFactoryAddress, PRIVATE_VAULT_FACTORY_ABI, provider);
      if (!await configuredFactory.isPrivateVault(vaultAddress)) { setState(null); setError(""); setAccess("denied"); return; }
      if (!await vault.allowedWallets(wallet.address)) { setState(null); setError(""); setAccess("denied"); return; }
      setState(await fetchMarketState(provider, wallet.address));
      setAccess("allowed");
      setError("");
    } catch (reason) { setState(null); setAccess("error"); setError(friendlyError(reason, zh)); }
  }, [validVault, vaultAddress, wallet.address, wallet.signer, zh, fetchMarketState]);
  useEffect(() => { load(); }, [load]);

  const refreshMarketState = useCallback(async () => {
    if (!wallet.address) return;
    try {
      const provider = wallet.signer?.provider ?? new JsonRpcProvider(config.rpcUrl);
      setState(await fetchMarketState(provider, wallet.address));
      setError("");
    } catch (reason) {
      // 交易已经上链时，刷新失败也保留当前页面，只弹出错误供用户重试。
      setError(friendlyError(reason, zh));
    }
  }, [wallet.address, wallet.signer, fetchMarketState, zh]);

  const transact = async (action: (vault: Contract) => Promise<unknown>) => {
    if (!wallet.signer) return wallet.connectWallet();
    setBusy(true); setError("");
    try { const vault = new Contract(vaultAddress, PRIVATE_VAULT_ABI, wallet.signer); const tx = await action(vault) as { wait: () => Promise<unknown> }; await tx.wait(); await refreshMarketState(); }
    catch (reason) { setError(friendlyError(reason, zh)); }
    finally { setBusy(false); }
  };

  const submitCreatorResolution = () => {
    if (!state) return;
    const selectedPool = resolveOutcome === 1 ? state.yes : resolveOutcome === 2 ? state.no : state.total;
    const emptyWinningSide = (resolveOutcome === 1 || resolveOutcome === 2) && selectedPool === 0n;
    if (emptyWinningSide) return setError(zh
      ? `${outcomeName(resolveOutcome)} 当前无人持仓，不能选择该结果。请选择有持仓的一方或 INVALID。`
      : `${outcomeName(resolveOutcome)} has no holders. Choose a side with holders or INVALID.`);
    const message = zh ? "该结果不可更改。确认提交吗？" : "This result is final and cannot be changed. Confirm?";
    setConfirmation({ message, action: () => void transact((vault) => vault.resolveByCreator(resolveOutcome)) });
  };

  const executeStake = async (side: number) => {
    if (!state || !wallet.signer) return wallet.connectWallet();
    setBusy(true); setError("");
    try {
      const value = parseUnits(amount || "0", state.decimals);
      if (value <= 0n) throw new Error("Amount below min stake");
      const token = new Contract(state.token, ERC20_ABI, wallet.signer);
      await (await token.approve(vaultAddress, value)).wait();
      const vault = new Contract(vaultAddress, PRIVATE_VAULT_ABI, wallet.signer);
      await (await vault.stake(side, value)).wait(); setAmount(""); await refreshMarketState();
    } catch (reason) { setError(friendlyError(reason, zh)); }
    finally { setBusy(false); }
  };

  const stake = (side: number) => {
    if (!state) return;
    if (state.mode === 1) {
      setConfirmation({
        message: zh ? "创建者可能持有这个 Market 的仓位，并将决定最终结果。是否继续？" : "The creator may have a financial position in this Market and will determine the final outcome. Continue?",
        action: () => void executeStake(side),
      });
      return;
    }
    void executeStake(side);
  };

  const staking = state && !state.finalized && now < state.stakeEnd;
  const creator = Boolean(state && wallet.address && wallet.address.toLowerCase() === state.creator.toLowerCase());
  const canCreatorResolve = Boolean(state && state.mode === 1 && creator && !state.finalized && now >= state.stakeEnd && now <= state.resolutionDeadline);
  const expired = Boolean(state && state.mode === 1 && !state.finalized && now > state.resolutionDeadline);
  const canCoreResolve = Boolean(state && state.mode === 0 && !state.finalized && now >= state.stakeEnd);
  const selectedPoolIsEmpty = Boolean(state && (resolveOutcome === 1 || resolveOutcome === 2) && (resolveOutcome === 1 ? state.yes : state.no) === 0n);
  const claimEligible = Boolean(state && state.participated && (state.outcome === 3 || (state.outcome === 1 && state.userYes > 0n) || (state.outcome === 2 && state.userNo > 0n)));
  const fmt = (value: bigint) => state ? `${formatUnits(value, state.decimals)} ${state.symbol}` : "—";
  const addresses = manageWallets.split(/[\s,;]+/).map((v) => v.trim()).filter(Boolean);

  return <main className="relative max-w-6xl mx-auto px-4 py-8 sm:px-6">
      <div className="friends-orb friends-orb-one" /><div className="friends-orb friends-orb-two" />
      <div className="friends-hero relative mb-6 overflow-hidden rounded-[2rem] p-6 sm:p-8"><Sparkles className="absolute right-7 top-7 h-9 w-9 text-fuchsia-400/80" /><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-fuchsia-300/30 bg-white/10 px-3 py-1.5 text-xs font-bold text-fuchsia-200"><PartyPopper className="h-4 w-4" />OCP/<FriendsBrand /></div><div className="font-display text-2xl font-bold">{zh ? "你的私人派对" : "Your private party"}</div><p className="mt-2 text-sm text-text-muted">{zh ? "只有收到邀请的钱包才能进入和参与。" : "Only invited wallets can enter and participate."}</p></div>
      {error && <ErrorDialog message={error} lang={lang} onClose={() => setError("")} />}
      {confirmation && <ConfirmDialog message={confirmation.message} lang={lang} onCancel={() => setConfirmation(null)} onConfirm={() => { const action = confirmation.action; setConfirmation(null); action(); }} />}
      {access !== "allowed" && <AccessGate access={access} error={error} zh={zh} onConnect={wallet.connectWallet} onNavigate={onNavigate} />}
      {access === "allowed" && <>
      {state?.mode === 1 && <div className="p-5 border-2 border-[#ff5a6f]/60 rounded-2xl bg-[#ff5a6f]/10 text-pink-100 mb-6"><div className="font-bold flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-[#ff7183]" />{zh ? "由 Market 创建者结算" : "Resolved by the Market creator"}</div><p className="mt-2 text-sm">{zh ? "创建者可以参与这个 Market，并且只有创建者能提交最终结果。" : "The creator may participate in this Market and has sole authority to submit the final result."}</p><p className="mt-1 font-bold">{zh ? "请只参加你信任的创建者发起的 Market。" : "Only participate if you trust the creator."}</p></div>}
      {!state ? (!error && <Message text={zh ? "正在加载私人 Market…" : "Loading private Market…"} />) : <>
        <section className="border border-border rounded-2xl p-6 mb-6"><div className="flex flex-col sm:flex-row sm:justify-between gap-4"><div><h1 className="text-2xl font-display font-bold">{state.claim || (zh ? "私人 Market" : "Private Market")}</h1><OutcomeDescription value={state.description} zh={zh} /></div><span className="self-start px-3 py-1 rounded-full border border-border text-xs font-bold">{state.finalized ? `${zh ? "已结算" : "FINAL"} · ${outcomeName(state.outcome)}` : staking ? (zh ? "参与中" : "STAKING") : (zh ? "待结算" : "RESOLUTION")}</span></div>
          <dl className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-6 text-xs font-mono"><Info label={zh ? "创建者" : "Created by"} value={short(state.creator)} /><Info label={zh ? "结算代币" : "Settlement token"} value={`${state.symbol} · ${short(state.token)}`} /><Info label={zh ? "结算方式" : "Resolution method"} value={state.mode === 0 ? (zh ? "资金多数" : "AUTOMATIC_MAJORITY") : (zh ? "创建者结算" : "Creator Resolved")} /><Info label={zh ? "参与截止" : "Stake deadline"} value={formatDate(state.stakeEnd, zh)} /><Info label={zh ? "结算截止" : "Resolution deadline"} value={formatDate(state.resolutionDeadline, zh)} /></dl>
          <div className="mt-5 flex flex-wrap items-center gap-4"><button onClick={() => navigator.clipboard.writeText(window.location.href)} className="text-xs text-accent inline-flex items-center gap-1"><Copy className="w-3 h-3" />{zh ? "复制邀请链接" : "Copy invite link"}</button><a href={`/friends-market-rules.html?mode=${state.mode}&lang=${lang}`} onClick={(event) => { event.preventDefault(); onNavigate(`/friends-market-rules.html?mode=${state.mode}&lang=${lang}`); }} className="text-xs font-bold text-accent hover:underline">{zh ? "查看结算方式 →" : "View settlement method →"}</a></div>
        </section>
        <ResolutionMethod mode={state.mode} stakeEnd={state.stakeEnd} resolutionDeadline={state.resolutionDeadline} zh={zh} />
        <div className="grid lg:grid-cols-3 gap-6">
          <section className="friends-card lg:col-span-2 border border-fuchsia-400/20 bg-[#120921]/90 rounded-2xl p-6"><h2 className="font-display font-bold mb-2">{zh ? "大家目前的选择" : "Current choices"}</h2><p className="mb-5 text-xs text-text-muted">{zh ? "玩家只能选择 YES 或 NO；INVALID 是退款结算状态。" : "Players can choose only YES or NO; INVALID is a refund outcome."}</p><ChoiceComparison yes={state.yes} no={state.no} /><div className="mt-5 grid sm:grid-cols-2 gap-3"><Pool side="YES" amount={fmt(state.yes)} color="text-success" /><Pool side="NO" amount={fmt(state.no)} color="text-danger" /></div><div className="mt-4 text-sm font-mono">{zh ? "总参与金额：" : "Total joined: "}<strong>{fmt(state.total)}</strong></div></section>
          <section className="border border-border rounded-2xl p-6"><h2 className="font-display font-bold mb-4">{zh ? "你的权限" : "Your Access"}</h2>{!wallet.connected ? <Button onClick={wallet.connectWallet} variant="outline">{zh ? "连接钱包" : "Connect wallet"}</Button> : state.allowed ? <div className="text-success flex gap-2 items-center"><ShieldCheck className="w-5 h-5" /><strong>{zh ? "你已受邀。" : "You are invited."}</strong></div> : <div className="text-danger text-sm"><strong>{zh ? "这是私人 Market。" : "This is a private Market."}</strong><p className="mt-2">{zh ? "当前钱包不在参与名单中。" : "Your wallet is not on the participant list."}</p></div>}<div className="mt-5 text-xs font-mono text-text-muted">{zh ? "你的仓位：" : "Your position: "}YES {fmt(state.userYes)} · NO {fmt(state.userNo)}</div></section>
        </div>
        <section className="border border-border rounded-2xl p-6 mt-6"><h2 className="font-display font-bold text-xl">{zh ? "Market 操作" : "Market Actions"}</h2>
          {state.mode === 1 && staking && <div className="my-4 p-3 border border-[#ff5a6f]/60 bg-[#ff5a6f]/10 rounded-xl text-sm font-bold text-pink-100">{zh ? "创建者可能持有这个 Market 的仓位，并将决定最终结果。" : "The creator may have a financial position in this Market and will determine the final outcome."}</div>}
          {staking && <div className="mt-5"><label className="text-xs font-bold uppercase">{zh ? `参与金额（最低 ${fmt(state.minStake)}）` : `Stake amount (minimum ${fmt(state.minStake)})`}</label><input className="input mt-2" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} /><div className="grid sm:grid-cols-2 gap-3 mt-3"><Button disabled={busy || !state.allowed} onClick={() => stake(0)} variant="success">{zh ? "选择 YES" : "Stake YES"}</Button><Button disabled={busy || !state.allowed} onClick={() => stake(1)} variant="danger">{zh ? "选择 NO" : "Stake NO"}</Button></div></div>}
          {canCoreResolve && <Button disabled={busy} onClick={() => transact((vault) => vault.finalizeByCoreRules())} variant="primary" className="mt-5">{zh ? "按资金多数规则结算" : "Finalize by automatic majority"}</Button>}
          {canCreatorResolve && <div className="mt-5 p-5 border-2 border-amber-500 rounded-xl"><h3 className="font-bold">{zh ? "提交最终结果" : "Submit Final Result"}</h3><select className="input mt-3" value={resolveOutcome} onChange={(e) => setResolveOutcome(Number(e.target.value))}><option value={1}>YES</option><option value={2}>NO</option><option value={3}>INVALID</option></select>{selectedPoolIsEmpty ? <p className="text-sm font-bold text-danger mt-3">{zh ? "该选项当前无人持仓，合约不允许选择。请选择有持仓的一方或 INVALID。" : "This side has no holders and cannot be selected. Choose a side with holders or INVALID."}</p> : <p className="text-sm font-bold text-danger mt-3">{zh ? "该结果不可更改。INVALID 会向所有玩家退还本金。" : "This result is final. INVALID refunds every player's principal."}</p>}<Button disabled={busy || selectedPoolIsEmpty} onClick={submitCreatorResolution} variant="primary" className="mt-3">{zh ? "确认结果" : "Confirm Result"}</Button></div>}
          {expired && <div className="mt-5 p-5 border border-amber-500 rounded-xl"><p>{zh ? "创建者未在截止时间前提交结果。现在可以将这个 Market 结算为 INVALID。" : "The creator did not submit a result before the deadline. This Market can now be finalized as INVALID."}</p><Button disabled={busy} onClick={() => transact((vault) => vault.finalizeExpiredResolution())} variant="secondary" className="mt-3">{zh ? "结算为 INVALID" : "Finalize as INVALID"}</Button></div>}
          {state.finalized && <div className="mt-5"><p className="font-bold">{zh ? "最终结果：" : "Final result: "}{outcomeName(state.outcome)}</p>{state.mode === 1 && <p className="text-sm text-text-muted mt-1">{zh ? "结果由创建者提交，或在超时后结算为 INVALID。" : "Final result submitted by the creator or finalized INVALID after timeout."}</p>}{claimEligible ? <Button disabled={busy || state.claimed} onClick={() => transact((vault) => vault.withdraw())} variant="primary" className="mt-4">{state.claimed ? (zh ? "已领取" : "Payout claimed") : (zh ? "领取资金" : "Claim payout")}</Button> : <p className="mt-4 text-sm font-bold text-text-muted">{state.participated ? (zh ? "你的仓位不是获胜方，没有可领取金额。" : "Your position did not win. There is no payout to claim.") : (zh ? "你没有参与这个 Market。" : "You did not participate in this Market.")}</p>}</div>}
        </section>
        {creator && staking && <section className="border border-border rounded-2xl p-6 mt-6"><h2 className="font-display font-bold">{zh ? "管理邀请钱包" : "Manage Allowed Wallets"}</h2><textarea className="input min-h-24 mt-3 font-mono" value={manageWallets} onChange={(e) => setManageWallets(e.target.value)} placeholder={zh ? "粘贴钱包地址" : "Paste wallet addresses"} /><div className="flex gap-3 mt-3"><Button disabled={busy || !addresses.length || addresses.some((v) => !isAddress(v))} onClick={() => transact((vault) => vault.addAllowedWallets(addresses)).then(() => setManageWallets(""))} variant="outline">{zh ? "添加钱包" : "Add wallets"}</Button><Button disabled={busy || addresses.length !== 1 || !isAddress(addresses[0] ?? "")} onClick={() => transact((vault) => vault.removeAllowedWallet(addresses[0])).then(() => setManageWallets(""))} variant="danger">{zh ? "移除钱包" : "Remove wallet"}</Button></div><p className="text-xs text-text-muted mt-3">{zh ? "钱包只能在参与截止前且尚未参与时移除。创建者不能被移除。" : "A wallet can be removed only before the deadline and before it participates. The creator can never be removed."}</p></section>}
      </>}
      </>}
  </main>;
}

function AccessGate({ access, error, zh, onConnect, onNavigate }: { access: "connect" | "checking" | "denied" | "allowed" | "error"; error: string; zh: boolean; onConnect: () => void; onNavigate: (href: string) => void }) {
  return <section className="mx-auto max-w-xl rounded-3xl border border-fuchsia-400/25 bg-[#120921]/95 p-8 text-center shadow-[0_0_55px_rgba(139,92,246,0.22)] backdrop-blur">
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff7628] via-[#ff3cac] to-[#8257f5] text-white shadow-[0_0_22px_rgba(255,118,40,0.22)]"><KeyRound className="h-7 w-7" /></div>
    <h1 className="mt-5 font-display text-2xl font-bold">{access === "connect" ? (zh ? "连接钱包验证邀请" : "Connect wallet to verify invite") : access === "checking" ? (zh ? "正在检查邀请名单…" : "Checking the invite list…") : access === "denied" ? (zh ? "这张邀请函不属于当前钱包" : "This invite is not for this wallet") : (zh ? "无法打开这个市场" : "Unable to open this Market")}</h1>
    <p className="mt-3 text-sm leading-6 text-text-muted">{access === "denied" ? (zh ? "当前钱包不在合约白名单中，因此不能查看市场详情。" : "The connected wallet is not on the contract allowlist, so Market details stay hidden.") : access === "connect" ? (zh ? <><FriendsBrand /> Market 只向白名单钱包开放。</> : <><FriendsBrand /> Markets are visible only to allowlisted wallets.</>) : error}</p>
    {access === "connect" && <Button onClick={onConnect} variant="primary" className="mt-6 !rounded-xl !bg-gradient-to-r !from-[#ff7628] !via-[#ff3cac] !to-[#8257f5] shadow-[0_0_22px_rgba(255,118,40,0.22)]">{zh ? "连接钱包" : "Connect wallet"}</Button>}
    {access === "denied" && <a href="/browse-friends-market.html" onClick={(event) => { event.preventDefault(); onNavigate("/browse-friends-market.html"); }} className="mt-6 inline-block text-sm font-bold text-fuchsia-700 hover:underline">{zh ? "返回浏览页" : "Back to Browse"}</a>}
  </section>;
}

function Info({ label, value }: { label: string; value: string }) { return <div><dt className="text-text-muted mb-1">{label}</dt><dd className="font-bold break-words">{value}</dd></div>; }
function OutcomeDescription({ value, zh }: { value: string; zh: boolean }) {
  const meanings = decodeOutcomeMeanings(value);
  if (!meanings) return value ? <p className="mt-2 text-text-muted whitespace-pre-wrap font-mono text-sm">{value}</p> : null;
  return <dl className="mt-4 grid gap-3 sm:grid-cols-3">
    <div className="rounded-xl border border-success/40 bg-success/5 p-3"><dt className="font-bold text-success">YES</dt><dd className="mt-1 whitespace-pre-wrap text-sm text-text-muted">{meanings.yes}</dd></div>
    <div className="rounded-xl border border-danger/40 bg-danger/5 p-3"><dt className="font-bold text-danger">NO</dt><dd className="mt-1 whitespace-pre-wrap text-sm text-text-muted">{meanings.no}</dd></div>
    {meanings.invalid && <div className="rounded-xl border border-fuchsia-400/40 bg-fuchsia-400/5 p-3"><dt className="font-bold text-fuchsia-300">INVALID</dt><dd className="mt-1 whitespace-pre-wrap text-sm text-text-muted">{meanings.invalid}</dd></div>}
    <span className="sr-only">{zh ? "选项含义" : "Outcome meanings"}</span>
  </dl>;
}
function ResolutionMethod({ mode, stakeEnd, resolutionDeadline, zh }: { mode: number; stakeEnd: number; resolutionDeadline: number; zh: boolean }) {
  return <section className={`mb-6 rounded-2xl border-2 p-6 ${mode === 0 ? "border-accent/60 bg-accent/10" : "border-fuchsia-400/60 bg-fuchsia-400/10"}`}>
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="text-xl font-display font-bold">{zh ? "结算方式" : "Resolution Method"}</h2>
      <span className={`self-start rounded-full px-3 py-1 text-xs font-bold ${mode === 0 ? "bg-accent/15 text-accent" : "bg-fuchsia-400/15 text-fuchsia-200"}`}>
        {mode === 0 ? (zh ? "资金多数" : "AUTOMATIC_MAJORITY") : (zh ? "创建者结算" : "CREATOR RESOLVED")}
      </span>
    </div>
    {mode === 0 ? <div className="mt-4 space-y-2 text-sm leading-6 text-text-muted">
      <p><strong className="text-text">{zh ? "谁结算：" : "Who resolves: "}</strong>{zh ? "参与结束后，任何地址都可以触发资金多数规则结算。" : "After staking ends, any address may trigger automatic-majority settlement."}</p>
      <p><strong className="text-text">{zh ? "判断规则：" : "Decision rule: "}</strong>{zh ? "YES 或 NO 的本金必须严格超过全部本金的 50%；否则结果为 INVALID。" : "YES or NO must hold strictly more than 50% of all staked principal. If neither side has a strict majority, the outcome is INVALID."}</p>
      <p><strong className="text-text">{zh ? "资金分配：" : "Settlement: "}</strong>{zh ? "获胜仓位按比例分配全部结算资金。INVALID 向所有玩家退还本金。" : "Winning positions receive the settlement pool pro rata. INVALID refunds every player's principal."}</p>
      <p className="font-mono text-xs">{zh ? "参与截止：" : "Staking ends: "}{formatDate(stakeEnd, zh)}</p>
    </div> : <div className="mt-4 space-y-2 text-sm leading-6 text-fuchsia-100">
      <p><strong>{zh ? "谁结算：" : "Who resolves: "}</strong>{zh ? "参与结束后，只有 Market 创建者能提交 YES、NO 或 INVALID。" : "The Market creator alone submits the final YES, NO, or INVALID result after staking ends."}</p>
      <p><strong>{zh ? "信任模型：" : "Trust model: "}</strong>{zh ? "创建者也可以参与并持有仓位，同时控制最终结果；但不能选择无人持仓的 YES 或 NO。" : "The creator may stake while controlling the result, but cannot choose an empty YES or NO side."}</p>
      <p><strong>{zh ? "超时规则：" : "Timeout: "}</strong>{zh ? "如果创建者未在截止时间前提交结果，任何地址都可以将 Market 结算为 INVALID。" : "If no result is submitted before the resolution deadline, any address may finalize the Market as INVALID."}</p>
      <p><strong>{zh ? "最终性：" : "Finality: "}</strong>{zh ? "提交后的结果不可更改或撤销。" : "The submitted result is final and cannot be changed or revoked."}</p>
      <div className="grid gap-1 pt-1 font-mono text-xs sm:grid-cols-2"><span>{zh ? "参与截止：" : "Staking ends: "}{formatDate(stakeEnd, zh)}</span><span>{zh ? "结算截止：" : "Resolution deadline: "}{formatDate(resolutionDeadline, zh)}</span></div>
    </div>}
  </section>;
}
function Pool({ side, amount, color }: { side: string; amount: string; color: string }) { return <div className="p-4 border border-border rounded-xl"><div className={`font-bold ${color}`}>{side}</div><div className="font-mono mt-2 text-sm">{amount}</div></div>; }
function Message({ text }: { text: string }) { return <div className="min-h-[40vh] flex items-center justify-center text-text-muted font-mono">{text}</div>; }
function short(value: string) { return `${value.slice(0, 6)}…${value.slice(-4)}`; }
