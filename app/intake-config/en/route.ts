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
    console.error("Config load error:", error);
    return NextResponse.json(
      { error: "Failed to load config" },
      { status: 500 }
    );
  }
}