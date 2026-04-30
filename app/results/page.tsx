"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { buildResultsIntro, evaluateScreening } from "@/lib/screening";

type Resource = {
  id: string;
  name: string;
  description: string | null;
  category_tags: string[];
  languages: string[];
  region: string;
  phone: string | null;
  website: string | null;
  hours: string | null;
  sort_order: number;
};

type IntakeConfig = any;

type ScreeningResult = {
  scores: {
    safety_risk: number;
    coercion_score: number;
    trafficking_score: number;
    labor_exploitation_score: number;
    dv_score: number;
    sexual_violence_score: number;
    immigration_need: number;
  };
  tags: string[];
  summaryFlags: string[];
  total_score: number;
  risk_level: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  intersections: string[];
};

const theme = {
  pageBg: "#F8FAFC",
  cardBg: "#FFFFFF",
  cardSubtle: "#F1F5F9",
  text: "#0F172A",
  muted: "#475569",
  border: "#E2E8F0",
  accent: "#0EA5A4",
  accentSoft: "#CCFBF1",
  danger: "#B91C1C"
};

const chartColors = [
  "#0EA5A4",
  "#2563EB",
  "#7C3AED",
  "#F59E0B",
  "#EF4444",
  "#14B8A6"
];

const TAG_LABELS: Record<string, string> = {
  crisis_support: "Crisis Support",
  safety_planning: "Safety Planning",
  housing_shelter: "Safe Housing and Shelter",
  trafficking_support: "Trafficking-Related Support",
  victim_support: "Victim Advocacy Support",
  case_management: "Case Management",
  legal_help: "Legal Help",
  immigration_legal_screening: "Immigration Legal Screening",
  t_visa_support: "T Visa Support",
  u_visa_support: "U Visa Support",
  asylum_support: "Asylum Support",
  employment_support: "Employment Support",
  financial_assistance: "Financial Assistance",
  medical_care: "Medical Care",
  mental_health: "Counseling and Mental Health Support",
  sexual_assault_support: "Sexual Assault Support",
  domestic_violence_support: "Domestic Violence Support",
  language_interpretation: "Language Interpretation",
  transportation: "Transportation Help",
  child_services: "Child and Family Support",
  food_assistance: "Food Assistance",
  trafficking_support_services: "Trafficking Support Services",
  labor_rights_support: "Labor Rights Support",
  emergency_help: "Emergency Help",
  shelter: "Shelter",
  counseling: "Counseling",
  legal_services: "Legal Services"
};

