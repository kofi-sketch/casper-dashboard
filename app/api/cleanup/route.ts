import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Use service role key for writes — falls back to anon key for read-only cleanup
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const STALE_TASK_MINUTES = 30;

export async function GET(request: Request) {
  // Optional auth via query param for cron protection
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  if (process.env.CLEANUP_SECRET && secret !== process.env.CLEANUP_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data, error } = await supabase
      .from("dashboard_state")
      .select("state")
      .eq("id", 1)
      .single();

    if (error || !data?.state) {
      return NextResponse.json({ error: "Failed to fetch state" }, { status: 500 });
    }

    const state = data.state as Record<string, unknown>;
    const now = new Date();
    let changed = false;
    const cleaned: string[] = [];

    // 1. Remove stale active tasks (older than STALE_TASK_MINUTES)
    const activeTasks = (state.activeTasks as Array<Record<string, unknown>>) || [];
    const freshTasks = activeTasks.filter((t) => {
      const startedAt = t.startedAt as string;
      if (!startedAt) return false;
      const started = new Date(startedAt);
      const ageMinutes = (now.getTime() - started.getTime()) / 60000;
      if (ageMinutes > STALE_TASK_MINUTES) {
        cleaned.push(t.taskDescription as string || "unknown task");
        return false;
      }
      return true;
    });

    if (freshTasks.length !== activeTasks.length) {
      state.activeTasks = freshTasks;
      changed = true;
    }

    // 2. Reset daily KPIs if lastUpdated is from a previous day
    const lastUpdated = state.lastUpdated as string;
    if (lastUpdated) {
      const lastDate = new Date(lastUpdated);
      if (lastDate.toDateString() !== now.toDateString()) {
        const kpis = state.kpis as Record<string, number>;
        if (kpis) {
          kpis.tasksCompletedToday = 0;
          kpis.errorsToday = 0;
          changed = true;
        }
      }
    }

    // 3. Clean completed pipelines from live state (they should be in history)
    const pipelines = (state.pipelines as Array<Record<string, unknown>>) || [];
    const activePipelines = pipelines.filter((p) => p.status === "running");
    if (activePipelines.length !== pipelines.length) {
      state.pipelines = activePipelines;
      changed = true;
    }

    if (changed) {
      state.lastUpdated = now.toISOString();

      const { error: updateError } = await supabase
        .from("dashboard_state")
        .update({ state, updated_at: now.toISOString() })
        .eq("id", 1);

      if (updateError) {
        return NextResponse.json({ error: "Failed to update state", details: updateError }, { status: 500 });
      }
    }

    return NextResponse.json({
      cleaned: cleaned.length,
      cleanedTasks: cleaned,
      pipelinesArchived: pipelines.length - activePipelines.length,
      kpisReset: changed && cleaned.length === 0,
      message: changed ? "Dashboard cleaned" : "No cleanup needed",
    });
  } catch (e) {
    return NextResponse.json({ error: "Cleanup failed", details: String(e) }, { status: 500 });
  }
}
