export type ScoreMap = {
  safety_risk: number;
  coercion_score: number;
  trafficking_score: number;
  labor_exploitation_score: number;
  dv_score: number;
  sexual_violence_score: number;
  immigration_need: number;
};

export type Answers = Record<string, any>;

export type QuestionConfig = {
  id: string;
  type: "select" | "multiselect";
  label: string;
  required?: boolean;
  options?: Array<string | { value: string; label: string }>;
  scores?: Record<string, Partial<ScoreMap>>;
  tags?: Record<string, string[]>;
  tag_map?: Record<string, string[]>;
};

export type StepConfig = {
  id: string;
  title: string;
  questions: QuestionConfig[];
};

export type ThresholdTagRule = {
  score: keyof ScoreMap;
  min: number;
  tags: string[];
};

export type IntakeConfig = {
  version: string;
  title: string;
  description?: string;
  steps: StepConfig[];
  thresholds?: Record<string, { moderate: number; high: number }>;
  threshold_tags?: ThresholdTagRule[];
};

export type ScreeningResult = {
  scores: ScoreMap;
  tags: string[];
  summaryFlags: string[];
};

const EMPTY_SCORES: ScoreMap = {
  safety_risk: 0,
  coercion_score: 0,
  trafficking_score: 0,
  labor_exploitation_score: 0,
  dv_score: 0,
  sexual_violence_score: 0,
  immigration_need: 0
};

function uniq(arr: string[]) {
  return Array.from(new Set(arr)).filter(Boolean);
}

function addScores(target: ScoreMap, partial?: Partial<ScoreMap>) {
  if (!partial) return;
  for (const key of Object.keys(partial) as Array<keyof ScoreMap>) {
    target[key] += Number(partial[key] || 0);
  }
}

export function evaluateScreening(config: IntakeConfig, answers: Answers): ScreeningResult {
  const scores: ScoreMap = { ...EMPTY_SCORES };
  const tags: string[] = [];

  for (const step of config.steps || []) {
    for (const q of step.questions || []) {
      const answer = answers[q.id];

      if (q.type === "multiselect") {
        const selected = Array.isArray(answer) ? answer : [];
        for (const value of selected) {
          if (q.scores?.[value]) addScores(scores, q.scores[value]);
          if (q.tags?.[value]) tags.push(...q.tags[value]);
          if (q.tag_map?.[value]) tags.push(...q.tag_map[value]);
        }
      } else {
        if (typeof answer === "string") {
          if (q.scores?.[answer]) addScores(scores, q.scores[answer]);
          if (q.tags?.[answer]) tags.push(...q.tags[answer]);
          if (q.tag_map?.[answer]) tags.push(...q.tag_map[answer]);
        }
      }
    }
  }

  for (const rule of config.threshold_tags || []) {
    if ((scores[rule.score] || 0) >= rule.min) {
      tags.push(...rule.tags);
    }
  }

  const summaryFlags: string[] = [];

  if (scores.safety_risk >= 4) summaryFlags.push("high_safety_risk");
  else if (scores.safety_risk >= 2) summaryFlags.push("moderate_safety_risk");

  if (scores.trafficking_score >= 6) summaryFlags.push("high_trafficking_indicators");
  else if (scores.trafficking_score >= 3) summaryFlags.push("moderate_trafficking_indicators");

  if (scores.dv_score >= 4) summaryFlags.push("high_dv_indicators");
  else if (scores.dv_score >= 2) summaryFlags.push("moderate_dv_indicators");

  if (scores.sexual_violence_score >= 3) summaryFlags.push("high_sexual_violence_indicators");
  else if (scores.sexual_violence_score >= 1) summaryFlags.push("moderate_sexual_violence_indicators");

  if (scores.immigration_need >= 3) summaryFlags.push("high_immigration_need");
  else if (scores.immigration_need >= 1) summaryFlags.push("moderate_immigration_need");

  if (scores.labor_exploitation_score >= 4) summaryFlags.push("high_labor_exploitation_indicators");
  else if (scores.labor_exploitation_score >= 2) summaryFlags.push("moderate_labor_exploitation_indicators");

  return {
    scores,
    tags: uniq(tags),
    summaryFlags
  };
}

export function buildResultsIntro(result: ScreeningResult): string[] {
  const lines: string[] = [];

  if (result.summaryFlags.includes("high_safety_risk")) {
    lines.push("Some of your answers suggest that urgent safety-related support may be helpful.");
  }

  if (
    result.summaryFlags.includes("high_trafficking_indicators") ||
    result.summaryFlags.includes("moderate_trafficking_indicators")
  ) {
    lines.push("Some of your answers suggest that support related to exploitation, coercion, or trafficking may be helpful.");
  }

  if (
    result.summaryFlags.includes("high_dv_indicators") ||
    result.summaryFlags.includes("moderate_dv_indicators")
  ) {
    lines.push("Some of your answers suggest that domestic violence or relationship safety support may be helpful.");
  }

  if (
    result.summaryFlags.includes("high_sexual_violence_indicators") ||
    result.summaryFlags.includes("moderate_sexual_violence_indicators")
  ) {
    lines.push("Some of your answers suggest that sexual assault or sexual violence support may be helpful.");
  }

  if (
    result.summaryFlags.includes("high_labor_exploitation_indicators") ||
    result.summaryFlags.includes("moderate_labor_exploitation_indicators")
  ) {
    lines.push("Some of your answers suggest that work-related exploitation support may be helpful.");
  }

  if (
    result.summaryFlags.includes("high_immigration_need") ||
    result.summaryFlags.includes("moderate_immigration_need")
  ) {
    lines.push("You may benefit from speaking with a qualified legal service provider about immigration-related options.");
  }

  if (lines.length === 0) {
    lines.push("Based on your answers, these support resources may be a helpful place to start.");
  }

  return lines;
}