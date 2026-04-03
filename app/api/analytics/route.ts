import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ALLOWED_EVENT_NAMES = new Set([
  "intake_started",
  "intake_step_viewed",
  "intake_completed",
  "results_viewed",
  "harm_selected",
  "need_selected",
  "barrier_selected",
  "police_report",
  "recommendation_shown",
  "resource_clicked"
]);

function sanitizeKey(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (!trimmed) return null;
  if (trimmed.length > 64) return null;
  if (!/^[a-zA-Z0-9:_-]+$/.test(trimmed)) return null;
  return trimmed;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const event_name = typeof body.event_name === "string" ? body.event_name.trim() : "";
    const event_key = sanitizeKey(body.event_key);

    if (!ALLOWED_EVENT_NAMES.has(event_name)) {
      return NextResponse.json({ ok: false, error: "Invalid event_name" }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

    const { error } = await supabase.rpc("increment_event_count", {
      p_event_name: event_name,
      p_event_key: event_key
    });

    if (error) {
      console.error("Supabase RPC error:", error);
      return NextResponse.json({ ok: false, error: "DB error" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Analytics route error:", e);
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }
}

// Optional: help debugging if someone hits it in browser
export async function GET() {
  return NextResponse.json({ ok: false, error: "Use POST" }, { status: 405 });
}
