# Bridgeway Connects: Implementation Guide

## 📋 Overview

This guide explains how to integrate the complete screening system into your application. The system consists of three main components:

1. **intake.en.json** - Question configuration (111 questions across 7 sections)
2. **evaluateScreening.ts** - Risk scoring engine (0-150 point scale with intersection detection)
3. **buildResultsIntro.ts** - Context-aware messaging generator
4. **intake.tsx** - (Already exists) Front-end form component
5. **results page** - (Already exists) Results display component

---

## 🚀 Quick Start Integration

### Step 1: Place Configuration File

```
your-app/
├── public/
│   └── intake-config/
│       └── en.json         ← Copy intake.en.json here
└── app/
    └── api/
        └── intake-config/
            └── route.ts    ← Modify to serve from public
```

Your existing `route.ts` in `app/api/intake-config/route.ts`:

```typescript
import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export async function GET() {
  try {
    const p = path.join(process.cwd(), "public", "intake-config", "en.json");
    const raw = fs.readFileSync(p, "utf-8");
    const config = JSON.parse(raw);
    return NextResponse.json(config);
  } catch (error) {
    return NextResponse.json({ error: "Failed to load config" }, { status: 500 });
  }
}
```

### Step 2: Add Screening Library

```
app/
└── lib/
    └── screening/
        ├── evaluateScreening.ts
        ├── buildResultsIntro.ts
        └── index.ts          ← Export both functions
```

Create `app/lib/screening/index.ts`:

```typescript
export { evaluateScreening } from "./evaluateScreening";
export { buildResultsIntro } from "./buildResultsIntro";
```

### Step 3: Update Results Page

Your results page already calls `evaluateScreening` and `buildResultsIntro`:

```typescript
import { evaluateScreening, buildResultsIntro } from "@/lib/screening";

// ... in your component:
const screeningResult = useMemo(() => {
  if (!cfg || !answers) return null;
  return evaluateScreening(cfg, answers);
}, [cfg, answers]);

const introLines = useMemo(() => {
  if (!screeningResult) return [];
  return buildResultsIntro(screeningResult);
}, [screeningResult]);
```

No changes needed! The existing code already uses these functions.

---

## 📊 How the Scoring Works

### Risk Categories (0-150 Scale)

The system calculates 6 risk categories:

1. **Wage & Compensation** (0-30 pts) — Below-minimum pay, wage theft, unpaid work
2. **Control & Coercion** (0-35 pts) — Document confiscation, threats, isolation from decision-making
3. **Restrictions & Isolation** (0-20 pts) — Cannot leave job, confined movement, no support network
4. **Labor Violations** (0-15 pts) — No breaks, excessive hours, no days off, unsafe conditions
5. **Vulnerability Factors** (0-10 pts) — Undocumented status, fear of deportation, recently arrived
6. **Sexual Exploitation** (0-40 pts) — Forced sexual activity, grooming, coercion, child trafficking

### Intersection Multipliers

Additional points added when multiple trafficking types co-occur:

- **Labor + Sex trafficking**: +15 pts
- **Child trafficking** (started before age 18): +20 pts
- **Gang/network trafficking**: +10 pts
- **Ongoing exploitation** (still happening): +15 pts

### Risk Levels

```
0–20 pts:    LOW RISK
21–50 pts:   MODERATE RISK
51–90 pts:   HIGH RISK
91–150 pts:  CRITICAL RISK
```

### Tag Generation

Tags are automatically generated based on risk factors and used to filter resources:

Examples:
- `trafficking_support` (when control_coercion ≥ 15)
- `labor_rights_support` (when wage_violations ≥ 10)
- `housing_shelter` (when lacking safe housing)
- `t_visa_support` (labor trafficking + undocumented)
- `sexual_assault_support` (sexual_exploitation ≥ 15)
- `mental_health` (total_score ≥ 51)

---

## 🔍 Testing the System

### Test Scenario 1: CRITICAL - Labor + Sex Trafficking

Use the provided `test-scenario.json` data:

```typescript
import testScenario from "@/public/test-scenario.json";

const result = evaluateScreening(config, testScenario.answers);
console.log(result);
// Expected: 
// - risk_level: "CRITICAL"
// - total_score: ~135-150
// - intersections: ["labor_and_sex_trafficking"]
// - tags includes: trafficking_support, housing_shelter, legal_help, t_visa_support
```

