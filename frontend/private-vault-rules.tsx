import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import { ArrowDown, PartyPopper, Sparkles, TriangleAlert } from "lucide-react";
import "./index.css";
import { FriendsHeader } from "./components/FriendsExoHeader";

type Mode = 0 | 1;
type Lang = "en" | "zh";

function initialMode(): Mode {
  return new URLSearchParams(window.location.search).get("mode") === "1" ? 1 : 0;
}

function initialLang(): Lang {
  const requested = new URLSearchParams(window.location.search).get("lang");
  if (requested === "en" || requested === "zh") return requested;
  return "en";
}

const COPY = {
  en: {
    create: "Create Private Vault", eyebrow: "FOR YOU & YOUR FRIENDS", title: "How to Play",
    intro: "First determine the final result, then pay the participants who are eligible for that result.",
    coreSub: "Capital majority decides the result", creatorSub: "Creator submits the result", step1: "Step 1 · Outcome",
    coreTitle: "Strict capital majority", creatorTitle: "Creator submits YES / NO / INVALID", automatic: "AUTOMATIC RULE", trusted: "TRUSTED CREATOR",
    yesWins: "YES wins", yesRule: "YES principal > 50% of all principal", noWins: "NO wins", noRule: "NO principal > 50% of all principal",
    invalid: "INVALID", invalidRule: "Neither YES nor NO has a strict majority, or nobody participates", during: "During staking", duringText: "The creator stakes together with the other invited wallets",
    window: "Resolution window", windowText: "Creator submits YES, NO, or INVALID; an empty YES or NO side cannot be selected", missed: "Deadline missed", missedText: "Anyone can trigger INVALID settlement and refunds",
    trustLabel: "Trust warning:", trustText: "The creator may hold a financial position and also controls the final result. The result is permanent once submitted.",
    fixed: "Result confirmed", step2: "Step 2 · Who gets paid", receives: "What happens after settlement?", outcome: "Result",
    yesOnly: "YES participants get paid", yesZero: "They share the available funds according to how much each person put in. NO participants get nothing.",
    noOnly: "NO participants get paid", noZero: "They share the available funds according to how much each person put in. YES participants get nothing.",
    everyone: "Full refund", everyoneDetail: "Every participant gets back the full amount they put in. If nobody participated, there is nothing to claim.",
  },
  zh: {
    create: "创建私人金库", eyebrow: "只属于你和朋友们", title: "玩法",
    intro: "先确定最终结果，再按照结果决定哪些参与者可以领取资金。",
    coreSub: "由资金严格多数决定结果", creatorSub: "由创建者提交最终结果", step1: "第一步 · 判定结果",
    coreTitle: "资金严格多数规则", creatorTitle: "创建者提交 YES / NO / INVALID", automatic: "自动规则", trusted: "信任创建者",
    yesWins: "YES 获胜", yesRule: "YES 本金严格超过全部本金的 50%", noWins: "NO 获胜", noRule: "NO 本金严格超过全部本金的 50%",
    invalid: "INVALID", invalidRule: "YES 和 NO 均未取得严格多数，或没有任何人参与", during: "质押期间", duringText: "创建者和其他受邀钱包一起参与质押",
    window: "结算窗口", windowText: "只有创建者可以提交结果；无人持仓的 YES 或 NO 不能被选择", missed: "创建者超时", missedText: "任何地址都可以触发 INVALID 结算并退款",
    trustLabel: "信任提示：", trustText: "创建者可以持有仓位，同时控制最终结果。结果一经提交即永久生效，不能更改。",
    fixed: "结果已经确定", step2: "第二步 · 谁可以拿钱", receives: "结算后怎么处理？", outcome: "结算结果",
    yesOnly: "选择 YES 的人可以拿钱", yesZero: "按照每个人投入的多少来分。选择 NO 的人拿不到钱。",
    noOnly: "选择 NO 的人可以拿钱", noZero: "按照每个人投入的多少来分。选择 YES 的人拿不到钱。",
    everyone: "全额退还", everyoneDetail: "每位参与者取回自己投入的全部本金。没有人参与时，不需要领取任何资金。",
  },
} as const;

