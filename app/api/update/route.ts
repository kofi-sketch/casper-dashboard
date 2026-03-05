import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Server-side Supabase client — prefers service key for full write access
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

interface TaskUpdate {
  task: string;
  status: "start" | "complete" | "fail";
  agent?: string;
  estMinutes?: number;
}

interface PipelineUpdate {
  id: string;
  name: string;
  stages: string[];
  currentStage: string;
  completedStages: string[];
  startedAt: string;
  status: "running" | "complete" | "failed";
  tasks?: Array<{
    id: string;
    description: string;
    agentName: string;
    status: string;
    duration: string;
  }>;
}

interface FullStateUpdate {
  kpis?: Record<string, number>;
  pipelines?: PipelineUpdate[];
  activeTasks?: unknown[];
  recentCompletions?: unknown[];
  errorLog?: unknown[];
  systemStatus?: Record<string, string>;
}

function calcDuration(startedAt: string, now: string): string {
  const s = new Date(startedAt).getTime();
  const e = new Date(now).getTime();
  const diff = Math.max(0, e - s);
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

function autoEstMinutes(agent: string, task: string): number {
  const a = agent.toLowerCase();
  const t = task.toLowerCase();
  if (a.includes("codex")) return 3;
  if (a.includes("claude")) {
    if (/research/.test(t)) return 5;
    if (/build|create|pdf|html/.test(t)) return 8;
    if (/strategy|plan/.test(t)) return 5;
    if (/qa|test|review/.test(t)) return 3;
    return 5;
  }
  return 5;
}

// POST /api/update — atomic dashboard state update
// Body: { type: "task", ...TaskUpdate } or { type: "pipeline", pipeline: PipelineUpdate }
//    or { type: "state", state: FullStateUpdate }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const now = new Date().toISOString();

    // Fetch current state atomically
    const { data: row, error: fetchErr } = await getSupabase()
      .from("dashboard_state")
      .select("state")
      .eq("id", 1)
      .single();

    if (fetchErr || !row?.state) {
      return NextResponse.json(
        { error: "Failed to fetch dashboard state", details: fetchErr?.message },
        { status: 500 }
      );
    }

    const state = row.state as Record<string, unknown>;
    const kpis = (state.kpis || { activeAgents: 0, tasksCompletedToday: 0, errorsToday: 0 }) as Record<string, number>;
    const activeTasks = ((state.activeTasks || []) as Array<Record<string, unknown>>);
    const recentCompletions = ((state.recentCompletions || []) as Array<Record<string, unknown>>);
    const errorLog = ((state.errorLog || []) as Array<Record<string, unknown>>);
    const pipelines = ((state.pipelines || []) as Array<Record<string, unknown>>);

    let historyInsert: Record<string, unknown> | null = null;

    if (body.type === "task") {
      const { task, status, agent = "CMO (Casper)", estMinutes } = body as TaskUpdate & { type: string };

      if (!task || !status) {
        return NextResponse.json({ error: "Missing task or status" }, { status: 400 });
      }

      // Clean stale tasks (>30 min)
      const staleThreshold = Date.now() - 30 * 60 * 1000;
      const freshTasks = activeTasks.filter((t) => {
        const started = new Date(t.startedAt as string).getTime();
        return started > staleThreshold;
      });

      if (status === "start") {
        // Remove duplicate if re-starting
        const without = freshTasks.filter((t) => t.taskDescription !== task);
        const est = estMinutes || autoEstMinutes(agent, task);
        const estDone = new Date(Date.now() + est * 60000).toISOString();
        without.push({
          id: `task-${now}`,
          priority: "high",
          agentName: agent,
          startedAt: now,
          estCompletion: estDone,
          taskDescription: task,
        });
        state.activeTasks = without;
      } else if (status === "complete") {
        // Find task to get real start time
        const existing = freshTasks.find((t) => t.taskDescription === task);
        const startedAt = (existing?.startedAt as string) || now;
        const duration = calcDuration(startedAt, now);

        // Remove from active
        state.activeTasks = freshTasks.filter((t) => t.taskDescription !== task);

        // Add to recent completions
        recentCompletions.unshift({
          id: `comp-${now}`,
          duration,
          agentName: agent,
          completedAt: now,
          taskDescription: task,
        });
        state.recentCompletions = recentCompletions.slice(0, 10);
        kpis.tasksCompletedToday = (kpis.tasksCompletedToday || 0) + 1;

        // Prepare pipeline_history insert
        historyInsert = {
          pipeline_id: `task-${now}`,
          name: task,
          stages: ["Done"],
          completed_stages: ["Done"],
          started_at: startedAt,
          completed_at: now,
          status: "complete",
          duration,
          tasks: [
            {
              id: "t1",
              description: task,
              agentName: agent,
              status: "complete",
              duration,
            },
          ],
        };
      } else if (status === "fail") {
        state.activeTasks = freshTasks.filter((t) => t.taskDescription !== task);
        errorLog.unshift({
          id: `err-${now}`,
          agent,
          message: task,
          severity: "high",
          timestamp: now,
        });
        state.errorLog = (errorLog as unknown[]).slice(0, 5);
        kpis.errorsToday = (kpis.errorsToday || 0) + 1;
      }
    } else if (body.type === "pipeline") {
      const pipeline = body.pipeline as PipelineUpdate;
      if (!pipeline?.id) {
        return NextResponse.json({ error: "Missing pipeline.id" }, { status: 400 });
      }

      // Replace existing pipeline or add new
      const pipelineRecord = pipeline as unknown as Record<string, unknown>;
      const idx = pipelines.findIndex((p) => p.id === pipeline.id);
      if (idx >= 0) {
        pipelines[idx] = pipelineRecord;
      } else {
        pipelines.push(pipelineRecord);
      }
      state.pipelines = pipelines;

      // If pipeline is complete/failed, archive to history
      if (pipeline.status === "complete" || pipeline.status === "failed") {
        const duration = pipeline.startedAt ? calcDuration(pipeline.startedAt, now) : "-";
        historyInsert = {
          pipeline_id: pipeline.id,
          name: pipeline.name,
          stages: pipeline.stages,
          completed_stages: pipeline.completedStages,
          started_at: pipeline.startedAt,
          completed_at: now,
          status: pipeline.status,
          duration,
          tasks: pipeline.tasks || null,
        };
      }
    } else if (body.type === "state") {
      // Full state merge
      const update = body.state as FullStateUpdate;
      if (update.kpis) Object.assign(kpis, update.kpis);
      if (update.pipelines) state.pipelines = update.pipelines;
      if (update.activeTasks) state.activeTasks = update.activeTasks;
      if (update.recentCompletions) state.recentCompletions = update.recentCompletions;
      if (update.errorLog) state.errorLog = update.errorLog;
      if (update.systemStatus) state.systemStatus = update.systemStatus;
    } else {
      return NextResponse.json(
        { error: "Unknown type. Use: task, pipeline, or state" },
        { status: 400 }
      );
    }

    state.kpis = kpis;
    state.lastUpdated = now;

    // Write state back
    const { error: updateErr } = await getSupabase()
      .from("dashboard_state")
      .update({ state, updated_at: now })
      .eq("id", 1);

    if (updateErr) {
      return NextResponse.json(
        { error: "Failed to write state", details: updateErr.message },
        { status: 500 }
      );
    }

    // Archive to pipeline_history if needed
    if (historyInsert) {
      const { error: histErr } = await getSupabase()
        .from("pipeline_history")
        .insert(historyInsert);

      if (histErr) {
        console.error("pipeline_history insert failed:", histErr);
        // Non-fatal — state was already updated
      }
    }

    return NextResponse.json({ ok: true, lastUpdated: now });
  } catch (e) {
    return NextResponse.json(
      { error: "Update failed", details: String(e) },
      { status: 500 }
    );
  }
}