### Test Scenario 2: MODERATE - Labor Violations Only

```typescript
const answers = {
  // ... minimal trafficking indicators
  wage_violations: 15,
  // ... other low-risk answers
};

const result = evaluateScreening(config, answers);
// Expected:
// - risk_level: "MODERATE"
// - total_score: 15-50
// - tags: ["labor_rights_support", "wage_recovery_legal_clinics"]
```

### Test Scenario 3: LOW - No Major Indicators

```typescript
const answers = {
  // ... all positive answers
  can_leave_job: "yes",
  control_documents: "yes",
  pressured_sexual_activity: "no",
  fear_employer: "no",
  // ... etc
};

const result = evaluateScreening(config, answers);
// Expected:
// - risk_level: "LOW"
// - total_score: 0-20
// - summaryFlags: mostly positive indicators
```

---

## 🔄 Data Flow

```
User fills intake form
    ↓
intake.tsx saves answers to sessionStorage
    ↓
User clicks "See Results"
    ↓
Results page loads answers + config
    ↓
evaluateScreening(config, answers)
    ↓
Calculates scores, detects intersections, generates tags
    ↓
Returns ScreeningOutput { scores, total_score, risk_level, tags, summaryFlags, intersections }
    ↓
buildResultsIntro(screeningResult)
    ↓
Generates context-aware intro lines based on:
    - Risk level
    - Detected intersections
    - Summary flags
    - Specific patterns
    ↓
Results page displays:
    - Score visualization (doughnut chart)
    - Intro text
    - Matched support tags
    - Filtered resources from /api/resources
```

---

## 📱 Resource Filtering

The results page filters resources in three ways:

```typescript
// 1. By generated tags (primary filter)
const filteredByTags = resources.filter(r =>
  r.category_tags.some(tag => screeningResult.tags.includes(tag))
);

// 2. By user language preference
const filteredByLanguage = filteredByTags.filter(r =>
  r.languages.includes(userLanguage)
);

// 3. By region/state
const filteredByRegion = filteredByLanguage.filter(r =>
  r.region === userState || r.region === "NATIONAL"
);
```

### Required Resource Database Fields

Your Supabase `resources` table should have:

```sql
CREATE TABLE resources (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category_tags TEXT[] NOT NULL, -- e.g., ['trafficking_support', 't_visa_support']
  languages TEXT[] NOT NULL, -- e.g., ['en', 'es', 'fr']
  region TEXT NOT NULL, -- e.g., 'NY', 'CA', 'NATIONAL'
  phone TEXT,
  website TEXT,
  hours TEXT, -- e.g., '24/7', 'Mon-Fri 9am-5pm'
  sort_order INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Sample Resource Tags to Support

The system generates these tags — ensure your resources database includes them:

- `crisis_support` — Emergency hotlines
- `trafficking_support` — Anti-trafficking orgs
- `housing_shelter` — Emergency/transitional housing
- `legal_help` — General legal aid
- `safety_planning` — Safety planning services
- `labor_rights_support` — Labor advocacy orgs
- `wage_recovery_legal_clinics` — Wage theft lawyers
- `t_visa_support` — Immigration attorneys specializing in T visas
- `u_visa_support` — U visa legal screening
- `immigration_legal_screening` — General immigration legal aid
- `sexual_assault_support` — RAINN, etc.
- `mental_health` — Trauma-informed counseling
- `medical_care` — Sexual health, general healthcare
- `domestic_violence_support` — DV shelters and advocates
- `case_management` — Case management services
- `trauma_informed_counseling` — Specialized therapy

---

## 🛡️ Privacy & Security

### Data Handling

✅ **What the system does:**
- Collects answers in sessionStorage (client-side only)
- No personal data stored on server
- Calculates scores client-side
- Generates recommendations based on patterns, not identity

❌ **What the system does NOT do:**
- Store user answers
- Request or store names, emails, phone numbers
- Track individual users
- Create user accounts

### Analytics

The intake page already sends privacy-compliant analytics:

```typescript
fetch("/api/analytics", {
  method: "POST",
  body: JSON.stringify({
    event_name: "intake_completed", // Don't include answers!
    event_key: "screening" // Don't include identifying data
  })
});
```

Keep analytics minimal—track events only, not content.

---

## 🚦 Deployment Checklist

- [ ] Copy `intake.en.json` to `public/intake-config/en.json`
- [ ] Add `evaluateScreening.ts` to `app/lib/screening/`
- [ ] Add `buildResultsIntro.ts` to `app/lib/screening/`
- [ ] Update `app/lib/screening/index.ts` to export both
- [ ] Verify results page imports from `@/lib/screening`
- [ ] Populate Supabase `resources` table with tagged services
- [ ] Test with sample data (use `test-scenario.json`)
- [ ] Verify scoring calculates correctly
- [ ] Verify tags generate and filter resources
- [ ] Verify intro text displays context-appropriately
- [ ] Test in different languages (ensure Spanish resources available)
- [ ] Test on mobile responsiveness
- [ ] Review privacy/consent language
- [ ] Set up analytics tracking
- [ ] Deploy to production

---

## 📞 Testing the Live Flow

1. **Go to intake form**: `https://your-app.com/intake`
2. **Fill out questions**: Answer as the test scenario person
3. **Submit form**: Should route to `/results`
4. **Check results page**:
   - ✅ Score displays correctly
   - ✅ Risk level shown (should be CRITICAL)
   - ✅ Intro text is trauma-informed
   - ✅ Suggested tags appear
   - ✅ Resources filtered and displayed
