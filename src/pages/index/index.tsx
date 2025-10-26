import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  SheetLogEntry,
  submitAnswer,
  triggerRun,
  useSheetState,
} from "../../utils/sheet";

const HomePage: React.FC = () => {
  const {
    state,
    loading,
    error,
    reload,
    startPolling,
    stopPolling,
    polling,
  } = useSheetState(2000);
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [running, setRunning] = useState(false);
  const [feedback, setFeedback] = useState<
    { type: "success" | "error"; message: string } | null
  >(null);
  const [logs, setLogs] = useState<SheetLogEntry[]>([]);
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  const imageSource = useMemo(() => {
    const source = state?.imageUrl;
    if (!source) {
      return undefined;
    }
    if (
      source.startsWith("http://") ||
      source.startsWith("https://") ||
      source.startsWith("data:")
    ) {
      return source;
    }
    return `data:image/png;base64,${source}`;
  }, [state?.imageUrl]);

  useEffect(() => {
    if (state) {
      setLogs(state.logs ?? []);
    }
  }, [state]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop =
        logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleRun = async () => {
    setFeedback(null);
    setRunning(true);
    try {
      await triggerRun();
      setFeedback({
        type: "success",
        message: "Set A2 = RUN. Please check the Google Sheet.",
      });
      startPolling();
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : String(err),
      });
      console.error("[auto-login] RUN LOGIN failed", err);
      stopPolling();
    } finally {
      setRunning(false);
    }
  };

  const handleAnswerChange = (value: string) => {
    const digitsOnly = value.replace(/\D/g, "").slice(0, 3);
    setAnswer(digitsOnly);
  };

  const handleSubmit = async () => {
    const trimmed = answer.trim();
    if (trimmed.length !== 3) {
      setFeedback({
        type: "error",
        message: "Please enter exactly 3 digits before sending.",
      });
      return;
    }

    setFeedback(null);
    setSubmitting(true);
    try {
      await submitAnswer(trimmed);
      setFeedback({
        type: "success",
        message: "Captcha code saved to cell D2.",
      });
      setAnswer("");
      await reload();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setFeedback({
        type: "error",
        message,
      });
      console.error("[auto-login] submit captcha failed", err);
    } finally {
      setSubmitting(false);
    }
  };

  const isSubmitDisabled = submitting || answer.length !== 3;

  return (
    <div className="relative flex flex-col bg-white min-h-screen">
      <main className="flex-1 overflow-auto p-4 space-y-4">
        <h1 className="text-2xl font-semibold">Auto Login</h1>
        {feedback && (
          <div
            className={`rounded-lg border p-3 ${
              feedback.type === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-green-200 bg-green-50 text-green-700"
            }`}
          >
            {feedback.message}
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">
            {error}
          </div>
        )}
        <section className="space-y-3 rounded-lg border border-divider bg-white p-4 shadow-sm">
          <header className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Control Panel</h2>
            {running && (
              <span className="text-xs font-medium uppercase text-blue-600">
                Running...
              </span>
            )}
            {!running && polling && (
              <span className="text-xs font-medium uppercase text-green-600">
                Polling...
              </span>
            )}
          </header>
          <button
            className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleRun}
            disabled={running}
          >
            {running ? "Sending..." : "RUN LOGIN"}
          </button>
        </section>

        <section className="space-y-3 rounded-lg border border-divider bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Captcha Image</h2>
          <div className="rounded-lg border border-dashed border-divider bg-gray-50 p-3">
            {imageSource ? (
              <div className="flex justify-center">
                <img
                  src={imageSource}
                  alt="Captcha from Google Sheet"
                  className="max-h-48 max-w-full object-contain"
                />
              </div>
            ) : (
              <p className="text-center text-sm text-gray-500">
                No image available.
              </p>
            )}
          </div>
        </section>

        <section className="space-y-3 rounded-lg border border-divider bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Enter Captcha</h2>
          <div className="flex flex-row space-x-2">
            <input
              className="flex-1 rounded-lg border border-divider px-3 py-2 text-lg font-semibold tracking-widest focus:outline-none focus:ring focus:ring-blue-200"
              placeholder="000"
              value={answer}
              onChange={(event) => handleAnswerChange(event.target.value)}
              inputMode="numeric"
              pattern="\d*"
              maxLength={3}
            />
            <button
              className="rounded-lg border border-divider px-4 py-2 font-semibold text-blue-600 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-[120px]"
              onClick={handleSubmit}
              disabled={isSubmitDisabled}
            >
              Send
            </button>
          </div>
        </section>

        <section className="space-y-3 rounded-lg border border-divider bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Log</h2>
            {loading && (
              <span className="text-xs font-medium uppercase text-gray-500">
                Updating...
              </span>
            )}
          </div>
          <div
            ref={logContainerRef}
            className="max-h-[420px] overflow-auto rounded-lg border border-divider bg-gray-50 p-3"
          >
            {logs.length === 0 ? (
              <p className="text-sm text-gray-500">
                {loading ? "Loading log..." : "No log entries yet."}
              </p>
            ) : (
              <ul className="space-y-2 text-sm text-gray-800">
                {logs.map((entry) => (
                  <li
                    key={entry.row}
                    className="flex items-start space-x-2 rounded-md bg-white/60 p-2 shadow-sm"
                  >
                    <span className="flex-1 whitespace-pre-wrap">
                      {entry.text}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default HomePage;
