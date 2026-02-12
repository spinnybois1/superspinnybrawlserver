const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 8080;

// Create HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("OK");
});

// Attach WebSocket server to the same HTTP server
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  console.log("Client connected");
  ws.send("hello");
});

// Start server
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