5. **Check browser console**:
   - ✅ No errors from `evaluateScreening()`
   - ✅ No errors from `buildResultsIntro()`
   - ✅ Analytics events logged

---

## 🔧 Customization

### Adding a New Language

1. Create `public/intake-config/es.json` (Spanish example)
2. Translate all question labels and helper text
3. Keep IDs identical to English version
4. Update language selector in intake form

### Adjusting Scoring Weights

Edit `evaluateScreening.ts` to change point values:

```typescript
// Example: Increase document confiscation penalty
if (answers.control_documents === "no") {
  control_coercion += 20; // Changed from 15
}
```

Then re-test with `test-scenario.json` to verify results match expectations.

### Adding New Questions

1. Add question to appropriate section in `intake.en.json`
2. Add scoring logic in `evaluateScreening.ts`
3. Update `buildResultsIntro.ts` if it affects messaging
4. Update `test-scenario.json` with test data

---

## ❓ FAQ

**Q: Will users' answers be stored?**
A: No. The system is designed for privacy—answers stay in sessionStorage (browser memory) and are deleted when the session ends. No data is sent to the server.

**Q: What if a user doesn't answer all questions?**
A: The intake form requires certain fields (marked `required: true`). Optional fields (like sexual exploitation questions) can be skipped without blocking progress.

**Q: How do we ensure resource accuracy?**
A: Your team manually maintains the Supabase resource database with verified organizations. The system filters based on tags and location—accuracy depends on data quality in Supabase.

**Q: Can we customize the scoring?**
A: Yes. Edit `evaluateScreening.ts` and `buildResultsIntro.ts` to adjust weights, thresholds, and messaging. Re-test with `test-scenario.json` after changes.

**Q: What about multi-language support?**
A: Create additional language config files in `public/intake-config/` (e.g., `es.json`, `fr.json`). The language selection in the intake form determines which config is loaded.

---

## 📚 Files Included

- `intake.en.json` — Complete question configuration (111 questions)
- `evaluateScreening.ts` — Risk scoring engine
- `buildResultsIntro.ts` — Results messaging
- `test-scenario.json` — Test data for verification
- `IMPLEMENTATION_GUIDE.md` — This file

---

## 🎯 Next Steps

1. **Integration** — Follow the Quick Start section above
2. **Resource Setup** — Populate Supabase with verified organizations
3. **Testing** — Use test-scenario.json to verify scoring
4. **Deployment** — Follow the deployment checklist
5. **Monitoring** — Track analytics and collect user feedback
6. **Iteration** — Refine based on real user data and feedback

---

## 💬 Questions?

The system is designed to be:
- **Transparent** — Clear how scoring works
- **Customizable** — Adjust weights and messaging
- **Testable** — Verify with sample data
- **Trauma-informed** — Language is non-judgmental
- **Accessible** — Multi-language, mobile-responsive

Good luck with your Bridgeway Connects implementation! 💚
