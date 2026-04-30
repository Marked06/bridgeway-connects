"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Option = string | { value: string; label: string };

type Condition = {
  field?: string;
  operator?: "===" | "!==" | "includes" | "!includes";
  value?: any;
  all?: Condition[];
  any?: Condition[];
};

type Question = {
  id: string;
  type: "select" | "multiselect";
  label: string;
  options?: Option[];
  default?: string;
  required?: boolean;
  helperText?: string;
  showIf?: Condition | Condition[];
};

type Step = {
  id: string;
  title: string;
  intro?: string;
  questions: Question[];
  showIf?: Condition | Condition[];
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

function evaluateCondition(condition: Condition | Condition[] | undefined, answers: Answers): boolean {
  if (!condition) return true;

  const conditions = Array.isArray(condition) ? condition : [condition];

  return conditions.every((cond) => {
    // Handle 'all' (AND) logic
    if (cond.all) {
      return evaluateCondition(cond.all, answers);
    }

    // Handle 'any' (OR) logic
    if (cond.any) {
      return cond.any.some((subCond) => evaluateCondition(subCond, answers));
    }

    // Handle basic field comparison
    if (!cond.field || !cond.operator) return true;

    const value = answers[cond.field];

    switch (cond.operator) {
      case "===":
        return value === cond.value;
      case "!==":
        return value !== cond.value;
      case "includes":
        if (Array.isArray(value)) {
          return value.includes(cond.value);
        }
        return false;
      case "!includes":
        if (Array.isArray(value)) {
          return !value.includes(cond.value);
        }
        return true;
      default:
        return true;
    }
  });
}

const QUICK_EXIT_URL = "https://www.google.com";

// Debug mode: set to true in browser console with: window.__DEBUG_INTAKE = true
const DEBUG = typeof window !== "undefined" && (window as any).__DEBUG_INTAKE === true;

function debugLog(label: string, data: any) {
  if (DEBUG) {
    console.log(`[INTAKE DEBUG] ${label}:`, data);
  }
}

export default function IntakePage() {
  const router = useRouter();

  const [config, setConfig] = useState<IntakeConfig | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [questionIndexInStep, setQuestionIndexInStep] = useState(0);
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

        const savedQuestionIndex = sessionStorage.getItem("bc_intake_question_index");
        if (savedQuestionIndex) {
          const parsedQuestion = Number(savedQuestionIndex);
          if (!Number.isNaN(parsedQuestion) && parsedQuestion >= 0) {
            setQuestionIndexInStep(parsedQuestion);
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
    sessionStorage.setItem("bc_intake_question_index", String(questionIndexInStep));
  }, [questionIndexInStep]);

  useEffect(() => {
    sessionStorage.setItem("bc_intake_review", showReview ? "true" : "false");
  }, [showReview]);

  const currentStep = useMemo(() => {
    if (!config) return null;
    return config.steps[stepIndex] ?? null;
  }, [config, stepIndex]);

  const visibleQuestionsInStep = useMemo(() => {
    if (!currentStep) return [];
    const visible = currentStep.questions.filter((q) => {
      const shouldShow = evaluateCondition(q.showIf, answers);
      debugLog(`Filter Q[${q.id}]`, {
        shouldShow,
        showIf: q.showIf,
        answerValue: answers[q.id]
      });
      return shouldShow;
    });
    debugLog(`Step[${currentStep.id}] visible questions`, visible.map(q => q.id));
    return visible;
  }, [currentStep, answers]);

  const currentQuestion = useMemo(() => {
    if (visibleQuestionsInStep.length === 0) {
      debugLog("Current question", "NONE (no visible questions)");
      return null;
    }
    const q = visibleQuestionsInStep[questionIndexInStep] ?? null;
    debugLog("Current question", {
      id: q?.id,
      index: questionIndexInStep,
      totalVisible: visibleQuestionsInStep.length,
      label: q?.label
    });
    return q;
  }, [visibleQuestionsInStep, questionIndexInStep]);

  const nextQuestion = useMemo(() => {
    if (visibleQuestionsInStep.length <= questionIndexInStep + 1) return null;
    return visibleQuestionsInStep[questionIndexInStep + 1] ?? null;
  }, [visibleQuestionsInStep, questionIndexInStep]);

  // Clamp question index to valid range when visible questions change (AFTER memoized values)
  useEffect(() => {
    if (visibleQuestionsInStep.length === 0) {
      setQuestionIndexInStep(0);
      return;
    }

    if (questionIndexInStep >= visibleQuestionsInStep.length) {
      setQuestionIndexInStep(Math.max(0, visibleQuestionsInStep.length - 1));
    }
  }, [visibleQuestionsInStep, questionIndexInStep]);

  const totalSteps = config?.steps?.length ?? 0;
  // Check if we're at the last pair of questions (2 questions at a time)
  const isLastPair = questionIndexInStep + 1 >= visibleQuestionsInStep.length;
  const isLastStep = stepIndex === totalSteps - 1;

  // Progress based on question pairs (questions 1-2, 3-4, etc.)
  const totalQuestionsToShow = visibleQuestionsInStep.length;
  const questionsAnswered = questionIndexInStep + 1; // +1 because we count the pair we just answered
  const progressPercent =
    totalQuestionsToShow > 0
      ? Math.round((questionsAnswered / totalQuestionsToShow) * 100)
      : 0;

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

  const validateCurrentQuestion = () => {
    // For 2 questions at a time, validate only the required ones that are visible
    if (currentQuestion && currentQuestion.required) {
      const value = answers[currentQuestion.id];
      if (currentQuestion.type === "multiselect") {
        if (!(Array.isArray(value) && value.length > 0)) return false;
      } else {
        if (!(typeof value === "string" && value.trim() !== "")) return false;
      }
    }

    if (nextQuestion && nextQuestion.required) {
      const value = answers[nextQuestion.id];
      if (nextQuestion.type === "multiselect") {
        if (!(Array.isArray(value) && value.length > 0)) return false;
      } else {
        if (!(typeof value === "string" && value.trim() !== "")) return false;
      }
    }

    return true;
  };

  const goNext = () => {
    setValidationError(null);

    if (!validateCurrentQuestion()) {
      setValidationError("Please answer all required questions before continuing.");
      return;
    }

    // Move by 2 questions in current step if possible
    if (questionIndexInStep + 2 < visibleQuestionsInStep.length) {
      setQuestionIndexInStep((prev) => prev + 2);
      return;
    }

    // Only 1 question left
    if (questionIndexInStep + 1 < visibleQuestionsInStep.length) {
      setQuestionIndexInStep((prev) => prev + 1);
      return;
    }

    // At end of section, move to next step
    if (currentStep) {
      fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_name: "intake_step_completed",
          event_key: currentStep.id
        })
      }).catch(() => {});
    }

    if (isLastStep) {
      setShowReview(true);
      return;
    }

    setStepIndex((prev) => prev + 1);
    setQuestionIndexInStep(0);
  };

  const goBack = () => {
    setValidationError(null);

    if (showReview) {
      setShowReview(false);
      return;
    }

    // Go back by 2 questions in current step if possible
    if (questionIndexInStep >= 2) {
      setQuestionIndexInStep((prev) => prev - 2);
      return;
    }

    // Go back by 1 if we're at question 1
    if (questionIndexInStep === 1) {
      setQuestionIndexInStep(0);
      return;
    }

    // At first question pair in step, go to previous step's last questions
    if (stepIndex > 0) {
      const prevStepIndex = stepIndex - 1;
      setStepIndex(prevStepIndex);
      // Will be updated in next render when visibleQuestionsInStep changes
      // Setting to a high number to ensure we get the last question pair
      setQuestionIndexInStep(999);
    }
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
    debugLog(`Select changed: ${questionId}`, value);
    setAnswers((prev) => {
      const updated = {
        ...prev,
        [questionId]: value
      };
      debugLog(`Answers after select change`, updated);
      return updated;
    });
  };

  const handleMultiSelectChange = (questionId: string, optionValue: string, checked: boolean) => {
    setAnswers((prev) => {
      const current = Array.isArray(prev[questionId]) ? prev[questionId] : [];
      const next = checked
        ? Array.from(new Set([...current, optionValue]))
        : current.filter((item: string) => item !== optionValue);

      const updated = {
        ...prev,
        [questionId]: next
      };
      debugLog(`MultiSelect changed: ${questionId}`, { optionValue, checked, newValue: updated[questionId] });
      return updated;
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
            Question {questionIndexInStep + 1} of {visibleQuestionsInStep.length} in {currentStep?.title} ({progressPercent}%)
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
            {config.steps
              .filter((step) => evaluateCondition(step.showIf, answers))
              .map((step) => (
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
                    {step.questions
                      .filter((question) => evaluateCondition(question.showIf, answers))
                      .map((question) => {
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

      {/* Progress Bar */}
      <div style={{ marginTop: 16 }}>
        <div
          style={{
            height: 8,
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
              borderRadius: 999,
              transition: "width 0.3s ease"
            }}
          />
        </div>
        <div style={{ marginTop: 8, fontSize: 13, color: theme.muted, fontWeight: 500 }}>
          Step {stepIndex + 1} of {totalSteps} · {progressPercent}% complete
        </div>
      </div>

      {/* Section Header */}
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
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 12px",
            borderRadius: 999,
            background: theme.accentSoft,
            color: theme.accent,
            fontSize: 12,
            fontWeight: 700,
            marginBottom: 8
          }}
        >
          Section {stepIndex + 1}
        </div>

        <div style={{ fontWeight: 800, fontSize: 24, color: theme.text, marginBottom: 4 }}>
          {currentStep.title}
        </div>

        {currentStep.intro ? (
          <p style={{ color: theme.muted, fontSize: 14, margin: 0 }}>
            {currentStep.intro}
          </p>
        ) : null}
      </div>

      {/* Two Questions Display */}
      <div
        style={{
          marginTop: 16,
          padding: 24,
          border: `1px solid ${theme.border}`,
          borderRadius: 16,
          background: theme.cardBg,
          boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)"
        }}
      >
        {/* First Question */}
        {currentQuestion ? (
          <div style={{ marginBottom: nextQuestion ? 32 : 0 }}>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 12, color: theme.text }}>
              {currentQuestion.label} {currentQuestion.required ? <span style={{ color: theme.danger }}>*</span> : null}
            </div>

            {currentQuestion.helperText || helperTextMap[currentQuestion.id] ? (
              <div
                style={{
                  marginBottom: 16,
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: theme.muted,
                  background: theme.cardSubtle,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 12,
                  padding: "12px 14px"
                }}
              >
                {currentQuestion.helperText || helperTextMap[currentQuestion.id]}
              </div>
            ) : null}

            {currentQuestion.type === "select" ? (
              <select
                value={typeof answers[currentQuestion.id] === "string" ? answers[currentQuestion.id] : ""}
                onChange={(e) => handleSelectChange(currentQuestion.id, e.target.value)}
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 12,
                  border: `1px solid ${theme.border}`,
                  background: theme.cardBg,
                  color: theme.text,
                  fontSize: 15
                }}
              >
                <option value="">Select an option</option>
                {(currentQuestion.options ?? []).map((option) => (
                  <option key={getOptionValue(option)} value={getOptionValue(option)}>
                    {getOptionLabel(option)}
                  </option>
                ))}
              </select>
            ) : null}

            {currentQuestion.type === "multiselect" ? (
              <div style={{ display: "grid", gap: 10 }}>
                {(currentQuestion.options ?? []).map((option) => {
                  const optionValue = getOptionValue(option);
                  const optionLabel = getOptionLabel(option);
                  const selectedValues = Array.isArray(answers[currentQuestion.id]) ? answers[currentQuestion.id] : [];
                  const checked = selectedValues.includes(optionValue);

                  return (
                    <label
                      key={optionValue}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "12px 14px",
                        borderRadius: 12,
                        border: `2px solid ${checked ? theme.accent : theme.border}`,
                        background: checked ? theme.accentSoft : theme.cardBg,
                        cursor: "pointer",
                        transition: "all 0.2s"
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          handleMultiSelectChange(currentQuestion.id, optionValue, e.target.checked)
                        }
                        style={{ cursor: "pointer" }}
                      />
                      <span style={{ color: theme.text, fontSize: 15 }}>{optionLabel}</span>
                    </label>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Divider if showing 2 questions */}
        {currentQuestion && nextQuestion ? (
          <div
            style={{
              height: 1,
              background: theme.border,
              margin: "32px 0"
            }}
          />
        ) : null}

        {/* Second Question */}
        {nextQuestion ? (
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 12, color: theme.text }}>
              {nextQuestion.label} {nextQuestion.required ? <span style={{ color: theme.danger }}>*</span> : null}
            </div>

            {nextQuestion.helperText || helperTextMap[nextQuestion.id] ? (
              <div
                style={{
                  marginBottom: 16,
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: theme.muted,
                  background: theme.cardSubtle,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 12,
                  padding: "12px 14px"
                }}
              >
                {nextQuestion.helperText || helperTextMap[nextQuestion.id]}
              </div>
            ) : null}

            {nextQuestion.type === "select" ? (
              <select
                value={typeof answers[nextQuestion.id] === "string" ? answers[nextQuestion.id] : ""}
                onChange={(e) => handleSelectChange(nextQuestion.id, e.target.value)}
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 12,
                  border: `1px solid ${theme.border}`,
                  background: theme.cardBg,
                  color: theme.text,
                  fontSize: 15
                }}
              >
                <option value="">Select an option</option>
                {(nextQuestion.options ?? []).map((option) => (
                  <option key={getOptionValue(option)} value={getOptionValue(option)}>
                    {getOptionLabel(option)}
                  </option>
                ))}
              </select>
            ) : null}

            {nextQuestion.type === "multiselect" ? (
              <div style={{ display: "grid", gap: 10 }}>
                {(nextQuestion.options ?? []).map((option) => {
                  const optionValue = getOptionValue(option);
                  const optionLabel = getOptionLabel(option);
                  const selectedValues = Array.isArray(answers[nextQuestion.id]) ? answers[nextQuestion.id] : [];
                  const checked = selectedValues.includes(optionValue);

                  return (
                    <label
                      key={optionValue}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "12px 14px",
                        borderRadius: 12,
                        border: `2px solid ${checked ? theme.accent : theme.border}`,
                        background: checked ? theme.accentSoft : theme.cardBg,
                        cursor: "pointer",
                        transition: "all 0.2s"
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          handleMultiSelectChange(nextQuestion.id, optionValue, e.target.checked)
                        }
                        style={{ cursor: "pointer" }}
                      />
                      <span style={{ color: theme.text, fontSize: 15 }}>{optionLabel}</span>
                    </label>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}

        {validationError ? (
          <p style={{ marginTop: 16, color: theme.danger, fontSize: 14 }}>{validationError}</p>
        ) : null}

        {/* Navigation Buttons */}
        <div style={{ display: "flex", gap: 10, marginTop: 24, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={goBack}
            disabled={stepIndex === 0 && questionIndexInStep === 0}
            style={{
              padding: "12px 16px",
              borderRadius: 12,
              border: `1px solid ${theme.border}`,
              background: stepIndex === 0 && questionIndexInStep === 0 ? theme.cardSubtle : theme.cardBg,
              color: stepIndex === 0 && questionIndexInStep === 0 ? theme.muted : theme.text,
              cursor: stepIndex === 0 && questionIndexInStep === 0 ? "not-allowed" : "pointer",
              fontWeight: 600,
              fontSize: 15,
              transition: "all 0.2s"
            }}
          >
            Back
          </button>

          <button
            type="button"
            onClick={goNext}
            style={{
              padding: "12px 24px",
              borderRadius: 12,
              border: "none",
              background: theme.accent,
              color: "#fff",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 15,
              transition: "all 0.2s"
            }}
          >
            {isLastPair && isLastStep ? "Review Answers" : isLastPair ? "Next Section" : "Next"}
          </button>
        </div>
      </div>
    </main>
  );
}