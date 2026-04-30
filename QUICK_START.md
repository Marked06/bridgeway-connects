# Bridgeway Connects: Quick Start (5 Minutes)

## Copy These Files Into Your Project

```bash
# 1. Configuration
cp intake.en.json → your-app/public/intake-config/en.json

# 2. Scoring Engine
cp evaluateScreening.ts → your-app/app/lib/screening/evaluateScreening.ts
cp buildResultsIntro.ts → your-app/app/lib/screening/buildResultsIntro.ts

# 3. Export barrel
# Create or update: your-app/app/lib/screening/index.ts
# Add these two lines:
export { evaluateScreening } from "./evaluateScreening";
export { buildResultsIntro } from "./buildResultsIntro";
```

## What You Already Have

Your existing code already:
- ✅ Loads config from `/intake-config/en`
- ✅ Calls `evaluateScreening(config, answers)`
- ✅ Calls `buildResultsIntro(screeningResult)`
- ✅ Filters resources by tags

**No changes needed to intake.tsx or results page!**

## Verify It Works

```typescript
// In your browser console on the results page:
console.log(screeningResult);
// Should show: { scores, total_score, risk_level, tags, summaryFlags, intersections }

console.log(introLines);
// Should show: Array of 7-12 strings with context-aware messaging
```

## Test With Sample Data

Open browser DevTools (F12) and paste:

```javascript
// Import the functions
import { evaluateScreening, buildResultsIntro } from "@/lib/screening";

// Simulate the CRITICAL test case
sessionStorage.setItem("bc_intake_answers", JSON.stringify({
  // ... see test-scenario.json for complete data
  pressure_sexual_activity: "yes",
  could_refuse: "no",
  control_documents: "no",
  leaving_consequences: "afraid",
  // ... etc
}));

// Reload page and check results page
// Expected: CRITICAL risk level, ~135-150 points
```

## Resource Database Setup (5 min)

Add to your Supabase `resources` table:

```sql
-- Example resources with correct tags
INSERT INTO resources VALUES (
  '1', -- id
  'National Human Trafficking Hotline',
  ' 24/7 crisis support and legal screening',
  ARRAY['trafficking_support', 'crisis_support', 'legal_help'],
  ARRAY['en', 'es', 'fr'], -- languages
  'NATIONAL', -- region
  '1-888-373-7888',
  'https://humantraffickinghotline.org',
  '24/7',
  1 -- sort_order
);

INSERT INTO resources VALUES (
  '2',
  'RAINN - Sexual Assault Hotline',
  'Support for sexual assault and trafficking survivors',
  ARRAY['sexual_assault_support', 'trauma_informed_counseling', 'crisis_support'],
  ARRAY['en'],
  'NATIONAL',
  '1-800-656-4673',
  'https://rainn.org',
  '24/7',
  2
);

-- ... add 10-15 more resources for your state/region
```

## One-Line Checklist

- [ ] Copy intake.en.json to public/intake-config/
- [ ] Copy evaluateScreening.ts to app/lib/screening/
- [ ] Copy buildResultsIntro.ts to app/lib/screening/
- [ ] Create/update app/lib/screening/index.ts with exports
- [ ] Add 10+ resources to Supabase with category_tags
- [ ] Test in browser with test-scenario data
- [ ] Check results page shows CRITICAL risk
- [ ] Verify tags and resources filter correctly
- [ ] Deploy!

## Expected Results

After filling out the domestic worker scenario:

```
Risk Level: CRITICAL
Total Score: 135-150
Intro Text: "Based on your answers, there are several serious concerns..."
Tags Generated: trafficking_support, housing_shelter, legal_help, t_visa_support...
Resources Shown: 4-8 relevant services filtered by tags
```

## Scoring Reference

| Risk Level | Score | Next Step |
|-----------|-------|-----------|
| CRITICAL | 91-150 | Crisis hotline + emergency shelter + legal |
| HIGH | 51-90 | Case management + legal screening + housing |
| MODERATE | 21-50 | Legal information + support group + counseling |
| LOW | 0-20 | General resources + support groups |

## Tag Meanings

- `trafficking_support` — Anti-trafficking orgs
- `crisis_support` — 24/7 emergency hotlines
- `housing_shelter` — Safe housing (emergency or transitional)
- `legal_help` — General legal aid
- `t_visa_support` — Immigration attorneys (trafficking victims)
- `u_visa_support` — Immigration attorneys (crime victims)
- `sexual_assault_support` — RAINN, etc.
- `labor_rights_support` — Labor advocacy
- `wage_recovery_legal_clinics` — Wage theft lawyers
- `safety_planning` — DV/trafficking safety specialists
- `mental_health` — Trauma-informed counseling
- `medical_care` — Sexual health + general healthcare

## 15-Minute Full Setup

```
0:00 - Copy files (2 min)
0:02 - Update routing/imports (2 min)
0:04 - Populate 5 resources in DB (5 min)
0:09 - Test in browser (3 min)
0:12 - Deploy (3 min)
0:15 - ✅ Live!
```

## Troubleshooting

**Q: "Module not found" error**
A: Check file paths match your app structure. Should be:
- `app/lib/screening/evaluateScreening.ts`
- `app/lib/screening/buildResultsIntro.ts`
- `app/lib/screening/index.ts`

**Q: Score is 0**
A: The intake config isn't loading. Check:
- intake.en.json exists at `public/intake-config/en.json`
- API route is reading from correct path
- Browser shows loaded config in console

**Q: No resources showing**
A: Check:
- Resources exist in Supabase
- category_tags include the generated tags
- Region/language filters aren't too restrictive

**Q: Intro text is generic**
A: Make sure buildResultsIntro() is being called with real screening data, not null/undefined

## Next Steps

Read **IMPLEMENTATION_GUIDE.md** for:
- Detailed setup instructions
- How scoring works (with math)
- Resource database schema
- Privacy/security best practices
- Customization options
- Testing procedures

---

**You've got this! 💚 The system is ready to launch.**
