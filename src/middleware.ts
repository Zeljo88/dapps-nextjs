import { NextRequest, NextResponse } from "next/server";

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/dapp/")) {
    return NextResponse.next();
  }

  // Extract the raw param after /dapp/
  const raw = pathname.slice("/dapp/".length);

  // Decode percent-encoded chars (e.g. %20 → space)
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return NextResponse.next();
  }

  const slug = toSlug(decoded);

  // If already a clean slug, pass through
  if (raw === slug) {
    return NextResponse.next();
  }

  // 301 redirect to the clean slug URL
  const url = request.nextUrl.clone();
  url.pathname = `/dapp/${slug}`;
  return NextResponse.redirect(url, { status: 301 });
}

export const config = {
  matcher: "/dapp/:path*",
};
