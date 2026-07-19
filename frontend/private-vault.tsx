import React, { useCallback, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { Contract, JsonRpcProvider, formatUnits, isAddress, parseUnits } from "ethers";
import { AlertTriangle, Copy, KeyRound, PartyPopper, ShieldCheck, Sparkles } from "lucide-react";
import "./index.css";
import { FriendsHeader } from "./components/FriendsExoHeader";
import { FriendsBrand } from "./components/FriendsBrand";
import { Button } from "./components/Button";
import { config, ERC20_ABI, PRIVATE_VAULT_ABI, PRIVATE_VAULT_FACTORY_ABI } from "./config";
import { useWallet } from "./useWallet";
import type { Language } from "./types";

type State = {
  creator: string; mode: number; stakeEnd: number; resolutionDeadline: number; minStake: bigint;
  token: string; symbol: string; decimals: number; finalized: boolean; outcome: number;
  allowed: boolean; participated: boolean; claimed: boolean; total: bigint; yes: bigint; no: bigint; invalid: bigint;
  userYes: bigint; userNo: bigint; userInvalid: bigint; claim: string; description: string;
};
const outcomeName = (value: number) => ["UNRESOLVED", "YES", "NO", "INVALID"][value] ?? "UNKNOWN";
const formatDate = (value: number) => value ? new Date(value * 1000).toLocaleString() : "Not applicable";

function PrivateVaultPage() {
  const wallet = useWallet();
  const [lang, setLang] = useState<Language>("en");
  const vaultAddress = new URLSearchParams(window.location.search).get("vault")?.trim() ?? "";
  const validVault = isAddress(vaultAddress);
  const [state, setState] = useState<State | null>(null);
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const [amount, setAmount] = useState("");
  const [resolveOutcome, setResolveOutcome] = useState(1);
  const [manageWallets, setManageWallets] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [access, setAccess] = useState<"connect" | "checking" | "denied" | "allowed" | "error">("checking");
  const zh = lang === "zh";

  useEffect(() => { const timer = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000); return () => clearInterval(timer); }, []);

  const load = useCallback(async () => {
    if (!validVault) { setState(null); setAccess("error"); return setError("The vault query parameter is missing or invalid."); }
    if (!wallet.address) { setState(null); setError(""); setAccess("connect"); return; }
    setAccess("checking");
    try {
      const provider = new JsonRpcProvider(config.rpcUrl);
      const vault = new Contract(vaultAddress, PRIVATE_VAULT_ABI, provider);
      const configuredFactory = new Contract(config.privateVaultFactoryAddress, PRIVATE_VAULT_FACTORY_ABI, provider);
      if (!await configuredFactory.isPrivateVault(vaultAddress)) { setState(null); setError(""); setAccess("denied"); return; }
      if (!await vault.allowedWallets(wallet.address)) { setState(null); setError(""); setAccess("denied"); return; }
      const user = wallet.address;
      const [creator, mode, stakeEnd, deadline, minStake, tokenAddress, finalized, outcome, participated, claimed, total, yes, no, invalid, stake, factoryAddress] = await Promise.all([
        vault.creator(), vault.resolutionMode(), vault.stakeEndTime(), vault.resolutionDeadline(), vault.minStake(), vault.stakeToken(), vault.finalized(), vault.resolvedOutcome(), vault.hasParticipated(user), vault.hasClaimed(user), vault.totalPrincipal(), vault.totalStakeYes(), vault.totalStakeNo(), vault.totalStakeInvalid(), vault.stakeOf(user), vault.factory(),
      ]);
      const token = new Contract(tokenAddress, ERC20_ABI, provider);
      const factory = new Contract(factoryAddress, PRIVATE_VAULT_FACTORY_ABI, provider);
      const [decimals, symbol, meta] = await Promise.all([token.decimals(), token.symbol(), factory.getPrivateVaultMeta(vaultAddress)]);
      setState({ creator, mode: Number(mode), stakeEnd: Number(stakeEnd), resolutionDeadline: Number(deadline), minStake, token: tokenAddress, symbol, decimals: Number(decimals), finalized, outcome: Number(outcome), allowed: true, participated, claimed, total, yes, no, invalid, userYes: stake[0], userNo: stake[1], userInvalid: stake[2], claim: meta[0], description: meta[1] });
      setAccess("allowed");
      setError("");
    } catch (reason) { setState(null); setAccess("error"); setError(reason instanceof Error ? reason.message : String(reason)); }
  }, [validVault, vaultAddress, wallet.address]);
  useEffect(() => { load(); }, [load]);

  const transact = async (action: (vault: Contract) => Promise<unknown>) => {
    if (!wallet.signer) return wallet.connectWallet();
    setBusy(true); setError("");
    try { const vault = new Contract(vaultAddress, PRIVATE_VAULT_ABI, wallet.signer); const tx = await action(vault) as { wait: () => Promise<unknown> }; await tx.wait(); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };

  const submitCreatorResolution = () => {
    if (!state) return;
    const selectedPool = resolveOutcome === 1 ? state.yes : resolveOutcome === 2 ? state.no : state.total;
    const emptyWinningSide = state.total > 0n && (resolveOutcome === 1 || resolveOutcome === 2) && selectedPool === 0n;
    const message = emptyWinningSide
      ? (zh
        ? `警告：${outcomeName(resolveOutcome)} 当前无人持仓。确认后将没有任何可领取者，Vault 内全部资金会永久锁死。结果不可更改，仍要继续吗？`
        : `WARNING: Nobody currently holds ${outcomeName(resolveOutcome)}. Confirming will leave no eligible claimant and permanently lock all funds in this Vault. The result cannot be changed. Continue?`)
      : (zh ? "该结果不可更改。确认提交吗？" : "This result is final and cannot be changed. Confirm?");
    if (window.confirm(message)) void transact((vault) => vault.resolveByCreator(resolveOutcome));
  };

  const stake = async (side: number) => {
    if (!state || !wallet.signer) return wallet.connectWallet();
    if (state.mode === 1 && !window.confirm("The creator may have a financial position in this Vault and will determine the final outcome. Continue?")) return;
    const value = parseUnits(amount || "0", state.decimals);
    if (value <= 0n) return setError("Enter an amount greater than zero.");
    setBusy(true); setError("");
    try {
      const token = new Contract(state.token, ERC20_ABI, wallet.signer);
      await (await token.approve(vaultAddress, value)).wait();
      const vault = new Contract(vaultAddress, PRIVATE_VAULT_ABI, wallet.signer);
      await (await vault.stake(side, value)).wait(); setAmount(""); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };

  const staking = state && !state.finalized && now < state.stakeEnd;
  const creator = Boolean(state && wallet.address && wallet.address.toLowerCase() === state.creator.toLowerCase());
  const canCreatorResolve = Boolean(state && state.mode === 1 && creator && !state.finalized && now >= state.stakeEnd && now <= state.resolutionDeadline);
  const expired = Boolean(state && state.mode === 1 && !state.finalized && now > state.resolutionDeadline);
  const canCoreResolve = Boolean(state && state.mode === 0 && !state.finalized && now >= state.stakeEnd);
  const selectedPoolIsEmpty = Boolean(state && state.total > 0n && (resolveOutcome === 1 || resolveOutcome === 2) && (resolveOutcome === 1 ? state.yes : state.no) === 0n);
  const claimEligible = Boolean(state && state.participated && (state.outcome === 3 || (state.outcome === 1 && state.userYes > 0n) || (state.outcome === 2 && state.userNo > 0n)));
  const fmt = (value: bigint) => state ? `${formatUnits(value, state.decimals)} ${state.symbol}` : "—";
  const addresses = manageWallets.split(/[\s,;]+/).map((v) => v.trim()).filter(Boolean);

  return <div className="friends-page min-h-screen text-text">
    <FriendsHeader lang={lang} onToggleLang={() => setLang((value) => value === "zh" ? "en" : "zh")} current="vault" wallet={wallet} />
    <main className="relative max-w-6xl mx-auto px-4 py-8 sm:px-6">
      <div className="friends-orb friends-orb-one" /><div className="friends-orb friends-orb-two" />
      <div className="friends-hero relative mb-6 overflow-hidden rounded-[2rem] p-6 sm:p-8"><Sparkles className="absolute right-7 top-7 h-9 w-9 text-fuchsia-400/80" /><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-fuchsia-300/30 bg-white/10 px-3 py-1.5 text-xs font-bold text-fuchsia-200"><PartyPopper className="h-4 w-4" />OCP/<FriendsBrand /></div><div className="font-display text-2xl font-bold">{zh ? "你的私人预测派对" : "Your private prediction party"}</div><p className="mt-2 text-sm text-text-muted">{zh ? "只有收到邀请的钱包才能进入和参与。" : "Only invited wallets can enter and participate."}</p></div>
      {access !== "allowed" && <AccessGate access={access} error={error} zh={zh} onConnect={wallet.connectWallet} />}
      {access === "allowed" && <>
      {state?.mode === 1 && <div className="p-5 border-2 border-[#ff5a6f]/60 rounded-2xl bg-[#ff5a6f]/10 text-pink-100 mb-6"><div className="font-bold flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-[#ff7183]" />Resolved by the Vault creator.</div><p className="mt-2 text-sm">The creator may participate in this Vault and has sole authority to submit the final result.</p><p className="mt-1 font-bold">Only participate if you trust the creator.</p></div>}
      {error && <div role="alert" className="p-4 mb-6 border border-danger bg-danger/5 rounded-xl text-danger text-xs break-words">{error}</div>}
      {!state ? (!error && <Message text="Loading private Vault…" />) : <>
        <section className="border border-border rounded-2xl p-6 mb-6"><div className="flex flex-col sm:flex-row sm:justify-between gap-4"><div><h1 className="text-2xl font-display font-bold">{state.claim || "Private Vault"}</h1><p className="mt-2 text-text-muted whitespace-pre-wrap font-mono text-sm">{state.description}</p></div><span className="self-start px-3 py-1 rounded-full border border-border text-xs font-bold">{state.finalized ? `FINAL · ${outcomeName(state.outcome)}` : staking ? "STAKING" : "RESOLUTION"}</span></div>
          <dl className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 text-xs font-mono"><Info label="Created by" value={short(state.creator)} /><Info label="Resolution method" value={state.mode === 0 ? "OCP Core Rules" : "Creator Resolved"} /><Info label="Stake deadline" value={formatDate(state.stakeEnd)} /><Info label="Resolution deadline" value={formatDate(state.resolutionDeadline)} /></dl>
          <div className="mt-5 flex flex-wrap items-center gap-4"><button onClick={() => navigator.clipboard.writeText(window.location.href)} className="text-xs text-accent inline-flex items-center gap-1"><Copy className="w-3 h-3" />{zh ? "复制邀请链接" : "Copy invite link"}</button><a href={`/private-vault-rules.html?mode=${state.mode}`} className="text-xs font-bold text-accent hover:underline">{zh ? "查看结算方式 →" : "View settlement method →"}</a></div>
        </section>
        <ResolutionMethod mode={state.mode} stakeEnd={state.stakeEnd} resolutionDeadline={state.resolutionDeadline} zh={zh} />
        <div className="grid lg:grid-cols-3 gap-6">
          <section className="friends-card lg:col-span-2 border border-fuchsia-400/20 bg-[#120921]/90 rounded-2xl p-6"><h2 className="font-display font-bold mb-2">{zh ? "大家目前的选择" : "Current choices"}</h2><p className="mb-5 text-xs text-text-muted">{zh ? "这里只显示每个选项已经投入的总金额。" : "This shows the total amount currently placed on each choice."}</p><div className="grid sm:grid-cols-3 gap-3"><Pool side="YES" amount={fmt(state.yes)} color="text-success" /><Pool side="NO" amount={fmt(state.no)} color="text-danger" /><Pool side="INVALID" amount={fmt(state.invalid)} color="text-fuchsia-300" /></div><div className="mt-4 text-sm font-mono">{zh ? "总参与金额：" : "Total joined: "}<strong>{fmt(state.total)}</strong></div></section>
          <section className="border border-border rounded-2xl p-6"><h2 className="font-display font-bold mb-4">Your Access</h2>{!wallet.connected ? <Button onClick={wallet.connectWallet} variant="outline">Connect wallet</Button> : state.allowed ? <div className="text-success flex gap-2 items-center"><ShieldCheck className="w-5 h-5" /><strong>You are invited.</strong></div> : <div className="text-danger text-sm"><strong>This is a private Vault.</strong><p className="mt-2">Your wallet is not on the participant list.</p></div>}<div className="mt-5 text-xs font-mono text-text-muted">Your position: YES {fmt(state.userYes)} · NO {fmt(state.userNo)} · INVALID {fmt(state.userInvalid)}</div></section>
        </div>
        <section className="border border-border rounded-2xl p-6 mt-6"><h2 className="font-display font-bold text-xl">Vault Actions</h2>
          {state.mode === 1 && staking && <div className="my-4 p-3 border border-[#ff5a6f]/60 bg-[#ff5a6f]/10 rounded-xl text-sm font-bold text-pink-100">The creator may have a financial position in this Vault and will determine the final outcome.</div>}
          {staking && <div className="mt-5"><label className="text-xs font-bold uppercase">Stake amount (minimum {fmt(state.minStake)})</label><input className="input mt-2" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} /><div className="grid sm:grid-cols-3 gap-3 mt-3"><Button disabled={busy || !state.allowed} onClick={() => stake(0)} variant="success">Stake YES</Button><Button disabled={busy || !state.allowed} onClick={() => stake(1)} variant="danger">Stake NO</Button><Button disabled={busy || !state.allowed} onClick={() => stake(2)} variant="secondary">Stake INVALID</Button></div></div>}
          {canCoreResolve && <Button disabled={busy} onClick={() => transact((vault) => vault.finalizeByCoreRules())} variant="primary" className="mt-5">Finalize with OCP Core Rules</Button>}
          {canCreatorResolve && <div className="mt-5 p-5 border-2 border-amber-500 rounded-xl"><h3 className="font-bold">Submit Final Result</h3><select className="input mt-3" value={resolveOutcome} onChange={(e) => setResolveOutcome(Number(e.target.value))}><option value={1}>YES</option><option value={2}>NO</option><option value={3}>INVALID</option></select>{selectedPoolIsEmpty ? <p className="text-sm font-bold text-danger mt-3">{zh ? "警告：该结果当前无人持仓。提交后将没有可领取者，Vault 内全部资金会永久锁死。" : "WARNING: This outcome has no holders. Submitting it will leave no eligible claimant and permanently lock all funds in the Vault."}</p> : <p className="text-sm font-bold text-danger mt-3">{zh ? "该结果不可更改。" : "This result is final and cannot be changed."}</p>}<Button disabled={busy} onClick={submitCreatorResolution} variant="primary" className="mt-3">Confirm Result</Button></div>}
          {expired && <div className="mt-5 p-5 border border-amber-500 rounded-xl"><p>The creator did not submit a result before the deadline. This Vault can now be finalized as INVALID.</p><Button disabled={busy} onClick={() => transact((vault) => vault.finalizeExpiredResolution())} variant="secondary" className="mt-3">Finalize as INVALID</Button></div>}
          {state.finalized && <div className="mt-5"><p className="font-bold">Final result: {outcomeName(state.outcome)}</p>{state.mode === 1 && <p className="text-sm text-text-muted mt-1">Final result submitted by the creator or finalized INVALID after timeout.</p>}{claimEligible ? <Button disabled={busy || state.claimed} onClick={() => transact((vault) => vault.withdraw())} variant="primary" className="mt-4">{state.claimed ? "Payout claimed" : "Claim payout"}</Button> : <p className="mt-4 text-sm font-bold text-text-muted">{state.participated ? (zh ? "你的仓位不是获胜方，没有可领取金额。" : "Your position did not win. There is no payout to claim.") : (zh ? "你没有参与这个 Vault。" : "You did not participate in this Vault.")}</p>}</div>}
        </section>
        {creator && staking && <section className="border border-border rounded-2xl p-6 mt-6"><h2 className="font-display font-bold">Manage Allowed Wallets</h2><textarea className="input min-h-24 mt-3 font-mono" value={manageWallets} onChange={(e) => setManageWallets(e.target.value)} placeholder="Paste wallet addresses" /><div className="flex gap-3 mt-3"><Button disabled={busy || !addresses.length || addresses.some((v) => !isAddress(v))} onClick={() => transact((vault) => vault.addAllowedWallets(addresses)).then(() => setManageWallets(""))} variant="outline">Add wallets</Button><Button disabled={busy || addresses.length !== 1 || !isAddress(addresses[0] ?? "")} onClick={() => transact((vault) => vault.removeAllowedWallet(addresses[0])).then(() => setManageWallets(""))} variant="danger">Remove wallet</Button></div><p className="text-xs text-text-muted mt-3">A wallet can be removed only before the deadline and before it participates. The creator can never be removed.</p></section>}
      </>}
      </>}
    </main>
  </div>;
}

function AccessGate({ access, error, zh, onConnect }: { access: "connect" | "checking" | "denied" | "allowed" | "error"; error: string; zh: boolean; onConnect: () => void }) {
  return <section className="mx-auto max-w-xl rounded-3xl border border-fuchsia-400/25 bg-[#120921]/95 p-8 text-center shadow-[0_0_55px_rgba(139,92,246,0.22)] backdrop-blur">
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff7628] via-[#ff3cac] to-[#8257f5] text-white shadow-[0_0_22px_rgba(255,118,40,0.22)]"><KeyRound className="h-7 w-7" /></div>
    <h1 className="mt-5 font-display text-2xl font-bold">{access === "connect" ? (zh ? "连接钱包验证邀请" : "Connect wallet to verify invite") : access === "checking" ? (zh ? "正在检查邀请名单…" : "Checking the invite list…") : access === "denied" ? (zh ? "这张邀请函不属于当前钱包" : "This invite is not for this wallet") : (zh ? "无法打开这个金库" : "Unable to open this Vault")}</h1>
    <p className="mt-3 text-sm leading-6 text-text-muted">{access === "denied" ? (zh ? "当前钱包不在合约白名单中，因此不能查看金库详情。" : "The connected wallet is not on the contract allowlist, so Vault details stay hidden.") : access === "connect" ? (zh ? <><FriendsBrand /> Vault 只向白名单钱包开放。</> : <><FriendsBrand /> Vaults are visible only to allowlisted wallets.</>) : error}</p>
    {access === "connect" && <Button onClick={onConnect} variant="primary" className="mt-6 !rounded-xl !bg-gradient-to-r !from-[#ff7628] !via-[#ff3cac] !to-[#8257f5] shadow-[0_0_22px_rgba(255,118,40,0.22)]">{zh ? "连接钱包" : "Connect wallet"}</Button>}
    {access === "denied" && <a href="/browse-private-vault.html" className="mt-6 inline-block text-sm font-bold text-fuchsia-700 hover:underline">{zh ? "返回浏览页" : "Back to Browse"}</a>}
  </section>;
}

function Info({ label, value }: { label: string; value: string }) { return <div><dt className="text-text-muted mb-1">{label}</dt><dd className="font-bold break-words">{value}</dd></div>; }
function ResolutionMethod({ mode, stakeEnd, resolutionDeadline, zh }: { mode: number; stakeEnd: number; resolutionDeadline: number; zh: boolean }) {
  return <section className={`mb-6 rounded-2xl border-2 p-6 ${mode === 0 ? "border-accent/60 bg-accent/10" : "border-fuchsia-400/60 bg-fuchsia-400/10"}`}>
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="text-xl font-display font-bold">Resolution Method / 结算方式</h2>
      <span className={`self-start rounded-full px-3 py-1 text-xs font-bold ${mode === 0 ? "bg-accent/15 text-accent" : "bg-fuchsia-400/15 text-fuchsia-200"}`}>
        {mode === 0 ? "OCP CORE RULES" : "CREATOR RESOLVED"}
      </span>
    </div>
    {mode === 0 ? <div className="mt-4 space-y-2 text-sm leading-6 text-text-muted">
      <p><strong className="text-text">Who resolves / 谁结算：</strong>After staking ends, any address may trigger the original OCP Core Rules.</p>
      <p><strong className="text-text">Decision rule / 判断规则：</strong>YES or NO must hold strictly more than 50% of all staked principal. If neither side has a strict majority, the outcome is INVALID.</p>
      <p><strong className="text-text">Settlement / 资金分配：</strong>Winning positions receive the entire settlement pool pro rata. INVALID follows the original Core INVALID distribution rule.</p>
      <p className="font-mono text-xs">Staking ends / 质押截止：{formatDate(stakeEnd)}</p>
    </div> : <div className="mt-4 space-y-2 text-sm leading-6 text-fuchsia-100">
      <p><strong>Who resolves / 谁结算：</strong>The Vault creator alone submits the final YES, NO, or INVALID result after staking ends.</p>
      <p><strong>Trust model / 信任模型：</strong>The creator may also stake in this Vault and may have a financial position while controlling the final result.</p>
      <p><strong>Timeout / 超时规则：</strong>If no result is submitted before the resolution deadline, any address may finalize the Vault as INVALID.</p>
      <p><strong>Finality / 最终性：</strong>The submitted result is final and cannot be changed or revoked.</p>
      <div className="grid gap-1 pt-1 font-mono text-xs sm:grid-cols-2"><span>Staking ends / 质押截止：{formatDate(stakeEnd)}</span><span>Resolution deadline / 结算截止：{formatDate(resolutionDeadline)}</span></div>
    </div>}
    <p className="mt-4 rounded-xl border border-amber-500/50 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100">{zh ? "最后一名有资格领取的人拿走 Vault 当时的全部剩余余额，包括结算后、最后领取前直接转入的 USDC。最后领取完成后再转入的资金会锁死。" : "The final eligible claimant receives the Vault's entire remaining balance, including USDC transferred after finalization but before that final claim. Transfers arriving afterward remain locked."}</p>
  </section>;
}
function Pool({ side, amount, color }: { side: string; amount: string; color: string }) { return <div className="p-4 border border-border rounded-xl"><div className={`font-bold ${color}`}>{side}</div><div className="font-mono mt-2 text-sm">{amount}</div></div>; }
function Message({ text }: { text: string }) { return <div className="min-h-[40vh] flex items-center justify-center text-text-muted font-mono">{text}</div>; }
function short(value: string) { return `${value.slice(0, 6)}…${value.slice(-4)}`; }

ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><PrivateVaultPage /></React.StrictMode>);
