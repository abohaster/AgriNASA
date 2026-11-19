import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ErrorState, LoadingState } from "../components/ui/AsyncState";
import { InfoNote } from "../components/ui/InfoNote";
import { SectionHeading } from "../components/ui/SectionHeading";
import { StatusPill } from "../components/ui/StatusPill";
import { AlertIcon, CheckIcon, DatabaseIcon, PlusIcon, RefreshIcon, TrashIcon } from "../components/ui/Icons";
import { useAsync } from "../hooks/useAsync";
import { useI18n } from "../i18n/I18nContext";
import { formatDateTime } from "../lib/format";
import {
  describeError,
  rayyanApi,
  setSettingsToken,
  type RayyanErrorInfo,
} from "./client";
import { Fale7ApiSection } from "./Fale7ApiSection";
import { RayyanShell } from "./RayyanShell";
import { useRayyanT } from "./strings";
import type { RayyanKey, RayyanKeyStatus, RayyanSettingsStatus } from "./types";

function statusTone(status: RayyanKeyStatus): "good" | "warn" | "bad" {
  if (status === "valid") return "good";
  return status === "quota_limited" ? "warn" : "bad";
}

function statusLabel(status: RayyanKeyStatus): "settings.statusValid" | "settings.statusQuota" | "settings.statusInvalid" {
  if (status === "valid") return "settings.statusValid";
  return status === "quota_limited" ? "settings.statusQuota" : "settings.statusInvalid";
}

type ConnectionState =
  | { tone: "good" | "warn" | "bad"; label: string; detail: string | null }
  | null;

