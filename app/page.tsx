"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const theme = {
  pageBg: "#F8FAFC",
  cardBg: "#FFFFFF",
  cardSubtle: "#F1F5F9",
  text: "#0F172A",
  muted: "#475569",
  border: "#E2E8F0",
  accent: "#0EA5A4",
  accentSoft: "#CCFBF1"
};

function FeatureCard({
  title,
  text
}: {
  title: string;
  text: string;
}) {
  return (
    <div
      style={{
        background: theme.cardBg,
        border: `1px solid ${theme.border}`,
        borderRadius: 16,
        padding: 20,
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)"
      }}
    >
      <h3 style={{ fontSize: 18, fontWeight: 700, color: theme.text, margin: 0 }}>
        {title}
      </h3>
      <p style={{ marginTop: 8, color: theme.muted, lineHeight: 1.6 }}>
        {text}
      </p>
    </div>
  );
}

function AudienceCard({
  title,
  text
}: {
  title: string;
  text: string;
}) {
  return (
    <div
      style={{
        background: theme.cardSubtle,
        border: `1px solid ${theme.border}`,
        borderRadius: 16,
        padding: 20
      }}
    >
      <h3 style={{ fontSize: 17, fontWeight: 700, color: theme.text, margin: 0 }}>
        {title}
      </h3>
      <p style={{ marginTop: 8, color: theme.muted, lineHeight: 1.6 }}>
        {text}
      </p>
    </div>
  );
}

function CTAButton({
  label,
  onClick,
  primary = false
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: primary ? theme.accent : theme.cardBg,
        color: primary ? "#FFFFFF" : theme.text,
        border: primary ? `1px solid ${theme.accent}` : `1px solid ${theme.border}`,
        padding: "14px 24px",
        fontSize: 16,
        borderRadius: 12,
        cursor: "pointer",
        fontWeight: 700,
        transition: "all 0.2s ease",
        transform: hovered ? "translateY(-1px)" : "translateY(0)",
        boxShadow: hovered ? "0 6px 18px rgba(15, 23, 42, 0.08)" : "none"
      }}
    >
      {label}
    </button>
  );
}

export default function HomePage() {
  const router = useRouter();

  return (
    <main
        style={{
          background: theme.pageBg,
          minHeight: "100vh",
          padding: "48px 20px",
          color: theme.text
        }}
      >
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        {/* HERO */}
        <section
          style={{
            textAlign: "center",
            padding: "24px 0 8px 0"
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
              marginBottom: 18
            }}
          >
            Privacy-first demo
          </div>

          <h1
            style={{
              fontSize: 42,
              fontWeight: 800,
              margin: 0,
              color: theme.text
            }}
          >
            Bridgeway Connects
          </h1>

          <p
            style={{
              fontSize: 19,
              color: theme.muted,
              maxWidth: 760,
              margin: "18px auto 0 auto",
              lineHeight: 1.7
            }}
          >
            A privacy-first screening tool designed to help individuals identify
            support services, even when they may not recognize their situation
            as exploitation, abuse, trafficking, or another form of harm.
          </p>

          <div
            style={{
              marginTop: 28,
              display: "flex",
              justifyContent: "center",
              gap: 12,
              flexWrap: "wrap"
            }}
          >
            <CTAButton
              label="Start Screening"
              primary
              onClick={() => router.push("/intake")}
            />
            <CTAButton
              label="Browse Resources"
              onClick={() => router.push("/resources")}
            />
          </div>
        </section>

        {/* FEATURES */}
        <section
          style={{
            marginTop: 48,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 20
          }}
        >
          <FeatureCard
            title="Private by Design"
            text="No personal data is stored. Responses stay in the browser session and are not saved to a user profile."
          />
          <FeatureCard
            title="Guided Screening"
            text="A structured series of questions helps surface support needs, even when someone may not know how to describe their experience."
          />
          <FeatureCard
            title="Smart Matching"
            text="Resources are matched based on patterns in answers, support priorities, and location."
          />
        </section>

        {/* HOW IT WORKS */}
        <section
          style={{
            marginTop: 28,
            background: theme.cardBg,
            border: `1px solid ${theme.border}`,
            borderRadius: 18,
            padding: 26,
            boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)"
          }}
        >
          <h2
            style={{
              fontSize: 24,
              fontWeight: 800,
              marginTop: 0,
              marginBottom: 12,
              color: theme.text
            }}
          >
            How it works
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16
            }}
          >
            <div
              style={{
                padding: 16,
                borderRadius: 14,
                background: theme.cardSubtle,
                border: `1px solid ${theme.border}`
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 8 }}>1. Answer questions</div>
              <div style={{ color: theme.muted, lineHeight: 1.6 }}>
                Complete a guided screening questionnaire designed to identify potential support needs.
              </div>
            </div>

            <div
              style={{
                padding: 16,
                borderRadius: 14,
                background: theme.cardSubtle,
                border: `1px solid ${theme.border}`
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 8 }}>2. Review responses</div>
              <div style={{ color: theme.muted, lineHeight: 1.6 }}>
                Check your answers before continuing so you can make changes if needed.
              </div>
            </div>

            <div
              style={{
                padding: 16,
                borderRadius: 14,
                background: theme.cardSubtle,
                border: `1px solid ${theme.border}`
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 8 }}>3. Explore matched resources</div>
              <div style={{ color: theme.muted, lineHeight: 1.6 }}>
                Receive support categories and resource matches based on your responses.
              </div>
            </div>
          </div>
        </section>

        {/* WHO THIS IS FOR */}
        <section style={{ marginTop: 28 }}>
          <h2
            style={{
              fontSize: 24,
              fontWeight: 800,
              marginBottom: 14,
              color: theme.text
            }}
          >
            Who this is for
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 20
            }}
          >
            <AudienceCard
              title="Individuals seeking help"
              text="People who may be experiencing abuse, exploitation, trafficking, coercion, or other harm and want a safer way to explore support options."
            />
            <AudienceCard
              title="Advocates and service providers"
              text="Organizations that want a privacy-first way to help people recognize possible support pathways and connect to services."
            />
            <AudienceCard
              title="Partners and stakeholders"
              text="Funders, nonprofits, and community leaders exploring how digital tools can improve navigation to support resources."
            />
          </div>
        </section>

        {/* TRUST / DISCLAIMER */}
        <section
          style={{
            marginTop: 36,
            textAlign: "center",
            color: theme.muted,
            fontSize: 14,
            maxWidth: 760,
            marginLeft: "auto",
            marginRight: "auto",
            lineHeight: 1.7
          }}
        >
          <p>
            This is a demo version of Bridgeway Connects. It is designed to support
            awareness and connection to services. It does not replace emergency
            assistance, legal advice, or professional care.
          </p>
        </section>
      </div>
    </main>
  );
}