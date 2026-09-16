import { NextRequest, NextResponse } from "next/server";

const CANONICAL_HOST = "dappsoncardano.com";

export function proxy(request: NextRequest) {
  const requestHost = (request.headers.get("host") || request.nextUrl.hostname)
    .split(":")[0]
    .toLowerCase();
  if (requestHost !== `www.${CANONICAL_HOST}`) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.protocol = "https:";
  url.hostname = CANONICAL_HOST;
  url.port = "";
  return NextResponse.redirect(url, { status: 308 });
}

export const config = {
  matcher: "/:path*",
};
