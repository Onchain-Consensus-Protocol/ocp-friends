import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { FriendsHeader } from "./components/FriendsExoHeader";
import { RulesPage } from "./private-vault-rules";
import { CreatePrivateVault } from "./create-private-vault";
import { BrowsePrivateVault } from "./browse-private-vault";
import { PrivateVaultPage } from "./private-vault";
import { FriendsHome } from "./friends-home";
import { useWallet } from "./useWallet";
import type { Language } from "./types";

type Route = "home" | "play" | "create" | "browse" | "vault";

function routeFromPath(pathname: string): Route {
  if (pathname === "/" || pathname.endsWith("/index.html")) return "home";
  if (pathname.endsWith("/friends-market-rules.html")) return "play";
  if (pathname.endsWith("/create-friends-market.html")) return "create";
  if (pathname.endsWith("/browse-friends-market.html")) return "browse";
  if (pathname.endsWith("/friends-market.html")) return "vault";
  return "home";
}

function initialLanguage(): Language {
  const requested = new URLSearchParams(window.location.search).get("lang");
  if (requested === "en" || requested === "zh") return requested;
  return window.localStorage.getItem("friends-language") === "zh" ? "zh" : "en";
}

function App() {
  const wallet = useWallet();
  const [lang, setLang] = useState<Language>(initialLanguage);
  const [route, setRoute] = useState<Route>(() => routeFromPath(window.location.pathname));

  useEffect(() => {
    const onPopState = () => setRoute(routeFromPath(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    window.localStorage.setItem("friends-language", lang);
  }, [lang]);

  useEffect(() => {
    const titles: Record<Route, string> = {
      home: "OCP/Friends — Your private prediction party.",
      play: "OCP/Friends — How to Play",
      create: "Create Market — OCP/Friends",
      browse: "Browse Private Markets — OCP/Friends",
      vault: "Private Market — OCP/Friends",
    };
    document.title = titles[route];
  }, [route]);

  const navigate = (href: string) => {
    const next = new URL(href, window.location.origin);
    window.history.pushState({}, "", `${next.pathname}${next.search}${next.hash}`);
    setRoute(routeFromPath(next.pathname));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return <div className="friends-page min-h-screen pb-20 text-text md:pb-0">
    <FriendsHeader
      lang={lang}
      onToggleLang={() => setLang((value) => value === "zh" ? "en" : "zh")}
      current={route}
      wallet={wallet}
      onNavigate={navigate}
    />
    {route === "home" && <FriendsHome lang={lang} />}
    {route === "play" && <RulesPage lang={lang} />}
    {route === "create" && <CreatePrivateVault lang={lang} wallet={wallet} onNavigate={navigate} />}
    {route === "browse" && <BrowsePrivateVault lang={lang} wallet={wallet} onNavigate={navigate} />}
    {route === "vault" && <PrivateVaultPage lang={lang} wallet={wallet} onNavigate={navigate} />}
  </div>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
