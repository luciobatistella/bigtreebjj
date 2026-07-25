"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { joinCopy } from "../i18n/joinCopy";
import type { Locale } from "../i18n/locale";

type TeacherSuggestion = {
  id: string;
  fullName: string;
  team?: string | null;
  city?: string | null;
  country?: string | null;
};

type SubmissionResult = {
  protocol: string;
  status: string;
  teacherName: string;
  submittedAt: string;
  certificateAttached?: boolean;
  certificateCount?: number;
};

type GraduationTrack = "adult" | "youth";
type BeltRank = "gray" | "yellow" | "orange" | "green" | "blue" | "purple" | "brown" | "black";

type BeltStep = {
  rank: BeltRank;
  label: string;
  shortLabel: string;
  required: boolean;
  youthGroup?: boolean;
};

const emptyFields = {
  fullName: "",
  email: "",
  instagram: "",
  academyTeam: "",
  city: "",
  country: "",
  promotionDate: "",
  claimType: "black_belt_awarded_by",
  evidenceText: "",
  evidenceNotes: "",
  consent: false,
  website: ""
};

export function JoinForm({
  initialTeacherName,
  initialTeacherId,
  locale
}: {
  initialTeacherName: string;
  initialTeacherId: string;
  locale: Locale;
}) {
  const copy = joinCopy[locale];
  const [fields, setFields] = useState({
    ...emptyFields,
    country: copy.countryDefault
  });
  const [teacherName, setTeacherName] = useState(initialTeacherName);
  const [teacherPersonId, setTeacherPersonId] = useState(initialTeacherId);
  const [suggestions, setSuggestions] = useState<TeacherSuggestion[]>([]);
  const [teacherOpen, setTeacherOpen] = useState(false);
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [graduationTrack, setGraduationTrack] = useState<GraduationTrack>("adult");
  const [activeBelt, setActiveBelt] = useState<BeltRank>("blue");
  const [certificateFiles, setCertificateFiles] = useState<Partial<Record<BeltRank, File>>>({});
  const [certificateDates, setCertificateDates] = useState<Partial<Record<BeltRank, string>>>({});
  const [certificateCompletenessConfirmed, setCertificateCompletenessConfirmed] = useState(false);
  const [certificateError, setCertificateError] = useState("");

  const beltSteps = useMemo<BeltStep[]>(() => {
    const step = (
      rank: BeltRank,
      required: boolean,
      youthGroup = false
    ): BeltStep => ({
      rank,
      label: copy.belt[rank][0],
      shortLabel: copy.belt[rank][1],
      required,
      youthGroup
    });
    const adult = [
      step("blue", true),
      step("purple", true),
      step("brown", true),
      step("black", true)
    ];
    if (graduationTrack === "adult") return adult;
    return [
      step("gray", false, true),
      step("yellow", false, true),
      step("orange", false, true),
      step("green", false, true),
      ...adult
    ];
  }, [copy.belt, graduationTrack]);
  const activeBeltIndex = Math.max(0, beltSteps.findIndex((step) => step.rank === activeBelt));
  const activeBeltStep = beltSteps[activeBeltIndex] ?? beltSteps[0];
  const blackBeltRequest = fields.claimType !== "trained_under";
  const isBeltUnlocked = useCallback(
    (index: number) =>
      !blackBeltRequest ||
      beltSteps
        .slice(0, index)
        .filter((step) => step.required)
        .every((step) => certificateFiles[step.rank]),
    [beltSteps, blackBeltRequest, certificateFiles]
  );
  const requiredBeltSteps = beltSteps.filter((step) => step.required);
  const completedRequiredBelts = requiredBeltSteps.filter(
    (step) => certificateFiles[step.rank]
  ).length;
  const completedJourneyBelts = beltSteps.filter(
    (step) => certificateFiles[step.rank]
  ).length;
  const nextRequiredStep = requiredBeltSteps.find(
    (step) => !certificateFiles[step.rank]
  );
  const nextRequiredRank = nextRequiredStep?.rank;
  const activeRequiredIndex = requiredBeltSteps.findIndex(
    (step) => step.rank === activeBeltStep.rank
  );

  useEffect(() => {
    if (isBeltUnlocked(activeBeltIndex)) return;
    setActiveBelt(nextRequiredRank ?? "blue");
  }, [activeBeltIndex, isBeltUnlocked, nextRequiredRank]);

  useEffect(() => {
    if (teacherName.trim().length < 2 || (teacherPersonId && teacherName === initialTeacherName)) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/join/teachers?q=${encodeURIComponent(teacherName)}`, {
          signal: controller.signal
        });
        const payload = (await response.json()) as TeacherSuggestion[];
        const teacherResults = Array.isArray(payload) ? payload : [];
        const exactTeacher = teacherResults.find(
          (teacher) => teacher.fullName.localeCompare(teacherName, undefined, { sensitivity: "base" }) === 0
        );
        if (exactTeacher && teacherName === initialTeacherName) {
          setTeacherPersonId(exactTeacher.id);
          setSuggestions([]);
          setTeacherOpen(false);
          return;
        }
        setSuggestions(teacherResults);
        setTeacherOpen(true);
      } catch {
        setSuggestions([]);
      }
    }, 240);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [teacherName, teacherPersonId, initialTeacherName]);

  const evidenceUrls = useMemo(
    () =>
      fields.evidenceText
        .split(/\r?\n|,\s*(?=https?:\/\/)/)
        .map((value) => value.trim())
        .filter(Boolean),
    [fields.evidenceText]
  );

  const update = (name: keyof typeof emptyFields, value: string | boolean) => {
    setFields((current) => ({ ...current, [name]: value }));
    setErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  };

  const chooseTeacher = (teacher: TeacherSuggestion) => {
    setTeacherName(teacher.fullName);
    setTeacherPersonId(teacher.id);
    setTeacherOpen(false);
    setSuggestions([]);
  };

  const chooseCertificate = (step: BeltStep, file: File | null) => {
    setCertificateError("");
    if (!file) {
      const stepIndex = beltSteps.findIndex((beltStep) => beltStep.rank === step.rank);
      const documentedLaterSteps = beltSteps
        .slice(stepIndex + 1)
        .filter((beltStep) => beltStep.required && certificateFiles[beltStep.rank]);
      if (step.required && documentedLaterSteps.length) {
        setCertificateError(
          copy.errors.removeLater(
            documentedLaterSteps
              .map((beltStep) => beltStep.shortLabel.toLowerCase())
              .join(", ")
          )
        );
        return;
      }
      setCertificateFiles((current) => {
        const next = { ...current };
        delete next[step.rank];
        return next;
      });
      return;
    }
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      setCertificateError(copy.errors.fileType);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setCertificateError(copy.errors.fileSize);
      return;
    }
    setCertificateFiles((current) => ({ ...current, [step.rank]: file }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState("submitting");
    setMessage("");
    setErrors({});
    try {
      if (certificateError) throw new Error(certificateError);
      const missingCertificates = blackBeltRequest
        ? beltSteps.filter((step) => step.required && !certificateFiles[step.rank])
        : [];
      if (missingCertificates.length) {
        setActiveBelt(missingCertificates[0].rank);
        throw new Error(
          copy.errors.missing(
            missingCertificates
              .map((step) => step.shortLabel.toLowerCase())
              .join(", ")
          )
        );
      }
      if (blackBeltRequest && !certificateCompletenessConfirmed) {
        throw new Error(copy.errors.completeness);
      }

      const certificateManifest = beltSteps.flatMap((step, sequence) => {
        const file = certificateFiles[step.rank];
        if (!file) return [];
        return [
          {
            fieldName: `certificate_${step.rank}`,
            track: graduationTrack,
            beltRank: step.rank,
            beltLabel: step.label,
            sequence,
            awardedAt:
              step.rank === "black"
                ? fields.promotionDate
                : certificateDates[step.rank] ?? ""
          }
        ];
      });
      const submissionPayload = {
        locale,
        fullName: fields.fullName,
        email: fields.email,
        instagram: fields.instagram,
        teacherPersonId: teacherPersonId || undefined,
        teacherName,
        academyTeam: fields.academyTeam,
        city: fields.city,
        country: fields.country,
        promotionDate: fields.promotionDate,
        claimType: fields.claimType,
        graduationTrack,
        certificateCompletenessConfirmed,
        certificateManifest,
        evidenceUrls,
        evidenceNotes: fields.evidenceNotes,
        consent: fields.consent,
        website: fields.website
      };
      const multipart = new FormData();
      multipart.append("payload", JSON.stringify(submissionPayload));
      certificateManifest.forEach((certificate) => {
        const file = certificateFiles[certificate.beltRank as BeltRank];
        if (file) multipart.append(certificate.fieldName, file);
      });
      const response = await fetch("/api/join", {
        method: "POST",
        body: multipart
      });
      const payload = await response.json();
      if (!response.ok) {
        setErrors(payload.fields ?? {});
        throw new Error(payload.error ?? copy.errors.submit);
      }
      setResult(payload as SubmissionResult);
      setState("success");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : copy.errors.submit);
      setState("error");
    }
  };

  if (state === "success" && result) {
    return (
      <section className="join-success" aria-live="polite">
        <span className="join-success-mark">✓</span>
        <p className="join-eyebrow">{copy.success.eyebrow}</p>
        <h2>{copy.success.title}</h2>
        <p>
          {copy.success.beforeTeacher} <strong>{result.teacherName}</strong>{" "}
          {copy.success.afterTeacher}
        </p>
        {result.certificateAttached ? (
          <p className="join-success-evidence">
            {copy.success.certificates(result.certificateCount ?? 1)}
          </p>
        ) : null}
        <div className="join-protocol">
          <small>{copy.success.protocol}</small>
          <strong>{result.protocol}</strong>
        </div>
        <div className="join-success-actions">
          <Link href={`/join/status?protocol=${encodeURIComponent(result.protocol)}`}>
            {copy.success.track}
          </Link>
          <Link href="/explore">{copy.success.back}</Link>
        </div>
      </section>
    );
  }

  const errorFor = (field: string) =>
    errors[field]?.length ? <small className="join-error">{errors[field][0]}</small> : null;

  return (
    <section className="join-form-section" id="formulario">
      <div className="join-form-heading">
        <p className="join-eyebrow">{copy.heading.eyebrow}</p>
        <h2>{copy.heading.title}</h2>
        <p>{copy.heading.note}</p>
      </div>

      <form className="join-form" onSubmit={submit} noValidate>
        <fieldset>
          <legend><span>01</span> {copy.connection.legend}</legend>
          <div className="join-grid">
            <label>
              {copy.connection.fullName}
              <input
                value={fields.fullName}
                onChange={(event) => update("fullName", event.target.value)}
                autoComplete="name"
                placeholder={copy.connection.fullNamePlaceholder}
              />
              {errorFor("fullName")}
            </label>

            <label className="join-teacher-field">
              {copy.connection.teacher}
              <input
                value={teacherName}
                onChange={(event) => {
                  setTeacherName(event.target.value);
                  setTeacherPersonId("");
                }}
                onFocus={() => setTeacherOpen(Boolean(suggestions.length))}
                autoComplete="off"
                placeholder={copy.connection.teacherPlaceholder}
              />
              {teacherPersonId ? (
                <small className="join-confirmed">{copy.connection.teacherFound}</small>
              ) : null}
              {errorFor("teacherName")}
              {teacherOpen && suggestions.length ? (
                <div className="join-suggestions">
                  {suggestions.map((teacher) => (
                    <button type="button" key={teacher.id} onClick={() => chooseTeacher(teacher)}>
                      <strong>{teacher.fullName}</strong>
                      <small>
                        {[teacher.team, teacher.city, teacher.country].filter(Boolean).join(" · ") ||
                          copy.connection.inTree}
                      </small>
                    </button>
                  ))}
                </div>
              ) : null}
            </label>

            <label>
              {copy.connection.type}
              <select value={fields.claimType} onChange={(event) => update("claimType", event.target.value)}>
                <option value="black_belt_awarded_by">
                  {copy.connection.claims.black_belt_awarded_by}
                </option>
                <option value="co_awarded_black_belt">
                  {copy.connection.claims.co_awarded_black_belt}
                </option>
                <option value="trained_under">{copy.connection.claims.trained_under}</option>
              </select>
            </label>

            <label>
              {copy.connection.promotionDate}
              <input
                type="date"
                value={fields.promotionDate}
                onChange={(event) => update("promotionDate", event.target.value)}
              />
            </label>

            <label>
              {copy.connection.academy}
              <input
                value={fields.academyTeam}
                onChange={(event) => update("academyTeam", event.target.value)}
                placeholder={copy.connection.academyPlaceholder}
              />
            </label>

            <label>
              {copy.connection.city}
              <input value={fields.city} onChange={(event) => update("city", event.target.value)} />
            </label>

            <label>
              {copy.connection.country}
              <input value={fields.country} onChange={(event) => update("country", event.target.value)} />
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend><span>02</span> {copy.evidence.legend}</legend>
          <div className="join-grid">
            <label>
              {copy.evidence.email}
              <input
                type="email"
                value={fields.email}
                onChange={(event) => update("email", event.target.value)}
                autoComplete="email"
                placeholder={copy.evidence.emailPlaceholder}
              />
              {errorFor("email")}
            </label>
            <label>
              {copy.evidence.instagram}
              <input
                value={fields.instagram}
                onChange={(event) => update("instagram", event.target.value)}
                placeholder={copy.evidence.instagramPlaceholder}
              />
            </label>
            <div className="join-wide join-certificate">
              <div className="join-certificate-heading">
                <div>
                  <small>{copy.certificates.eyebrow}</small>
                  <h3>{copy.certificates.title}</h3>
                  <p>{copy.certificates.lede}</p>
                </div>
                <span>
                  {graduationTrack === "youth"
                    ? `${completedJourneyBelts}/${beltSteps.length}`
                    : `${completedRequiredBelts}/${requiredBeltSteps.length}`}
                  <small>
                    {graduationTrack === "youth"
                      ? copy.certificates.youthCounter
                      : copy.certificates.adultCounter}
                  </small>
                  {graduationTrack === "youth" ? (
                    <small className="join-certificate-counter-detail">
                      {copy.certificates.youthCounterDetail}
                    </small>
                  ) : null}
                </span>
              </div>

              <div
                className="join-track-choice"
                role="group"
                aria-label={copy.certificates.trackLabel}
              >
                <button
                  type="button"
                  className={graduationTrack === "adult" ? "is-active" : ""}
                  onClick={() => {
                    setGraduationTrack("adult");
                    setActiveBelt("blue");
                    setCertificateError("");
                  }}
                >
                  <strong>{copy.certificates.adult}</strong>
                  <small>{copy.certificates.adultPath}</small>
                </button>
                <button
                  type="button"
                  className={graduationTrack === "youth" ? "is-active" : ""}
                  onClick={() => {
                    setGraduationTrack("youth");
                    setActiveBelt("blue");
                    setCertificateError("");
                  }}
                >
                  <strong>{copy.certificates.youth}</strong>
                  <small>{copy.certificates.youthPath}</small>
                </button>
              </div>

              {blackBeltRequest ? (
                <div className="join-certificate-sequence">
                  <p>
                    <strong>{copy.certificates.whiteStartLabel}</strong>{" "}
                    {copy.certificates.whiteStart}
                  </p>
                  <p>
                    <strong>{copy.certificates.sequenceLabel}</strong>{" "}
                    {copy.certificates.sequence}
                  </p>
                </div>
              ) : null}

              <ol className={`join-belt-steps track-${graduationTrack}`}>
                {beltSteps.map((step, index) => {
                  const hasFile = Boolean(certificateFiles[step.rank]);
                  const isLocked = !isBeltUnlocked(index);
                  const isNextRequired = !isLocked && nextRequiredRank === step.rank;
                  const requiredIndex = requiredBeltSteps.findIndex(
                    (requiredStep) => requiredStep.rank === step.rank
                  );
                  return (
                    <li key={step.rank}>
                      <button
                        type="button"
                        className={`belt-${step.rank} ${activeBelt === step.rank ? "is-active" : ""} ${hasFile ? "is-complete" : ""} ${isLocked ? "is-locked" : ""} ${isNextRequired ? "is-next-required" : ""}`}
                        onClick={() => {
                          if (isLocked) return;
                          setActiveBelt(step.rank);
                          setCertificateError("");
                        }}
                        disabled={isLocked}
                        aria-current={activeBelt === step.rank ? "step" : undefined}
                        aria-label={
                          isLocked
                            ? copy.certificates.lockedAria(step.label)
                            : step.label
                        }
                        title={
                          isLocked
                            ? copy.certificates.lockedTitle(
                                nextRequiredStep?.shortLabel.toLowerCase() ??
                                  (locale === "en" ? "previous belt" : "anterior")
                              )
                            : undefined
                        }
                      >
                        <i>
                          {isLocked
                            ? "×"
                            : hasFile
                              ? "✓"
                              : step.required
                                ? requiredIndex + 1
                                : "+"}
                        </i>
                        <span>{step.shortLabel}</span>
                        {isLocked ? (
                          <small>{copy.certificates.locked}</small>
                        ) : step.required && blackBeltRequest ? (
                          <small>
                            {isNextRequired
                              ? copy.certificates.uploadNow
                              : copy.certificates.required}
                          </small>
                        ) : (
                          <small>{copy.certificates.optional}</small>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ol>

              <section className={`join-belt-panel belt-${activeBeltStep.rank}`}>
                <div className="join-belt-panel-copy">
                  <small>
                    {activeBeltStep.required
                      ? copy.certificates.certificateProgress(
                          activeRequiredIndex + 1,
                          requiredBeltSteps.length
                        )
                      : copy.certificates.supplemental}
                  </small>
                  <h4>{activeBeltStep.label}</h4>
                  <p>
                    {activeBeltStep.youthGroup
                      ? copy.certificates.youthHelp(
                          activeBeltStep.shortLabel.toLowerCase()
                        )
                      : blackBeltRequest
                        ? copy.certificates.requiredHelp
                        : copy.certificates.optionalHelp}
                  </p>
                </div>

                <label className={`join-certificate-drop ${certificateFiles[activeBeltStep.rank] ? "has-file" : ""}`}>
                  <input
                    key={`${graduationTrack}-${activeBeltStep.rank}-${certificateFiles[activeBeltStep.rank]?.name ?? "empty"}`}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                    onChange={(event) => {
                      chooseCertificate(activeBeltStep, event.target.files?.[0] ?? null);
                      event.target.value = "";
                    }}
                  />
                  <i aria-hidden="true">{certificateFiles[activeBeltStep.rank] ? "✓" : "＋"}</i>
                  <strong>
                    {certificateFiles[activeBeltStep.rank]?.name ??
                      copy.certificates.attach(activeBeltStep.shortLabel.toLowerCase())}
                  </strong>
                  <small>
                    {certificateFiles[activeBeltStep.rank]
                      ? `${(certificateFiles[activeBeltStep.rank]!.size / 1024 / 1024).toFixed(2)} MB · ${copy.certificates.privateFile}`
                      : copy.certificates.fileHelp}
                  </small>
                </label>

                <div className="join-belt-meta">
                  <label>
                    {copy.certificates.date}
                    <input
                      type="date"
                      value={
                        activeBeltStep.rank === "black"
                          ? fields.promotionDate
                          : certificateDates[activeBeltStep.rank] ?? ""
                      }
                      onChange={(event) => {
                        if (activeBeltStep.rank === "black") {
                          update("promotionDate", event.target.value);
                        } else {
                          setCertificateDates((current) => ({
                            ...current,
                            [activeBeltStep.rank]: event.target.value
                          }));
                        }
                      }}
                    />
                  </label>
                  <div className="join-belt-actions">
                    {certificateFiles[activeBeltStep.rank] ? (
                      <button
                        type="button"
                        className="join-belt-remove"
                        onClick={() => chooseCertificate(activeBeltStep, null)}
                      >
                        {copy.certificates.remove}
                      </button>
                    ) : null}
                    {activeBeltIndex < beltSteps.length - 1 ? (
                      <button
                        type="button"
                        className="join-belt-next"
                        disabled={
                          blackBeltRequest &&
                          activeBeltStep.required &&
                          !certificateFiles[activeBeltStep.rank]
                        }
                        onClick={() => setActiveBelt(beltSteps[activeBeltIndex + 1].rank)}
                      >
                        {copy.certificates.continue(
                          beltSteps[activeBeltIndex + 1].shortLabel
                        )}
                      </button>
                    ) : (
                      <span className="join-belt-finish">
                        {certificateFiles.black
                          ? copy.certificates.ready
                          : copy.certificates.blackRequired}
                      </span>
                    )}
                  </div>
                </div>
              </section>

              {blackBeltRequest ? (
                <label className="join-certificate-declaration">
                  <input
                    type="checkbox"
                    checked={certificateCompletenessConfirmed}
                    onChange={(event) => {
                      setCertificateCompletenessConfirmed(event.target.checked);
                      setCertificateError("");
                    }}
                  />
                  <span>{copy.certificates.declaration}</span>
                </label>
              ) : null}
              <small className="join-certificate-note">
                {copy.certificates.note}
              </small>
              {certificateError ? <small className="join-error">{certificateError}</small> : null}
              {errorFor("certificateManifest")}
              {errorFor("certificateCompletenessConfirmed")}
            </div>
            <label className="join-wide">
              {copy.links.label}
              <textarea
                value={fields.evidenceText}
                onChange={(event) => update("evidenceText", event.target.value)}
                placeholder={copy.links.placeholder}
              />
              <small>{copy.links.count(evidenceUrls.length)}</small>
              {errorFor("evidenceUrls")}
            </label>
            <label className="join-wide">
              {copy.links.context}
              <textarea
                value={fields.evidenceNotes}
                onChange={(event) => update("evidenceNotes", event.target.value)}
                placeholder={copy.links.contextPlaceholder}
              />
              <small>{copy.links.contextHelp}</small>
              {errorFor("evidenceNotes")}
            </label>
          </div>
        </fieldset>

        <label className="join-consent">
          <input
            type="checkbox"
            checked={fields.consent}
            onChange={(event) => update("consent", event.target.checked)}
          />
          <span>{copy.consent}</span>
        </label>
        {errorFor("consent")}

        <label className="join-honeypot" aria-hidden="true">
          Website
          <input tabIndex={-1} value={fields.website} onChange={(event) => update("website", event.target.value)} />
        </label>

        {message ? <p className="join-submit-error" role="alert">{message}</p> : null}

        <button className="join-submit" type="submit" disabled={state === "submitting"}>
          <span>{state === "submitting" ? copy.sending : copy.submit}</span>
          <i aria-hidden="true">→</i>
        </button>
      </form>
    </section>
  );
}
