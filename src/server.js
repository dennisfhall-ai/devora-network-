import { createServer } from "node:http";

// Local health endpoint only. The registry is intentionally NOT reachable over HTTP
// until a trusted identity adapter and persistent storage are implemented.
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid port");
const server = createServer((req, res) => {
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200);
    res.end(JSON.stringify({ status: "ok", environment: "prototype", publicApi: false, mainnet: false }));
    return;
  }
  res.writeHead(403);
  res.end(JSON.stringify({ error: "API_DISABLED_PENDING_AUTHENTICATION" }));
});
server.listen(port, "127.0.0.1", () => console.log("Devora local-only prototype on " + port));
