import { useEffect, useRef, useState } from "react";
import { api } from "../../api/client";
import type { DataMode } from "../../api/types";
import { useDataMode } from "../../context/DataModeContext";
import { useI18n } from "../../i18n/I18nContext";
import { formatDateTime } from "../../lib/format";
import { AlertIcon, SendIcon, SparkIcon } from "../ui/Icons";
import { StatusPill } from "../ui/StatusPill";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  provider?: string | null;
  notice?: string;
  context?: Record<string, unknown>;
  createdAt?: string;
}

const SUGGESTIONS_FULL = [
  "Why is irrigation demand at this level?",
  "What changed in the last 7 days?",
  "Explain the ET₀ and Kc calculation.",
  "How confident is this analysis?",
  "Which data is missing?",
];
const SUGGESTIONS_COMPACT = SUGGESTIONS_FULL.slice(0, 2);

/**
 * Field assistant chat.
 *
 * The browser only sends a question. The backend recomputes the field analyses,
 * passes a structured snapshot to the model (or the rule-based explainer) and
 * returns the exact context it used, which this component can display.
 *
 * When no AI key is configured the backend still answers with deterministic
 * templates, so the panel never appears broken.
 */
export function AIChat({
  fieldId,
  compact = false,
  mode,
}: {
  fieldId: number;
  compact?: boolean;
  /** Optional override; defaults to the global live/demo switch. */
  mode?: DataMode;
}) {
  const { mode: globalMode } = useDataMode();
  const { t } = useI18n();
  const activeMode = mode ?? globalMode;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(!compact);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  // Load the latest saved conversation on the full assistant page. The compact
  // dashboard widget starts fresh so it stays lightweight.
  useEffect(() => {
    if (compact) return;
    let cancelled = false;
    setHistoryLoading(true);
    setError(null);
    setConversationId(null);
    setMessages([]);

    api
      .conversation(fieldId)
      .then((rows) => {
        if (cancelled) return;
        setMessages(
          rows.map((row) => ({
            id: `saved-${row.id}`,
            role: row.role,
            content: row.content,
            provider: row.provider,
            context: row.context_used ?? undefined,
            createdAt: row.created_at,
          })),
        );
      })
      .catch(() => {
        // History is a convenience; a failed load must not block new questions.
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fieldId, compact, activeMode]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length, sending]);

  async function submit(question: string) {
    const trimmed = question.trim();
    if (trimmed.length < 2 || sending) return;

    setSending(true);
    setError(null);
    setMessages((current) => [
      ...current,
      { id: `u-${Date.now()}`, role: "user", content: trimmed },
    ]);
    setInput("");

    try {
      const response = await api.chat({
        field_id: fieldId,
        message: trimmed,
        conversation_id: conversationId,
        mode: activeMode,
      });
      setConversationId(response.conversation_id);
      setMessages((current) => [
        ...current,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: response.reply,
          provider: response.provider,
          notice: response.notice,
          context: response.context_used,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("The assistant could not answer."));
    } finally {
      setSending(false);
    }
  }

  const suggestions = (compact ? SUGGESTIONS_COMPACT : SUGGESTIONS_FULL).map((item) => t(item));

  return (
    <section
      className={`card flex flex-col overflow-hidden ${compact ? "" : "h-full"}`}
      aria-label={t("AI field assistant")}
    >
      <header className="panel-night flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <SparkIcon size={17} />
          <div>
            <p className="text-sm font-semibold leading-tight">{t("Field assistant")}</p>
            <p className="text-2xs text-white/65">
              {t("Explains computed values · cannot create measurements")}
            </p>
          </div>
        </div>
        <StatusPill tone="info" dot={false} className="border-white/20 bg-white/10 text-white">
          {t("Grounded")}
        </StatusPill>
      </header>

      <div
        className={`scroll-thin flex-1 space-y-3 overflow-y-auto bg-paper px-4 py-4 ${
          compact ? "max-h-[350px] min-h-[190px]" : "min-h-[380px] max-h-[560px]"
        }`}
        aria-live="polite"
        aria-busy={sending}
      >
        {historyLoading && <p className="text-xs text-muted">{t("Loading saved conversation…")}</p>}

        {!historyLoading && messages.length === 0 && (
          <div className="rounded-md border border-dashed border-line bg-sage-50 p-4">
            <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
              <SparkIcon size={15} />
              {t("Ask about this field")}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {t(
                "Answers are built from the current NASA POWER data, irrigation model and crop-health indicators. If a value is missing, the assistant is instructed to say so.",
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void submit(suggestion)}
                  className="rounded-full border border-line bg-card px-2.5 py-1 text-2xs text-muted transition-colors hover:border-forest-300 hover:text-ink"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) =>
          message.role === "user" ? (
            <div key={message.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-lg rounded-ee-sm bg-forest-800 px-3.5 py-2.5 text-sm leading-relaxed text-paper">
                {message.content}
              </div>
            </div>
          ) : (
            <div key={message.id} className="flex justify-start">
              <div className="max-w-[92%] rounded-lg rounded-es-sm border border-line bg-card px-3.5 py-3">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className="text-2xs font-semibold uppercase tracking-[0.08em] text-forest-700">
                    {t("Assistant")}
                  </span>
                  {message.provider && (
                    <StatusPill tone={message.provider === "llm" ? "info" : "neutral"} dot={false}>
                      {message.provider === "llm" ? t("AI explanation") : t("Rule-based")}
                    </StatusPill>
                  )}
                  {message.createdAt && (
                    <span className="font-mono text-2xs text-muted">
                      {formatDateTime(message.createdAt)}
                    </span>
                  )}
                </div>
                <p className="whitespace-pre-line text-sm leading-relaxed text-ink/90">
                  {message.content}
                </p>
                {message.notice && (
                  <p className="mt-2 border-t border-line pt-2 text-2xs leading-relaxed text-muted">
                    {t(message.notice)}
                  </p>
                )}
                {message.context && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-2xs font-medium text-forest-700 hover:underline">
                      {t("View data sent to the assistant")}
                    </summary>
                    <pre
                      dir="ltr"
                      className="scroll-thin mt-1.5 max-h-56 overflow-auto rounded border border-line bg-sage-50 p-2 font-mono text-[10px] leading-relaxed text-muted"
                    >
                      {JSON.stringify(message.context, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          ),
        )}

        {sending && (
          <div className="flex items-center gap-2 text-xs text-muted" role="status">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-forest-500" />
            {t("Recomputing field analyses and preparing an answer…")}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-[#e7c4bd] bg-[#fbf0ee] px-3 py-2 text-xs text-[#8a352a] dark:border-[#6b3a32] dark:bg-[#2a1714] dark:text-[#f0b0a3]"
          >
            <AlertIcon size={14} />
            <span>{error}</span>
          </div>
        )}

        <div ref={endRef} />
      </div>

      <div className="border-t border-line bg-card px-4 py-3">
        <label htmlFor={`chat-${fieldId}-${compact ? "compact" : "full"}`} className="sr-only">
          {t("Ask the field assistant a question")}
        </label>
        <div className="flex items-end gap-2">
          <textarea
            id={`chat-${fieldId}-${compact ? "compact" : "full"}`}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submit(input);
              }
            }}
            rows={compact ? 1 : 2}
            maxLength={1000}
            placeholder={t("Ask about irrigation, rainfall, temperature, crop health…")}
            className="input min-h-[42px] resize-none py-2.5"
            disabled={sending}
          />
          <button
            type="button"
            onClick={() => void submit(input)}
            disabled={sending || input.trim().length < 2}
            className="btn-primary h-[42px] shrink-0 px-3.5"
            aria-label={t("Send question")}
          >
            <SendIcon size={16} className="rtl:-scale-x-100" />
          </button>
        </div>
        <p className="mt-1.5 text-[10px] leading-relaxed text-muted">
          {t(
            "The assistant only explains computed data. It cannot invent measurements or irrigation volumes. Enter to send · Shift+Enter for a new line.",
          )}
        </p>
      </div>
    </section>
  );
}
