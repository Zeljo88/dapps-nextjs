const configured = process.env.API_URL?.trim();

if (!configured) {
  console.error("Build configuration error: API_URL is required. Set it to the backend origin before running npm run build.");
  process.exit(1);
}

let url;
try {
  url = new URL(configured);
} catch {
  console.error("Build configuration error: API_URL must be a valid absolute URL.");
  process.exit(1);
}

const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
if (url.protocol !== "https:" && !(url.protocol === "http:" && loopbackHosts.has(url.hostname))) {
  console.error("Build configuration error: API_URL must use HTTPS. Loopback HTTP is allowed only for local build verification.");
  process.exit(1);
}
