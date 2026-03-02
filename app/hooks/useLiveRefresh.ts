// @deprecated — Use useRealtimeSubscription instead for live Supabase subscriptions.
import { useState, useEffect, useCallback, useRef } from "react";

const REFRESH_INTERVAL = 30; // seconds

export function useLiveRefresh(fetchFn: () => Promise<void>) {
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const fetchRef = useRef(fetchFn);
  fetchRef.current = fetchFn;

  const doFetch = useCallback(async () => {
    await fetchRef.current();
    setLastRefresh(new Date());
    setCountdown(REFRESH_INTERVAL);
  }, []);

  useEffect(() => {
    doFetch();
    const interval = setInterval(doFetch, REFRESH_INTERVAL * 1000);
    return () => clearInterval(interval);
  }, [doFetch]);

  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : REFRESH_INTERVAL));
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  };

  return { lastRefresh, countdown, formatTime };
}
