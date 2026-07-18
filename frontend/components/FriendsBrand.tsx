import React from "react";

export function FriendsBrand({ gradient = false }: { gradient?: boolean }) {
  return <span style={{
    display: "inline-block",
    fontFamily: "'Exo 2', sans-serif",
    fontWeight: 800,
    fontSize: "1em",
    letterSpacing: "-0.03em",
    lineHeight: 1,
    backgroundImage: gradient ? "linear-gradient(100deg, #ff7628 5%, #ff3cac 52%, #a56cff 95%)" : undefined,
    backgroundClip: gradient ? "text" : undefined,
    WebkitBackgroundClip: gradient ? "text" : undefined,
    color: gradient ? "transparent" : undefined,
    transform: "translateY(-0.09em) scaleY(1.16)",
    transformOrigin: "center 55%",
  }}>Friends</span>;
}