function ConnectionTest({ activeKey }: { activeKey: RayyanKey | null }) {
  const { t } = useRayyanT();
  const [state, setState] = useState<ConnectionState>(null);
  const [busy, setBusy] = useState(false);

  async function test() {
    if (!activeKey) return;
    setBusy(true);
    setState(null);
    try {
      const result = await rayyanApi.validateKey(activeKey.id);
      if (result.valid) {
        setState({ tone: "good", label: t("settings.testConnected"), detail: result.message });
      } else if (result.status === "invalid") {
        setState({ tone: "bad", label: t("settings.testInvalidKey"), detail: result.message });
      } else if (result.status === "quota_limited") {
        setState({ tone: "warn", label: t("settings.testRateLimited"), detail: result.message });
      } else {
        setState({ tone: "bad", label: t("settings.testDisconnected"), detail: result.message });
      }
    } catch (err) {
      const info = describeError(err);
      const label =
        info.code === "GEMINI_QUOTA_EXCEEDED"
          ? t("settings.testRateLimited")
          : info.code === "GEMINI_KEY_INVALID"
            ? t("settings.testInvalidKey")
            : t("settings.testDisconnected");
      setState({ tone: label === t("settings.testRateLimited") ? "warn" : "bad", label, detail: info.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-2xs text-muted">{t("settings.testHint")}</span>
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={() => void test()}
          disabled={busy || !activeKey}
        >
          <RefreshIcon size={13} />
          {busy ? t("settings.testing") : t("settings.testConnection")}
        </button>
      </div>
      {state && (
        <p className="mt-2 flex items-center gap-2 text-2xs">
          <StatusPill tone={state.tone}>{state.label}</StatusPill>
          {state.detail && <span className="text-muted">{state.detail}</span>}
        </p>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line/70 py-2 last:border-b-0">
      <dt className="text-2xs uppercase tracking-[0.08em] text-muted">{label}</dt>
      <dd className="text-end text-xs font-medium text-ink">{value}</dd>
    </div>
  );
}

function ErrorLine({ error }: { error: RayyanErrorInfo | null }) {
  if (!error) return null;
  return (
    <div role="alert" className="mt-2 flex items-start gap-1.5 text-2xs text-[#8a352a] dark:text-[#f0b0a3]">
      <AlertIcon size={13} />
      <span>
        {error.message}
        {error.details ? ` — ${error.details}` : ""}
      </span>
    </div>
  );
}

function SavedKeyRow({
  item,
  onChanged,
}: {
  item: RayyanKey;
  onChanged: () => void;
}) {
  const { t } = useRayyanT();
  const { tm } = useI18n();
  const [busy, setBusy] = useState<null | "test" | "activate" | "delete" | "model" | "models">(null);
  const [models, setModels] = useState<string[] | null>(null);
  const [modelsSource, setModelsSource] = useState<"live" | "cached" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<RayyanErrorInfo | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function run(action: Exclude<typeof busy, null>, task: () => Promise<void>) {
    setBusy(action);
    setError(null);
    setNotice(null);
    try {
      await task();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(null);
    }
  }

  async function testKey() {
    await run("test", async () => {
      const result = await rayyanApi.validateKey(item.id);
      if (result.status === "valid") setNotice(t("settings.validationOk"));
      else if (result.status === "quota_limited") setNotice(t("settings.validationQuota"));
      else if (result.status === "invalid") setNotice(t("settings.validationFailed"));
      else setNotice(t("settings.validationTransient"));
      if (result.models.length > 0) {
        setModels(result.models);
        setModelsSource("live");
      }
      onChanged();
    });
  }

  async function loadModels() {
    await run("models", async () => {
      const result = await rayyanApi.models(item.id);
      setModels(result.models);
      setModelsSource(result.models_source === "cached" ? "cached" : "live");
    });
  }

  async function useModel(model: string) {
    await run("model", async () => {
      await rayyanApi.updateKey(item.id, { model });
      setNotice(t("settings.modelSaved"));
      onChanged();
    });
  }

  const selectableModels = models ?? (item.model ? [item.model] : []);

  return (
    <article className="rounded-md border border-line bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{item.label}</h3>
            {item.active && (
              <StatusPill tone="info" dot={false}>
                {t("settings.active")}
              </StatusPill>
            )}
            <StatusPill tone={statusTone(item.status)}>{t(statusLabel(item.status))}</StatusPill>
          </div>
          <p className="mt-1 font-mono text-xs tracking-tight text-muted" dir="ltr">
            {item.masked_key}
          </p>
        </div>
        <div className="text-end text-2xs text-muted">
          <p>
            {t("settings.created")}: {formatDateTime(item.created_at)}
          </p>
          <p>
            {t("settings.lastChecked")}:{" "}
            {item.last_validated_at ? formatDateTime(item.last_validated_at) : t("settings.never")}
          </p>
        </div>
      </div>

      {item.last_error_code && (
        <p className="mt-2 rounded border border-clay-200 bg-clay-50 px-2 py-1 font-mono text-[10px] text-clay-600">
          {t("settings.lastError")}: {item.last_error_code}
          {item.last_error_message ? ` · ${tm(item.last_error_message)}` : ""}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="min-w-[200px] flex-1">
          <span className="field-label">{t("settings.modelLabel")}</span>
          <select
            className="input py-1.5 text-xs"
            value={item.model ?? ""}
            disabled={!item.active && selectableModels.length === 0}
            onChange={(event) => {
              if (event.target.value) void useModel(event.target.value);
            }}
          >
            <option value="">
              {item.model ?? t("settings.modelUnresolved")}
            </option>
            {selectableModels
              .filter((model) => model !== item.model)
              .map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
          </select>
        </label>
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={() => void loadModels()}
          disabled={busy !== null}
        >
          <RefreshIcon size={13} />
          {busy === "models" ? t("settings.loadingModels") : t("settings.loadModels")}
        </button>
        {modelsSource && (
          <span className="text-2xs text-muted">
            {modelsSource === "cached"
              ? t("settings.modelsSourceCached")
              : t("settings.modelsSourceLive")}
          </span>
        )}
        {busy === "model" && <span className="text-2xs text-muted">{t("common.loading")}</span>}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line/70 pt-3">
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={() => void testKey()}
          disabled={busy !== null}
        >
          {busy === "test" ? t("settings.testing") : t("settings.test")}
        </button>
        {!item.active && (
          <button
            type="button"
            className="btn-primary btn-sm"
            disabled={busy !== null || item.status === "invalid"}
            onClick={() =>
              void run("activate", async () => {
                await rayyanApi.activateKey(item.id);
                onChanged();
              })
            }
          >
            {t("settings.activate")}
          </button>
        )}
        {confirming ? (
          <>
            <button
              type="button"
              className="btn-sm inline-flex items-center gap-1 rounded-md border border-[#e7c4bd] bg-[#fbf0ee] px-3 py-1.5 text-xs font-medium text-[#8a352a] dark:border-[#6b3a32] dark:bg-[#2a1714] dark:text-[#f0b0a3]"
              disabled={busy !== null}
              onClick={() =>
                void run("delete", async () => {
                  await rayyanApi.deleteKey(item.id);
                  onChanged();
                })
              }
            >
              <TrashIcon size={13} />
              {t("settings.confirmDelete")}
            </button>
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => setConfirming(false)}
              disabled={busy !== null}
            >
              {t("common.cancel")}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn-ghost btn-sm text-[#8a352a] dark:text-[#f0b0a3]"
            onClick={() => setConfirming(true)}
            disabled={busy !== null}
          >
            <TrashIcon size={13} />
            {t("settings.delete")}
          </button>
        )}
      </div>

      {notice && (
        <p className="mt-2 flex items-start gap-1.5 text-2xs text-forest-700">
          <CheckIcon size={13} />
          <span>{notice}</span>
        </p>
      )}
      <ErrorLine error={error} />
    </article>
  );
}

function AddKeyCard({ onAdded, hasKeys }: { onAdded: () => void; hasKeys: boolean }) {
  const { t } = useRayyanT();
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<RayyanErrorInfo | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmedLabel = label.trim();
    const trimmedKey = apiKey.trim();
    if (!trimmedLabel || trimmedKey.length < 20) return;

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await rayyanApi.addKey({ label: trimmedLabel, api_key: trimmedKey });
      setNotice(t(hasKeys ? "settings.addSuccess" : "settings.addFirstActive"));
      setLabel("");
      onAdded();
    } catch (err) {
      setError(describeError(err));
    } finally {
      // The key lives in component state for the duration of the request only.
      setApiKey("");
      setBusy(false);
    }
  }

  return (
    <section className="card card-pad" aria-labelledby="rayyan-add-key">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest-50 text-forest-700">
          <PlusIcon size={16} />
        </span>
        <div>
          <h2 id="rayyan-add-key" className="text-sm font-semibold">
            {t("settings.addTitle")}
          </h2>
          <p className="text-2xs leading-relaxed text-muted">{t("settings.addDescription")}</p>
        </div>
      </div>

      <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(event) => void submit(event)}>
        <label>
          <span className="field-label">{t("settings.labelField")}</span>
          <input
            className="input"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder={t("settings.labelPlaceholder")}
            maxLength={120}
            autoComplete="off"
            disabled={busy}
          />
        </label>
        <label>
          <span className="field-label">{t("settings.keyField")}</span>
          <input
            className="input font-mono text-xs"
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={t("settings.keyPlaceholder")}
            autoComplete="new-password"
            spellCheck={false}
            dir="ltr"
            maxLength={200}
            disabled={busy}
          />
        </label>
        <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="btn-primary btn-sm"
            disabled={busy || !label.trim() || apiKey.trim().length < 20}
          >
            {busy ? t("settings.adding") : t("settings.addSubmit")}
          </button>
          <p className="text-2xs text-muted">{t("settings.keyNote")}</p>
        </div>
      </form>

      {notice && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-forest-700">
          <CheckIcon size={14} />
          <span>{notice}</span>
        </p>
      )}
      <ErrorLine error={error} />
    </section>
  );
}

function TokenGate({ onUnlocked, hint }: { onUnlocked: () => void; hint: string }) {
  const { t } = useRayyanT();
  const [token, setToken] = useState("");
  return (
    <section className="card card-pad mx-auto max-w-xl">
      <h2 className="text-sm font-semibold">{t("token.title")}</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted">{t("token.description")}</p>
      <p className="mt-2 text-2xs text-[#8a352a] dark:text-[#f0b0a3]">{hint}</p>
      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          if (!token.trim()) return;
          setSettingsToken(token);
          setToken("");
          onUnlocked();
        }}
      >
        <input
          className="input flex-1 font-mono text-xs"
          type="password"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          aria-label={t("token.field")}
          autoComplete="off"
          dir="ltr"
        />
        <button type="submit" className="btn-primary btn-sm" disabled={!token.trim()}>
          {t("token.submit")}
        </button>
      </form>
    </section>
  );
}

function SettingsBody({ data, reload }: { data: RayyanSettingsStatus; reload: () => void }) {
  const { t } = useRayyanT();
  const { tm } = useI18n();
  const active = data.active_key;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-5">
        <AddKeyCard onAdded={reload} hasKeys={data.keys.length > 0} />

        <section className="card card-pad" aria-labelledby="rayyan-saved-keys">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="rayyan-saved-keys" className="text-sm font-semibold">
              {t("settings.keysTitle")}
            </h2>
            <button type="button" className="btn-ghost btn-sm" onClick={reload}>
              <RefreshIcon size={13} />
              {t("common.refresh")}
            </button>
          </div>
          <p className="mt-1 text-2xs text-muted">{t("settings.maskedNote")}</p>

          <div className="mt-3 space-y-3">
            {data.keys.length === 0 && (
              <p className="rounded-md border border-dashed border-line bg-sage-50 p-4 text-xs leading-relaxed text-muted">
                {t("settings.keysEmpty")}
              </p>
            )}
            {data.keys.map((item) => (
              <SavedKeyRow key={item.id} item={item} onChanged={reload} />
            ))}
          </div>
        </section>
      </div>

      <div className="space-y-5">
        <section className="card card-pad" aria-labelledby="rayyan-connection">
          <div className="flex items-center justify-between gap-2">
            <h2 id="rayyan-connection" className="text-sm font-semibold">
              {t("settings.connection")}
            </h2>
            <StatusPill tone={data.configured ? "good" : "warn"}>
              {data.configured ? t("settings.configured") : t("settings.notConfigured")}
            </StatusPill>
          </div>

          <dl className="mt-3">
            <Field label={t("settings.provider")} value={t("settings.providerName")} />
            <Field
              label={t("settings.activeKey")}
              value={active ? `${active.label} · ${active.masked_key}` : t("settings.noActiveKey")}
            />
            <Field
              label={t("settings.source")}
              value={
                data.source === "saved"
                  ? t("settings.sourceSaved")
                  : data.source === "environment"
                    ? t("settings.sourceEnv")
                    : t("settings.sourceNone")
              }
            />
            <Field
              label={t("settings.selectedModel")}
              value={active?.model ?? data.models[0] ?? t("settings.modelUnresolved")}
            />
            <Field
              label={t("settings.authMode")}
              value={data.auth_mode === "token" ? t("settings.authToken") : t("settings.authLoopback")}
            />
            <Field label={t("settings.encryption")} value={data.encryption} />
            <Field label={t("settings.storage")} value={t("settings.storageValue")} />
          </dl>

          {active?.last_error_message && (
            <p className="mt-2 text-2xs leading-relaxed text-clay-600">
              {tm(active.last_error_message)}
            </p>
          )}

          <ConnectionTest activeKey={active} />
        </section>

        <InfoNote tone="info" title={t("settings.switchHint")}>
          {t("settings.quotaHint")}
        </InfoNote>

        {data.bootstrap_env_present && (
          <InfoNote tone="neutral" title={t("settings.sourceEnv")}>
            {t("settings.envNote")}
          </InfoNote>
        )}

        <section className="card card-pad">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <DatabaseIcon size={15} />
            {t("settings.securityTitle")}
          </h2>
          <p className="mt-2 text-2xs leading-relaxed text-muted">{t("settings.securityBody")}</p>
          <p className="mt-3 border-t border-line pt-3 text-2xs text-muted">
            <Link to="/rayyan" className="link-underline">
              {t("common.backToAssistant")}
            </Link>
          </p>
        </section>
      </div>

      <div className="xl:col-span-2">
        <Fale7ApiSection />
      </div>
    </div>
  );
}

/** Key management screen: add → validate → save → activate/switch/delete. */
export function RayyanSettingsPage() {
  const { t } = useRayyanT();
  const [authVersion, setAuthVersion] = useState(0);
  const status = useAsync((signal) => rayyanApi.settings(signal), [authVersion]);
  // Keep the last snapshot on screen while a reload runs, so per-row action
  // notices and model lists survive the refresh triggered by that action.
  const [lastData, setLastData] = useState<RayyanSettingsStatus | null>(null);
  useEffect(() => {
    if (status.data) setLastData(status.data);
  }, [status.data]);
  const data = status.data ?? lastData;

  return (
    <RayyanShell title="Fale7" subtitle={t("brand.subtitle")}>
      <SectionHeading
        eyebrow={t("settings.eyebrow")}
        title={t("settings.title")}
        description={t("settings.description")}
        as="h1"
      />

      <div className="mt-6">
        {!data && status.status === "loading" && <LoadingState label={t("common.loading")} rows={2} />}

        {!data && status.status === "error" && status.error && (
          <>
            {describeError(status.error).status === 401 || describeError(status.error).status === 403 ? (
              <TokenGate
                hint={describeError(status.error).message}
                onUnlocked={() => setAuthVersion((value) => value + 1)}
              />
            ) : (
              <ErrorState
                title={t("settings.title")}
                message={describeError(status.error).message}
                details={describeError(status.error).details}
                onRetry={status.reload}
              />
            )}
          </>
        )}

        {data && <SettingsBody data={data} reload={status.reload} />}
      </div>
    </RayyanShell>
  );
}
