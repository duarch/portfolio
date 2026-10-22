import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { dictionaries, normalizeLocale, COUNTRIES } from "../shared/locale.js";
import { LIMITS, MIME_TYPES } from "../shared/config.js";
import { apps, ticketSchema, uploadRequestSchema } from "../shared/schema.js";
import { useTurnstile } from "./turnstile.js";

const initialForm = {
  name: "",
  email: "",
  phone: "",
  country: "",
  city: "",
  appId: "",
  description: "",
  wantsReply: true,
  consent: false,
  website: "",
};

const API_BASE = (import.meta.env.VITE_SUPPORT_API_BASE || "").replace(
  /\/$/,
  "",
);
const apiUrl = (path) => `${API_BASE}${path}`;

function storedLocale() {
  try {
    const query = new URLSearchParams(window.location.search).get("lang");
    const requested = normalizeLocale(query);
    if (requested) return requested;
    const preference = localStorage.getItem("language");
    return /^(pt(?:-br)?|en|es)$/i.test(preference || "")
      ? normalizeLocale(preference)
      : null;
  } catch {
    return null;
  }
}

function persistLocale(locale) {
  try {
    localStorage.setItem("language", locale === "pt-BR" ? "pt" : locale);
  } catch {
    // The form still works when browser storage is unavailable.
  }
}

function messageKey(value) {
  return typeof value === "string" && value.startsWith("errors.")
    ? value
    : "errors.server";
}

function hasProductionPolicy(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

async function postJSON(url, body, headers = {}) {
  let response;
  try {
    response = await fetch(apiUrl(url), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      credentials: "omit",
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("ui.networkError");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      messageKey(data.error?.code || data.error || data.code),
    );
    error.issues = data.issues || data.error?.issues;
    throw error;
  }
  return data;
}

function uploadFile(file, url, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.timeout = 15 * 60 * 1000;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error("ui.uploadFailed"));
    };
    xhr.onerror = () => reject(new Error("ui.uploadFailed"));
    xhr.ontimeout = () => reject(new Error("ui.uploadFailed"));
    xhr.onabort = () => reject(new Error("ui.uploadFailed"));
    xhr.send(file);
  });
}

function issueMap(issues) {
  const fields = {};
  for (const issue of issues || []) {
    const path = issue.path?.[0];
    const field =
      path === "consentVersion"
        ? "consent"
        : path === "turnstileToken"
          ? "_form"
          : path || "_form";
    if (!fields[field]) fields[field] = messageKey(issue.message);
  }
  return fields;
}

