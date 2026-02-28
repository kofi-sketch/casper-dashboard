"use client";

import { useEffect, useState, useCallback } from "react";

interface DashboardState {
  lastUpdated: string;
  kpis: {
    activeAgents: number;
    tasksCompletedToday: number;
    currentPipelineStage: string;
    errorsToday: number;
  };
  pipeline: {
    stages: string[];
    currentStage: string;
    completedStages: string[];
  };
  activeTasks: Array<{
    id: string;
    agentName: string;
    taskDescription: string;
    status: "running" | "queued" | "paused";
    startedAt: string;
    estCompletion: string;
  }>;
  recentCompletions: Array<{
    id: string;
    agentName: string;
    taskDescription: string;
    completedAt: string;
    duration: string;
  }>;
  errorLog: Array<{
    id: string;
    timestamp: string;
    agent: string;
    error: string;
    severity: "error" | "warning" | "info";
  }>;
  systemStatus: Record<string, string>;
}

const STATUS_COLORS: Record<string, string> = {
  running: "#86EFAC",
  queued: "#A0A0A0",
  paused: "#F59E0B",
};

const STATUS_BG: Record<string, string> = {
  running: "rgba(134,239,172,0.1)",
  queued: "rgba(160,160,160,0.1)",
  paused: "rgba(245,158,11,0.1)",
};

const SEVERITY_COLORS: Record<string, string> = {
  error: "#EF4444",
  warning: "#F59E0B",
  info: "#86EFAC",
};

const SYSTEM_ICONS: Record<string, string> = {
  xApi: "𝕏",
  braveSearch: "🦁",
  elevenlabs: "🎙",
  vercel: "▲",
  supabase: "⚡",
  metaAds: "𝕄",
  email: "✉",
};

