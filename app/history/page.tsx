"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import Header from "../components/Header";
import { supabase } from "../lib/supabase";
import { useRealtimeSubscription } from "../hooks/useRealtimeSubscription";

interface PipelineHistoryEntry {
  id: number;
  pipeline_id: string;
  name: string;
  stages: string[];
  completed_stages: string[];
  started_at: string;
  completed_at: string;
  status: "complete" | "failed";
  duration: string | null;
  tasks: Array<{
    id: string;
    description: string;
    agentName: string;
    status: string;
    duration: string;
  }> | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  complete: "#22C55E",
  failed: "#EF4444",
};

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
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function calcDuration(startedAt: string, completedAt: string): string {
  const diff = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (diff < 0) return "-";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "<1m";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hrs}h ${remainMins}m` : `${hrs}h`;
}

function getDateLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: "9999px", fontSize: "11px", fontWeight: 500, background: `${color}1A`, border: `1px solid ${color}4D`, color, fontFamily: "'Inter', sans-serif" }}>
      {label}
    </span>
  );
}

function HistoryCard({ entry }: { entry: PipelineHistoryEntry }) {
  const [expanded, setExpanded] = useState(false);
  const statusColor = STATUS_COLORS[entry.status] || "#A0A0A0";
  const completedCount = entry.completed_stages.length;
  const totalStages = entry.stages.length;
  const displayDuration = (entry.duration && entry.duration !== "-") ? entry.duration : calcDuration(entry.started_at, entry.completed_at);

  return (
    <div style={{ background: "#0D0D0D", border: `1px solid ${entry.status === "complete" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`, borderRadius: "12px", overflow: "hidden", marginBottom: "10px" }}>
      <div onClick={() => setExpanded((e) => !e)} style={{ padding: "16px 20px", cursor: "pointer", userSelect: "none", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px", flexWrap: "wrap" }}>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: "15px", color: "#fff" }}>{entry.name}</span>
            <Badge label={entry.status.charAt(0).toUpperCase() + entry.status.slice(1)} color={statusColor} />
            <span style={{ fontSize: "11px", color: "#86EFAC", fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>⏱ {displayDuration}</span>
          </div>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
            {entry.stages.map((stage) => {
              const done = entry.completed_stages.includes(stage);
              return (
                <span key={stage} style={{ fontSize: "11px", color: done ? "#22C55E" : "#EF4444", fontFamily: "'Inter', sans-serif", background: done ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${done ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`, padding: "2px 8px", borderRadius: "4px", display: "flex", alignItems: "center", gap: "3px" }}>
                  {done ? "✓" : "✗"} {stage}
                </span>
              );
            })}
          </div>
          <div style={{ marginTop: "10px", display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "11px", color: "#555", fontFamily: "'Inter', sans-serif" }}>
            <span>Started: <span style={{ color: "#A0A0A0" }}>{formatDateTime(entry.started_at)}</span></span>
            <span>Ended: <span style={{ color: "#A0A0A0" }}>{formatDateTime(entry.completed_at)}</span></span>
            <span>{completedCount}/{totalStages} stages completed</span>
            <span style={{ color: "#444" }}>{timeAgo(entry.completed_at)}</span>
          </div>
        </div>
        <span style={{ color: "#555", fontSize: "14px", flexShrink: 0, marginTop: "2px" }}>{expanded ? "▾" : "▸"}</span>
      </div>
      {expanded && entry.tasks && entry.tasks.length > 0 && (
        <div style={{ borderTop: "1px solid #1F1F1F", padding: "16px 20px" }}>
          <div style={{ fontSize: "11px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: "#555", fontFamily: "'Inter', sans-serif", marginBottom: "10px" }}>Tasks ({entry.tasks.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {entry.tasks.map((task) => (
              <div key={task.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#111", border: "1px solid #1A1A1A", borderRadius: "8px", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0 }}>
                  <span style={{ color: task.status === "complete" ? "#22C55E" : "#EF4444", fontSize: "12px" }}>{task.status === "complete" ? "✓" : "✗"}</span>
                  <span style={{ fontSize: "13px", color: "#D0D0D0", fontFamily: "'Inter', sans-serif" }}>{task.description}</span>
                </div>
                <div style={{ display: "flex", gap: "10px", alignItems: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: "11px", color: "#555", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 }}>{task.agentName}</span>
                  {task.duration && <span style={{ fontSize: "11px", color: "#86EFAC", fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>{task.duration}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {expanded && (!entry.tasks || entry.tasks.length === 0) && (
        <div style={{ borderTop: "1px solid #1F1F1F", padding: "16px 20px", fontSize: "13px", color: "#555", fontFamily: "'Inter', sans-serif" }}>No task details recorded.</div>
      )}
    </div>
  );
}

export default function HistoryPage() {
  const [entries, setEntries] = useState<PipelineHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const CATEGORIES: Record<string, { label: string; icon: string; ids: string[] }> = {
    all: { label: "All", icon: "📋", ids: [] },
    content: { label: "Content", icon: "✍️", ids: ["draft-posts", "first-posts", "voice-research", "content-ops-build"] },
    research: { label: "Research", icon: "🔍", ids: ["ppir-vol2", "report-design"] },
    email: { label: "Email", icon: "📧", ids: ["email-catchup", "email3-send", "email-nurture", "email-images", "gravatar-setup"] },
    infrastructure: { label: "Infra", icon: "⚙️", ids: ["cron-setup", "dashboard-autoupdate", "dashboard-rebuild", "dashboard-global-header", "x-auth-setup", "x-reauth"] },
    ads: { label: "Ads", icon: "📢", ids: ["ad-scripts"] },
  };

  const PRIMARY_FILTERS = ["all", "content", "research", "email"];
  const MORE_FILTERS = ["infrastructure", "ads"];

  const fetchHistory = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("pipeline_history").select("*").order("completed_at", { ascending: false });
      if (error) throw error;
      setEntries((data || []) as PipelineHistoryEntry[]);
    } catch (e) {
      console.error("Failed to fetch history:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const { lastRefresh, formatTime } = useRealtimeSubscription(
    "pipeline_history",
    "*",
    fetchHistory
  );

  // Search + filter
  const searchFiltered = useMemo(() => {
    let result = entries;
    
    // Category filter
    if (filter !== "all") {
      const cat = CATEGORIES[filter];
      if (cat) result = result.filter((e) => cat.ids.includes(e.pipeline_id));
    }
    
    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((e) => {
        if (e.name.toLowerCase().includes(q)) return true;
        if (e.pipeline_id.toLowerCase().includes(q)) return true;
        if (e.tasks?.some((t) => t.description.toLowerCase().includes(q) || t.agentName.toLowerCase().includes(q))) return true;
        if (e.stages.some((s) => s.toLowerCase().includes(q))) return true;
        return false;
      });
    }
    
    return result;
  }, [entries, filter, search, CATEGORIES]);

  // Group by date
  const groupedEntries = useMemo(() => {
    const groups: { label: string; entries: PipelineHistoryEntry[] }[] = [];
    const map = new Map<string, PipelineHistoryEntry[]>();
    const labels: string[] = [];
    
    searchFiltered.forEach((entry) => {
      const dateKey = new Date(entry.completed_at).toDateString();
      const label = getDateLabel(entry.completed_at);
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
        labels.push(dateKey);
      }
      map.get(dateKey)!.push(entry);
    });
    
    labels.forEach((key) => {
      groups.push({ label: getDateLabel(map.get(key)![0].completed_at), entries: map.get(key)! });
    });
    
    return groups;
  }, [searchFiltered]);

  const completeCount = entries.filter((e) => e.status === "complete").length;
  const failedCount = entries.filter((e) => e.status === "failed").length;

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#fff" }}>
      <Header activePage="history" live lastRefresh={lastRefresh} formatTime={formatTime} />
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>

      <main style={{ maxWidth: "900px", margin: "0 auto", padding: "24px 16px" }}>
        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "24px" }}>
          {[
            { label: "Total Runs", value: entries.length, color: "#fff" },
            { label: "Completed", value: completeCount, color: "#22C55E" },
            { label: "Failed", value: failedCount, color: failedCount > 0 ? "#EF4444" : "#22C55E" },
          ].map((s) => (
            <div key={s.label} style={{ background: "#0D0D0D", border: "1px solid #1F1F1F", borderRadius: "12px", padding: "16px 20px" }}>
              <div style={{ fontSize: "11px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", color: "#A0A0A0", fontFamily: "'Inter', sans-serif", marginBottom: "6px" }}>{s.label}</div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "30px", color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Search bar */}
        <div style={{ marginBottom: "12px" }}>
          <input
            type="text"
            placeholder="Search pipelines, tasks, agents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              background: "#0D0D0D",
              border: "1px solid #1F1F1F",
              borderRadius: "10px",
              padding: "10px 16px",
              color: "#fff",
              fontSize: "13px",
              fontFamily: "'Inter', sans-serif",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Filter bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", position: "relative" }}>
          {PRIMARY_FILTERS.map((key) => {
            const cat = CATEGORIES[key];
            return (
              <button key={key} onClick={() => { setFilter(key); setShowMoreFilters(false); }} style={{ padding: "6px 14px", borderRadius: "9999px", fontSize: "13px", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 500, cursor: "pointer", border: filter === key ? "1px solid rgba(134,239,172,0.5)" : "1px solid #1F1F1F", background: filter === key ? "rgba(134,239,172,0.1)" : "transparent", color: filter === key ? "#86EFAC" : "#A0A0A0", transition: "all 0.15s ease" }}>
                {cat.icon} {cat.label}
              </button>
            );
          })}
          <div style={{ position: "relative" }}>
            <button onClick={() => setShowMoreFilters(!showMoreFilters)} style={{ padding: "6px 14px", borderRadius: "9999px", fontSize: "13px", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 500, cursor: "pointer", border: MORE_FILTERS.includes(filter) ? "1px solid rgba(134,239,172,0.5)" : "1px solid #1F1F1F", background: MORE_FILTERS.includes(filter) ? "rgba(134,239,172,0.1)" : "transparent", color: MORE_FILTERS.includes(filter) ? "#86EFAC" : "#A0A0A0", transition: "all 0.15s ease" }}>
              ••• More
            </button>
            {showMoreFilters && (
              <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, background: "#0D0D0D", border: "1px solid #1F1F1F", borderRadius: "12px", padding: "8px", zIndex: 50, minWidth: "160px", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
                {MORE_FILTERS.map((key) => {
                  const cat = CATEGORIES[key];
                  return (
                    <button key={key} onClick={() => { setFilter(key); setShowMoreFilters(false); }} style={{ display: "block", width: "100%", padding: "8px 12px", borderRadius: "8px", fontSize: "13px", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 500, cursor: "pointer", border: "none", background: filter === key ? "rgba(134,239,172,0.1)" : "transparent", color: filter === key ? "#86EFAC" : "#A0A0A0", textAlign: "left", transition: "all 0.15s ease" }}>
                      {cat.icon} {cat.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* History list grouped by date */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "48px", color: "#86EFAC", fontFamily: "'Space Grotesk', sans-serif", fontSize: "14px" }}>Loading history...</div>
        ) : groupedEntries.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px", color: "#A0A0A0", fontFamily: "'Inter', sans-serif", fontSize: "14px", background: "#0D0D0D", border: "1px solid #1F1F1F", borderRadius: "12px" }}>
            {search ? `No results for "${search}"` : "No pipeline history found"}
          </div>
        ) : (
          groupedEntries.map((group) => (
            <div key={group.label}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "20px 0 12px 0" }}>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: "13px", color: "#A0A0A0", textTransform: "uppercase", letterSpacing: "0.06em" }}>{group.label}</span>
                <div style={{ flex: 1, height: "1px", background: "#1F1F1F" }} />
                <span style={{ fontSize: "11px", color: "#555", fontFamily: "'Inter', sans-serif" }}>{group.entries.length} {group.entries.length === 1 ? "run" : "runs"}</span>
              </div>
              {group.entries.map((entry) => <HistoryCard key={entry.id} entry={entry} />)}
            </div>
          ))
        )}

        <div style={{ marginTop: "32px", paddingTop: "16px", borderTop: "1px solid #1F1F1F", textAlign: "center", fontSize: "12px", color: "#333", fontFamily: "'Inter', sans-serif" }}>
          Casper · Traqd CMO Operations · Pipeline History
        </div>
      </main>
    </div>
  );
}
