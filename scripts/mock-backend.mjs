import http from "node:http";

const port = Number(process.env.MOCK_API_PORT || 18080);
const categories = ["DEFI", "COLLECTION", "MARKETPLACE", "GAMING", "COMMUNITY", "STABLECOIN", "SMART_WALLET", "LAYER_2", "NFT_MINTING_PLATFORM"];
const dapps = Array.from({ length: 107 }, (_, index) => ({
  id: `mock-${index + 1}`,
  name: index === 0 ? "ADA Blobs" : `Mock DApp ${index + 1}`,
  slug: index === 0 ? "ada-blobs" : `mock-dapp-${index + 1}`,
  category: categories[index % categories.length],
  subCategory: categories[index % categories.length],
  tvl: 1_000_000 - index,
  volume30d: 10_000 + index,
  volume7d: 2_000 + index,
  trxCount: 1_000 + index,
  tx24h: 10 + index,
  tx7d: 70 + index,
  activeUsers24h: 5 + index,
  change1d: 0,
  change7d: 0,
  audits: 0,
  scriptCount: 1,
  hasYields: false,
  yields: [],
  scripts: [],
  releases: [],
  features: [],
  description: "Deterministic local build fixture.",
}));

const stats = {
  adaPrice: 0.5,
  totalTvl: dapps.reduce((sum, dapp) => sum + dapp.tvl, 0),
  totalVolume30d: dapps.reduce((sum, dapp) => sum + dapp.volume30d, 0),
  totalVolume24h: 100_000,
  totalActiveUsers24h: 1_000,
  totalTxCount: 100_000,
  totalDapps: dapps.length,
  currentEpoch: 600,
};

function send(response, body, status = 200) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host}`);
  if (url.pathname === "/dapps/list-dapps") {
    const category = url.searchParams.get("category");
    send(response, category ? dapps.filter(dapp => dapp.category === category) : dapps);
    return;
  }
  if (url.pathname.startsWith("/dapps/find-dapp/")) {
    const id = decodeURIComponent(url.pathname.slice("/dapps/find-dapp/".length));
    const dapp = dapps.find(item => item.id === id || item.slug === id || item.name === id);
    send(response, dapp || { error: "not found" }, dapp ? 200 : 404);
    return;
  }
  if (url.pathname === "/global/stats") return send(response, stats);
  if (url.pathname === "/global/ecosystem") {
    return send(response, {
      tvlLeaderboard: dapps.slice(0, 12),
      volumeLeaderboard: dapps.slice(0, 8),
      categoryBreakdown: categories.map(category => ({ category, count: dapps.filter(dapp => dapp.category === category).length })),
    });
  }
  if (url.pathname === "/yields") return send(response, []);
  if (url.pathname === "/dapps/categories") return send(response, categories);
  if (url.pathname === "/dapps/slug-map") return send(response, dapps.map(({ name, slug }) => ({ name, slug })));
  if (/^\/dapps\/[^/]+\/tvl-history$/.test(url.pathname)) return send(response, { points: [], totalPoints: 0 });
  send(response, { error: "not found" }, 404);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Mock backend listening on http://127.0.0.1:${port}`);
});
