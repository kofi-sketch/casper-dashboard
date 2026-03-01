"use client";

import { useState, useEffect, ReactNode } from "react";

const PASSWORD = "traqd2026";
const STORAGE_KEY = "casper_auth";

export default function AuthGate({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    setAuthenticated(stored === "1");
  }, []);

  if (authenticated === null) return null; // SSR safe

  if (authenticated) return <>{children}</>;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input === PASSWORD) {
      localStorage.setItem(STORAGE_KEY, "1");
      setAuthenticated(true);
    } else {
      setError(true);
      setShake(true);
      setInput("");
      setTimeout(() => setShake(false), 500);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div
        style={{
          background: "#0D0D0D",
          border: "1px solid #1F1F1F",
          borderRadius: "16px",
          padding: "40px 36px",
          width: "100%",
          maxWidth: "360px",
          textAlign: "center",
          animation: shake ? "shake 0.4s ease" : "none",
        }}
      >
        <div style={{ fontSize: "28px", marginBottom: "8px" }}>👻</div>
        <h1
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: "20px",
            color: "#fff",
            margin: "0 0 4px 0",
          }}
        >
          Casper Operations
        </h1>
        <p
          style={{
            fontSize: "12px",
            color: "#555",
            marginBottom: "28px",
          }}
        >
          Enter access password to continue
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError(false);
            }}
            placeholder="Password"
            autoFocus
            style={{
              width: "100%",
              background: "#111",
              border: `1px solid ${error ? "#EF4444" : "#1F1F1F"}`,
              borderRadius: "8px",
              padding: "12px 14px",
              color: "#fff",
              fontSize: "14px",
              fontFamily: "'Inter', sans-serif",
              outline: "none",
              boxSizing: "border-box",
              marginBottom: "12px",
              transition: "border-color 0.2s",
            }}
          />
          {error && (
            <div
              style={{
                fontSize: "12px",
                color: "#EF4444",
                marginBottom: "12px",
              }}
            >
              Incorrect password
            </div>
          )}
          <button
            type="submit"
            style={{
              width: "100%",
              background: "#86EFAC",
              color: "#000",
              border: "none",
              borderRadius: "8px",
              padding: "12px",
              fontSize: "14px",
              fontWeight: 600,
              fontFamily: "'Space Grotesk', sans-serif",
              cursor: "pointer",
            }}
          >
            Unlock
          </button>
        </form>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}
