// Local test preload only. Do not set this NODE_OPTIONS hook on Vercel.
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, options) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith("https://api.llama.fi/protocol/")) {
    return originalFetch("http://127.0.0.1:18081/__tvl/" + url.split("/").at(-1), options);
  }
  return originalFetch(input, options);
};