function RulesPage() {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [lang, setLang] = useState<Lang>(initialLang);
  const t = COPY[lang];
  return <div className="friends-page min-h-screen text-text">
    <FriendsHeader lang={lang} onToggleLang={() => setLang((value) => value === "en" ? "zh" : "en")} current="play" />
    <main className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="friends-orb friends-orb-one" /><div className="friends-orb friends-orb-two" />
      <div className="friends-hero relative mb-8 overflow-hidden rounded-[2rem] p-7 sm:p-10"><Sparkles className="absolute right-7 top-7 h-10 w-10 text-fuchsia-400/80" /><div className="mb-4 inline-flex items-center gap-2 rounded-full border border-fuchsia-300/30 bg-white/10 px-4 py-2 text-xs font-bold text-fuchsia-200 shadow-[0_0_18px_rgba(217,70,239,0.2)]"><PartyPopper className="h-4 w-4" />{t.eyebrow}</div><h1 className="max-w-3xl text-4xl font-display font-bold sm:text-6xl">{t.title}</h1><p className="mt-5 max-w-2xl text-sm leading-7 text-text-muted sm:text-base">{t.intro}</p></div>

      <div className="mb-8 grid gap-3 sm:grid-cols-2"><ModeButton active={mode === 0} onClick={() => setMode(0)} title="AUTOMATIC_MAJORITY" subtitle={t.coreSub} /><ModeButton active={mode === 1} onClick={() => setMode(1)} title={lang === "zh" ? "创建者结算" : "Creator Resolved"} subtitle={t.creatorSub} warning /></div>

      <section className={`friends-card rounded-2xl border-2 p-6 sm:p-8 ${mode === 0 ? "border-accent/60 bg-[#120921]/90" : "border-fuchsia-400/70 bg-[#160a29]/95"}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="text-xs font-bold uppercase tracking-widest text-text-muted">{t.step1}</div><h2 className="mt-2 text-2xl font-display font-bold">{mode === 0 ? t.coreTitle : t.creatorTitle}</h2></div><span className={`self-start rounded-full px-3 py-1 text-xs font-bold ${mode === 0 ? "bg-accent/10 text-accent" : "bg-fuchsia-200 text-fuchsia-900"}`}>{mode === 0 ? t.automatic : t.trusted}</span></div>
        {mode === 0 ? <div className="mt-5 grid gap-3 md:grid-cols-3"><RuleCard title={t.yesWins} text={t.yesRule} color="success" /><RuleCard title={t.noWins} text={t.noRule} color="danger" /><RuleCard title={t.invalid} text={t.invalidRule} color="invalid" /></div> : <div className="mt-5 grid gap-3 md:grid-cols-3"><RuleCard title={t.during} text={t.duringText} color="neutral" /><RuleCard title={t.window} text={t.windowText} color="invalid" /><RuleCard title={t.missed} text={t.missedText} color="danger" /></div>}
        {mode === 1 && <div className="mt-4 flex gap-3 rounded-xl border border-[#ff5a6f]/60 bg-[#ff5a6f]/10 p-4 text-sm text-pink-100"><TriangleAlert className="h-5 w-5 shrink-0 text-[#ff7183]" /><div><strong>{t.trustLabel}</strong>{t.trustText}</div></div>}
      </section>

      <FlowArrow label={t.fixed} />
      <section className="friends-card rounded-2xl border border-fuchsia-400/20 bg-[#120921]/90 p-6 sm:p-8"><div className="text-xs font-bold uppercase tracking-widest text-text-muted">{t.step2}</div><h2 className="mt-2 text-2xl font-display font-bold">{t.receives}</h2><div className="mt-6 grid gap-4 md:grid-cols-3"><Eligibility outcome="YES" eligible={t.yesOnly} detail={t.yesZero} color="border-success/50 bg-success/10 text-success" outcomeLabel={t.outcome} /><Eligibility outcome="NO" eligible={t.noOnly} detail={t.noZero} color="border-danger/50 bg-danger/10 text-danger" outcomeLabel={t.outcome} /><Eligibility outcome="INVALID" eligible={t.everyone} detail={t.everyoneDetail} color="border-fuchsia-400/50 bg-fuchsia-400/10 text-fuchsia-300" outcomeLabel={t.outcome} /></div></section>
    </main>
  </div>;
}

function ModeButton({ active, onClick, title, subtitle, warning = false }: { active: boolean; onClick: () => void; title: string; subtitle: string; warning?: boolean }) { return <button onClick={onClick} className={`rounded-xl border-2 p-5 text-left transition ${active ? warning ? "border-fuchsia-400 bg-fuchsia-400/10 shadow-[0_0_24px_rgba(217,70,239,0.16)]" : "border-accent bg-accent/10 shadow-[0_0_24px_rgba(255,60,172,0.14)]" : "border-border bg-[#0d0618]/70 hover:border-accent/40"}`}><div className="font-display text-lg font-bold">{active ? "●" : "○"} {title}</div><div className="mt-2 text-xs text-text-muted">{subtitle}</div></button>; }
function RuleCard({ title, text, color }: { title: string; text: string; color: "success" | "danger" | "invalid" | "neutral" }) { const styles = { success: "border-success/50 bg-success/10", danger: "border-danger/50 bg-danger/10", invalid: "border-fuchsia-400/50 bg-fuchsia-400/10", neutral: "border-border bg-white/5" }; return <div className={`rounded-xl border p-4 ${styles[color]}`}><div className="font-bold">{title}</div><p className="mt-2 text-xs leading-5 text-text-muted">{text}</p></div>; }
function FlowArrow({ label }: { label: string }) { return <div className="flex flex-col items-center py-5 text-text-muted"><ArrowDown className="h-5 w-5 text-accent" /><span className="mt-1 text-center text-[10px] font-bold uppercase tracking-widest">{label}</span></div>; }
function Eligibility({ outcome, eligible, detail, color, outcomeLabel }: { outcome: string; eligible: string; detail: string; color: string; outcomeLabel: string }) { return <div className={`rounded-xl border p-5 ${color}`}><div className="text-xs font-bold uppercase tracking-widest">{outcomeLabel} {outcome}</div><div className="mt-3 font-display text-lg font-bold text-text">{eligible}</div><p className="mt-2 text-xs text-text-muted">{detail}</p></div>; }

ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><RulesPage /></React.StrictMode>);
