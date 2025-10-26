import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_POLL_INTERVAL = 2000;

function getScriptUrl() {
  const url = import.meta.env.VITE_SHEET_WEBAPP_URL;
  if (!url) {
    throw new Error(
      "Missing environment variable VITE_SHEET_WEBAPP_URL pointing to the sheet API endpoint."
    );
  }
  return url;
}

interface SheetResponse<T> {
  success?: boolean;
  data?: T;
  error?: string;
  [key: string]: unknown;
}

type SheetStateRaw = {
  A2?: unknown;
  B2?: unknown;
  C2?: unknown;
  D2?: unknown;
  E2?: unknown;
  action?: unknown;
  time?: unknown;
  imageUrl?: unknown;
  answer?: unknown;
  log?: unknown;
  logs?: unknown;
  [key: string]: unknown;
};

export interface SheetLogEntry {
  row: number;
  text: string;
}

export interface SheetState {
  action?: string;
  time?: string;
  imageUrl?: string;
  answer?: string;
  log?: string;
  logs: SheetLogEntry[];
}

async function sheetRequest<T>(
  action: string,
  payload?: Record<string, unknown>
): Promise<T> {
  const url = getScriptUrl();
  console.info("[sheet] request", { action, payload, url });
  const response = await fetch(getScriptUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action,
      ...payload,
    }),
  });

  if (!response.ok) {
    console.error("[sheet] request failed", {
      status: response.status,
      statusText: response.statusText,
    });
    throw new Error(
      `Sheet request failed: ${response.status} ${response.statusText}`
    );
  }

  const json = (await response.json().catch(() => ({}))) as SheetResponse<T>;
  if (json.success === false) {
    console.error("[sheet] response error", json);
    throw new Error(
      typeof json.error === "string"
        ? json.error
        : "Sheet request returned an error."
    );
  }
  console.info("[sheet] response success", {
    action,
    keys: Object.keys(json),
  });
  return (json.data ?? (json as unknown)) as T;
}

export async function fetchSheetState(): Promise<SheetState> {
  const data = await sheetRequest<SheetStateRaw>("get-state");
  const getString = (value: unknown) =>
    typeof value === "string" ? value : undefined;
  const logs = collectLogs(data);
  return {
    action: getString(data.action) ?? getString(data.A2),
    time: getString(data.time) ?? getString(data.B2),
    imageUrl:
      getString(data.imageUrl) ??
      getString((data as { C3?: unknown }).C3) ??
      getString(data.C2),
    answer: getString(data.answer) ?? getString(data.D2),
    log: getString(data.log) ?? getString(data.E2),
    logs,
  };
}

function collectLogs(raw: SheetStateRaw): SheetLogEntry[] {
  const entries = new Map<number, string>();

  const assign = (row: number, value: unknown) => {
    if (typeof value === "string" && value.trim() !== "") {
      entries.set(row, value);
    }
  };

  const fromArray = (arr: unknown[]) => {
    arr.forEach((item, index) => {
      if (typeof item === "string") {
        assign(index + 2, item);
      } else if (
        item &&
        typeof item === "object" &&
        ("row" in item || "index" in item || "text" in item)
      ) {
        const obj = item as {
          row?: unknown;
          index?: unknown;
          text?: unknown;
          value?: unknown;
        };
        const rowCandidate =
          (typeof obj.row === "number" && obj.row) ||
          parseInt(String(obj.row), 10) ||
          (typeof obj.index === "number" && obj.index + 2) ||
          parseInt(String(obj.index ?? index), 10) + 2 ||
          index + 2;
        const textCandidate =
          typeof obj.text === "string"
            ? obj.text
            : typeof obj.value === "string"
            ? obj.value
            : undefined;
        if (textCandidate) {
          assign(rowCandidate, textCandidate);
        }
      }
    });
  };

  const maybeLogs = (raw as { logs?: unknown }).logs;
  if (Array.isArray(maybeLogs)) {
    fromArray(maybeLogs);
  }

  const maybeLogArray = (raw as { log?: unknown }).log;
  if (Array.isArray(maybeLogArray)) {
    fromArray(maybeLogArray);
  }

  if (typeof raw.log === "string") {
    raw.log
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line, index) => assign(index + 2, line));
  }

  Object.entries(raw).forEach(([key, value]) => {
    const match = key.match(/^E(\d+)$/i);
    if (match) {
      assign(parseInt(match[1], 10), value);
    }
  });

  return Array.from(entries.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([row, text]) => ({ row, text }));
}

export async function triggerRun(): Promise<void> {
  await sheetRequest("update-cell", {
    cell: "A2",
    value: "RUN",
  });
}

export async function submitAnswer(answer: string): Promise<void> {
  await sheetRequest("update-cell", {
    cell: "D2",
    value: answer,
  });
}

export function useSheetState(pollInterval = DEFAULT_POLL_INTERVAL) {
  const [state, setState] = useState<SheetState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const timerRef = useRef<number>();

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = undefined;
    }
    setPolling(false);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sheetState = await fetchSheetState();
      setState(sheetState);
      if ((sheetState.action ?? "").trim().toUpperCase() !== "RUN") {
        stopPolling();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      stopPolling();
    } finally {
      setLoading(false);
    }
  }, [stopPolling]);

  const startPolling = useCallback(() => {
    stopPolling();
    setPolling(true);
    void load();
    timerRef.current = window.setInterval(() => {
      void load();
    }, pollInterval);
  }, [load, pollInterval, stopPolling]);

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    state,
    loading,
    error,
    reload: load,
    startPolling,
    stopPolling,
    polling,
  };
}
