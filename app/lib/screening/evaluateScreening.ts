/**
 * Bridgeway Connects: Risk Scoring Engine
 * Calculates trafficking risk scores (0-150 scale) with intersection detection
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

export function evaluateScreening(config: any, answers: Record<string, any>): ScreeningOutput {
  // Initialize scores
  let wage_violations = 0;
  let control_coercion = 0;
  let restrictions_isolation = 0;
  let labor_violations = 0;
  let vulnerability = 0;
  let sexual_exploitation = 0;

  // Detection flags for intersections
  let has_labor_indicators = false;
  let has_sexual_indicators = false;
  let has_domestic_violence = false;
  let is_child_trafficking = false;
  let is_gang_trafficking = false;
  let is_ongoing = false;
  let has_labor_and_sex = false;

  const tags: string[] = [];
  const summaryFlags: string[] = [];
  const intersections: string[] = [];

  // ============================================
  // CATEGORY 1: WAGE & COMPENSATION (max 30)
  // ============================================

  // Wage calculation based on answers
  const payFrequencyType = answers.pay_frequency_type;
  const payAmount = normalizePayAmount(answers.pay_amount);
  const hoursPerDay = normalizeHours(answers.hours_per_day);
  const daysPerWeek = normalizeDays(answers.days_per_week);
  const consistency = answers.work_consistency;

  if (payAmount && hoursPerDay && daysPerWeek) {
    // Calculate hourly rate
    let hourlyRate = 0;

    if (payFrequencyType === "hourly") {
      hourlyRate = payAmount;
    } else if (payFrequencyType === "daily") {
      hourlyRate = hoursPerDay > 0 ? payAmount / hoursPerDay : payAmount;
    } else if (payFrequencyType === "weekly") {
      const totalHours = hoursPerDay * daysPerWeek;
      hourlyRate = totalHours > 0 ? payAmount / totalHours : payAmount;
    } else if (payFrequencyType === "monthly") {
      const totalHours = hoursPerDay * daysPerWeek * 4.33;
      hourlyRate = totalHours > 0 ? payAmount / totalHours : payAmount;
    }

    // Account for irregular work
    if (consistency === "most_weeks") {
      hourlyRate = hourlyRate * (2.5 / 4);
    } else if (consistency === "some_weeks") {
      hourlyRate = hourlyRate * (1.5 / 4);
    } else if (consistency === "very_unpredictable") {
      hourlyRate = hourlyRate * 0.5;
    }

    // Compare to federal minimum ($7.25)
    const federalMinimum = 7.25;
    const state = (answers.state || "US").toUpperCase();
    const stateMinimum = getStateMinimumWage(state);

    if (hourlyRate < federalMinimum) {
      wage_violations += 5;
    }
    if (hourlyRate < stateMinimum) {
      wage_violations += 10;
    }
    if (hourlyRate < stateMinimum * 0.5) {
      wage_violations += 15; // Severely underpaid
    }
  }

  // Payment issues
  if (answers.pay_stub === "no") {
    wage_violations += 3;
  }
  if (answers.understand_pay === "no") {
    wage_violations += 2;
  }

  const paymentIssues = answers.payment_issues || [];
  if (paymentIssues.includes("not_paid")) {
    wage_violations += 15;
  } else if (paymentIssues.includes("paid_less")) {
    wage_violations += 5;
  }
  if (paymentIssues.includes("bonus_withheld")) {
    wage_violations += 5;
  }

  // Deductions
  const deductions = answers.deduction_types || [];
  if (deductions.length > 2) {
    wage_violations += 8; // Multiple deductions = debt bondage indicator
  }

  // Overtime issues
  if (answers.overtime_pay === "no") {
    wage_violations += 5;
  }

  wage_violations = Math.min(wage_violations, 30);

  // ============================================
  // CATEGORY 2: CONTROL & COERCION (max 35)
  // ============================================

  // Documents held
  if (answers.control_documents === "no" || answers.control_documents === "partially") {
    control_coercion += 15;
  }

  // Cannot refuse work
  if (answers.can_refuse_work === "no") {
    control_coercion += 12;
  }

  // Permission required for basic functions
  const permissions = answers.permission_required || [];
  if (permissions.length >= 2) {
    control_coercion += 8;
  }

  // Threats
  const threatTypes = answers.threat_types || [];
  if (threatTypes.includes("deportation")) {
    control_coercion += 10;
  }
  if (threatTypes.includes("physical_harm") || threatTypes.includes("family_harm")) {
    control_coercion += 10;
  }
  if (threatTypes.includes("police")) {
    control_coercion += 8;
  }

  // Cannot contact family
  if (answers.contact_family === "no" || answers.contact_family === "limited") {
    control_coercion += 12;
  }

  // Employer monitors communications
  if (answers.monitor_communications === "yes") {
    control_coercion += 6;
  }

  // Fear of employer
  if (answers.fear_employer === "yes") {
    control_coercion += 8;
  }

  // Afraid to ask about pay
  const resolutionAttempt = answers.resolution_attempt;
  if (resolutionAttempt === "afraid_ask") {
    control_coercion += 7;
  }

  control_coercion = Math.min(control_coercion, 35);

  // ============================================
  // CATEGORY 3: RESTRICTIONS & ISOLATION (max 20)
  // ============================================

  // Cannot leave freely
  const leavingConsequences = answers.leaving_consequences;
  if (leavingConsequences === "not_allowed" || leavingConsequences === "afraid" || leavingConsequences === "threatened") {
    restrictions_isolation += 15;
  }

  // Cannot move freely
  if (answers.free_movement === "no" || answers.free_movement === "mostly") {
    restrictions_isolation += 8;
  }

  // Multiple barriers to leaving
  const barriers = answers.barriers_to_leaving || [];
  if (barriers.length >= 3) {
    restrictions_isolation += 5;
  }

  // No support network
  const whoToCall = answers.who_to_call || [];
  if (whoToCall.length === 0 || (whoToCall.length === 1 && whoToCall.includes("no_one"))) {
    restrictions_isolation += 5;
  }

  restrictions_isolation = Math.min(restrictions_isolation, 20);

  // ============================================
  // CATEGORY 4: LABOR VIOLATIONS (max 15)
  // ============================================

  // No breaks or insufficient
  if (answers.can_take_breaks === "no") {
    labor_violations += 5;
  }
  const breaksPerDay = answers.breaks_per_day;
  if (breaksPerDay === "none" || breaksPerDay === "one") {
    labor_violations += 3;
  }

  // Excessive hours
  const hoursPerWeek = hoursPerDay && daysPerWeek ? hoursPerDay * daysPerWeek : 0;
  if (hoursPerWeek > 60) {
    labor_violations += 5;
  }

  // No days off
  if (answers.days_off_per_week === "zero") {
    labor_violations += 5;
  }

  // Unsafe conditions
  const unsafeReasons = answers.unsafe_reasons || [];
  if (unsafeReasons.length > 0) {
    labor_violations += 8;
  }

  // Retaliation for complaints
  if (answers.resolution_attempt === "threatened") {
    labor_violations += 10;
  }

  // Recent injury/threat
  if (answers.workplace_injury === "yes") {
    labor_violations += 15;
  }

  labor_violations = Math.min(labor_violations, 15);

  // ============================================
  // CATEGORY 5: VULNERABILITY (max 10)
  // ============================================

  // Immigration status
  if (answers.immigration_status === "undocumented") {
    vulnerability += 5;
  }

  // Fear of deportation
  if (answers.afraid_deported === "yes") {
    vulnerability += 3;
  }

  // Recently arrived (indicator of newness/vulnerability)
  const jobDuration = answers.job_duration;
  if (jobDuration === "less_1month" || jobDuration === "1_3months") {
    vulnerability += 3;
  }

  vulnerability = Math.min(vulnerability, 10);

  // ============================================
  // CATEGORY 6: SEXUAL EXPLOITATION (max 40)
  // ============================================

  const pressuredSexual = answers.pressured_sexual_activity;
  if (pressuredSexual === "yes") {
    has_sexual_indicators = true;

    // Sexual activity forced/coerced
    if (answers.could_refuse === "no") {
      sexual_exploitation += 15;
    } else if (answers.could_refuse === "partially") {
      sexual_exploitation += 8;
    }

    // Recruited as minor
    const ageWhenStarted = answers.age_when_started;
    if (ageWhenStarted === "under_12" || ageWhenStarted === "12_14" || ageWhenStarted === "15_17") {
      sexual_exploitation += 15;
      is_child_trafficking = true;
    }

    // Money taken
    if (answers.give_money_earned === "yes") {
      sexual_exploitation += 10;
    }

    // Someone profits
    if (answers.someone_profited === "yes" && answers.knew_about_profit === "yes") {
      sexual_exploitation += 12;
    }

    // Threats for trying to stop
    const triedToStop = answers.tried_to_stop || [];
    if (
      triedToStop.includes("threatened") ||
      triedToStop.includes("beaten") ||
      triedToStop.includes("family_threatened")
    ) {
      sexual_exploitation += 12;
    }

    // Substance dependency (provider-controlled)
    if (answers.who_provided_drugs === "exploiter") {
      sexual_exploitation += 8;
    }

    // Prevented medical care
    if (answers.contact_family === "no") {
      // Using as proxy since we don't have explicit healthcare question yet
      sexual_exploitation += 5;
    }

    // Multiple people involved
    const whoAsked = answers.who_asked || [];
    if (whoAsked.includes("multiple")) {
      sexual_exploitation += 12;
      is_gang_trafficking = true;
    }

    // Used fake name
    if (answers.fake_name === "yes") {
      sexual_exploitation += 3;
    }

    // Ongoing contact with exploiter
    if (answers.still_happening === "yes") {
      sexual_exploitation += 8;
      is_ongoing = true;
    }
  }

  sexual_exploitation = Math.min(sexual_exploitation, 40);

  // ============================================
  // DETECT INTERSECTIONS
  // ============================================

  // Check if labor exploitation is present
  if (wage_violations + labor_violations > 5) {
    has_labor_indicators = true;
  }

  // Labor + Sex trafficking intersection
  if (has_labor_indicators && has_sexual_indicators) {
    has_labor_and_sex = true;
    intersections.push("labor_and_sex_trafficking");
  }

  // Domestic violence pattern
  const relationshipType = answers.relationship_type;
  if (relationshipType === "romantic" && (control_coercion > 10 || sexual_exploitation > 10)) {
    has_domestic_violence = true;
    intersections.push("intimate_partner_exploitation");
  }

  // Gang/network trafficking
  if (is_gang_trafficking) {
    intersections.push("gang_network_trafficking");
  }

  // Child trafficking
  if (is_child_trafficking) {
    intersections.push("child_trafficking");
  }

  // ============================================
  // CALCULATE TOTAL SCORE WITH MULTIPLIERS
  // ============================================

  let baseScore =
    wage_violations + control_coercion + restrictions_isolation + labor_violations + vulnerability + sexual_exploitation;

  let finalScore = baseScore;

  // Apply multipliers
  if (has_labor_and_sex) {
    finalScore += 15;
  }
  if (is_child_trafficking) {
    finalScore += 20;
  }
  if (is_gang_trafficking) {
    finalScore += 10;
  }
  if (is_ongoing) {
    finalScore += 15;
  }

  // Cap at 150 for CRITICAL
  finalScore = Math.min(finalScore, 150);

  // ============================================
  // DETERMINE RISK LEVEL
  // ============================================

  let riskLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL" = "LOW";
  if (finalScore >= 91) {
    riskLevel = "CRITICAL";
  } else if (finalScore >= 51) {
    riskLevel = "HIGH";
  } else if (finalScore >= 21) {
    riskLevel = "MODERATE";
  }

  // ============================================
  // GENERATE TAGS FOR RESOURCE FILTERING
  // ============================================

  // Wage/Labor issues
  if (wage_violations >= 10) {
    tags.push("labor_rights_support", "wage_recovery_legal_clinics");
  }

  // Control/Coercion issues
  if (control_coercion >= 15) {
    tags.push("trafficking_support", "case_management");
  }

  // Safety
  if (finalScore >= 51) {
    tags.push("crisis_support", "safety_planning");
  }

  // Housing
  if (answers.needs_right_now?.includes("safe_housing") || barriers.includes("nowhere_safe")) {
    tags.push("housing_shelter");
  }

  // Legal help
  if (sexual_exploitation >= 15 || wage_violations >= 15) {
    tags.push("legal_help");
  }

  // Immigration
  if (answers.immigration_status === "undocumented" || answers.wants_immigration_help === "yes") {
    tags.push("immigration_legal_screening");
  }

  // Sexual violence/trafficking
  if (sexual_exploitation >= 15) {
    tags.push("sexual_assault_support");
    if (finalScore >= 51) {
      tags.push("trauma_informed_counseling");
    }
  }

  // Domestic violence
  if (has_domestic_violence) {
    tags.push("domestic_violence_support", "safety_planning");
  }

  // T visa (labor trafficking victim)
  if (has_labor_indicators && finalScore >= 36) {
    tags.push("t_visa_support");
  }

  // U visa (crime victim)
  if (sexual_exploitation >= 15 || has_domestic_violence) {
    tags.push("u_visa_support");
  }

  // Medical care
  if (answers.needs_right_now?.includes("medical") || sexual_exploitation >= 10) {
    tags.push("medical_care");
  }

  // Mental health
  if (finalScore >= 51) {
    tags.push("mental_health");
  }

  // Remove duplicates
  const uniqueTags = [...new Set(tags)];

  // ============================================
  // GENERATE SUMMARY FLAGS
  // ============================================

  if (wage_violations >= 10) {
    summaryFlags.push("Pay is significantly below minimum wage");
  }
  if (control_coercion >= 15) {
    summaryFlags.push("Limited freedom and control over decisions");
  }
  if (sexual_exploitation >= 15) {
    summaryFlags.push("Forced or coerced sexual activity");
  }
  if (restrictions_isolation >= 10) {
    summaryFlags.push("Isolation from support networks");
  }
  if (is_ongoing) {
    summaryFlags.push("Situation is still happening");
  }
  if (is_child_trafficking) {
    summaryFlags.push("Exploitation began before age 18");
  }

  // ============================================
  // RETURN SCREENING OUTPUT
  // ============================================

  // Debug logging
  if (typeof window !== 'undefined') {
    console.log('[evaluateScreening] Debug Info:', {
      wage_violations,
      control_coercion,
      restrictions_isolation,
      labor_violations,
      vulnerability,
      sexual_exploitation,
      baseScore,
      finalScore,
      riskLevel,
      has_sexual_indicators,
      has_labor_indicators,
      pressured_sexual: answers.pressured_sexual_activity,
      could_refuse: answers.could_refuse
    });
  }

  return {
    scores: {
      safety_risk: restrictions_isolation,
      coercion_score: control_coercion,
      trafficking_score: finalScore,
      labor_exploitation_score: wage_violations + labor_violations,
      dv_score: has_domestic_violence ? 20 : 0,
      sexual_violence_score: sexual_exploitation,
      immigration_need: answers.immigration_status === "undocumented" ? 5 : 0
    },
    total_score: finalScore,
    risk_level: riskLevel,
    tags: uniqueTags,
    summaryFlags: summaryFlags,
    intersections: intersections
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function normalizePayAmount(payAmount: string | undefined): number {
  if (!payAmount) return 0;

  const ranges: Record<string, number> = {
    under_100: 50,
    "100_250": 175,
    "250_500": 375,
    "500_1000": 750,
    "1000_2000": 1500,
    "2000_plus": 3000
  };

  return ranges[payAmount] || 0;
}

function normalizeHours(hours: string | undefined): number {
  if (!hours) return 0;

  const ranges: Record<string, number> = {
    under_4: 2,
    "4_6": 5,
    "6_8": 7,
    "8_10": 9,
    "10_12": 11,
    "12_16": 14,
    "16_plus": 18,
    varies: 8,
    unsure: 8
  };

  return ranges[hours] || 0;
}

function normalizeDays(days: string | undefined): number {
  if (!days) return 0;

  const ranges: Record<string, number> = {
    less_2: 1,
    "2_3": 2.5,
    "3_4": 3.5,
    "4_5": 4.5,
    "5_6": 5.5,
    "7": 7,
    varies: 4,
    unsure: 4
  };

  return ranges[days] || 0;
}

function getStateMinimumWage(state: string): number {
  const minimumWages: Record<string, number> = {
    AL: 7.25,
    AK: 11.73,
    AZ: 15.45,
    AR: 11.0,
    CA: 16.5,
    CO: 15.08,
    CT: 15.69,
    DE: 13.5,
    FL: 13.0,
    GA: 7.25,
    HI: 14.0,
    ID: 10.93,
    IL: 14.0,
    IN: 7.25,
    IA: 11.0,
    KS: 7.25,
    KY: 7.25,
    LA: 7.25,
    ME: 14.15,
    MD: 15.3,
    MA: 15.0,
    MI: 10.33,
    MN: 11.85,
    MS: 7.25,
    MO: 12.3,
    MT: 12.3,
    NE: 14.0,
    NV: 12.0,
    NH: 7.25,
    NJ: 15.13,
    NM: 12.0,
    NY: 15.0,
    NC: 7.25,
    ND: 7.25,
    OH: 10.45,
    OK: 7.25,
    OR: 15.45,
    PA: 7.25,
    RI: 15.0,
    SC: 7.25,
    SD: 14.0,
    TN: 7.25,
    TX: 7.25,
    UT: 7.25,
    VT: 15.67,
    VA: 12.0,
    WA: 16.28,
    WV: 8.75,
    WI: 10.86,
    WY: 7.25,
    US: 7.25
  };

  return minimumWages[state] || 7.25;
}
