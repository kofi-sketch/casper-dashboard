"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import Header from "../components/Header";

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

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

interface Subscriber {
  id: string;
  name: string;
  email: string;
  signup_date: string;
  current_stage: number;
  status: "active" | "paused" | "completed";
  created_at: string;
}

interface EmailSend {
  id: string;
  subscriber_id: string;
  email_number: number;
  sent_at: string;
  status: "sent" | "failed";
}

const STAGE_LABELS = [
  "Welcome",
  "Pain Point",
  "Solution Intro",
  "Social Proof",
  "Feature Deep Dive",
  "Objection Handling",
  "Urgency/Scarcity",
  "Final CTA",
];

const STATUS_COLORS: Record<string, string> = {
  active: "#86EFAC",
  paused: "#F59E0B",
  completed: "#A0A0A0",
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function EmailPage() {
  const isMobile = useIsMobile();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [sends, setSends] = useState<EmailSend[]>([]);
  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [subRes, sendRes] = await Promise.all([
      getSupabase().from("email_subscribers").select("*").order("signup_date", { ascending: false }),
      getSupabase().from("email_sends").select("*").order("sent_at", { ascending: false }),
    ]);
    if (subRes.data) setSubscribers(subRes.data);
    if (sendRes.data) setSends(sendRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const updateStatus = async (id: string, status: string) => {
    await getSupabase().from("email_subscribers").update({ status }).eq("id", id);
    fetchData();
  };

  const advanceStage = async (sub: Subscriber) => {
    if (sub.current_stage >= 8) return;
    const newStage = sub.current_stage + 1;
    const newStatus = newStage >= 8 ? "completed" : sub.status;
    await getSupabase().from("email_subscribers").update({ current_stage: newStage, status: newStatus }).eq("id", sub.id);
    await getSupabase().from("email_sends").insert({ subscriber_id: sub.id, email_number: sub.current_stage, status: "sent" });
    fetchData();
  };

  // Computed
  const totalSent = sends.filter((s) => s.status === "sent").length;
  const activeCount = subscribers.filter((s) => s.status === "active").length;
  const completedCount = subscribers.filter((s) => s.status === "completed").length;

  const stageCounts = Array.from({ length: 8 }, (_, i) =>
    subscribers.filter((s) => s.current_stage === i + 1 && s.status === "active").length
  );
  const maxStageCount = Math.max(...stageCounts, 1);

  const filtered = subscribers.filter((s) => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.email.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStage !== null && s.current_stage !== filterStage) return false;
    if (filterStatus && s.status !== filterStatus) return false;
    return true;
  });

  const subscriberSends = (id: string) => sends.filter((s) => s.subscriber_id === id);

  const lastSendFor = (id: string) => {
    const ss = subscriberSends(id);
    return ss.length > 0 ? ss[0] : null;
  };

  const recentActivity = sends.slice(0, 10);

  const cardStyle: React.CSSProperties = {
    background: "#0D0D0D",
    border: "1px solid #1F1F1F",
    borderRadius: "12px",
    padding: "20px",
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#000", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "#A0A0A0", fontFamily: "'Inter', sans-serif" }}>Loading…</span>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#fff" }}>
      <Header activePage="email" />

      <main style={{ padding: isMobile ? "12px" : "24px", maxWidth: "1200px", margin: "0 auto" }}>
        {/* KPI Row */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: isMobile ? "10px" : "16px", marginBottom: "24px" }}>
          {[
            { label: "Total Subscribers", value: subscribers.length, color: "#FFFFFF" },
            { label: "Emails Sent", value: totalSent, color: "#86EFAC" },
            { label: "Active in Sequence", value: activeCount, color: "#86EFAC" },
            { label: "Completed Sequence", value: completedCount, color: "#A0A0A0" },
          ].map((kpi) => (
            <div key={kpi.label} style={cardStyle}>
              <div style={{ fontSize: "11px", color: "#A0A0A0", fontFamily: "'Inter', sans-serif", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {kpi.label}
              </div>
              <div style={{ fontSize: "28px", fontWeight: 700, color: kpi.color, fontFamily: "'Space Grotesk', sans-serif" }}>
                {kpi.value}
              </div>
            </div>
          ))}
        </div>

        {/* Funnel Visualization */}
        <div style={{ ...cardStyle, marginBottom: "24px" }}>
          <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "14px", margin: "0 0 16px 0" }}>
            Email Sequence Funnel
          </h3>
          <div style={{ display: "flex", gap: "8px", alignItems: "flex-end", height: "120px" }}>
            {stageCounts.map((count, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "14px", fontWeight: 700, color: "#fff", fontFamily: "'Space Grotesk', sans-serif" }}>
                  {count}
                </span>
                <div
                  style={{
                    width: "100%",
                    height: `${Math.max((count / maxStageCount) * 80, 4)}px`,
                    background: count > 0 ? "#86EFAC" : "#1F1F1F",
                    borderRadius: "4px 4px 0 0",
                    transition: "height 0.3s",
                  }}
                />
                <span style={{ fontSize: isMobile ? "8px" : "10px", color: "#A0A0A0", fontFamily: "'Inter', sans-serif", textAlign: "center", lineHeight: "1.2" }}>
                  {isMobile ? `${i + 1}` : `${i + 1}. ${STAGE_LABELS[i]}`}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 300px", gap: isMobile ? "16px" : "24px" }}>
          {/* Subscriber Table */}
          <div style={{ ...cardStyle, ...(isMobile ? { overflowX: "auto" as const } : {}) }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
              <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "14px", margin: 0 }}>
                Subscribers
              </h3>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input
                  type="text"
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    background: "#000",
                    border: "1px solid #1F1F1F",
                    borderRadius: "6px",
                    padding: "6px 10px",
                    color: "#fff",
                    fontSize: "12px",
                    fontFamily: "'Inter', sans-serif",
                    outline: "none",
                    width: "140px",
                  }}
                />
                <select
                  value={filterStage ?? ""}
                  onChange={(e) => setFilterStage(e.target.value ? Number(e.target.value) : null)}
                  style={{ background: "#000", border: "1px solid #1F1F1F", borderRadius: "6px", padding: "6px 8px", color: "#A0A0A0", fontSize: "12px", fontFamily: "'Inter', sans-serif" }}
                >
                  <option value="">All Stages</option>
                  {STAGE_LABELS.map((l, i) => (
                    <option key={i} value={i + 1}>{i + 1}. {l}</option>
                  ))}
                </select>
                <select
                  value={filterStatus ?? ""}
                  onChange={(e) => setFilterStatus(e.target.value || null)}
                  style={{ background: "#000", border: "1px solid #1F1F1F", borderRadius: "6px", padding: "6px 8px", color: "#A0A0A0", fontSize: "12px", fontFamily: "'Inter', sans-serif" }}
                >
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>

            {/* Table Header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr 0.6fr 0.5fr 0.9fr" : "1.2fr 1.5fr 0.8fr 0.8fr 0.7fr 1fr",
                gap: "8px",
                padding: "8px 12px",
                fontSize: "10px",
                color: "#A0A0A0",
                fontFamily: "'Inter', sans-serif",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                borderBottom: "1px solid #1F1F1F",
                minWidth: isMobile ? "0" : undefined,
              }}
            >
              <span>Name</span>
              {!isMobile && <span>Email</span>}
              <span>Stage</span>
              {!isMobile && <span>Signed Up</span>}
              <span>Status</span>
              <span>Actions</span>
            </div>

            {filtered.map((sub) => {
              const lastSend = lastSendFor(sub.id);
              const isExpanded = expandedId === sub.id;
              const subSends = subscriberSends(sub.id);

              return (
                <div key={sub.id}>
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : sub.id)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: isMobile ? "1fr 0.6fr 0.5fr 0.9fr" : "1.2fr 1.5fr 0.8fr 0.8fr 0.7fr 1fr",
                      gap: "8px",
                      padding: "10px 12px",
                      fontSize: isMobile ? "11px" : "12px",
                      fontFamily: "'Inter', sans-serif",
                      borderBottom: "1px solid #0D0D0D",
                      cursor: "pointer",
                      background: isExpanded ? "#111" : "transparent",
                      transition: "background 0.15s",
                    }}
                  >
                    <span style={{ color: "#fff", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub.name}</span>
                    {!isMobile && <span style={{ color: "#A0A0A0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub.email}</span>}
                    <span>
                      <span style={{
                        background: "#86EFAC20",
                        color: "#86EFAC",
                        padding: "2px 8px",
                        borderRadius: "10px",
                        fontSize: "11px",
                        fontWeight: 600,
                      }}>
                        {sub.current_stage}/8
                      </span>
                    </span>
                    {!isMobile && <span style={{ color: "#A0A0A0" }}>{new Date(sub.signup_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
                    <span style={{ color: STATUS_COLORS[sub.status], fontSize: "11px", fontWeight: 500, textTransform: "capitalize" }}>
                      {sub.status}
                    </span>
                    <div style={{ display: "flex", gap: "4px" }} onClick={(e) => e.stopPropagation()}>
                      {sub.status === "active" && (
                        <>
                          <button
                            onClick={() => advanceStage(sub)}
                            style={{
                              background: "#86EFAC20",
                              color: "#86EFAC",
                              border: "none",
                              borderRadius: "4px",
                              padding: "3px 8px",
                              fontSize: "10px",
                              cursor: "pointer",
                              fontFamily: "'Inter', sans-serif",
                            }}
                          >
                            Send Next
                          </button>
                          <button
                            onClick={() => updateStatus(sub.id, "paused")}
                            style={{
                              background: "#F59E0B20",
                              color: "#F59E0B",
                              border: "none",
                              borderRadius: "4px",
                              padding: "3px 8px",
                              fontSize: "10px",
                              cursor: "pointer",
                              fontFamily: "'Inter', sans-serif",
                            }}
                          >
                            Pause
                          </button>
                        </>
                      )}
                      {sub.status === "paused" && (
                        <button
                          onClick={() => updateStatus(sub.id, "active")}
                          style={{
                            background: "#86EFAC20",
                            color: "#86EFAC",
                            border: "none",
                            borderRadius: "4px",
                            padding: "3px 8px",
                            fontSize: "10px",
                            cursor: "pointer",
                            fontFamily: "'Inter', sans-serif",
                          }}
                        >
                          Resume
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div style={{ padding: "12px 24px", background: "#0A0A0A", borderBottom: "1px solid #1F1F1F" }}>
                      <div style={{ fontSize: "11px", color: "#A0A0A0", fontFamily: "'Inter', sans-serif", marginBottom: "8px" }}>
                        Send History — {subSends.length} email{subSends.length !== 1 ? "s" : ""} sent
                      </div>
                      {subSends.length === 0 ? (
                        <div style={{ fontSize: "11px", color: "#555", fontFamily: "'Inter', sans-serif" }}>No emails sent yet</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          {subSends.map((s) => (
                            <div key={s.id} style={{ display: "flex", gap: "12px", fontSize: "11px", fontFamily: "'Inter', sans-serif" }}>
                              <span style={{ color: "#86EFAC" }}>Email #{s.email_number}</span>
                              <span style={{ color: "#A0A0A0" }}>{STAGE_LABELS[s.email_number - 1]}</span>
                              <span style={{ color: "#555" }}>{timeAgo(s.sent_at)}</span>
                              <span style={{ color: s.status === "sent" ? "#86EFAC" : "#EF4444" }}>{s.status}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {lastSend && (
                        <div style={{ marginTop: "8px", fontSize: "10px", color: "#555", fontFamily: "'Inter', sans-serif" }}>
                          Last sent: {timeAgo(lastSend.sent_at)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div style={{ padding: "24px", textAlign: "center", color: "#555", fontSize: "12px", fontFamily: "'Inter', sans-serif" }}>
                No subscribers found
              </div>
            )}
          </div>

          {/* Activity Feed */}
          <div style={cardStyle}>
            <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "14px", margin: "0 0 16px 0" }}>
              Recent Activity
            </h3>
            {recentActivity.length === 0 ? (
              <div style={{ fontSize: "12px", color: "#555", fontFamily: "'Inter', sans-serif" }}>No activity yet</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {recentActivity.map((send) => {
                  const sub = subscribers.find((s) => s.id === send.subscriber_id);
                  return (
                    <div key={send.id} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <div style={{ fontSize: "12px", fontFamily: "'Inter', sans-serif" }}>
                        <span style={{ color: "#fff", fontWeight: 500 }}>{sub?.name ?? "Unknown"}</span>
                        <span style={{ color: "#A0A0A0" }}> → Email #{send.email_number}</span>
                      </div>
                      <div style={{ fontSize: "10px", color: "#555", fontFamily: "'Inter', sans-serif" }}>
                        {STAGE_LABELS[send.email_number - 1]} · {timeAgo(send.sent_at)} · <span style={{ color: send.status === "sent" ? "#86EFAC" : "#EF4444" }}>{send.status}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
