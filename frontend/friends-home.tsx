import React from "react";
import { LockKeyhole } from "lucide-react";
import type { Language } from "./types";

type Person = {
  id: string;
  name: string;
  x: number;
  y: number;
  cropX: number;
  cropY: number;
  color: string;
};

type Market = {
  title: string;
  x: number;
  y: number;
  width: number;
  yes: number;
  people: string[];
  extra: number;
  color: string;
};

const PEOPLE: Person[] = [
  { id: "amara", name: "Amara", x: 280, y: 85, cropX: 660, cropY: 152, color: "#a855f7" },
  { id: "leo", name: "Leo", x: 170, y: 180, cropX: 502, cropY: 252, color: "#a855f7" },
  { id: "maya", name: "Maya", x: 450, y: 175, cropX: 834, cropY: 255, color: "#a855f7" },
  { id: "nina", name: "Nina", x: 190, y: 315, cropX: 520, cropY: 431, color: "#a855f7" },
  { id: "omar", name: "Omar", x: 720, y: 80, cropX: 1235, cropY: 152, color: "#ff8a2b" },
  { id: "zoe", name: "Zoe", x: 600, y: 180, cropX: 1051, cropY: 276, color: "#ff8a2b" },
  { id: "alex", name: "Alex", x: 910, y: 180, cropX: 1414, cropY: 279, color: "#ff8a2b" },
  { id: "mei", name: "Mei", x: 650, y: 320, cropX: 1084, cropY: 484, color: "#ff8a2b" },
  { id: "imani", name: "Imani", x: 870, y: 320, cropX: 1365, cropY: 485, color: "#ff8a2b" },
  { id: "kai", name: "Kai", x: 80, y: 450, cropX: 142, cropY: 642, color: "#42a5ff" },
  { id: "ava", name: "Ava", x: 230, y: 430, cropX: 367, cropY: 628, color: "#42a5ff" },
  { id: "marcus", name: "Marcus", x: 70, y: 650, cropX: 122, cropY: 867, color: "#42a5ff" },
  { id: "ethan", name: "Ethan", x: 470, y: 335, cropX: 714, cropY: 589, color: "#ff4fac" },
  { id: "jules", name: "Jules", x: 430, y: 610, cropX: 533, cropY: 867, color: "#ff4fac" },
  { id: "jessica", name: "Jessica", x: 770, y: 605, cropX: 1055, cropY: 865, color: "#ff4fac" },
];

const MARKETS: Market[] = [
  { title: "Weekend trip?", x: 320, y: 185, width: 184, yes: 52, people: ["leo", "maya", "nina"], extra: 5, color: "#a855f7" },
  { title: "Game night winner?", x: 350, y: 285, width: 192, yes: 55, people: ["amara", "leo", "maya"], extra: 7, color: "#a855f7" },
  { title: "Will Alex be late?", x: 760, y: 210, width: 198, yes: 49, people: ["omar", "zoe", "alex"], extra: 6, color: "#ff8a2b" },
  { title: "Brunch this Sunday?", x: 215, y: 540, width: 204, yes: 52, people: ["kai", "ava", "marcus"], extra: 6, color: "#42a5ff" },
  { title: "Alex like Jessica?", x: 595, y: 520, width: 254, yes: 62, people: ["ethan", "jules", "jessica"], extra: 9, color: "#ff4fac" },
];

const CONNECTIONS: [string, string, string][] = [
  ["amara", "leo", "#a855f7"], ["amara", "maya", "#a855f7"], ["leo", "nina", "#a855f7"], ["leo", "ethan", "#a855f7"], ["nina", "ethan", "#a855f7"], ["maya", "ethan", "#a855f7"],
  ["omar", "zoe", "#ff8a2b"], ["omar", "alex", "#ff8a2b"], ["omar", "mei", "#ff8a2b"], ["zoe", "mei", "#ff8a2b"], ["zoe", "alex", "#ff8a2b"], ["alex", "imani", "#ff8a2b"], ["mei", "imani", "#ff8a2b"],
  ["kai", "ava", "#42a5ff"], ["kai", "marcus", "#42a5ff"], ["ava", "marcus", "#42a5ff"], ["ava", "jules", "#42a5ff"], ["marcus", "jules", "#42a5ff"],
  ["ethan", "jules", "#ff4fac"], ["ethan", "jessica", "#ff4fac"], ["jules", "jessica", "#ff4fac"],
];

