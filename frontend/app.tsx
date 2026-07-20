import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { FriendsHeader } from "./components/FriendsExoHeader";
import { RulesPage } from "./private-vault-rules";
import { CreatePrivateVault } from "./create-private-vault";
import { BrowsePrivateVault } from "./browse-private-vault";
import { PrivateVaultPage } from "./private-vault";
import { useWallet } from "./useWallet";
import type { Language } from "./types";

type Route = "play" | "create" | "browse" | "vault";

function routeFromPath(pathname: string): Route {
  if (pathname.endsWith("/create-private-vault.html")) return "create";
  if (pathname.endsWith("/browse-private-vault.html")) return "browse";
  if (pathname.endsWith("/private-vault.html")) return "vault";
  return "play";
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

  return <div className="friends-page min-h-screen text-text">
    <FriendsHeader
      lang={lang}
      onToggleLang={() => setLang((value) => value === "zh" ? "en" : "zh")}
      current={route}
      wallet={wallet}
      onNavigate={navigate}
    />
    {route === "play" && <RulesPage lang={lang} />}
    {route === "create" && <CreatePrivateVault lang={lang} wallet={wallet} onNavigate={navigate} />}
    {route === "browse" && <BrowsePrivateVault lang={lang} wallet={wallet} onNavigate={navigate} />}
    {route === "vault" && <PrivateVaultPage lang={lang} wallet={wallet} onNavigate={navigate} />}
  </div>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
