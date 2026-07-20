import React, { useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import { Contract, isAddress, parseUnits } from "ethers";
import { PartyPopper, Plus, Sparkles, Trash2, AlertTriangle } from "lucide-react";
import "./index.css";
import { FriendsHeader } from "./components/FriendsExoHeader";
import { FriendsBrand } from "./components/FriendsBrand";
import { Button } from "./components/Button";
import { config, PRIVATE_VAULT_FACTORY_ABI } from "./config";
import { useWallet } from "./useWallet";
import type { Language } from "./types";
import { friendlyError } from "./friendly-error";
import { encodeOutcomeMeanings, validateOutcomeMeanings } from "./outcome-metadata";

const ZERO = "0x0000000000000000000000000000000000000000";

function splitWallets(value: string) {
  return value.split(/[\s,;]+/).map((item) => item.trim()).filter(Boolean);
}

function CreatePrivateVault() {
  const wallet = useWallet();
  const [lang, setLang] = useState<Language>("en");
  const [claim, setClaim] = useState("");
  const [yesMeaning, setYesMeaning] = useState("");
  const [noMeaning, setNoMeaning] = useState("");
  const [mode, setMode] = useState<0 | 1>(0);
  const [stakeHours, setStakeHours] = useState("24");
  const [resolutionHours, setResolutionHours] = useState("24");
  const [minStake, setMinStake] = useState("1");
  const [batch, setBatch] = useState("");
  const [wallets, setWallets] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const zh = lang === "zh";

  const parsed = useMemo(() => splitWallets(batch), [batch]);
  const invalid = parsed.filter((address) => !isAddress(address));
  const validNew = parsed.filter((address) => isAddress(address) && !wallets.some((w) => w.toLowerCase() === address.toLowerCase()));

  const addWallets = () => {
    if (invalid.length) return;
    const byLower = new Map(wallets.map((address) => [address.toLowerCase(), address]));
    validNew.forEach((address) => byLower.set(address.toLowerCase(), address));
    setWallets([...byLower.values()]);
    setBatch("");
  };

  const create = async () => {
    if (!claim.trim()) return setError(zh ? "请填写主题。" : "Enter a claim.");
    const meanings = { yes: yesMeaning, no: noMeaning };
    const meaningsError = validateOutcomeMeanings(meanings, zh);
    if (meaningsError) return setError(meaningsError);
    if (!wallet.signer) return wallet.connectWallet();
    if (config.privateVaultFactoryAddress === ZERO) return setError(zh ? "Vault 工厂尚未配置。" : "The Vault factory is not configured.");
    const stakePeriod = Math.floor(Number(stakeHours) * 3600);
    const resolutionPeriod = mode === 1 ? Math.floor(Number(resolutionHours) * 3600) : 0;
    if (!Number.isSafeInteger(stakePeriod) || stakePeriod <= 0) return setError(zh ? "参与时间必须大于零。" : "The staking period must be greater than zero.");
    if (mode === 1 && (!Number.isSafeInteger(resolutionPeriod) || resolutionPeriod <= 0)) return setError(zh ? "结算时间必须大于零。" : "The resolution period must be greater than zero.");
    setBusy(true); setError("");
    try {
      const token = new Contract(config.depositTokenAddress, ["function decimals() view returns (uint8)"], wallet.signer);
      const decimals = Number(await token.decimals());
      const factory = new Contract(config.privateVaultFactoryAddress, PRIVATE_VAULT_FACTORY_ABI, wallet.signer);
      const minStakeValue = parseUnits(minStake, decimals);
      if (minStakeValue <= 0n) throw new Error("Amount below min stake");
      const params = { claim: claim.trim(), description: encodeOutcomeMeanings(meanings), stakeToken: config.depositTokenAddress, resolutionMode: mode, stakePeriod, resolutionPeriod, minStake: minStakeValue, allowedWallets: wallets };
      const tx = await factory.createPrivateVault(params);
      const receipt = await tx.wait();
      let vault = "";
      for (const log of receipt.logs) {
        try {
          const event = factory.interface.parseLog(log);
          if (event?.name === "PrivateVaultCreated") vault = String(event.args.vault);
        } catch { /* unrelated log */ }
      }
      if (!vault) throw new Error("Creation succeeded but the vault address was not found in the receipt.");
      window.location.assign(`/private-vault.html?vault=${vault}`);
    } catch (reason) {
      setError(friendlyError(reason, zh));
    } finally { setBusy(false); }
  };

  return <div className="friends-page min-h-screen text-text">
    <FriendsHeader lang={lang} onToggleLang={() => setLang((value) => value === "zh" ? "en" : "zh")} current="create" wallet={wallet} />
    <main className="relative mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="friends-orb friends-orb-one" /><div className="friends-orb friends-orb-two" />
      <div className="friends-hero relative mb-8 overflow-hidden rounded-[2rem] p-7 sm:p-10"><Sparkles className="absolute right-7 top-7 h-10 w-10 text-fuchsia-400/80" /><div className="mb-4 inline-flex items-center gap-2 rounded-full border border-fuchsia-300/30 bg-white/10 px-4 py-2 text-xs font-bold text-fuchsia-200"><PartyPopper className="h-4 w-4" />{zh ? "提出主张，派对开始。" : "Make a claim. Let the party begin."}</div><h1 className="text-4xl font-display font-bold sm:text-5xl">{zh ? <>创建 <FriendsBrand gradient /> Vault</> : <>Create a <FriendsBrand gradient /> Vault</>}</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-text-muted">{zh ? "独立、仅限邀请。创建者会自动加入名单，你只需要邀请想一起玩的朋友。" : "Independent and invite-only. The creator is added automatically—just invite the friends you want to play with."}</p></div>
      {error && <div className="mb-5 p-4 border border-danger bg-danger/5 rounded-xl text-sm text-danger break-words"><AlertTriangle className="inline w-4 h-4 mr-2" />{error}</div>}
      <div className="friends-card space-y-6 rounded-3xl border border-fuchsia-400/20 bg-[#120921]/90 p-6 shadow-xl backdrop-blur sm:p-8">
        <Field label={zh ? "主题" : "Claim"}><input required aria-label={zh ? "主题" : "Claim"} value={claim} onChange={(e) => setClaim(e.target.value)} className="input" placeholder={zh ? "Alex 喜欢 Jessica 吗？" : "Does Alex like Jessica?"} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={zh ? "YES 的含义（必填）" : "YES meaning (required)"}><textarea required aria-label={zh ? "YES 的含义" : "YES meaning"} value={yesMeaning} onChange={(e) => setYesMeaning(e.target.value)} className="input min-h-24" placeholder={zh ? "例如：喜欢" : "For example: Alex likes Jessica"} /></Field>
          <Field label={zh ? "NO 的含义（必填）" : "NO meaning (required)"}><textarea required aria-label={zh ? "NO 的含义" : "NO meaning"} value={noMeaning} onChange={(e) => setNoMeaning(e.target.value)} className="input min-h-24" placeholder={zh ? "例如：不喜欢" : "For example: Alex does not like Jessica"} /></Field>
        </div>
        <div className="rounded-xl border border-fuchsia-400/40 bg-fuchsia-400/10 p-4 text-sm text-fuchsia-100">{zh ? "玩家只能选择 YES 或 NO。INVALID 是平局、取消、无法判断或超时时的全额退款结果，不能提前质押。" : "Players can stake only YES or NO. INVALID is a full-refund result for a tie, cancellation, uncertainty, or timeout; it cannot be staked."}</div>
        <Field label={zh ? "结算方式" : "Resolution Method"}><div className="grid sm:grid-cols-2 gap-3">
          <Mode selected={mode === 0} onClick={() => setMode(0)} title="AUTOMATIC_MAJORITY" text={zh ? "YES 或 NO 严格超过 50% 时获胜；平局或无人参与时 INVALID 并退款。" : "YES or NO wins above 50%; a tie or no participation resolves INVALID with refunds."} />
          <Mode selected={mode === 1} onClick={() => setMode(1)} title={zh ? "创建者结算" : "Creator Resolved"} text={zh ? "参与结束后，由创建者提交 YES、NO 或 INVALID。" : "The creator submits YES, NO, or INVALID after staking ends."} />
        </div></Field>
        {mode === 1 && <div className="p-4 rounded-xl border-2 border-fuchsia-400/60 bg-fuchsia-400/10 text-fuchsia-100 text-sm"><strong>{zh ? "信任提示：" : "Trust notice:"}</strong>{zh ? "创建者也可以参与，并且只有创建者能提交最终结果。请只参加你信任的朋友创建的金库。" : " The creator may stake and has sole authority to submit the final result. Only participate if you trust the creator."}</div>}
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label={zh ? "参与时间（小时）" : "Stake Period (hours)"}><input aria-label={zh ? "参与时间（小时）" : "Stake Period (hours)"} type="number" min="0.01" value={stakeHours} onChange={(e) => setStakeHours(e.target.value)} className="input" /></Field>
          {mode === 1 && <Field label={zh ? "结算时间（小时）" : "Resolution Period (hours)"}><input aria-label={zh ? "结算时间（小时）" : "Resolution Period (hours)"} type="number" min="0.01" value={resolutionHours} onChange={(e) => setResolutionHours(e.target.value)} className="input" /></Field>}
          <Field label={zh ? "最低参与金额" : "Minimum Stake"}><input aria-label={zh ? "最低参与金额" : "Minimum Stake"} type="number" min="0.000001" step="0.000001" value={minStake} onChange={(e) => setMinStake(e.target.value)} className="input" /></Field>
        </div>
        <Field label={zh ? "邀请的钱包" : "Allowed Wallets"}><textarea aria-label="Allowed Wallets" value={batch} onChange={(e) => setBatch(e.target.value)} className="input min-h-28 font-mono" placeholder={"0x1234...\n0xabcd..."} />
          <div className="mt-2 flex items-center justify-between gap-3 text-xs font-mono"><span className={invalid.length ? "text-danger" : "text-text-muted"}>{invalid.length ? (zh ? `${invalid.length} 个无效地址` : `${invalid.length} invalid address${invalid.length === 1 ? "" : "es"}`) : (zh ? `已邀请 ${wallets.length} 个钱包，创建者会自动加入` : `${wallets.length} invited wallets · Creator added automatically`)}</span><Button onClick={addWallets} disabled={!parsed.length || invalid.length > 0 || wallets.length + validNew.length > 99} size="sm" variant="outline"><Plus className="w-3 h-3 mr-1" />{zh ? "添加" : "Add"}</Button></div>
        </Field>
        {wallets.length > 0 && <div className="space-y-2 max-h-52 overflow-auto">{wallets.map((address) => <div key={address} className="flex justify-between items-center bg-white/5 border border-border rounded-lg px-3 py-2 font-mono text-xs"><span className="truncate">{address}</span><button onClick={() => setWallets((all) => all.filter((item) => item !== address))} aria-label={zh ? `移除 ${address}` : `Remove ${address}`}><Trash2 className="w-4 h-4 text-danger" /></button></div>)}</div>}
        <Button onClick={create} disabled={busy || Boolean(invalid.length)} variant="primary" className="w-full justify-center !rounded-xl !bg-gradient-to-r !from-[#ff7628] !via-[#ff3cac] !to-[#8257f5] !py-3.5 shadow-[0_0_24px_rgba(255,118,40,0.24)]">{busy ? (zh ? "正在创建…" : "Creating…") : wallet.connected ? <>{zh ? "创建 " : "Create "}<FriendsBrand /> Vault</> : (zh ? "连接钱包后创建" : "Connect Wallet to Create")}</Button>
      </div>
    </main>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="block"><div className="block text-xs font-display font-bold uppercase tracking-wider mb-2">{label}</div>{children}</div>; }
function Mode({ selected, onClick, title, text }: { selected: boolean; onClick: () => void; title: string; text: string }) { return <button type="button" onClick={onClick} className={`text-left p-4 rounded-xl border-2 ${selected ? "border-accent bg-accent/5" : "border-border"}`}><div className="font-bold">{selected ? "◉" : "○"} {title}</div><div className="text-xs text-text-muted mt-2 font-mono">{text}</div></button>; }

ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><CreatePrivateVault /></React.StrictMode>);
