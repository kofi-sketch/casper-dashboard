"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Header from "../components/Header";
import { supabase } from "../lib/supabase";
import { useRealtimeSubscription } from "../hooks/useRealtimeSubscription";


interface ContentPost {
  id: string;
  account: "@gettraqd" | "@igobykofi";
  content: string;
  scheduled_at: string | null;
  posted_at: string | null;
  status: "scheduled" | "posted" | "draft";
  post_id: string | null;
  engagement_metrics: {
    likes?: number;
    replies?: number;
    reposts?: number;
    impressions?: number;
    followers_snapshot?: number;
  } | null;
}

interface ContentResearch {
  id: string;
  author_handle: string;
  author_followers: number;
  post_preview: string;
  post_url: string;
  engagement_score: number;
  found_at: string;
  status: "new" | "queued" | "ignored";
}

interface ContentReply {
  id: string;
  target_post_url: string;
  target_author: string;
  suggested_reply: string;
  account: "@gettraqd" | "@igobykofi";
  status: "queued" | "sent" | "skipped";
  sent_at: string | null;
}

interface TargetAccount {
  id: string;
  handle: string;
  followers: number;
  niche: string;
  last_engaged_at: string | null;
}

interface GrowthPoint {
  label: string;
  gettraqd: number;
  igobykofi: number;
  target: number;
}

