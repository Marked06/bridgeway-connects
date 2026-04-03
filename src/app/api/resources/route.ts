import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabaseAnon() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anon, { auth: { persistSession: false } });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // region can be "US" or state code like "NY"
  const region = (searchParams.get("region") || "US").toUpperCase();
  const category = searchParams.get("category");
  const language = searchParams.get("language");

  const supabase = supabaseAnon();

  // Always include national + selected state (if state was provided)
  const regionsToInclude = region === "US" ? ["US"] : ["US", region];

  let query = supabase
    .from("resources")
    .select("id,name,description,category_tags,languages,region,phone,website,hours,is_active,sort_order")
    .eq("is_active", true)
    .in("region", regionsToInclude)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (category) query = query.contains("category_tags", [category]);
  if (language) query = query.contains("languages", [language]);

  const { data, error } = await query;

  if (error) {
    console.error("Resources error:", error);
    return NextResponse.json({ ok: false, error: "DB error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, resources: data ?? [] });
}