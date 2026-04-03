"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Option = string | { value: string; label: string };

type Question = {
  id: string;
  type: "select" | "multiselect";
  label: string;
  options?: Option[];
  default?: string;
  required?: boolean;
  helperText?: string;
};

type Step = {
  id: string;
  title: string;
  intro?: string;
  questions: Question[];
};

type IntakeConfig = {
  version: string;
  title: string;
  description?: string;
  steps: Step[];
};

type Answers = Record<string, any>;

const theme = {
  pageBg: "#F8FAFC",
  cardBg: "#FFFFFF",
  cardSubtle: "#F1F5F9",
  text: "#0F172A",
  muted: "#475569",
  border: "#E2E8F0",
  accent: "#0EA5A4",
  accentSoft: "#CCFBF1",
  danger: "#B91C1C",
  dangerSoft: "#FEE2E2"
};

function getOptionValue(option: Option) {
  return typeof option === "string" ? option : option.value;
}

function getOptionLabel(option: Option) {
  return typeof option === "string" ? option : option.label;
}

function prettifyValue(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getAnswerLabel(question: Question, rawValue: string) {
  const options = question.options ?? [];
  const match = options.find((option) => getOptionValue(option) === rawValue);
  return match ? getOptionLabel(match) : prettifyValue(rawValue);
}

const QUICK_EXIT_URL = "https://www.google.com";

export default function IntakePage() {
  const router = useRouter();

  const [config, setConfig] = useState<IntakeConfig | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showReview, setShowReview] = useState(false);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await fetch("/intake-config/en");
        if (!res.ok) throw new Error("Failed to load intake configuration.");

        const json: IntakeConfig = await res.json();
        setConfig(json);

        const defaults: Answers = {};
        for (const step of json.steps ?? []) {
          for (const q of step.questions ?? []) {
            if (q.type === "multiselect") defaults[q.id] = [];
            else if (q.default !== undefined) defaults[q.id] = q.default;
            else defaults[q.id] = "";
          }
        }

        const savedAnswers = sessionStorage.getItem("bc_intake_answers");
        const savedStepIndex = sessionStorage.getItem("bc_intake_step_index");
        const savedReview = sessionStorage.getItem("bc_intake_review");

        if (savedAnswers) {
          try {
            const parsed = JSON.parse(savedAnswers);
            setAnswers({ ...defaults, ...parsed });
          } catch {
            setAnswers(defaults);
          }
        } else {
          setAnswers(defaults);
        }

        if (savedStepIndex) {
          const parsedStep = Number(savedStepIndex);
          if (!Number.isNaN(parsedStep) && parsedStep >= 0 && parsedStep < json.steps.length) {
            setStepIndex(parsedStep);
          }
        }

        if (savedReview === "true") setShowReview(true);

        fetch("/api/analytics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event_name: "intake_started",
            event_key: json.version || "screening"
          })
        }).catch(() => {});
      } catch (e: any) {
        setPageError(e?.message || "Unable to load the intake.");
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, []);

  useEffect(() => {
    if (!config) return;
    sessionStorage.setItem("bc_intake_answers", JSON.stringify(answers));
  }, [answers, config]);

  useEffect(() => {
    if (!config) return;
    sessionStorage.setItem("bc_intake_step_index", String(stepIndex));
  }, [stepIndex, config]);

  useEffect(() => {
    sessionStorage.setItem("bc_intake_review", showReview ? "true" : "false");
  }, [showReview]);

  const currentStep = useMemo(() => {
    if (!config) return null;
    return config.steps[stepIndex] ?? null;
  }, [config, stepIndex]);

  const totalSteps = config?.steps?.length ?? 0;
  const isLastStep = stepIndex === totalSteps - 1;
  const progressPercent =
    totalSteps > 0 ? Math.round(((showReview ? totalSteps : stepIndex + 1) / totalSteps) * 100) : 0;

  const helperTextMap: Record<string, string> = {
    immediate_danger:
      "If you are in immediate danger, consider calling 911 or a local emergency service if it is safe to do so.",
    safe_place_tonight:
      "If you do not have a safe place to stay, the results page can highlight shelter and crisis resources.",
    monitored:
      "It is okay if you are unsure. Answering honestly helps show safer support options.",
    forced_work_or_activity:
      "Some people may not describe their experience as trafficking or exploitation. This question is about what happened, not labels.",
    threatened_you_or_family:
      "Threats can be direct or indirect, including threats against loved ones.",
    threatened_immigration_or_police:
      "Threats involving immigration or police are often used to control people.",
    controlled_documents:
      "This can include a passport, ID, work papers, money, or other personal documents.",
    can_leave_freely:
      "If leaving feels unsafe, impossible, or controlled by someone else, that matters.",
    promised_job_different:
      "This can include being recruited for one kind of work but being required to do something else.",
    not_paid_or_underpaid:
      "This includes being unpaid, paid less than promised, or having wages withheld.",
    unsafe_or_excessive_hours:
      "Unsafe work, no breaks, or extremely long hours can be signs of exploitation.",
    debt_pressure:
      "This includes pressure related to travel costs, housing, recruitment fees, or other debts.",
    forced_sexual_activity:
      "You do not need to be certain about how to describe the experience. Answer based on what happened.",
    sex_for_needs:
      "This can include pressure involving housing, food, transportation, safety, or money.",
    partner_controls_life:
      "Control can include isolation, monitoring, restricting movement, or limiting contact with others.",
    partner_hurt_or_threatened:
      "Threats, intimidation, or physical harm by a partner or family member are important safety concerns.",
    wants_immigration_help:
      "This does not determine eligibility. It only helps identify whether legal screening could be useful.",
    status_or_documents_concern:
      "This can include immigration status, work authorization, lost documents, or fear related to paperwork.",
    needs_now: "Select as many support needs as apply right now."
  };

  const validateCurrentStep = () => {
    if (!currentStep) return false;

    for (const question of currentStep.questions) {
      if (!question.required) continue;
      const value = answers[question.id];

      if (question.type === "multiselect") {
        if (!Array.isArray(value) || value.length === 0) return false;
      } else {
        if (typeof value !== "string" || value.trim() === "") return false;
      }
    }

    return true;
  };

  const goNext = () => {
    setValidationError(null);

    if (!validateCurrentStep()) {
      setValidationError("Please answer all required questions before continuing.");
      return;
    }

    if (currentStep) {
      fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_name: "intake_step_viewed",
          event_key: currentStep.id
        })
      }).catch(() => {});
    }

    if (isLastStep) {
      setShowReview(true);
      return;
    }

    setStepIndex((prev) => Math.max(0, Math.min(prev + 1, totalSteps - 1)));
  };

  const goBack = () => {
    setValidationError(null);

    if (showReview) {
      setShowReview(false);
      return;
    }

    setStepIndex((prev) => Math.max(0, prev - 1));
  };

  const submitToResults = () => {
    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_name: "intake_completed",
        event_key: config?.version || "screening"
      })
    }).catch(() => {});

    router.push("/results");
  };

  const handleSelectChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleMultiSelectChange = (questionId: string, optionValue: string, checked: boolean) => {
    setAnswers((prev) => {
      const current = Array.isArray(prev[questionId]) ? prev[questionId] : [];
      const next = checked
        ? Array.from(new Set([...current, optionValue]))
        : current.filter((item: string) => item !== optionValue);

      return {
        ...prev,
        [questionId]: next
      };
    });
  };

  const quickExit = async () => {
    await fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_name: "intake_step_viewed",
        event_key: "quick_exit"
      })
    }).catch(() => {});

    window.location.href = QUICK_EXIT_URL;
  };

  const resetScreening = () => {
    const confirmed = window.confirm("Are you sure you want to clear your answers and start over?");
    if (!confirmed) return;

    sessionStorage.removeItem("bc_intake_answers");
    sessionStorage.removeItem("bc_intake_step_index");
    sessionStorage.removeItem("bc_intake_review");
    setAnswers({});
    setStepIndex(0);
    setShowReview(false);
    window.location.href = "/intake";
  };

  const shellStyle = {
    background: theme.pageBg,
    minHeight: "100vh",
    color: theme.text
  } as const;

  if (loading) {
    return (
      <main style={{ ...shellStyle, padding: 24, maxWidth: 900, margin: "0 auto" }}>
        <p>Loading screening questions…</p>
      </main>
    );
  }

  if (pageError || !config) {
    return (
      <main style={{ ...shellStyle, padding: 24, maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>Bridgeway Connects</h1>
        <p style={{ color: theme.danger }}>
          {pageError || "Unable to load the screening questionnaire."}
        </p>
      </main>
    );
  }

  if (showReview) {
    return (
      <main style={{ ...shellStyle, padding: 24, maxWidth: 900, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap"
          }}
        >
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>{config.title}</h1>
            <p style={{ color: theme.muted, marginTop: 8 }}>
              Review your answers before seeing your matched support resources.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={resetScreening}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: `1px solid ${theme.border}`,
                background: theme.cardBg,
                color: theme.text,
                cursor: "pointer",
                fontWeight: 700
              }}
            >
              Reset Screening
            </button>

            <button
              type="button"
              onClick={quickExit}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: `1px solid ${theme.danger}`,
                background: theme.cardBg,
                color: theme.danger,
                cursor: "pointer",
                fontWeight: 700
              }}
            >
              Quick Exit
            </button>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <div
            style={{
              height: 10,
              width: "100%",
              background: theme.border,
              borderRadius: 999,
              overflow: "hidden"
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progressPercent}%`,
                background: theme.accent,
                borderRadius: 999
              }}
            />
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: theme.muted }}>
            Progress: {progressPercent}%
          </div>
        </div>

        <div
          style={{
            marginTop: 16,
            padding: 16,
            border: `1px solid ${theme.border}`,
            borderRadius: 16,
            background: theme.cardBg,
            boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)"
          }}
        >
          <h2 style={{ marginTop: 0, color: theme.text }}>Review your answers</h2>

          <div style={{ display: "grid", gap: 18 }}>
            {config.steps.map((step) => (
              <div
                key={step.id}
                style={{
                  border: `1px solid ${theme.border}`,
                  borderRadius: 14,
                  padding: 14,
                  background: theme.cardSubtle
                }}
              >
                <div style={{ fontWeight: 800, marginBottom: 10, color: theme.text }}>{step.title}</div>

                <div style={{ display: "grid", gap: 10 }}>
                  {step.questions.map((question) => {
                    const value = answers[question.id];
                    let displayValue = "Not answered";

                    if (question.type === "multiselect") {
                      const selected = Array.isArray(value) ? value : [];
                      displayValue =
                        selected.length > 0
                          ? selected.map((v) => getAnswerLabel(question, v)).join(", ")
                          : "Not answered";
                    } else if (typeof value === "string" && value.trim() !== "") {
                      displayValue = getAnswerLabel(question, value);
                    }

                    return (
                      <div key={question.id}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>
                          {question.label}
                        </div>
                        <div style={{ marginTop: 4, color: theme.muted }}>{displayValue}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={goBack}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: `1px solid ${theme.border}`,
                background: theme.cardBg,
                cursor: "pointer",
                color: theme.text
              }}
            >
              Back to edit answers
            </button>

            <button
              type="button"
              onClick={submitToResults}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: `1px solid ${theme.accent}`,
                background: theme.accent,
                color: "#fff",
                cursor: "pointer",
                fontWeight: 700
              }}
            >
              See Results
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!currentStep) {
    return (
      <main style={{ ...shellStyle, padding: 24, maxWidth: 900, margin: "0 auto" }}>
        <p>Loading…</p>
      </main>
    );
  }

  return (
    <main style={{ ...shellStyle, padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap"
        }}
      >
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: theme.text }}>
            {config.title}
          </h1>
          <p style={{ color: theme.muted, maxWidth: 720, marginTop: 8 }}>
            {config.description ||
              "Answer a series of questions to help identify services and support that may be helpful. Your answers are not stored."}
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={resetScreening}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: `1px solid ${theme.border}`,
              background: theme.cardBg,
              color: theme.text,
              cursor: "pointer",
              fontWeight: 700
            }}
          >
            Reset Screening
          </button>

          <button
            type="button"
            onClick={quickExit}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: `1px solid ${theme.danger}`,
              background: theme.cardBg,
              color: theme.danger,
              cursor: "pointer",
              fontWeight: 700
            }}
          >
            Quick Exit
          </button>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div
          style={{
            height: 10,
            width: "100%",
            background: theme.border,
            borderRadius: 999,
            overflow: "hidden"
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progressPercent}%`,
              background: theme.accent,
              borderRadius: 999
            }}
          />
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: theme.muted }}>
          Step {stepIndex + 1} of {totalSteps} · {progressPercent}% complete
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          padding: 14,
          border: `1px solid ${theme.border}`,
          borderRadius: 16,
          background: theme.cardBg,
          boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)"
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 10px",
            borderRadius: 999,
            background: theme.accentSoft,
            color: theme.accent,
            fontSize: 12,
            fontWeight: 700
          }}
        >
          Section {stepIndex + 1}
        </div>

        <div style={{ marginTop: 10, fontWeight: 800, fontSize: 22, color: theme.text }}>
          {currentStep.title}
        </div>

        {currentStep.intro ? <p style={{ marginTop: 8, color: theme.muted }}>{currentStep.intro}</p> : null}
      </div>

      <div
        style={{
          marginTop: 16,
          padding: 16,
          border: `1px solid ${theme.border}`,
          borderRadius: 16,
          background: theme.cardBg,
          boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)"
        }}
      >
        <div style={{ display: "grid", gap: 22 }}>
          {currentStep.questions.map((question) => {
            const value = answers[question.id];
            const helperText = question.helperText || helperTextMap[question.id];

            return (
              <div key={question.id}>
                <div style={{ fontWeight: 700, marginBottom: 8, color: theme.text }}>
                  {question.label} {question.required ? <span style={{ color: theme.danger }}>*</span> : null}
                </div>

                {helperText ? (
                  <div
                    style={{
                      marginBottom: 10,
                      fontSize: 13,
                      lineHeight: 1.5,
                      color: theme.muted,
                      background: theme.cardSubtle,
                      border: `1px solid ${theme.border}`,
                      borderRadius: 12,
                      padding: "10px 12px"
                    }}
                  >
                    {helperText}
                  </div>
                ) : null}

                {question.type === "select" ? (
                  <select
                    value={typeof value === "string" ? value : ""}
                    onChange={(e) => handleSelectChange(question.id, e.target.value)}
                    style={{
                      width: "100%",
                      maxWidth: 560,
                      padding: 12,
                      borderRadius: 12,
                      border: `1px solid ${theme.border}`,
                      background: theme.cardBg,
                      color: theme.text
                    }}
                  >
                    <option value="" disabled>
                      Select an option
                    </option>
                    {(question.options ?? []).map((option) => (
                      <option key={getOptionValue(option)} value={getOptionValue(option)}>
                        {getOptionLabel(option)}
                      </option>
                    ))}
                  </select>
                ) : null}

                {question.type === "multiselect" ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    {(question.options ?? []).map((option) => {
                      const optionValue = getOptionValue(option);
                      const optionLabel = getOptionLabel(option);
                      const selectedValues = Array.isArray(value) ? value : [];
                      const checked = selectedValues.includes(optionValue);

                      return (
                        <label
                          key={optionValue}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px 12px",
                            borderRadius: 12,
                            border: `1px solid ${checked ? theme.accent : theme.border}`,
                            background: checked ? theme.accentSoft : theme.cardBg,
                            cursor: "pointer"
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              handleMultiSelectChange(question.id, optionValue, e.target.checked)
                            }
                          />
                          <span style={{ color: theme.text }}>{optionLabel}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {validationError ? <p style={{ marginTop: 16, color: theme.danger }}>{validationError}</p> : null}

        <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={goBack}
            disabled={stepIndex === 0}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: `1px solid ${theme.border}`,
              background: stepIndex === 0 ? "#F8FAFC" : theme.cardBg,
              color: stepIndex === 0 ? "#94A3B8" : theme.text,
              cursor: stepIndex === 0 ? "not-allowed" : "pointer"
            }}
          >
            Back
          </button>

          <button
            type="button"
            onClick={goNext}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: `1px solid ${theme.accent}`,
              background: theme.accent,
              color: "#fff",
              cursor: "pointer",
              fontWeight: 700
            }}
          >
            {isLastStep ? "Review Answers" : "Next"}
          </button>
        </div>
      </div>
    </main>
  );
}