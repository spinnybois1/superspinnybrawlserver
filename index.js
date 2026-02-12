const http = require("http");
const WebSocket = require("ws");

// Railway gives us ONE port. We MUST use it for BOTH HTTP and WebSocket.
const PORT = process.env.PORT || 8080;

// ------------------------------
// 1. CREATE HTTP SERVER
// ------------------------------
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("SpinnyBrawl WebSocket Server Running");
});

// ------------------------------
// 2. ATTACH WEBSOCKET SERVER TO SAME HTTP SERVER
// ------------------------------
const wss = new WebSocket.Server({ server });

console.log("SpinnyBrawl server running on port", PORT);

// ------------------------------
// 3. MATCHMAKING + STATE
// ------------------------------
let queue = [];
let matches = new Map();

function makeMatchId() {
  return Math.random().toString(36).slice(2);
}

wss.on("connection", (ws) => {
  ws.playerId = null;
  ws.matchId = null;

  ws.on("message", (msg) => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch {
      return;
    }

    // Player enters queue
    if (data.type === "queue") {
      queue.push(ws);
      console.log("Player queued. Queue size:", queue.length);

      if (queue.length >= 2) {
        const p1 = queue.shift();
        const p2 = queue.shift();

        const matchId = makeMatchId();
        p1.playerId = 1;
        p2.playerId = 2;
        p1.matchId = matchId;
        p2.matchId = matchId;

        const state = {
          p1: { x: 300, y: 200, percent: 0 },
          p2: { x: 600, y: 200, percent: 0 }
        };

        matches.set(matchId, { p1, p2, state });

        p1.send(JSON.stringify({ type: "matchFound", playerId: 1 }));
        p2.send(JSON.stringify({ type: "matchFound", playerId: 2 }));

        console.log("Match started:", matchId);
      }
    }

    // Player input
    if (data.type === "input" && ws.matchId && ws.playerId) {
      const match = matches.get(ws.matchId);
      if (!match) return;

      const me = ws.playerId === 1 ? "p1" : "p2";
      const s = match.state;

      s[me].vx ??= 0;
      s[me].vy ??= 0;

      const speed = 6;
      const jumpPower = -13;
      const gravity = 0.8;

      if (data.left) s[me].vx = -speed;
      else if (data.right) s[me].vx = speed;
      else s[me].vx *= 0.8;

      if (data.jump && s[me].onGround) {
        s[me].vy = jumpPower;
        s[me].onGround = false;
      }

      s[me].vy += gravity;
      s[me].x += s[me].vx;
      s[me].y += s[me].vy;

      if (s[me].y > 340) {
        s[me].y = 340;
        s[me].vy = 0;
        s[me].onGround = true;
      }

      const payload = JSON.stringify({
        type: "state",
        p1: s.p1,
        p2: s.p2
      });

      match.p1.readyState === WebSocket.OPEN && match.p1.send(payload);
      match.p2.readyState === WebSocket.OPEN && match.p2.send(payload);
    }
  });

  ws.on("close", () => {
    queue = queue.filter(p => p !== ws);

    if (ws.matchId && matches.has(ws.matchId)) {
      const match = matches.get(ws.matchId);
      matches.delete(ws.matchId);

      [match.p1, match.p2].forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: "end", reason: "opponent_left" }));
          client.close();
        }
      });
    }
  });
});

// ------------------------------
// 4. START SERVER
// ------------------------------
server.listen(PORT);