const SYSTEM_LABELS: Record<string, string> = {
  xApi: "X API",
  braveSearch: "Brave Search",
  elevenlabs: "ElevenLabs",
  vercel: "Vercel",
  supabase: "Supabase",
  metaAds: "Meta Ads",
  email: "Email",
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

function Card({ children, className = "", style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={className}
      style={{
        background: "#0D0D0D",
        border: "1px solid #1F1F1F",
        borderRadius: "12px",
        padding: "20px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: "'Space Grotesk', sans-serif",
        fontWeight: 700,
        fontSize: "14px",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "#A0A0A0",
        marginBottom: "16px",
      }}
    >
      {children}
    </h2>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: "9999px",
        fontSize: "11px",
        fontWeight: 500,
        background: `${color}1A`,
        border: `1px solid ${color}4D`,
        color: color,
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {label}
    </span>
  );
}

export default function Dashboard() {
  const [state, setState] = useState<DashboardState | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(30);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`/state.json?t=${Date.now()}`);
      const data = await res.json();
      setState(data);
      setLastRefresh(new Date());
      setCountdown(30);
    } catch (e) {
      console.error("Failed to fetch state:", e);
    }
  }, []);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 30000);
    return () => clearInterval(interval);
  }, [fetchState]);

  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : 30));
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  if (!state) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000",
          color: "#86EFAC",
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: "16px",
        }}
      >
        Loading Casper Operations...
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#fff" }}>
      {/* Header */}
      <header
        style={{
          background: "#0A0A0A",
          borderBottom: "1px solid #1F1F1F",
          padding: "0 24px",
          height: "60px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://traqd.io/favicon.ico"
            alt="Traqd"
            width={28}
            height={28}
            style={{ borderRadius: "6px" }}
          />
          <span
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: "16px",
              color: "#fff",
            }}
          >
            Casper{" "}
            <span style={{ color: "#86EFAC" }}>Operations</span>{" "}
            Dashboard
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            fontSize: "12px",
            color: "#A0A0A0",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "#22C55E",
                display: "inline-block",
                animation: "pulse 2s infinite",
              }}
            />
            Live
          </span>
          <span>Refresh in {countdown}s</span>
          {lastRefresh && (
            <span style={{ display: "none" }} className="sm-show">
              Updated {formatTime(lastRefresh.toISOString())}
            </span>
          )}
        </div>
      </header>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .grid-kpi {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        @media (min-width: 768px) {
          .grid-kpi {
            grid-template-columns: repeat(4, 1fr);
          }
        }
        .table-scroll {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .system-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }
        @media (min-width: 480px) {
          .system-grid {
            grid-template-columns: repeat(4, 1fr);
          }
        }
        @media (min-width: 768px) {
          .system-grid {
            grid-template-columns: repeat(7, 1fr);
          }
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-family: 'Inter', sans-serif;
          font-size: 13px;
        }
        th {
          text-align: left;
          padding: 8px 12px;
          color: #A0A0A0;
          font-size: 11px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          border-bottom: 1px solid #1F1F1F;
          white-space: nowrap;
        }
        td {
          padding: 12px;
          border-bottom: 1px solid #111111;
          color: #fff;
          vertical-align: middle;
        }
        tr:last-child td {
          border-bottom: none;
        }
        tr:hover td {
          background: rgba(255,255,255,0.02);
        }
      `}</style>

      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px 16px" }}>
        {/* Row 1: KPI Cards */}
        <div className="grid-kpi" style={{ marginBottom: "16px" }}>
          <Card>
            <div style={{ color: "#A0A0A0", fontSize: "11px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px", fontFamily: "'Inter', sans-serif" }}>
              Active Agents
            </div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "36px", color: "#86EFAC" }}>
              {state.kpis.activeAgents}
            </div>
            <div style={{ fontSize: "12px", color: "#A0A0A0", marginTop: "4px", fontFamily: "'Inter', sans-serif" }}>agents running</div>
          </Card>

          <Card>
            <div style={{ color: "#A0A0A0", fontSize: "11px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px", fontFamily: "'Inter', sans-serif" }}>
              Completed Today
            </div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "36px", color: "#fff" }}>
              {state.kpis.tasksCompletedToday}
            </div>
            <div style={{ fontSize: "12px", color: "#A0A0A0", marginTop: "4px", fontFamily: "'Inter', sans-serif" }}>tasks finished</div>
          </Card>

          <Card>
            <div style={{ color: "#A0A0A0", fontSize: "11px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px", fontFamily: "'Inter', sans-serif" }}>
              Pipeline Stage
            </div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "22px", color: "#86EFAC", marginTop: "6px" }}>
              {state.kpis.currentPipelineStage}
            </div>
            <div style={{ fontSize: "12px", color: "#A0A0A0", marginTop: "4px", fontFamily: "'Inter', sans-serif" }}>current focus</div>
          </Card>

          <Card>
            <div style={{ color: "#A0A0A0", fontSize: "11px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px", fontFamily: "'Inter', sans-serif" }}>
              Errors Today
            </div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "36px", color: state.kpis.errorsToday > 0 ? "#EF4444" : "#22C55E" }}>
              {state.kpis.errorsToday}
            </div>
            <div style={{ fontSize: "12px", color: "#A0A0A0", marginTop: "4px", fontFamily: "'Inter', sans-serif" }}>
              {state.kpis.errorsToday === 0 ? "all clear" : "need attention"}
            </div>
          </Card>
        </div>

        {/* Row 2: Pipeline */}
        <Card style={{ marginBottom: "16px" }}>
          <SectionTitle>Pipeline</SectionTitle>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0",
              overflowX: "auto",
              paddingBottom: "4px",
            }}
          >
            {state.pipeline.stages.map((stage, i) => {
              const isCompleted = state.pipeline.completedStages.includes(stage);
              const isCurrent = stage === state.pipeline.currentStage;
              const isUpcoming = !isCompleted && !isCurrent;
              const isLast = i === state.pipeline.stages.length - 1;

              return (
                <div key={stage} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <div
                      style={{
                        padding: "8px 16px",
                        borderRadius: "9999px",
                        fontSize: "12px",
                        fontWeight: isCurrent ? 700 : 500,
                        fontFamily: "'Inter', sans-serif",
                        whiteSpace: "nowrap",
                        background: isCurrent
                          ? "rgba(134,239,172,0.15)"
                          : isCompleted
                          ? "rgba(34,197,94,0.08)"
                          : "rgba(255,255,255,0.04)",
                        border: isCurrent
                          ? "1px solid rgba(134,239,172,0.5)"
                          : isCompleted
                          ? "1px solid rgba(34,197,94,0.3)"
                          : "1px solid #1F1F1F",
                        color: isCurrent ? "#86EFAC" : isCompleted ? "#22C55E" : "#A0A0A0",
                        transition: "all 0.2s",
                      }}
                    >
                      {isCompleted && <span style={{ marginRight: "4px" }}>✓</span>}
                      {stage}
                    </div>
                    {isCurrent && (
                      <div
                        style={{
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          background: "#86EFAC",
                          animation: "pulse 2s infinite",
                        }}
                      />
                    )}
                  </div>
                  {!isLast && (
                    <div
                      style={{
                        width: "32px",
                        height: "1px",
                        background: isCompleted ? "#22C55E" : "#1F1F1F",
                        margin: "0 4px",
                        flexShrink: 0,
                        marginBottom: isCurrent ? "14px" : "0",
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Row 3: Active Tasks */}
        <Card style={{ marginBottom: "16px" }}>
          <SectionTitle>Active Tasks</SectionTitle>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Task</th>
                  <th>Status</th>
                  <th>Started</th>
                  <th>Est. Done</th>
                </tr>
              </thead>
              <tbody>
                {state.activeTasks.map((task) => (
                  <tr key={task.id}>
                    <td>
                      <span
                        style={{
                          fontFamily: "'Space Grotesk', sans-serif",
                          fontWeight: 600,
                          fontSize: "13px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {task.agentName}
                      </span>
                    </td>
                    <td style={{ maxWidth: "300px", color: "#D0D0D0" }}>
                      {task.taskDescription}
                    </td>
                    <td>
                      <Badge
                        label={task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                        color={STATUS_COLORS[task.status] || "#A0A0A0"}
                      />
                    </td>
                    <td style={{ color: "#A0A0A0", whiteSpace: "nowrap" }}>
                      {formatTime(task.startedAt)}
                    </td>
                    <td style={{ color: "#A0A0A0", whiteSpace: "nowrap" }}>
                      {formatTime(task.estCompletion)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Row 4: Recent Completions */}
        <Card style={{ marginBottom: "16px" }}>
          <SectionTitle>Recent Completions</SectionTitle>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Task</th>
                  <th>Completed</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {state.recentCompletions.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span
                        style={{
                          fontFamily: "'Space Grotesk', sans-serif",
                          fontWeight: 600,
                          fontSize: "13px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.agentName}
                      </span>
                    </td>
                    <td style={{ color: "#D0D0D0", maxWidth: "300px" }}>
                      {item.taskDescription}
                    </td>
                    <td style={{ color: "#A0A0A0", whiteSpace: "nowrap", fontSize: "12px" }}>
                      {timeAgo(item.completedAt)}
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: "12px",
                          color: "#86EFAC",
                          fontFamily: "'Inter', sans-serif",
                          fontWeight: 500,
                        }}
                      >
                        {item.duration}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Row 5: Error Log */}
        <Card style={{ marginBottom: "16px" }}>
          <SectionTitle>Error Log</SectionTitle>
          {state.errorLog.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "32px",
                color: "#22C55E",
                fontSize: "14px",
                fontFamily: "'Inter', sans-serif",
              }}
            >
              ✓ No errors — all systems clean
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {state.errorLog.map((err) => (
                <div
                  key={err.id}
                  style={{
                    background: "#111",
                    border: `1px solid ${err.severity === "error" ? "rgba(239,68,68,0.3)" : err.severity === "warning" ? "rgba(245,158,11,0.3)" : "rgba(134,239,172,0.3)"}`,
                    borderRadius: "8px",
                    padding: "12px 16px",
                    display: "flex",
                    gap: "12px",
                    alignItems: "flex-start",
                  }}
                >
                  <span
                    style={{
                      fontSize: "16px",
                      flexShrink: 0,
                      marginTop: "1px",
                    }}
                  >
                    {err.severity === "error" ? "🔴" : err.severity === "warning" ? "🟡" : "🟢"}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        alignItems: "center",
                        marginBottom: "4px",
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "'Space Grotesk', sans-serif",
                          fontWeight: 600,
                          fontSize: "13px",
                          color: "#fff",
                        }}
                      >
                        {err.agent}
                      </span>
                      <span style={{ fontSize: "11px", color: "#A0A0A0", fontFamily: "'Inter', sans-serif" }}>
                        {formatDateTime(err.timestamp)}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "13px",
                        color: SEVERITY_COLORS[err.severity],
                        fontFamily: "'Inter', sans-serif",
                        lineHeight: "1.5",
                      }}
                    >
                      {err.error}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Footer: System Status */}
        <Card>
          <SectionTitle>System Status</SectionTitle>
          <div className="system-grid">
            {Object.entries(state.systemStatus).map(([key, status]) => (
              <div
                key={key}
                style={{
                  background: "#111",
                  border: `1px solid ${status === "connected" ? "rgba(34,197,94,0.2)" : status === "degraded" ? "rgba(245,158,11,0.2)" : "rgba(239,68,68,0.2)"}`,
                  borderRadius: "8px",
                  padding: "10px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: "18px" }}>{SYSTEM_ICONS[key]}</span>
                <span
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: "11px",
                    fontWeight: 500,
                    color: "#A0A0A0",
                    textAlign: "center",
                  }}
                >
                  {SYSTEM_LABELS[key]}
                </span>
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "10px",
                    fontFamily: "'Inter', sans-serif",
                    color:
                      status === "connected"
                        ? "#22C55E"
                        : status === "degraded"
                        ? "#F59E0B"
                        : "#EF4444",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  <span
                    style={{
                      width: "5px",
                      height: "5px",
                      borderRadius: "50%",
                      background:
                        status === "connected"
                          ? "#22C55E"
                          : status === "degraded"
                          ? "#F59E0B"
                          : "#EF4444",
                      animation: status === "connected" ? "pulse 2s infinite" : "none",
                    }}
                  />
                  {status}
                </span>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: "20px",
              paddingTop: "16px",
              borderTop: "1px solid #1F1F1F",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: "#A0A0A0" }}>
              Casper · Traqd CMO Operations · v1.0
            </span>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: "#A0A0A0" }}>
              State updated {timeAgo(state.lastUpdated)}
            </span>
          </div>
        </Card>
      </main>
    </div>
  );
}
