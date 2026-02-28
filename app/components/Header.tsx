"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= breakpoint);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);
  return isMobile;
}

interface HeaderProps {
  activePage: "dashboard" | "history" | "email";
  countdown?: number;
  lastRefresh?: Date | null;
  formatTime?: (iso: string) => string;
}

const NAV_ITEMS = [
  { href: "/", key: "dashboard", label: "🏠 Dashboard" },
  { href: "/history", key: "history", label: "📜 History" },
  { href: "/email", key: "email", label: "📧 Email" },
];

export default function Header({ activePage, countdown, lastRefresh, formatTime }: HeaderProps) {
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header
      style={{
        background: "#0A0A0A",
        borderBottom: "1px solid #1F1F1F",
        padding: isMobile ? "0 12px" : "0 24px",
        height: "60px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "8px" : "12px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="https://traqd.io/favicon.ico" alt="Traqd" width={28} height={28} style={{ borderRadius: "6px" }} />
        <Link href="/" style={{ textDecoration: "none" }}>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: isMobile ? "14px" : "16px", color: "#fff" }}>
            {isMobile ? (
              <>Casper <span style={{ color: "#86EFAC" }}>Ops</span></>
            ) : (
              <>Casper <span style={{ color: "#86EFAC" }}>Operations</span> Dashboard</>
            )}
          </span>
        </Link>
      </div>

      {isMobile ? (
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{ background: "none", border: "none", color: "#A0A0A0", fontSize: "22px", cursor: "pointer", padding: "4px 8px" }}
          >
            ☰
          </button>
          {menuOpen && (
            <div
              style={{
                position: "absolute",
                top: "40px",
                right: 0,
                background: "#0D0D0D",
                border: "1px solid #1F1F1F",
                borderRadius: "8px",
                padding: "8px 0",
                minWidth: "140px",
                zIndex: 200,
              }}
            >
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  style={{
                    display: "block",
                    padding: "8px 16px",
                    color: item.key === activePage ? "#86EFAC" : "#A0A0A0",
                    textDecoration: "none",
                    fontSize: "13px",
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: "12px", color: "#A0A0A0", fontFamily: "'Inter', sans-serif" }}>
          {NAV_ITEMS.map((item) =>
            item.key === activePage ? (
              <span key={item.key} style={{ color: "#86EFAC" }}>{item.label.split(" ")[1]}</span>
            ) : (
              <Link key={item.key} href={item.href} style={{ color: "#A0A0A0", textDecoration: "none" }}>
                {item.label.split(" ")[1]}
              </Link>
            )
          )}
          {countdown !== undefined && (
            <>
              <span style={{ color: "#1F1F1F" }}>|</span>
              <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#22C55E", display: "inline-block", animation: "pulse 2s infinite" }} />
                Live
              </span>
              <span>Refresh in {countdown}s</span>
              {lastRefresh && formatTime && (
                <span>Updated {formatTime(lastRefresh.toISOString())}</span>
              )}
            </>
          )}
        </div>
      )}
    </header>
  );
}
