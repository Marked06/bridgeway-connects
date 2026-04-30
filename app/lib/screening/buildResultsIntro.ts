/**
 * Bridgeway Connects: Concise Results Messaging
 * Creates brief, victim-friendly, supportive messaging (3-4 lines max)
 */

type ScreeningOutput = {
  scores: {
    safety_risk: number;
    coercion_score: number;
    trafficking_score: number;
    labor_exploitation_score: number;
    dv_score: number;
    sexual_violence_score: number;
    immigration_need: number;
  };
  total_score: number;
  risk_level: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  tags: string[];
  summaryFlags: string[];
  intersections: string[];
};

export function buildResultsIntro(screeningResult: ScreeningOutput): string[] {
  const lines: string[] = [];
  const { scores, total_score, risk_level, intersections, summaryFlags } = screeningResult;

  // ============================================
  // OPENING - BRIEF, WARM ACKNOWLEDGMENT
  // ============================================

  lines.push(
    "Thank you for sharing your story. Based on your answers, here's what we found and what support might help."
  );

  // ============================================
  // VICTIM-FRIENDLY SITUATION SUMMARY (1-2 lines max)
  // ============================================

  // Determine situation type
  const hasLaborExploitation = scores.labor_exploitation_score >= 25;
  const hasSexualExploitation = scores.sexual_violence_score >= 15;
  const hasDomesticViolence = scores.dv_score >= 15;
  const isOngoing = summaryFlags.includes("Situation is still happening");
  const isCritical = risk_level === "CRITICAL";

  // Concise summary based on situation
  if (intersections.includes("labor_and_sex_trafficking")) {
    lines.push(
      "You described both work exploitation and unwanted sexual activity. This pattern of control is serious, and there are specialized services and legal options for you."
    );
  } else if (intersections.includes("intimate_partner_exploitation")) {
    lines.push(
      "Your partner is using control or coercion in ways that harm you. This is abuse, and safety planning plus legal options can help."
    );
  } else if (hasLaborExploitation) {
    lines.push(
      "Your work situation shows serious wage and labor rights violations. You may be owed money, and protections exist to help you."
    );
  } else if (hasSexualExploitation) {
    lines.push(
      "You described sexual experiences involving coercion or pressure. This is exploitation, and healing support is available to you."
    );
  } else if (hasDomesticViolence) {
    lines.push(
      "Your relationship involves control or pressure. Safety planning and support services can help you understand your options."
    );
  } else {
    lines.push(
      "While some things in your situation are positive, there are areas where support could help you stay safe or improve things."
    );
  }

  // ============================================
  // URGENCY CHECK (if applicable)
  // ============================================

  if (isOngoing && isCritical) {
    lines.push(
      "Your immediate safety is most important. Crisis support (1-888-373-7888) is available right now, 24/7, and confidential."
    );
  }

  // ============================================
  // CHILD TRAFFICKING CALLOUT (if applicable)
  // ============================================

  if (intersections.includes("child_trafficking")) {
    lines.push(
      "Because this started when you were under 18, you have access to special federal protections and services designed for young trafficking survivors."
    );
  }

  // ============================================
  // CLOSING - EMPOWERMENT & NEXT STEP
  // ============================================

  lines.push("---");
  lines.push(
    "The resources below match your situation. You're not alone—many people have found safety and recovery. Help is real, and you deserve support."
  );

  return lines;
}
