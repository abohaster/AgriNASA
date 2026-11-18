import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { ErrorState } from "../components/ui/AsyncState";
import { InfoNote } from "../components/ui/InfoNote";
import { SectionHeading } from "../components/ui/SectionHeading";
import { StatusPill } from "../components/ui/StatusPill";
import { AlertIcon, CheckIcon, SendIcon, SparkIcon } from "../components/ui/Icons";
import { useDataMode } from "../context/DataModeContext";
import { useAsync } from "../hooks/useAsync";
import { useI18n } from "../i18n/I18nContext";
import { describeError, rayyanApi, type RayyanErrorInfo } from "./client";
import { RayyanShell } from "./RayyanShell";
import { capabilityLabel, useRayyanT } from "./strings";
import type { CapabilityStatus, RayyanAskResponse, RayyanCapability } from "./types";

interface Turn {
  id: string;
  role: "user" | "assistant";
  content: string;
  response?: RayyanAskResponse;
}

const CAP_TONE: Record<CapabilityStatus, "good" | "info" | "warn" | "neutral" | "bad"> = {
  AVAILABLE: "good",
  PARTIALLY_AVAILABLE: "info",
  CONFIGURATION_REQUIRED: "warn",
  DATA_UNAVAILABLE: "warn",
  DEMO_ONLY: "neutral",
  NOT_IMPLEMENTED: "bad",
};

function CapabilityRow({ item }: { item: RayyanCapability }) {
  const { tm, lang } = useI18n();
  return (
    <li className="flex items-start justify-between gap-2 border-b border-line/70 py-2 last:border-b-0">
      <div className="min-w-0">
        <p className="text-xs font-medium text-ink">{capabilityLabel(lang, item.id, tm(item.label))}</p>
        <p className="mt-0.5 text-2xs leading-relaxed text-muted">{tm(item.detail)}</p>
      </div>
      <StatusPill tone={CAP_TONE[item.status]} dot={false} className="shrink-0 font-mono">
        {item.status}
      </StatusPill>
    </li>
  );
}

