import { NextResponse } from "next/server";
export async function GET() { return NextResponse.json({error:"Yield data is unavailable in the validated feed"},{status:503}); }