const MOBILE_GROUPS = [
  { color: "#a855f7", people: ["amara", "leo", "maya", "nina"], markets: [MARKETS[0], MARKETS[1]] },
  { color: "#ff8a2b", people: ["omar", "zoe", "alex", "mei", "imani"], markets: [MARKETS[2]] },
  { color: "#42a5ff", people: ["kai", "ava", "marcus"], markets: [MARKETS[3]] },
  { color: "#ff4fac", people: ["ethan", "jules", "jessica"], markets: [MARKETS[4]] },
];

function Avatar({ person, compact = false }: { person: Person; compact?: boolean }) {
  const backgroundPositionX = `${((person.cropX - 60) / (1536 - 120)) * 100}%`;
  const backgroundPositionY = `${((person.cropY - 60) / (1024 - 120)) * 100}%`;
  return <div
    role="img"
    aria-label={person.name}
    className={`${compact ? "h-12 w-12" : "h-[72px] w-[72px]"} shrink-0 rounded-full border-2 bg-[#0b0718] shadow-[0_0_18px_var(--avatar-glow)]`}
    style={{
      backgroundImage: "url('/home-network-sprite.png')",
      backgroundSize: "1280% auto",
      backgroundPosition: `${backgroundPositionX} ${backgroundPositionY}`,
      backgroundRepeat: "no-repeat",
      borderColor: person.color,
      "--avatar-glow": `${person.color}aa`,
    } as React.CSSProperties}
  />;
}

function MarketCard({ market, large = false }: { market: Market; large?: boolean }) {
  const no = 100 - market.yes;
  return <article
    className={`rounded-xl border bg-[#10071f]/95 p-3 shadow-[0_0_24px_rgba(0,0,0,0.55)] ${large ? "p-4" : ""}`}
    style={{ borderColor: `${market.color}aa`, boxShadow: `0 0 24px ${market.color}22` }}
  >
    <div className="mb-1 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wide" style={{ color: market.color }}><LockKeyhole size={10} /> Invited only</div>
    <h2 className={`${large ? "text-lg" : "text-sm"} whitespace-nowrap font-sans font-bold tracking-tight text-white`}>{market.title}</h2>
    <div className="my-2 flex items-center">
      {market.people.map((id, index) => {
        const person = PEOPLE.find((item) => item.id === id)!;
        return <div key={id} className={index ? "-ml-1.5" : ""}><Avatar person={person} compact /></div>;
      })}
      <span className="ml-1 text-[10px] text-white/80">+{market.extra}</span>
    </div>
    <div className="flex h-7 overflow-hidden rounded-md text-center font-sans text-[10px] font-bold text-white">
      <div className="flex items-center justify-center bg-gradient-to-r from-emerald-500/80 to-emerald-400/80" style={{ width: `${market.yes}%` }}>YES {market.yes}%</div>
      <div className="flex items-center justify-center bg-gradient-to-r from-pink-700/90 to-pink-500/80" style={{ width: `${no}%` }}>NO {no}%</div>
    </div>
  </article>;
}

function NetworkSvg() {
  const byId = Object.fromEntries(PEOPLE.map((person) => [person.id, person]));
  return <svg viewBox="0 0 1000 720" className="absolute inset-0 h-full w-full" aria-hidden="true">
    <defs>
      <filter id="network-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    </defs>
    <g fillOpacity="0.09" strokeWidth="2" filter="url(#network-glow)">
      <ellipse cx="310" cy="200" rx="260" ry="178" fill="#a855f7" stroke="#a855f7" />
      <ellipse cx="760" cy="205" rx="226" ry="175" fill="#ff8a2b" stroke="#ff8a2b" />
      <ellipse cx="220" cy="545" rx="212" ry="165" fill="#278cff" stroke="#42a5ff" />
      <ellipse cx="595" cy="530" rx="265" ry="176" fill="#ff4fac" stroke="#ff4fac" />
    </g>
    <g strokeWidth="1.6" strokeLinecap="round" opacity="0.95" filter="url(#network-glow)">
      {CONNECTIONS.map(([from, to, color]) => <line key={`${from}-${to}`} x1={byId[from].x} y1={byId[from].y} x2={byId[to].x} y2={byId[to].y} stroke={color} />)}
    </g>
  </svg>;
}