function Field({ name, label, optional, hint, error, t, children }) {
  return (
    <div className={`support-field${error ? " support-field-invalid" : ""}`}>
      <label htmlFor={`support-${name}`}>
        {label}{" "}
        <span className="support-field-status">
          {optional ? (
            t("ui.optional")
          ) : (
            <>
              <span aria-hidden="true">*</span>
              <span className="support-sr-only">{t("ui.required")}</span>
            </>
          )}
        </span>
      </label>
      {children}
      {hint && (
        <p className="support-hint" id={`support-${name}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="support-field-error" id={`support-${name}-error`}>
          {t(error)}
        </p>
      )}
    </div>
  );
}

export function SupportApp() {
  const preferenceRef = useRef(storedLocale());
  const [locale, setLocale] = useState(preferenceRef.current || "en");
  const [config, setConfig] = useState(null);
  const [configError, setConfigError] = useState("");
  const [configAttempt, setConfigAttempt] = useState(0);
  const [form, setForm] = useState(initialForm);
  const [files, setFiles] = useState([]);
  const filesRef = useRef(files);
  filesRef.current = files;
  const [errors, setErrors] = useState({});
  const [errorCount, setErrorCount] = useState(0);
  const [phase, setPhase] = useState("");
  const [success, setSuccess] = useState(null);
  const errorRef = useRef(null);
  const successRef = useRef(null);
  const idempotencyRef = useRef(null);
  const challenge = useTurnstile(config, locale);
  const busy = Boolean(phase);

  const t = useCallback(
    (key, variables = {}) => {
      const template =
        dictionaries[locale]?.[key] ?? dictionaries.en[key] ?? key;
      return template.replace(/\{(\w+)\}/g, (match, variable) =>
        String(variables[variable] ?? match),
      );
    },
    [locale],
  );

  useEffect(() => {
    const controller = new AbortController();
    setConfigError("");
    fetch(apiUrl("/api/support/config"), {
      signal: controller.signal,
      credentials: "omit",
    })
      .then(async (response) => {
        const value = await response.json();
        if (!response.ok) throw new Error(messageKey(value.error));
        if (
          !value.consentVersion ||
          (!value.mockServices &&
            (!hasProductionPolicy(value.privacyPolicyUrl) ||
              !value.turnstileSiteKey))
        )
          throw new Error("errors.configuration");
        setConfig(value);
        if (!preferenceRef.current)
          setLocale(normalizeLocale(value.locale) || "en");
      })
      .catch((error) => {
        if (error.name !== "AbortError")
          setConfigError(
            error.message.startsWith("errors.")
              ? error.message
              : "ui.networkError",
          );
      });
    return () => controller.abort();
  }, [configAttempt]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = t("ui.pageTitle");
    persistLocale(locale);
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", t("ui.metaDescription"));
  }, [locale, t]);

  useEffect(() => {
    if (errorCount) errorRef.current?.focus();
  }, [errorCount]);

  useEffect(() => {
    if (success) successRef.current?.focus();
  }, [success]);

  useEffect(
    () => () => {
      filesRef.current.forEach((entry) => URL.revokeObjectURL(entry.preview));
    },
    [],
  );

  const countries = useMemo(() => {
    const names = new Intl.DisplayNames([locale], { type: "region" });
    return COUNTRIES.map((code) => ({
      code,
      name: names.of(code) || code,
    })).sort((a, b) => a.name.localeCompare(b.name, locale));
  }, [locale]);

  function selectLocale(event) {
    const nextLocale = normalizeLocale(event.target.value);
    preferenceRef.current = nextLocale;
    persistLocale(nextLocale);
    setLocale(nextLocale);
  }

  function fail(nextErrors) {
    setErrors(nextErrors);
    setErrorCount((count) => count + 1);
  }

  function change(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
    setErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  }

  function addFiles(event) {
    const chosen = [...event.target.files];
    event.target.value = "";
    if (!chosen.length) return;
    if (files.length + chosen.length > LIMITS.maxFiles) {
      fail({ attachments: "errors.attachments" });
      return;
    }
    const metadata = chosen.map((file) => ({
      name: file.name,
      type: file.type,
      size: file.size,
    }));
    const checked = uploadRequestSchema.safeParse({
      files: metadata,
      turnstileToken: "client-validation",
      website: "",
      locale,
    });
    if (!checked.success) {
      fail({ attachments: messageKey(checked.error.issues[0]?.message) });
      return;
    }
    setFiles((current) => [
      ...current,
      ...chosen.map((file) => ({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
        progress: 0,
        uploaded: null,
      })),
    ]);
    setErrors((current) => {
      const next = { ...current };
      delete next.attachments;
      return next;
    });
  }

  function removeFile(id) {
    const entry = files.find((file) => file.id === id);
    if (entry) URL.revokeObjectURL(entry.preview);
    setFiles((current) => current.filter((file) => file.id !== id));
  }

  function updateFile(id, changes) {
    setFiles((current) =>
      current.map((entry) =>
        entry.id === id ? { ...entry, ...changes } : entry,
      ),
    );
  }

  async function protectedPost(url, payload, headers) {
    setPhase("ui.verifying");
    const token = await challenge.consume();
    try {
      setPhase(
        url.endsWith("/uploads") ? "ui.signingUploads" : "ui.submitting",
      );
      return await postJSON(
        url,
        { ...payload, turnstileToken: token },
        headers,
      );
    } finally {
      challenge.reset();
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (busy || !config) return;
    const candidate = {
      ...form,
      consentVersion: config.consentVersion,
      locale,
      attachments: files
        .filter((entry) => entry.uploaded)
        .map((entry) => ({
          key: entry.uploaded.key,
          proof: entry.uploaded.proof,
        })),
      turnstileToken: "client-validation",
    };
    const checked = ticketSchema.safeParse(candidate);
    if (!checked.success) {
      fail(issueMap(checked.error.issues));
      return;
    }
    setErrors({});
    setPhase("ui.submitting");
    try {
      const pending = files.filter((entry) => !entry.uploaded);
      const attachments = [...checked.data.attachments];
      if (pending.length) {
        const signed = await protectedPost("/api/support/uploads", {
          files: pending.map(({ file }) => ({
            name: file.name,
            type: file.type,
            size: file.size,
          })),
          website: form.website,
          locale,
        });
        if (
          !Array.isArray(signed.uploads) ||
          signed.uploads.length !== pending.length
        )
          throw new Error("errors.server");
        setPhase("ui.uploading");
        // Sequential PUTs keep progress and retries predictable on mobile networks.
        for (let index = 0; index < pending.length; index += 1) {
          const entry = pending[index];
          const upload = signed.uploads[index];
          if (!upload.url || !upload.key || !upload.proof)
            throw new Error("errors.server");
          await uploadFile(entry.file, upload.url, (progress) =>
            updateFile(entry.id, { progress }),
          );
          updateFile(entry.id, { progress: 100, uploaded: upload });
          attachments.push({ key: upload.key, proof: upload.proof });
        }
      }
      const payload = { ...checked.data, attachments };
      const content = { ...payload };
      delete content.turnstileToken;
      const fingerprint = JSON.stringify(content);
      if (idempotencyRef.current?.fingerprint !== fingerprint) {
        idempotencyRef.current = { fingerprint, key: crypto.randomUUID() };
      }
      const result = await protectedPost("/api/support/tickets", payload, {
        "Idempotency-Key": idempotencyRef.current.key,
      });
      if (typeof result.protocol !== "string") throw new Error("errors.server");
      setSuccess({
        protocol: result.protocol,
        wantsReply: checked.data.wantsReply,
      });
      files.forEach((entry) => URL.revokeObjectURL(entry.preview));
      setFiles([]);
    } catch (error) {
      const fields = issueMap(error.issues);
      fail(
        Object.keys(fields).length
          ? fields
          : {
              _form: error.message.startsWith("ui.")
                ? error.message
                : messageKey(error.message),
            },
      );
    } finally {
      setPhase("");
    }
  }

  function restart() {
    setSuccess(null);
    setForm(initialForm);
    setErrors({});
    idempotencyRef.current = null;
    challenge.retry();
    window.requestAnimationFrame(() =>
      document.getElementById("support-name")?.focus(),
    );
  }

  function fieldProps(name, hint = false) {
    return {
      id: `support-${name}`,
      name,
      value: form[name],
      onChange: change,
      "aria-invalid": Boolean(errors[name]),
      "aria-describedby":
        [
          hint && `support-${name}-hint`,
          errors[name] && `support-${name}-error`,
        ]
          .filter(Boolean)
          .join(" ") || undefined,
    };
  }

  const fieldLabel = (field) =>
    t(
      `ui.${field === "appId" ? "app" : field === "consent" ? "privacyPolicy" : field}`,
    );
  const privacyURL = config?.privacyPolicyUrl || "/support/privacy/";
  const safePrivacyURL =
    typeof privacyURL === "string" &&
    (/^https?:\/\//i.test(privacyURL) || /^\/(?!\/)/.test(privacyURL))
      ? privacyURL
      : "/support/privacy/";

  return (
    <div className="support-shell">
      <a className="support-skip" href="#support-content">
        {t("ui.skipLink")}
      </a>
      <header className="support-header">
        <a className="support-brand" href="/" aria-label={t("ui.home")}>
          duar.ch<span aria-hidden="true">↗</span>
        </a>
        <div className="support-language">
          <label htmlFor="support-language">{t("ui.language")}</label>
          <select
            id="support-language"
            value={locale}
            onChange={selectLocale}
            disabled={busy}
          >
            <option value="pt-BR" lang="pt-BR">
              {t("ui.languagePortuguese")}
            </option>
            <option value="en" lang="en">
              {t("ui.languageEnglish")}
            </option>
            <option value="es" lang="es">
              {t("ui.languageSpanish")}
            </option>
          </select>
        </div>
      </header>
      <main id="support-content" className="support-main">
        <section className="support-intro" aria-labelledby="support-title">
          <p className="support-eyebrow">{t("ui.eyebrow")}</p>
          <h1 id="support-title">{t("ui.title")}</h1>
          <p>{t("ui.intro")}</p>
          <a className="support-contact" href="mailto:support@duar.ch">
            support@duar.ch
          </a>
        </section>
        <section
          className="support-card"
          aria-labelledby={
            success ? "support-success-title" : "support-form-title"
          }
        >
          {success ? (
            <div
              className="support-success"
              ref={successRef}
              tabIndex={-1}
              role="status"
            >
              <span className="support-success-icon" aria-hidden="true">
                ✓
              </span>
              <h2 id="support-success-title">{t("ui.successTitle")}</h2>
              <p className="support-hint">{t("ui.protocol")}</p>
              <p className="support-protocol">{success.protocol}</p>
              <p>
                {t(
                  success.wantsReply ? "ui.successReply" : "ui.successNoReply",
                )}
              </p>
              <button
                className="support-button"
                type="button"
                onClick={restart}
              >
                {t("ui.newTicket")}
              </button>
            </div>
          ) : (
            <>
              <div className="support-card-heading">
                <h2 id="support-form-title">{t("ui.formTitle")}</h2>
                <p className="support-hint">{t("ui.requiredNote")}</p>
              </div>
              {configError && (
                <div className="support-alert" role="alert">
                  <p>{t(configError)}</p>
                  <button
                    className="support-text-button"
                    type="button"
                    onClick={() => setConfigAttempt((attempt) => attempt + 1)}
                  >
                    {t("ui.retryConfig")}
                  </button>
                </div>
              )}
              {!config && !configError && (
                <p className="support-hint" role="status">
                  {t("ui.loading")}
                </p>
              )}
              {Object.keys(errors).length > 0 && (
                <div
                  className="support-alert"
                  ref={errorRef}
                  tabIndex={-1}
                  aria-live="assertive"
                  aria-atomic="true"
                >
                  <h3>{t("ui.errorSummary")}</h3>
                  <p>{t("ui.errorIntro")}</p>
                  <ul>
                    {Object.entries(errors).map(([field, error]) => (
                      <li key={field}>
                        {field.startsWith("_") ? (
                          t(error)
                        ) : (
                          <a
                            href={`#support-${field}`}
                            onClick={(event) => {
                              event.preventDefault();
                              document
                                .getElementById(`support-${field}`)
                                ?.focus();
                            }}
                          >
                            {fieldLabel(field)}: {t(error)}
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <form onSubmit={submit} noValidate aria-busy={busy}>
                <fieldset className="support-fields" disabled={busy || !config}>
                  <div className="support-grid">
                    <Field
                      name="name"
                      label={t("ui.name")}
                      error={errors.name}
                      t={t}
                    >
                      <input
                        {...fieldProps("name")}
                        type="text"
                        autoComplete="name"
                        required
                        maxLength={150}
                      />
                    </Field>
                    <Field
                      name="email"
                      label={t("ui.email")}
                      error={errors.email}
                      t={t}
                    >
                      <input
                        {...fieldProps("email")}
                        type="email"
                        autoComplete="email"
                        required
                        maxLength={254}
                      />
                    </Field>
                    <Field
                      name="country"
                      label={t("ui.country")}
                      error={errors.country}
                      t={t}
                    >
                      <select
                        {...fieldProps("country")}
                        autoComplete="country"
                        required
                      >
                        <option value="">{t("ui.selectCountry")}</option>
                        {countries.map(({ code, name }) => (
                          <option key={code} value={code}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field
                      name="city"
                      label={t("ui.city")}
                      optional
                      error={errors.city}
                      t={t}
                    >
                      <input
                        {...fieldProps("city")}
                        type="text"
                        autoComplete="address-level2"
                        maxLength={120}
                      />
                    </Field>
                    <Field
                      name="phone"
                      label={t("ui.phone")}
                      optional
                      error={errors.phone}
                      t={t}
                    >
                      <input
                        {...fieldProps("phone")}
                        type="tel"
                        autoComplete="tel"
                        maxLength={40}
                      />
                    </Field>
                    <Field
                      name="appId"
                      label={t("ui.app")}
                      error={errors.appId}
                      t={t}
                    >
                      <select {...fieldProps("appId")} required>
                        <option value="">{t("ui.selectApp")}</option>
                        {apps.map((app) => (
                          <option key={app.id} value={app.id}>
                            {app.id === "other" ? t("ui.otherApp") : app.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <Field
                    name="description"
                    label={t("ui.description")}
                    hint={t("ui.descriptionHint")}
                    error={errors.description}
                    t={t}
                  >
                    <textarea
                      {...fieldProps("description", true)}
                      rows={7}
                      minLength={20}
                      maxLength={5000}
                      required
                    />
                    <span className="support-counter" aria-hidden="true">
                      {t("ui.characterCount", {
                        count: form.description.length,
                        max: 5000,
                      })}
                    </span>
                  </Field>
                  <Field
                    name="attachments"
                    label={t("ui.attachments")}
                    optional
                    hint={t("ui.attachmentHint", {
                      count: LIMITS.maxFiles,
                      imageMB: LIMITS.imageBytes / 1048576,
                      videoMB: LIMITS.videoBytes / 1048576,
                    })}
                    error={errors.attachments}
                    t={t}
                  >
                    <div className="support-file-picker">
                      <input
                        id="support-attachments"
                        type="file"
                        multiple
                        accept={Object.keys(MIME_TYPES).join(",")}
                        onChange={addFiles}
                        aria-describedby={`support-attachments-hint${errors.attachments ? " support-attachments-error" : ""}`}
                        aria-invalid={Boolean(errors.attachments)}
                      />
                      <span aria-hidden="true">＋ {t("ui.chooseFiles")}</span>
                    </div>
                    {files.length > 0 && (
                      <ul className="support-attachments">
                        {files.map((entry) => (
                          <li key={entry.id}>
                            <div className="support-preview">
                              <span
                                className="support-preview-fallback"
                                aria-hidden="true"
                              >
                                {t(
                                  entry.file.type.startsWith("video/")
                                    ? "ui.fileKindVideo"
                                    : "ui.fileKindImage",
                                )}
                              </span>
                              {entry.file.type.startsWith("video/") ? (
                                <video
                                  src={entry.preview}
                                  controls
                                  preload="metadata"
                                  aria-label={t("ui.attachmentPreview", {
                                    name: entry.file.name,
                                  })}
                                  onError={(event) => {
                                    event.currentTarget.style.display = "none";
                                  }}
                                />
                              ) : (
                                <img
                                  src={entry.preview}
                                  alt={t("ui.attachmentPreview", {
                                    name: entry.file.name,
                                  })}
                                  onError={(event) => {
                                    event.currentTarget.style.display = "none";
                                  }}
                                />
                              )}
                            </div>
                            <div className="support-attachment-detail">
                              <span className="support-filename">
                                {entry.file.name}
                              </span>
                              <span className="support-hint">
                                {(entry.file.size / 1048576).toLocaleString(
                                  locale,
                                  { maximumFractionDigits: 1 },
                                )}{" "}
                                MB
                                {entry.uploaded ? ` · ${t("ui.uploaded")}` : ""}
                              </span>
                              {busy && (
                                <progress
                                  max="100"
                                  value={entry.progress}
                                  aria-label={t("ui.uploadProgress", {
                                    name: entry.file.name,
                                    percent: entry.progress,
                                  })}
                                />
                              )}
                            </div>
                            <button
                              className="support-remove"
                              type="button"
                              onClick={() => removeFile(entry.id)}
                              aria-label={t("ui.removeFile", {
                                name: entry.file.name,
                              })}
                            >
                              ×
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Field>
                  <div className="support-checkbox-field">
                    <label htmlFor="support-wantsReply">
                      <input
                        id="support-wantsReply"
                        name="wantsReply"
                        type="checkbox"
                        checked={form.wantsReply}
                        onChange={change}
                        aria-describedby="support-reply-hint"
                      />
                      <span>{t("ui.wantsReply")}</span>
                    </label>
                    <p id="support-reply-hint" className="support-hint">
                      {t("ui.wantsReplyHint")}
                    </p>
                  </div>
                  <div
                    className={`support-checkbox-field${errors.consent ? " support-field-invalid" : ""}`}
                  >
                    <div className="support-consent-line">
                      <input
                        id="support-consent"
                        name="consent"
                        type="checkbox"
                        checked={form.consent}
                        onChange={change}
                        required
                        aria-invalid={Boolean(errors.consent)}
                        aria-describedby={
                          errors.consent ? "support-consent-error" : undefined
                        }
                      />
                      <span>
                        <label htmlFor="support-consent">
                          {t("ui.consent")}{" "}
                        </label>
                        <a href={safePrivacyURL}>{t("ui.privacyPolicy")}</a>{" "}
                        <span aria-hidden="true">*</span>
                      </span>
                    </div>
                    {errors.consent && (
                      <p
                        className="support-field-error"
                        id="support-consent-error"
                      >
                        {t(errors.consent)}
                      </p>
                    )}
                  </div>
                  <div className="support-honeypot" aria-hidden="true">
                    <label htmlFor="support-website">{t("ui.website")}</label>
                    <input
                      id="support-website"
                      name="website"
                      type="text"
                      value={form.website}
                      onChange={change}
                      tabIndex={-1}
                      autoComplete="off"
                    />
                  </div>
                </fieldset>
                <div className="support-privacy-note" id="privacy-notice">
                  <p>{t("ui.privacyNotice")}</p>
                </div>
                <div
                  className="support-verification"
                  hidden={Boolean(config?.mockServices)}
                >
                  <div ref={challenge.elementRef} />
                  {config && challenge.state === "loading" && (
                    <p className="support-hint" role="status">
                      {t("ui.turnstileLoading")}
                    </p>
                  )}
                  {config && challenge.state === "error" && (
                    <>
                      <p className="support-field-error" role="alert">
                        {t("ui.turnstileUnavailable")}
                      </p>
                      <button
                        className="support-text-button"
                        type="button"
                        onClick={challenge.retry}
                        disabled={busy}
                      >
                        {t("ui.retryVerification")}
                      </button>
                    </>
                  )}
                </div>
                <div className="support-submit-row">
                  <button
                    className="support-button"
                    type="submit"
                    disabled={busy || !config}
                  >
                    {t(busy ? phase : "ui.submit")}{" "}
                    <span aria-hidden="true">{busy ? "…" : "↗"}</span>
                  </button>
                  <span
                    className="support-submit-status"
                    role="status"
                    aria-live="polite"
                  >
                    {busy ? t(phase) : ""}
                  </span>
                </div>
              </form>
            </>
          )}
        </section>
      </main>
      <footer className="support-footer">
        <a href="mailto:support@duar.ch">{t("ui.supportContact")}</a>
        <span>© duar.ch</span>
      </footer>
    </div>
  );
}