const ACCOUNT_HANDLES = ["@gettraqd", "@igobykofi"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeAccount(value: unknown): ContentPost["account"] {
  return value === "@igobykofi" ? "@igobykofi" : "@gettraqd";
}

function normalizePostStatus(value: unknown): ContentPost["status"] {
  return value === "scheduled" || value === "posted" || value === "draft" ? value : "draft";
}

function normalizeResearchStatus(value: unknown): ContentResearch["status"] {
  return value === "new" || value === "queued" || value === "ignored" ? value : "new";
}

function normalizeReplyStatus(value: unknown): ContentReply["status"] {
  return value === "queued" || value === "sent" || value === "skipped" ? value : "queued";
}

function normalizePost(row: unknown, index: number): ContentPost | null {
  if (!isRecord(row)) return null;
  const engagement = isRecord(row.engagement_metrics) ? row.engagement_metrics : null;
  return {
    id: asString(row.id, `post-${index}`),
    account: normalizeAccount(row.account),
    content: asString(row.content, ""),
    scheduled_at: asNullableString(row.scheduled_at),
    posted_at: asNullableString(row.posted_at),
    status: normalizePostStatus(row.status),
    post_id: asNullableString(row.post_id),
    engagement_metrics: engagement
      ? {
          likes: asNumber(engagement.likes, 0),
          replies: asNumber(engagement.replies, 0),
          reposts: asNumber(engagement.reposts, 0),
          impressions: asNumber(engagement.impressions, 0),
          followers_snapshot: asNumber(engagement.followers_snapshot, 0),
        }
      : null,
  };
}

function normalizeResearch(row: unknown, index: number): ContentResearch | null {
  if (!isRecord(row)) return null;
  return {
    id: asString(row.id, `research-${index}`),
    author_handle: asString(row.author_handle, "unknown"),
    author_followers: asNumber(row.author_followers, 0),
    post_preview: asString(row.post_preview, ""),
    post_url: asString(row.post_url, ""),
    engagement_score: asNumber(row.engagement_score, 0),
    found_at: asString(row.found_at, new Date().toISOString()),
    status: normalizeResearchStatus(row.status),
  };
}

function normalizeReply(row: unknown, index: number): ContentReply | null {
  if (!isRecord(row)) return null;
  return {
    id: asString(row.id, `reply-${index}`),
    target_post_url: asString(row.target_post_url, ""),
    target_author: asString(row.target_author, "unknown"),
    suggested_reply: asString(row.suggested_reply, ""),
    account: normalizeAccount(row.account),
    status: normalizeReplyStatus(row.status),
    sent_at: asNullableString(row.sent_at),
  };
}

function normalizeTargetAccount(row: unknown, index: number): TargetAccount | null {
  if (!isRecord(row)) return null;
  return {
    id: asString(row.id, `target-${index}`),
    handle: asString(row.handle, ""),
    followers: asNumber(row.followers, 0),
    niche: asString(row.niche, ""),
    last_engaged_at: asNullableString(row.last_engaged_at),
  };
}

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

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatPostTime(dateIso: string | null) {
  if (!dateIso) return "—";
  const parsed = new Date(dateIso);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatShortDate(dateIso: string | null) {
  if (!dateIso) return "Never";
  const parsed = new Date(dateIso);
  if (Number.isNaN(parsed.getTime())) return "Never";
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function timeAgo(dateIso: string) {
  const parsed = new Date(dateIso);
  if (Number.isNaN(parsed.getTime())) return "unknown";
  const diff = Date.now() - parsed.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatTime(iso: string) {
  const parsed = new Date(iso);
  if (isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function chartPath(points: number[], width: number, height: number, padding: number, minValue: number, maxValue: number) {
  if (points.length < 2 || maxValue === minValue) return "";

  const stepX = (width - padding * 2) / (points.length - 1);
  return points
    .map((point, idx) => {
      const x = padding + idx * stepX;
      const y = padding + (height - padding * 2) * (1 - (point - minValue) / (maxValue - minValue));
      return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

function getSupabaseClient() {
  return supabase;
}

export default function ContentPage() {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [research, setResearch] = useState<ContentResearch[]>([]);
  const [replies, setReplies] = useState<ContentReply[]>([]);
  const [targetAccounts, setTargetAccounts] = useState<TargetAccount[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());

  const cardStyle: React.CSSProperties = {
    background: "#0D0D0D",
    border: "1px solid #1F1F1F",
    borderRadius: "12px",
    padding: "20px",
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const weekStart = startOfWeek();
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const [postsRes, researchRes, repliesRes, targetsRes] = await Promise.all([
        getSupabaseClient()
          .from("content_posts")
          .select("*")
          .or(`scheduled_at.gte.${weekStart.toISOString()},posted_at.gte.${weekStart.toISOString()}`)
          .order("scheduled_at", { ascending: true }),
        getSupabaseClient()
          .from("content_research")
          .select("*")
          .gte("found_at", startOfDay().toISOString())
          .lte("found_at", endOfDay().toISOString())
          .order("engagement_score", { ascending: false })
          .limit(8),
        getSupabaseClient()
          .from("content_replies")
          .select("*")
          .order("status", { ascending: true })
          .order("sent_at", { ascending: false })
          .limit(20),
        getSupabaseClient()
          .from("target_accounts")
          .select("*")
          .order("followers", { ascending: false }),
      ]);

      if (postsRes.error) throw postsRes.error;
      if (researchRes.error) throw researchRes.error;
      if (repliesRes.error) throw repliesRes.error;
      if (targetsRes.error) throw targetsRes.error;

      if (postsRes.data) {
        const visible = postsRes.data
          .map((item, index) => normalizePost(item, index))
          .filter((item): item is ContentPost => item !== null)
          .filter((item) => {
            const sched = item.scheduled_at ? new Date(item.scheduled_at) : null;
            const posted = item.posted_at ? new Date(item.posted_at) : null;
            return (sched && sched < weekEnd) || (posted && posted < weekEnd);
          });
        setPosts(visible);
      } else {
        setPosts([]);
      }

      setResearch((researchRes.data || []).map((item, index) => normalizeResearch(item, index)).filter((item): item is ContentResearch => item !== null));
      setReplies((repliesRes.data || []).map((item, index) => normalizeReply(item, index)).filter((item): item is ContentReply => item !== null));
      setTargetAccounts(
        (targetsRes.data || [])
          .map((item, index) => normalizeTargetAccount(item, index))
          .filter((item): item is TargetAccount => item !== null)
      );
      setLoadError(null);
    } catch (error) {
      console.error("Failed to fetch content dashboard data:", error);
      setPosts([]);
      setResearch([]);
      setReplies([]);
      setTargetAccounts([]);
      setLoadError("Unable to refresh content data.");
    } finally {
      setLoading(false);
    }
  }, []);

  const { lastRefresh, formatTime: fmtTime } = useRealtimeSubscription(
    ["content_posts", "content_replies", "content_research", "target_accounts"],
    "*",
    fetchData
  );

  const queueReply = async (item: ContentResearch) => {
    if (!item.post_url) return;
    const account = item.author_followers > 50000 ? "@gettraqd" : "@igobykofi";
    const suggested = `Strong point on this, @${item.author_handle}. Curious which framework is driving your current growth loop?`;

    await getSupabaseClient().from("content_replies").insert({
      target_post_url: item.post_url,
      target_author: item.author_handle,
      suggested_reply: suggested,
      account,
      status: "queued",
    });

    await getSupabaseClient().from("content_research").update({ status: "queued" }).eq("id", item.id);
    fetchData();
  };

  const postNow = async (postId: string) => {
    try {
      await getSupabaseClient()
        .from("content_posts")
        .update({
          status: "scheduled",
          scheduled_at: new Date().toISOString()
        })
        .eq("id", postId);
      fetchData();
    } catch (error) {
      console.error("Failed to schedule post:", error);
    }
  };

  const todayStart = startOfDay();
  const todayEnd = endOfDay();

  const postsToday = posts.filter((post) => {
    if (!post.posted_at) return false;
    const date = new Date(post.posted_at);
    return date >= todayStart && date <= todayEnd;
  });

  const repliesToday = replies.filter((reply) => {
    if (!reply.sent_at || reply.status !== "sent") return false;
    const date = new Date(reply.sent_at);
    return date >= todayStart && date <= todayEnd;
  });

  const engagementRate = (() => {
    const totals = postsToday.reduce(
      (acc, post) => {
        const metrics = post.engagement_metrics || {};
        acc.engagement += (metrics.likes || 0) + (metrics.replies || 0) + (metrics.reposts || 0);
        acc.impressions += metrics.impressions || 0;
        return acc;
      },
      { engagement: 0, impressions: 0 }
    );

    if (!totals.impressions) return 0;
    return (totals.engagement / totals.impressions) * 100;
  })();

  const accountFollowers = useMemo(() => {
    const gettraqd = targetAccounts.find((acc) => acc.handle.toLowerCase() === "@gettraqd")?.followers || 0;
    const igobykofi = targetAccounts.find((acc) => acc.handle.toLowerCase() === "@igobykofi")?.followers || 0;
    return { gettraqd, igobykofi };
  }, [targetAccounts]);

  const weekDays = useMemo(() => {
    const start = startOfWeek();
    return Array.from({ length: 7 }, (_, idx) => {
      const date = new Date(start);
      date.setDate(start.getDate() + idx);
      return date;
    });
  }, []);

  const postsByDay = useMemo(() => {
    const map = new Map<string, ContentPost[]>();
    weekDays.forEach((day) => {
      const key = day.toDateString();
      map.set(key, []);
    });

    posts.forEach((post) => {
      const stamp = post.scheduled_at || post.posted_at;
      if (!stamp) return;
      const key = new Date(stamp).toDateString();
      if (!map.has(key)) return;
      map.set(key, [...(map.get(key) || []), post]);
    });

    map.forEach((value, key) => {
      map.set(
        key,
        value.sort((a, b) => {
          const left = new Date(a.scheduled_at || a.posted_at || 0).getTime();
          const right = new Date(b.scheduled_at || b.posted_at || 0).getTime();
          return left - right;
        })
      );
    });

    return map;
  }, [posts, weekDays]);

  const growthSeries = useMemo<GrowthPoint[]>(() => {
    const now = new Date();
    const rows: GrowthPoint[] = [];

    for (let i = 7; i >= 0; i--) {
      const pointDate = new Date(now);
      pointDate.setDate(pointDate.getDate() - i * 7);

      const gettraqd = Math.max(0, Math.round(accountFollowers.gettraqd * (1 - i * 0.015)));
      const igobykofi = Math.max(0, Math.round(accountFollowers.igobykofi * (1 - i * 0.012)));
      rows.push({
        label: pointDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        gettraqd,
        igobykofi,
        target: 30000,
      });
    }

    return rows;
  }, [accountFollowers.gettraqd, accountFollowers.igobykofi]);

  const chartWidth = isMobile ? 640 : 920;
  const chartHeight = 240;
  const chartPadding = 26;
  const chartValues = growthSeries.flatMap((row) => [row.gettraqd, row.igobykofi, row.target]);
  const maxValue = Math.max(30000, ...chartValues, 1);
  const minValue = 0;

  const gettraqdPath = chartPath(
    growthSeries.map((row) => row.gettraqd),
    chartWidth,
    chartHeight,
    chartPadding,
    minValue,
    maxValue
  );
  const igobykofiPath = chartPath(
    growthSeries.map((row) => row.igobykofi),
    chartWidth,
    chartHeight,
    chartPadding,
    minValue,
    maxValue
  );
  const targetPath = chartPath(
    growthSeries.map((row) => row.target),
    chartWidth,
    chartHeight,
    chartPadding,
    minValue,
    maxValue
  );

  const publishedPosts = posts
    .filter(post => post.status === "posted")
    .sort((a, b) => {
      const aTime = a.posted_at ? new Date(a.posted_at).getTime() : 0;
      const bTime = b.posted_at ? new Date(b.posted_at).getTime() : 0;
      return bTime - aTime; // Most recent first
    })
    .slice(0, 6); // Show last 6 published posts

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#000", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "#A0A0A0", fontFamily: "'Inter', sans-serif" }}>{loadError || "Loading…"}</span>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#fff" }}>
      <Header activePage="content" live lastRefresh={lastRefresh} formatTime={formatTime} />

      <main style={{ padding: isMobile ? "12px" : "24px", maxWidth: "1280px", margin: "0 auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(5, 1fr)",
            gap: isMobile ? "10px" : "14px",
            marginBottom: "24px",
          }}
        >
          {[
            { label: "Followers @gettraqd", value: accountFollowers.gettraqd, color: "#86EFAC" },
            { label: "Followers @igobykofi", value: accountFollowers.igobykofi, color: "#fff" },
            { label: "Posts Today", value: postsToday.length, color: "#fff" },
            { label: "Replies Today", value: repliesToday.length, color: "#fff" },
            { label: "Engagement Rate", value: `${engagementRate.toFixed(2)}%`, color: "#86EFAC" },
          ].map((item) => (
            <div key={item.label} style={cardStyle}>
              <div
                style={{
                  fontSize: "11px",
                  color: "#A0A0A0",
                  fontFamily: "'Inter', sans-serif",
                  marginBottom: "8px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                {item.label}
              </div>
              <div style={{ fontSize: "28px", fontWeight: 700, color: item.color, fontFamily: "'Space Grotesk', sans-serif" }}>
                {typeof item.value === "number" ? formatCompact(item.value) : item.value}
              </div>
            </div>
          ))}
        </div>

        {/* Daily Selector and Content Calendar */}
        <div style={{ ...cardStyle, marginBottom: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", gap: "8px", flexWrap: "wrap" }}>
            <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "14px", margin: 0 }}>Content Calendar</h3>
            <span style={{ fontSize: "11px", color: "#555", fontFamily: "'Inter', sans-serif", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {selectedDay.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </span>
          </div>

          {/* Daily Selector */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
            {weekDays.map((day) => {
              const isSelected = day.toDateString() === selectedDay.toDateString();
              const dayPosts = postsByDay.get(day.toDateString()) || [];
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDay(day)}
                  style={{
                    background: isSelected ? "#86EFAC" : "#111",
                    color: isSelected ? "#000" : "#fff",
                    border: `1px solid ${isSelected ? "#86EFAC" : "#1F1F1F"}`,
                    borderRadius: "8px",
                    padding: "8px 12px",
                    fontSize: "12px",
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: 500,
                    cursor: "pointer",
                    minWidth: "80px",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "11px", fontWeight: 600 }}>
                    {day.toLocaleDateString("en-US", { weekday: "short" })}
                  </div>
                  <div style={{ fontSize: "10px", opacity: 0.8 }}>
                    {day.toLocaleDateString("en-US", { day: "numeric" })}
                  </div>
                  {dayPosts.length > 0 && (
                    <div style={{ fontSize: "9px", marginTop: "2px", opacity: 0.7 }}>
                      {dayPosts.length} post{dayPosts.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected Day Posts */}
          <div>
            {(() => {
              const dayPosts = postsByDay.get(selectedDay.toDateString()) || [];
              if (dayPosts.length === 0) {
                return (
                  <div style={{
                    background: "#111",
                    border: "1px solid #1F1F1F",
                    borderRadius: "10px",
                    padding: "24px",
                    textAlign: "center",
                  }}>
                    <div style={{ fontSize: "14px", color: "#555", fontFamily: "'Inter', sans-serif", marginBottom: "8px" }}>
                      No posts scheduled for this day
                    </div>
                    <div style={{ fontSize: "12px", color: "#777", fontFamily: "'Inter', sans-serif" }}>
                      {selectedDay.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                    </div>
                  </div>
                );
              }

              return (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {dayPosts.map((post) => (
                    <div
                      key={post.id}
                      style={{
                        background: "#111",
                        border: "1px solid #1F1F1F",
                        borderRadius: "12px",
                        padding: "18px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "12px", flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "14px", color: "#86EFAC", fontFamily: "'Inter', sans-serif", fontWeight: 600 }}>
                            {post.account}
                          </span>
                          <span style={{ fontSize: "13px", color: "#A0A0A0", fontFamily: "'Inter', sans-serif" }}>
                            {formatPostTime(post.scheduled_at || post.posted_at)}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span
                            style={{
                              fontSize: "10px",
                              textTransform: "uppercase",
                              letterSpacing: "0.07em",
                              color: post.status === "posted" ? "#86EFAC" : post.status === "scheduled" ? "#F59E0B" : "#A0A0A0",
                              fontFamily: "'Inter', sans-serif",
                              background: post.status === "posted" ? "rgba(134,239,172,0.1)" : post.status === "scheduled" ? "rgba(245,158,11,0.1)" : "rgba(160,160,160,0.1)",
                              padding: "4px 8px",
                              borderRadius: "4px",
                            }}
                          >
                            {post.status}
                          </span>
                          {post.status === "draft" && (
                            <button
                              onClick={() => postNow(post.id)}
                              style={{
                                background: "rgba(134,239,172,0.15)",
                                color: "#86EFAC",
                                border: "1px solid rgba(134,239,172,0.3)",
                                borderRadius: "6px",
                                padding: "6px 12px",
                                fontSize: "11px",
                                cursor: "pointer",
                                fontFamily: "'Inter', sans-serif",
                                fontWeight: 500,
                              }}
                            >
                              Post Now
                            </button>
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          fontSize: "14px",
                          color: "#E5E5E5",
                          fontFamily: "'Inter', sans-serif",
                          lineHeight: 1.5,
                          marginBottom: post.engagement_metrics ? "12px" : 0,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {post.content}
                      </div>

                      {post.engagement_metrics && (
                        <div style={{ display: "flex", gap: "16px", fontSize: "12px", fontFamily: "'Inter', sans-serif", borderTop: "1px solid #1A1A1A", paddingTop: "12px" }}>
                          <span style={{ color: "#F59E0B" }}>❤ {post.engagement_metrics.likes || 0}</span>
                          <span style={{ color: "#60A5FA" }}>💬 {post.engagement_metrics.replies || 0}</span>
                          <span style={{ color: "#86EFAC" }}>🔄 {post.engagement_metrics.reposts || 0}</span>
                          <span style={{ color: "#A0A0A0" }}>👁 {formatCompact(post.engagement_metrics.impressions || 0)}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Published Posts Section */}
        <div style={{ ...cardStyle, marginBottom: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "14px", margin: 0 }}>
              Published Posts
            </h3>
            <span style={{ fontSize: "11px", color: "#555", fontFamily: "'Inter', sans-serif" }}>
              {publishedPosts.length} recent posts
            </span>
          </div>

          {publishedPosts.length === 0 ? (
            <div style={{ fontSize: "13px", color: "#555", fontFamily: "'Inter', sans-serif", textAlign: "center", padding: "20px" }}>
              No published posts yet
            </div>
          ) : (
            <div style={{ display: "grid", gap: "12px" }}>
              {publishedPosts.map((post) => (
                <div
                  key={post.id}
                  style={{
                    background: "#111",
                    border: "1px solid #1F1F1F",
                    borderRadius: "10px",
                    padding: "14px",
                    display: "flex",
                    gap: "12px",
                    alignItems: "flex-start",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "8px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "12px", color: "#86EFAC", fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>
                        {post.account}
                      </span>
                      <span style={{ fontSize: "11px", color: "#A0A0A0", fontFamily: "'Inter', sans-serif" }}>
                        {post.posted_at ? timeAgo(post.posted_at) : "Unknown time"}
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: "13px",
                        color: "#D0D0D0",
                        fontFamily: "'Inter', sans-serif",
                        lineHeight: 1.4,
                        marginBottom: "10px",
                      }}
                    >
                      {post.content.length > 120 ? `${post.content.substring(0, 120)}...` : post.content}
                    </div>

                    <div style={{ display: "flex", gap: "16px", fontSize: "11px", fontFamily: "'Inter', sans-serif" }}>
                      {post.engagement_metrics ? (
                        <>
                          <span style={{ color: "#F59E0B" }}>❤ {post.engagement_metrics.likes || 0}</span>
                          <span style={{ color: "#60A5FA" }}>💬 {post.engagement_metrics.replies || 0}</span>
                          <span style={{ color: "#86EFAC" }}>🔄 {post.engagement_metrics.reposts || 0}</span>
                          <span style={{ color: "#A0A0A0" }}>👁 {formatCompact(post.engagement_metrics.impressions || 0)}</span>
                        </>
                      ) : (
                        <span style={{ color: "#555" }}>Pending sync</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "24px", marginBottom: "24px" }}>
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "14px" }}>
              <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "14px", margin: 0 }}>Today&apos;s Research</h3>
              <span style={{ fontSize: "11px", color: "#555", fontFamily: "'Inter', sans-serif" }}>{research.length} opportunities</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {research.length === 0 ? (
                <div style={{ fontSize: "13px", color: "#555", fontFamily: "'Inter', sans-serif" }}>No scout findings for today yet.</div>
              ) : (
                research.map((item) => (
                  <div key={item.id} style={{ background: "#111", border: "1px solid #1F1F1F", borderRadius: "10px", padding: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", marginBottom: "8px", flexWrap: "wrap" }}>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ color: "#86EFAC", fontSize: "12px", fontFamily: "'Inter', sans-serif" }}>@{item.author_handle.replace(/^@/, "")}</span>
                        <span style={{ color: "#555", fontSize: "11px", fontFamily: "'Inter', sans-serif" }}>{formatCompact(item.author_followers)} followers</span>
                        <span style={{ color: "#F59E0B", fontSize: "11px", fontFamily: "'Inter', sans-serif" }}>Velocity {item.engagement_score.toFixed(1)}</span>
                      </div>
                      <span style={{ color: "#555", fontSize: "11px", fontFamily: "'Inter', sans-serif" }}>{timeAgo(item.found_at)}</span>
                    </div>

                    <div style={{ fontSize: "13px", color: "#D0D0D0", fontFamily: "'Inter', sans-serif", marginBottom: "10px", lineHeight: 1.35 }}>
                      {item.post_preview}
                    </div>

                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <button
                        onClick={() => queueReply(item)}
                        disabled={item.status === "queued" || !item.post_url}
                        style={{
                          background: item.status === "queued" || !item.post_url ? "#1F1F1F" : "rgba(134,239,172,0.12)",
                          color: item.status === "queued" || !item.post_url ? "#555" : "#86EFAC",
                          border: `1px solid ${item.status === "queued" || !item.post_url ? "#1F1F1F" : "rgba(134,239,172,0.35)"}`,
                          borderRadius: "8px",
                          padding: "6px 10px",
                          fontSize: "11px",
                          fontFamily: "'Inter', sans-serif",
                          cursor: item.status === "queued" || !item.post_url ? "default" : "pointer",
                        }}
                      >
                        {item.status === "queued" ? "Queued" : item.post_url ? "Queue Reply" : "No URL"}
                      </button>
                      <Link href={item.post_url || "#"} target="_blank" style={{ color: "#A0A0A0", fontSize: "11px", fontFamily: "'Inter', sans-serif", textDecoration: "none" }}>
                        View Post ↗
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div style={cardStyle}>
            <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "14px", margin: "0 0 14px 0" }}>Reply Queue</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "8px" }}>
              {replies.length === 0 ? (
                <div style={{ fontSize: "13px", color: "#555", fontFamily: "'Inter', sans-serif" }}>No replies in queue.</div>
              ) : (
                replies.map((reply) => (
                  <div key={reply.id} style={{ border: "1px solid #1F1F1F", borderRadius: "10px", background: "#111", padding: "10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", marginBottom: "8px", flexWrap: "wrap" }}>
                      <span style={{ color: "#86EFAC", fontSize: "11px", fontFamily: "'Inter', sans-serif" }}>{reply.account}</span>
                      <span
                        style={{
                          color: reply.status === "sent" ? "#86EFAC" : reply.status === "skipped" ? "#EF4444" : "#F59E0B",
                          fontSize: "10px",
                          fontFamily: "'Inter', sans-serif",
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                        }}
                      >
                        {reply.status}
                      </span>
                    </div>
                    <div style={{ fontSize: "11px", color: "#A0A0A0", fontFamily: "'Inter', sans-serif", marginBottom: "6px" }}>
                      Target: @{reply.target_author.replace(/^@/, "")}
                    </div>
                    <div style={{ fontSize: "12px", color: "#D0D0D0", fontFamily: "'Inter', sans-serif", lineHeight: 1.35, marginBottom: "8px" }}>
                      {reply.suggested_reply}
                    </div>
                    <Link href={reply.target_post_url || "#"} target="_blank" style={{ color: "#555", fontSize: "11px", fontFamily: "'Inter', sans-serif", textDecoration: "none" }}>
                      Target post ↗
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div style={{ ...cardStyle, marginBottom: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
            <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "14px", margin: 0 }}>Performance Tracker</h3>
            <span style={{ fontSize: "11px", color: "#F59E0B", fontFamily: "'Inter', sans-serif", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Target: 30k by Aug 2026
            </span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <svg width={chartWidth} height={chartHeight} style={{ display: "block", minWidth: `${chartWidth}px` }}>
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const y = chartPadding + (chartHeight - chartPadding * 2) * ratio;
                return (
                  <g key={ratio}>
                    <line x1={chartPadding} y1={y} x2={chartWidth - chartPadding} y2={y} stroke="#1A1A1A" strokeWidth="1" />
                    <text x={4} y={y + 3} fill="#444" fontSize="10" fontFamily="Inter">
                      {formatCompact(Math.round(maxValue * (1 - ratio)))}
                    </text>
                  </g>
                );
              })}

              <path d={targetPath} fill="none" stroke="#F59E0B" strokeWidth="2" strokeDasharray="5 5" />
              <path d={gettraqdPath} fill="none" stroke="#86EFAC" strokeWidth="2.5" />
              <path d={igobykofiPath} fill="none" stroke="#60A5FA" strokeWidth="2.5" />

              {growthSeries.map((point, idx) => {
                const stepX = (chartWidth - chartPadding * 2) / Math.max(growthSeries.length - 1, 1);
                const x = chartPadding + idx * stepX;
                const yGettraqd = chartPadding + (chartHeight - chartPadding * 2) * (1 - point.gettraqd / maxValue);
                const yIgobykofi = chartPadding + (chartHeight - chartPadding * 2) * (1 - point.igobykofi / maxValue);

                return (
                  <g key={point.label}>
                    <circle cx={x} cy={yGettraqd} r="2.8" fill="#86EFAC" />
                    <circle cx={x} cy={yIgobykofi} r="2.8" fill="#60A5FA" />
                    <text x={x} y={chartHeight - 6} textAnchor="middle" fill="#555" fontSize="10" fontFamily="Inter">
                      {point.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div style={{ marginTop: "12px", display: "flex", gap: "18px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "11px", color: "#86EFAC", fontFamily: "'Inter', sans-serif" }}>● @gettraqd</span>
            <span style={{ fontSize: "11px", color: "#60A5FA", fontFamily: "'Inter', sans-serif" }}>● @igobykofi</span>
            <span style={{ fontSize: "11px", color: "#F59E0B", fontFamily: "'Inter', sans-serif" }}>● Target line</span>
          </div>
        </div>

        <div style={cardStyle}>
          <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "14px", margin: "0 0 14px 0" }}>Target Accounts</h3>

          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: isMobile ? "620px" : "unset" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.3fr 1fr 1fr 1fr",
                  gap: "8px",
                  padding: "8px 10px",
                  borderBottom: "1px solid #1F1F1F",
                  marginBottom: "8px",
                  fontSize: "11px",
                  color: "#555",
                  fontFamily: "'Inter', sans-serif",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                <span>Handle</span>
                <span>Followers</span>
                <span>Niche</span>
                <span>Last engaged</span>
              </div>

              {targetAccounts.length === 0 ? (
                <div style={{ padding: "10px", fontSize: "13px", color: "#555", fontFamily: "'Inter', sans-serif" }}>No monitored accounts yet.</div>
              ) : (
                targetAccounts.map((account) => (
                  <div
                    key={account.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.3fr 1fr 1fr 1fr",
                      gap: "8px",
                      padding: "10px",
                      borderBottom: "1px solid #141414",
                      fontSize: "13px",
                      color: "#D0D0D0",
                      fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    <span style={{ color: ACCOUNT_HANDLES.includes(account.handle.toLowerCase()) ? "#86EFAC" : "#fff" }}>{account.handle}</span>
                    <span>{formatCompact(account.followers)}</span>
                    <span style={{ color: "#A0A0A0" }}>{account.niche}</span>
                    <span style={{ color: "#A0A0A0" }}>{formatShortDate(account.last_engaged_at)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
