import { createServer } from "node:http";
import { createRegistry } from "./core.js";
const registry = createRegistry();
const port = Number(process.env.PORT || 3000);
const maxBytes = 8192;
const server = createServer(async (req, res) => {
  const respond = (status, payload) => { res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }); res.end(JSON.stringify(payload)); };
  if (req.url === "/health" && req.method === "GET") return respond(200, { status: "ok", environment: "prototype", mainnet: false });
  if (req.url === "/projects" && req.method === "GET") return respond(200, registry.listProjects());
  if (req.url === "/applications" && req.method === "GET") return respond(200, registry.listApplications());
  if (req.url === "/audit" && req.method === "GET") return respond(200, registry.auditLog());
  const actions = { "/projects": data => registry.submitProject(data), "/applications": data => registry.applyForGrant(data) };
  if (req.method !== "POST" || !actions[req.url]) return respond(404, { error: "Not found" });
  let body = "";
  try {
    for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > maxBytes) throw new Error("Payload too large"); }
    return respond(201, actions[req.url](JSON.parse(body)));
  } catch (error) { return respond(error.message === "Payload too large" ? 413 : 400, { error: error.message }); }
});
server.listen(port, "127.0.0.1", () => console.log("Devora prototype on localhost:" + port));
