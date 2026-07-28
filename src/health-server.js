const http = require("node:http");

function startHealthServer() {
  const port = Number(process.env.PORT || 3000);
  const service = String(process.env.BOT_INSTANCE_NAME || "pixy-system").trim();

  const server = http.createServer((request, response) => {
    const pathname = new URL(
      request.url || "/",
      "http://localhost"
    ).pathname;

    response.setHeader(
      "Content-Type",
      "application/json; charset=utf-8"
    );
    response.setHeader("Cache-Control", "no-store");

    if (pathname === "/" || pathname === "/health") {
      response.writeHead(200);
      response.end(
        JSON.stringify({
          status: "ok",
          service,
          uptime: Math.floor(process.uptime()),
          timestamp: new Date().toISOString(),
        })
      );
      return;
    }

    response.writeHead(404);
    response.end(
      JSON.stringify({
        status: "not_found",
      })
    );
  });

  server.on("error", (error) => {
    console.error("Health server failed:", error);
    process.exit(1);
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`Health server listening on port ${port} for ${service}.`);
  });

  return server;
}

module.exports = {
  startHealthServer,
};
