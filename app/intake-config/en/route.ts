import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  const p = path.join(process.cwd(), "config", "intake.en.json");
  const raw = fs.readFileSync(p, "utf-8");
  return NextResponse.json(JSON.parse(raw));
}