function getTagLabel(tag: string) {
  return TAG_LABELS[tag] || tag.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function toPercent(score: number, highThreshold: number) {
  if (!highThreshold || highThreshold <= 0) return 0;
  return Math.min(100, Math.round((score / highThreshold) * 100));
}

function DoughnutChart({
  items
}: {
  items: { label: string; value: number; color: string }[];
}) {
  const safeItems = items.filter((i) => i.value > 0);
  const total = safeItems.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return (
      <div
        style={{
          width: 220,
          height: 220,
          borderRadius: "50%",
          background: theme.cardSubtle,
          border: `1px solid ${theme.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: theme.muted,
          fontSize: 14
        }}
      >
        No chart data yet
      </div>
    );
  }

  let current = 0;
  const segments = safeItems.map((item) => {
    const start = (current / total) * 360;
    current += item.value;
    const end = (current / total) * 360;
    return `${item.color} ${start}deg ${end}deg`;
  });

  return (
    <div
      style={{
        width: 220,
        height: 220,
        borderRadius: "50%",
        background: `conic-gradient(${segments.join(", ")})`,
        position: "relative",
        border: `1px solid ${theme.border}`
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 35,
          borderRadius: "50%",
          background: theme.cardBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: 12,
          color: theme.text,
          fontWeight: 700,
          fontSize: 14,
          lineHeight: 1.3
        }}
      >
        Score
        <br />
        Distribution
      </div>
    </div>
  );
}

export default function ResultsPage() {
  const router = useRouter();

  const [answers, setAnswers] = useState<Record<string, any> | null>(null);
  const [cfg, setCfg] = useState<IntakeConfig | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("bc_intake_answers");

    try {
      setAnswers(saved ? JSON.parse(saved) : {});
    } catch {
      setAnswers({});
    }

    fetch("/intake-config/en")
      .then((r) => r.json())
      .then(setCfg)
      .catch(() => {
        setCfg(null);
        setError("Failed to load intake configuration.");
      });

    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_name: "results_viewed", event_key: "v2-screening" })
    }).catch(() => {});
  }, []);

  const screeningResult: ScreeningResult | null = useMemo(() => {
    if (!cfg || !answers) return null;
    return evaluateScreening(cfg, answers);
  }, [cfg, answers]);

  const region = useMemo(() => (answers?.state || "US").toUpperCase(), [answers]);
  const language = useMemo(() => answers?.language || "", [answers]);

  const introLines = useMemo(() => {
    if (!screeningResult) return [];
    return buildResultsIntro(screeningResult);
  }, [screeningResult]);

  const thresholdMap = cfg?.thresholds || {};

  const scoreCards = useMemo(() => {
    if (!screeningResult) return [];

    return [
      {
        key: "safety_risk",
        label: "Safety Risk",
        score: screeningResult.scores.safety_risk,
        percent: toPercent(screeningResult.scores.safety_risk, thresholdMap?.safety_risk?.high || 4),
        color: chartColors[0]
      },
      {
        key: "trafficking_score",
        label: "Trafficking Indicators",
        score: screeningResult.scores.trafficking_score,
        percent: toPercent(screeningResult.scores.trafficking_score, thresholdMap?.trafficking_score?.high || 6),
        color: chartColors[1]
      },
      {
        key: "labor_exploitation_score",
        label: "Labor Exploitation",
        score: screeningResult.scores.labor_exploitation_score,
        percent: toPercent(
          screeningResult.scores.labor_exploitation_score,
          thresholdMap?.labor_exploitation_score?.high || 4
        ),
        color: chartColors[2]
      },
      {
        key: "dv_score",
        label: "Domestic Violence",
        score: screeningResult.scores.dv_score,
        percent: toPercent(screeningResult.scores.dv_score, thresholdMap?.dv_score?.high || 4),
        color: chartColors[3]
      },
      {
        key: "sexual_violence_score",
        label: "Sexual Violence",
        score: screeningResult.scores.sexual_violence_score,
        percent: toPercent(
          screeningResult.scores.sexual_violence_score,
          thresholdMap?.sexual_violence_score?.high || 3
        ),
        color: chartColors[4]
      },
      {
        key: "immigration_need",
        label: "Immigration Legal Need",
        score: screeningResult.scores.immigration_need,
        percent: toPercent(screeningResult.scores.immigration_need, thresholdMap?.immigration_need?.high || 3),
        color: chartColors[5]
      }
    ];
  }, [screeningResult, thresholdMap]);

  useEffect(() => {
    const run = async () => {
      if (!answers || !screeningResult) return;

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/resources?region=${encodeURIComponent(region)}`);
        const json = await res.json();

        if (!json.ok) throw new Error(json.error || "Failed to load resources");

        const all: Resource[] = json.resources || [];

        const filteredByTags =
          screeningResult.tags.length === 0
            ? all
            : all.filter(
                (r) =>
                  Array.isArray(r.category_tags) &&
                  r.category_tags.some((tag) => screeningResult.tags.includes(tag))
              );

        const filteredByLanguage =
          language && language.trim() !== ""
            ? filteredByTags.filter(
                (r) => Array.isArray(r.languages) && r.languages.includes(language)
              )
            : filteredByTags;

        setResources(filteredByLanguage);

        screeningResult.tags.slice(0, 15).forEach((tag) => {
          fetch("/api/analytics", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event_name: "recommendation_shown",
              event_key: tag
            })
          }).catch(() => {});
        });
      } catch (e: any) {
        setError(e?.message || "Failed to load matched resources.");
        setResources([]);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [answers, screeningResult, region, language]);

  const logResourceClick = async (resourceId: string) => {
    await fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_name: "resource_clicked",
        event_key: resourceId
      })
    }).catch(() => {});
  };

  const startOver = () => {
    const confirmed = window.confirm("Are you sure you want to clear your answers and start over?");
    if (!confirmed) return;

    sessionStorage.removeItem("bc_intake_answers");
    sessionStorage.removeItem("bc_intake_step_index");
    sessionStorage.removeItem("bc_intake_question_index");
    sessionStorage.removeItem("bc_intake_review");
    router.push("/intake");
  };

  if (!answers) {
    return (
      <main style={{ background: theme.pageBg, minHeight: "100vh", padding: 24 }}>
        <p>Loading…</p>
      </main>
    );
  }

  return (
    <main style={{ background: theme.pageBg, minHeight: "100vh", padding: 24, color: theme.text }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            flexWrap: "wrap"
          }}
        >
          <div>
            <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 8 }}>Results</h1>
            <p style={{ color: theme.muted, maxWidth: 760 }}>
              Based on your answers, these resources may be helpful. Your answers are not stored.
            </p>
          </div>

          <button
            type="button"
            onClick={startOver}
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
            Start Over
          </button>
        </div>

        {screeningResult && (
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
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
              <div style={{ flex: "1 1 460px" }}>
                <div style={{ fontSize: 14, color: theme.muted }}>
                  <b>State:</b> {region}
                  {language ? (
                    <>
                      {" "}
                      · <b>Language:</b> {language}
                    </>
                  ) : null}
                </div>

                <div style={{ marginTop: 14 }}>
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>What this may mean</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {introLines.map((line, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 12,
                          background: theme.cardSubtle,
                          border: `1px solid ${theme.border}`,
                          color: theme.text
                        }}
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tags are kept in backend for resource filtering but hidden from user display */}
              </div>

              <div
                style={{
                  flex: "0 0 260px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 14
                }}
              >
                <DoughnutChart
                  items={scoreCards.map((item) => ({
                    label: item.label,
                    value: item.score,
                    color: item.color
                  }))}
                />

                <div style={{ width: "100%", display: "grid", gap: 8 }}>
                  {scoreCards.map((item) => (
                    <div
                      key={item.key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                        padding: "8px 10px",
                        border: `1px solid ${theme.border}`,
                        borderRadius: 12,
                        background: theme.cardSubtle
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: "50%",
                            background: item.color,
                            display: "inline-block"
                          }}
                        />
                        <span style={{ fontSize: 13, color: theme.text }}>{item.label}</span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 800 }}>{item.percent}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={{ marginTop: 18 }}>
          <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 10 }}>Resource matches</div>

          {loading && <p>Loading matched resources…</p>}

          {error && <p style={{ color: theme.danger }}>{error}</p>}

          {!loading && !error && resources.length === 0 && (
            <p style={{ color: theme.muted }}>
              No matching resources were found yet. Add more resources in Supabase with category tags
              that match the screening results.
            </p>
          )}

          <div style={{ display: "grid", gap: 14, marginTop: 12 }}>
            {resources.map((r) => (
              <div
                key={r.id}
                style={{
                  border: `1px solid ${theme.border}`,
                  borderRadius: 16,
                  padding: 16,
                  background: theme.cardBg,
                  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap"
                  }}
                >
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: theme.text }}>{r.name}</div>
                    {r.description ? (
                      <div style={{ marginTop: 6, color: theme.muted }}>{r.description}</div>
                    ) : null}
                  </div>

                  <div style={{ fontSize: 12, color: theme.muted }}>
                    <div>
                      <b>Region:</b> {r.region}
                    </div>
                    {r.hours ? (
                      <div>
                        <b>Hours:</b> {r.hours}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {r.category_tags?.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        border: `1px solid ${theme.border}`,
                        borderRadius: 999,
                        padding: "5px 10px",
                        fontSize: 12,
                        background: theme.cardSubtle,
                        color: theme.text
                      }}
                    >
                      {getTagLabel(tag)}
                    </span>
                  ))}
                </div>

                {r.languages?.length ? (
                  <div style={{ marginTop: 8, fontSize: 12, color: theme.muted }}>
                    Languages: {r.languages.join(", ")}
                  </div>
                ) : null}

                <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {r.phone ? (
                    <a
                      href={`tel:${r.phone}`}
                      onClick={() => logResourceClick(r.id)}
                      style={{
                        textDecoration: "none",
                        border: `1px solid ${theme.border}`,
                        padding: "10px 14px",
                        borderRadius: 10,
                        background: theme.cardBg,
                        color: theme.text,
                        fontWeight: 700
                      }}
                    >
                      Call
                    </a>
                  ) : null}

                  {r.website ? (
                    <a
                      href={r.website}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => logResourceClick(r.id)}
                      style={{
                        textDecoration: "none",
                        border: `1px solid ${theme.accent}`,
                        padding: "10px 14px",
                        borderRadius: 10,
                        background: theme.accent,
                        color: "#fff",
                        fontWeight: 700
                      }}
                    >
                      Website
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}