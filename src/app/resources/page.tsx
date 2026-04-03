"use client";

import { useEffect, useMemo, useState } from "react";

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

const US_STATES = [
  "US","AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN",
  "MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"
];

export default function ResourcesPage() {
  const [region, setRegion] = useState("US");
  const [language, setLanguage] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [resources, setResources] = useState<Resource[]>([]);
  const [error, setError] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const r of resources) r.category_tags?.forEach((t) => set.add(t));
    return Array.from(set).sort();
  }, [resources]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        qs.set("region", region);
        if (language) qs.set("language", language);
        if (category) qs.set("category", category);

        const res = await fetch(`/api/resources?${qs.toString()}`);
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || "Failed to load resources");
        setResources(json.resources || []);
      } catch (e: any) {
        setError(e?.message || "Failed to load resources");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [region, language, category]);

  const logClick = async (resourceId: string) => {
    // privacy-safe: no user id, no session id
    await fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_name: "resource_clicked", event_key: resourceId })
    }).catch(() => {});
  };

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Resources</h1>
      <p style={{ opacity: 0.85 }}>
        National resources (US) plus state resources (if selected). No personal data is stored.
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16, marginBottom: 16 }}>
        <label>
          <div style={{ fontSize: 12, opacity: 0.75 }}>State</div>
          <select value={region} onChange={(e) => setRegion(e.target.value)} style={{ padding: 8 }}>
            {US_STATES.map((s) => (
              <option key={s} value={s}>{s === "US" ? "US (National)" : s}</option>
            ))}
          </select>
        </label>

        <label>
          <div style={{ fontSize: 12, opacity: 0.75 }}>Language</div>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} style={{ padding: 8 }}>
            <option value="">Any</option>
            <option value="en">English (en)</option>
            <option value="es">Spanish (es)</option>
            <option value="fr">French (fr)</option>
            <option value="pt">Portuguese (pt)</option>
            <option value="ar">Arabic (ar)</option>
            <option value="sw">Swahili (sw)</option>
          </select>
        </label>

        <label>
          <div style={{ fontSize: 12, opacity: 0.75 }}>Category</div>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ padding: 8, minWidth: 220 }}>
            <option value="">Any</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>

      {loading && <p>Loading…</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {!loading && !error && resources.length === 0 && (
        <p>No resources found for these filters yet.</p>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {resources.map((r) => (
          <div key={r.id} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{r.name}</div>
                {r.description && <div style={{ marginTop: 6, opacity: 0.9 }}>{r.description}</div>}
              </div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                <div><b>Region:</b> {r.region}</div>
                {r.hours && <div><b>Hours:</b> {r.hours}</div>}
              </div>
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12 }}>
              {r.category_tags?.map((t) => (
                <span key={t} style={{ border: "1px solid #ccc", padding: "4px 8px", borderRadius: 999 }}>
                  {t}
                </span>
              ))}
              {r.languages?.length ? (
                <span style={{ opacity: 0.75 }}>Languages: {r.languages.join(", ")}</span>
              ) : null}
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
              {r.phone ? (
                <a
                  href={`tel:${r.phone}`}
                  onClick={() => logClick(r.id)}
                  style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ccc", textDecoration: "none" }}
                >
                  Call
                </a>
              ) : null}

              {r.website ? (
                <a
                  href={r.website}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => logClick(r.id)}
                  style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ccc", textDecoration: "none" }}
                >
                  Website
                </a>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}