function DesktopNetwork() {
  return <div className="relative mx-auto aspect-[1000/720] w-full max-w-[1080px]">
    <NetworkSvg />
    {PEOPLE.map((person) => <div key={person.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${person.x / 10}%`, top: `${person.y / 7.2}%` }}><Avatar person={person} /></div>)}
    {MARKETS.map((market, index) => <div key={market.title} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${market.x / 10}%`, top: `${market.y / 7.2}%`, width: `${market.width / 10}%` }}><MarketCard market={market} large={index === 4} /></div>)}
  </div>;
}

function MobileNetwork() {
  return <div className="space-y-6 md:hidden">
    {MOBILE_GROUPS.map((group) => <section key={group.color} className="relative overflow-hidden rounded-[2rem] border bg-[#0b0417]/80 p-5" style={{ borderColor: group.color, boxShadow: `inset 0 0 50px ${group.color}18, 0 0 26px ${group.color}1f` }}>
      <div className="absolute left-10 right-10 top-[3.15rem] h-px" style={{ background: group.color, boxShadow: `0 0 10px ${group.color}` }} />
      <div className="relative z-10 flex items-center justify-around gap-2">
        {group.people.map((id) => <Avatar key={id} person={PEOPLE.find((person) => person.id === id)!} compact />)}
      </div>
      <div className="relative z-10 mx-auto mt-5 max-w-sm divide-y" style={{ borderColor: `${group.color}55` }}>
        {group.markets.map((market) => {
          const no = 100 - market.yes;
          return <article key={market.title} className="py-4 first:pt-2 last:pb-1">
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: group.color }}><LockKeyhole size={12} /> Invited only</div>
            <h2 className={`${market.title === "Alex like Jessica?" ? "text-xl" : "text-lg"} font-sans font-bold tracking-tight text-white`}>{market.title}</h2>
            <div className="mt-4 flex h-10 overflow-hidden rounded-lg text-center font-sans text-xs font-bold text-white">
              <div className="flex items-center justify-center bg-gradient-to-r from-emerald-500/80 to-emerald-400/80" style={{ width: `${market.yes}%` }}>YES {market.yes}%</div>
              <div className="flex items-center justify-center bg-gradient-to-r from-pink-700/90 to-pink-500/80" style={{ width: `${no}%` }}>NO {no}%</div>
            </div>
          </article>;
        })}
      </div>
    </section>)}
  </div>;
}

export function FriendsHome({ lang }: { lang: Language }) {
  return <main className="mx-auto w-full max-w-[1536px] px-4 py-10 sm:px-8 lg:px-10 lg:py-4">
    <div className="grid items-center gap-8 md:min-h-[calc(100vh-4rem)] md:grid-cols-[minmax(240px,0.34fr)_minmax(0,1fr)] md:gap-0">
      <header className="relative z-10 md:-mr-12 md:pl-1 lg:pl-2">
        <h1 className="max-w-[560px] font-sans text-[clamp(3rem,5.3vw,5.2rem)] font-black leading-[0.96] tracking-[-0.06em] text-white">
          {lang === "zh" ? <>你的私人<br /><span className="friends-gradient-text">预测派对。</span></> : <><span className="whitespace-nowrap">Your private</span><br /><span className="friends-gradient-text">prediction<br />party.</span></>}
        </h1>
        <p className="mt-5 max-w-sm text-sm leading-6 text-text-muted md:text-base">{lang === "zh" ? "只邀请你的朋友。选择立场，在链上结算。" : "Invite your friends. Pick a side. Settle onchain."}</p>
      </header>
      <div className="hidden min-w-0 md:block"><DesktopNetwork /></div>
    </div>
    <MobileNetwork />
  </main>;
}
