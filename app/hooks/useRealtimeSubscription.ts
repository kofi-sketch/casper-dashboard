import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";

type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE" | "*";

const POLL_INTERVAL_MS = 15_000; // 15s polling fallback

export function useRealtimeSubscription(
  tables: string | string[],
  event: RealtimeEvent,
  onChangeCallback: () => Promise<void>
) {
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const callbackRef = useRef(onChangeCallback);
  callbackRef.current = onChangeCallback;

  const doFetch = useCallback(async () => {
    await callbackRef.current();
    setLastRefresh(new Date());
  }, []);

  const tablesKey = Array.isArray(tables) ? tables.join(",") : tables;

  useEffect(() => {
    doFetch();

    const tableList = tablesKey.split(",");
    const channel = supabase.channel(`realtime-${tableList.join("-")}`);

    let realtimeConnected = false;

    for (const table of tableList) {
      channel.on(
        "postgres_changes" as any,
        { event, schema: "public", table },
        () => {
          doFetch();
        }
      );
    }

    channel.subscribe((status: string) => {
      realtimeConnected = status === "SUBSCRIBED";
    });

    // Polling fallback: refresh every POLL_INTERVAL_MS regardless of realtime status.
    // This ensures the dashboard stays current even if websocket silently disconnects.
    const pollTimer = setInterval(() => {
      doFetch();
    }, POLL_INTERVAL_MS);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doFetch, event, tablesKey]);

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return { lastRefresh, formatTime };
}