function AssistantTurn({ turn }: { turn: Turn }) {
  const { t } = useRayyanT();
  const { tm } = useI18n();
  const response = turn.response;
  if (!response) return null;

  const isGemini = response.provider === "gemini";
  const validationLabel =
    response.validation.status === "passed"
      ? t("chat.validationPassed")
      : response.validation.status === "rejected"
        ? t("chat.validationRejected")
        : t("chat.validationSkipped");

  return (
    <div className="flex justify-start">
      <div className="w-full max-w-[94%] rounded-lg rounded-es-sm border border-line bg-card px-3.5 py-3">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <span className="text-2xs font-semibold uppercase tracking-[0.08em] text-forest-700">
            {t("chat.rayyan")}
          </span>
          <StatusPill tone={isGemini ? "info" : "neutral"} dot={false}>
            {isGemini ? t("chat.providerGemini") : t("chat.providerFallback")}
          </StatusPill>
          {response.model && (
            <span className="font-mono text-2xs text-muted" dir="ltr">
              {response.model}
            </span>
          )}
          <StatusPill tone={response.validation.status === "rejected" ? "warn" : "neutral"} dot={false}>
            {t("chat.validation")}: {validationLabel}
          </StatusPill>
        </div>

        <p className="whitespace-pre-line text-sm leading-relaxed text-ink/90">{response.reply}</p>

        {response.notice && (
          <p className="mt-2 border-t border-line pt-2 text-2xs leading-relaxed text-muted">
            {tm(response.notice)}
          </p>
        )}

        {!isGemini && (
          <p className="mt-1.5 text-2xs leading-relaxed text-clay-600">{t("chat.fallbackNotice")}</p>
        )}

        {response.provider_error && (
          <p className="mt-1.5 font-mono text-[10px] text-clay-600">
            {response.provider_error.code} · {tm(response.provider_error.message)}
          </p>
        )}

        {response.validation.rejected_numbers.length > 0 && (
          <p className="mt-1.5 text-2xs text-clay-600">
            {t("chat.rejectedNumbers")}:{" "}
            <span className="font-mono">{response.validation.rejected_numbers.join(", ")}</span>
          </p>
        )}

        <details className="mt-2">
          <summary className="cursor-pointer text-2xs font-medium text-forest-700 hover:underline">
            {t("chat.inspectContext")}
          </summary>
          <div className="mt-1.5 space-y-2">
            <pre
              dir="ltr"
              className="scroll-thin max-h-56 overflow-auto rounded border border-line bg-sage-50 p-2 font-mono text-[10px] leading-relaxed text-muted"
            >
              {JSON.stringify(response.context_used, null, 2)}
            </pre>
            <p className="text-2xs text-muted">
              {t("chat.model")}: <span className="font-mono">{response.model ?? "—"}</span>
              {response.key_label ? ` · ${t("chat.key")}: ${response.key_label}` : ""}
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}

function ErrorPanel({ error, onDismiss }: { error: RayyanErrorInfo; onDismiss: () => void }) {
  const { t } = useRayyanT();
  const ctaTitle =
    error.code === "GEMINI_QUOTA_EXCEEDED"
      ? t("chat.quotaTitle")
      : error.code === "GEMINI_KEY_INVALID"
        ? t("chat.invalidTitle")
        : error.code === "RAYAN_NO_ACTIVE_KEY"
          ? t("chat.noKeyTitle")
          : null;
  const ctaBody =
    error.code === "GEMINI_QUOTA_EXCEEDED"
      ? t("chat.quotaBody")
      : error.code === "GEMINI_KEY_INVALID"
        ? t("chat.invalidBody")
        : error.code === "RAYAN_NO_ACTIVE_KEY"
          ? t("chat.noKeyBody")
          : null;

  return (
    <div
      role="alert"
      className="rounded-md border border-[#e7c4bd] bg-[#fbf0ee] px-3.5 py-3 text-xs text-[#8a352a] dark:border-[#6b3a32] dark:bg-[#2a1714] dark:text-[#f0b0a3]"
    >
      <div className="flex items-start gap-2">
        <AlertIcon size={15} />
        <div className="space-y-1">
          <p className="font-semibold">{ctaTitle ?? t("chat.requestFailed")}</p>
          <p className="leading-relaxed">{error.message}</p>
          {error.details && <p className="leading-relaxed opacity-80">{error.details}</p>}
          {ctaBody && <p className="leading-relaxed">{ctaBody}</p>}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {ctaTitle && (
              <Link to="/rayyan/settings" className="btn-secondary btn-sm">
                {t("chat.openSettings")}
              </Link>
            )}
            <button type="button" className="btn-ghost btn-sm" onClick={onDismiss}>
              {t("common.cancel")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Grounded chat screen: Fale7 only explains what the backend computed. */
export function RayyanChatPage() {
  const { t } = useRayyanT();
  const { lang } = useI18n();
  const { mode } = useDataMode();
  const [searchParams] = useSearchParams();
  const requestedField = Number.parseInt(searchParams.get("field") ?? "", 10);
  const requestedFieldId = Number.isFinite(requestedField) && requestedField > 0 ? requestedField : null;

  const availability = useAsync((signal) => rayyanApi.availability(signal), []);
  const fields = useAsync((signal) => api.listFields(signal), []);
  const capabilities = useAsync((signal) => rayyanApi.capabilities(mode, signal), [mode]);

  const [selectedFieldId, setSelectedFieldId] = useState<number | null>(requestedFieldId);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<RayyanErrorInfo | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (selectedFieldId === null && fields.data && fields.data.length > 0) {
      setSelectedFieldId(fields.data[0].id);
    }
  }, [fields.data, selectedFieldId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [turns.length, sending]);

  const configured = availability.data?.configured ?? false;
  const canAsk = configured && selectedFieldId !== null && !sending;

  async function submit(event: FormEvent | null, preset?: string) {
    if (event) event.preventDefault();
    const question = (preset ?? input).trim();
    if (!canAsk || !selectedFieldId || question.length < 2) return;

    setSending(true);
    setError(null);
    setInput("");
    setTurns((current) => [...current, { id: `u-${Date.now()}`, role: "user", content: question }]);

    try {
      const response = await rayyanApi.ask({
        field_id: selectedFieldId,
        message: question,
        lang,
        conversation_id: conversationId,
        mode,
      });
      setConversationId(response.conversation_id);
      setTurns((current) => [
        ...current,
        { id: `a-${Date.now()}`, role: "assistant", content: response.reply, response },
      ]);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSending(false);
    }
  }

  function resetConversation() {
    setTurns([]);
    setConversationId(null);
    setError(null);
  }

  return (
    <RayyanShell title="Fale7" subtitle={t("brand.subtitle")}>
      <SectionHeading
        eyebrow={t("chat.eyebrow")}
        title={t("chat.title")}
        description={t("chat.description")}
        as="h1"
        actions={
          <>
            <StatusPill tone={configured ? "good" : "warn"} dot={false}>
              {configured ? t("settings.configured") : t("chat.notConnectedTitle")}
            </StatusPill>
            <Link to="/rayyan/settings" className="btn-secondary btn-sm">
              {t("chat.openSettings")}
            </Link>
          </>
        }
      />

      {mode === "demo" && (
        <div className="mt-4">
          <InfoNote tone="warn" title={t("chat.demoNotice")}>
            {t("chat.ephemeral")}
          </InfoNote>
        </div>
      )}

      {!configured && availability.status === "success" && (
        <div className="mt-4">
          <InfoNote tone="warn" title={t("chat.notConnectedTitle")}>
            {t("chat.notConnectedBody")}{" "}
            <Link to="/rayyan/settings" className="link-underline">
              {t("chat.openSettings")}
            </Link>
          </InfoNote>
        </div>
      )}

      {availability.status === "error" && availability.error && (
        <div className="mt-4">
          <ErrorState
            title={t("chat.title")}
            message={describeError(availability.error).message}
            onRetry={availability.reload}
          />
        </div>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="card flex flex-col overflow-hidden" aria-label={t("chat.title")}>
          <div className="flex flex-wrap items-end gap-2 border-b border-line bg-card px-4 py-3">
            <label className="min-w-[200px] flex-1">
              <span className="field-label">{t("chat.fieldLabel")}</span>
              <select
                className="input py-1.5 text-xs"
                value={selectedFieldId ?? ""}
                onChange={(event) => setSelectedFieldId(Number.parseInt(event.target.value, 10))}
                disabled={!fields.data || fields.data.length === 0}
              >
                <option value="" disabled>
                  {t("chat.fieldPlaceholder")}
                </option>
                {fields.data?.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={resetConversation}
              disabled={turns.length === 0 && !conversationId}
            >
              {t("chat.newChat")}
            </button>
          </div>

          <div
            className="scroll-thin min-h-[320px] max-h-[560px] flex-1 space-y-3 overflow-y-auto bg-paper px-4 py-4"
            aria-live="polite"
            aria-busy={sending}
          >
            {fields.status === "loading" && <p className="text-xs text-muted">{t("common.loading")}</p>}
            {fields.status === "success" && (fields.data?.length ?? 0) === 0 && (
              <p className="rounded-md border border-dashed border-line bg-sage-50 p-4 text-xs text-muted">
                {t("chat.noFields")}
              </p>
            )}

            {turns.length === 0 && fields.status === "success" && (fields.data?.length ?? 0) > 0 && (
              <div className="rounded-md border border-dashed border-line bg-sage-50 p-4">
                <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
                  <SparkIcon size={15} />
                  {t("chat.title")}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{t("chat.description")}</p>
                <p className="mt-2 text-2xs text-muted">{t("chat.ephemeral")}</p>
              </div>
            )}

            {turns.map((turn) =>
              turn.role === "user" ? (
                <div key={turn.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-lg rounded-ee-sm bg-forest-800 px-3.5 py-2.5 text-sm leading-relaxed text-paper">
                    {turn.content}
                  </div>
                </div>
              ) : (
                <AssistantTurn key={turn.id} turn={turn} />
              ),
            )}

            {sending && (
              <p className="flex items-center gap-2 text-xs text-muted" role="status">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-forest-500" />
                {t("chat.thinking")}
              </p>
            )}

            {error && <ErrorPanel error={error} onDismiss={() => setError(null)} />}
            <div ref={endRef} />
          </div>

          <form className="border-t border-line bg-card px-4 py-3" onSubmit={(event) => void submit(event)}>
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void submit(null);
                  }
                }}
                rows={2}
                maxLength={1000}
                placeholder={configured ? t("chat.inputPlaceholder") : t("chat.notConnectedTitle")}
                className="input min-h-[42px] resize-none py-2.5"
                disabled={!canAsk}
              />
              <button
                type="submit"
                className="btn-primary h-[42px] shrink-0 px-3.5"
                disabled={!canAsk || input.trim().length < 2}
                aria-label={t("chat.send")}
              >
                <SendIcon size={16} className="rtl:-scale-x-100" />
              </button>
            </div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-muted">
              {selectedFieldId === null ? t("chat.selectFieldFirst") : t("chat.ephemeral")}
            </p>
          </form>
        </section>

        <div className="space-y-5">
          <section className="card card-pad" aria-labelledby="rayyan-capabilities">
            <h2 id="rayyan-capabilities" className="text-sm font-semibold">
              {t("chat.capabilitiesTitle")}
            </h2>
            <p className="mt-1 text-2xs leading-relaxed text-muted">
              {t("chat.capabilitiesDescription")}
            </p>
            {capabilities.status === "loading" && (
              <p className="mt-3 text-xs text-muted">{t("common.loading")}</p>
            )}
            {capabilities.status === "error" && capabilities.error && (
              <p className="mt-3 text-2xs text-clay-600">
                {describeError(capabilities.error).message}
              </p>
            )}
            {capabilities.status === "success" && capabilities.data && (
              <>
                <p className="mt-2 font-mono text-2xs text-muted">{capabilities.data.data_mode}</p>
                <ul className="mt-2">
                  {capabilities.data.capabilities.map((item) => (
                    <CapabilityRow key={item.id} item={item} />
                  ))}
                </ul>
              </>
            )}
          </section>

          {availability.status === "success" && availability.data && (
            <section className="card card-pad" aria-labelledby="rayyan-connection-summary">
              <h2 id="rayyan-connection-summary" className="text-sm font-semibold">
                {t("settings.connection")}
              </h2>
              <dl className="mt-2 text-2xs leading-relaxed text-muted">
                <div className="flex items-center justify-between gap-2 border-b border-line/70 py-1.5">
                  <dt>{t("settings.activeKey")}</dt>
                  <dd className="text-end font-medium text-ink">
                    {availability.data.active_key_label ?? t("settings.noActiveKey")}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2 border-b border-line/70 py-1.5">
                  <dt>{t("settings.selectedModel")}</dt>
                  <dd className="text-end font-mono text-ink" dir="ltr">
                    {availability.data.model ?? "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2 border-b border-line/70 py-1.5">
                  <dt>{t("settings.rateLimit")}</dt>
                  <dd className="text-end font-mono text-ink">{availability.data.max_requests_per_hour}</dd>
                </div>
                <div className="flex items-center justify-between gap-2 py-1.5">
                  <dt>{t("settings.authMode")}</dt>
                  <dd className="text-end text-ink">
                    {availability.data.auth_mode === "token"
                      ? t("settings.authToken")
                      : t("settings.authLoopback")}
                  </dd>
                </div>
              </dl>
            </section>
          )}

          {turns.some((turn) => turn.response) && (
            <section className="card card-pad" aria-labelledby="rayyan-sources">
              <h2 id="rayyan-sources" className="text-sm font-semibold">
                {t("chat.sourcesTitle")}
              </h2>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {Array.from(
                  new Set(
                    turns
                      .flatMap((turn) => turn.response?.sources ?? [])
                      .map((source) => (typeof source.name === "string" ? source.name : null))
                      .filter((name): name is string => Boolean(name)),
                  ),
                ).map((name) => (
                  <li
                    key={name}
                    className="rounded-full border border-line bg-sage-50 px-2 py-0.5 text-2xs text-muted"
                  >
                    {name}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <InfoNote tone="neutral" title={t("settings.securityTitle")}>
            <span className="flex items-start gap-1.5">
              <CheckIcon size={13} />
              <span>{t("settings.securityBody")}</span>
            </span>
          </InfoNote>
        </div>
      </div>
    </RayyanShell>
  );
}
