const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: process.env.PORT || 3000 });

console.log("SpinnyWFC Matchmaking + Online Battle Server Running");

let waitingPlayer = null;
let rooms = {};
let roomCounter = 1;

wss.on("connection", (ws) => {
    console.log("Client connected");

    ws.on("message", (msg) => {
        msg = msg.toString();
        console.log("Received:", msg);

        // -------------------------
        // QUICK MATCH REQUEST
        // -------------------------
        if (msg === "quick_match") {

            // No one waiting → store this player
            if (waitingPlayer === null) {
                waitingPlayer = ws;
                console.log("Player added to queue");
            }

            // Someone IS waiting → pair them
            else {
                console.log("Match found! Pairing players...");

                const p1 = waitingPlayer;
                const p2 = ws;
                waitingPlayer = null;

                // Create room
                const roomId = "room" + roomCounter++;
                rooms[roomId] = { p1, p2 };
                p1.roomId = roomId;
                p2.roomId = roomId;

                // Randomly assign roles
                const roles = Math.random() < 0.5
                    ? [["p1", p1], ["p2", p2]]
                    : [["p1", p2], ["p2", p1]];

                roles[0][1].send(JSON.stringify({ type: "role", role: "p1" }));
                roles[1][1].send(JSON.stringify({ type: "role", role: "p2" }));

                // Notify both clients
                p1.send("match_found");
                p2.send("match_found");

                console.log("Room created:", roomId);
            }
        }

        // -------------------------
        // INPUT SYNC PACKETS
        // -------------------------
        try {
            const data = JSON.parse(msg);

            if (data.type === "input") {
                const room = rooms[ws.roomId];
                if (!room) return;

                // Determine opponent
                const opponent =
                    room.p1 === ws ? room.p2 :
                    room.p2 === ws ? room.p1 : null;

                if (opponent && opponent.readyState === WebSocket.OPEN) {
                    opponent.send(JSON.stringify({
                        type: "opponent_input",
                        keys: data.keys
                    }));
                }
            }
        } catch (e) {
            // Ignore non‑JSON messages
        }
    });

    // -------------------------
    // DISCONNECT HANDLING
    // -------------------------
    ws.on("close", () => {
        console.log("Client disconnected");

        // If this player was waiting, clear queue
        if (waitingPlayer === ws) {
            waitingPlayer = null;
            console.log("Waiting player disconnected, queue cleared");
        }

        // If this player was in a room, destroy it
        const roomId = ws.roomId;
        if (roomId && rooms[roomId]) {
            const room = rooms[roomId];
            const opponent = room.p1 === ws ? room.p2 : room.p2 === ws ? room.p1 : null;

            if (opponent && opponent.readyState === WebSocket.OPEN) {
                opponent.send(JSON.stringify({ type: "opponent_disconnect" }));
            }

            delete rooms[roomId];
            console.log("Room destroyed:", roomId);
        }
    });
});
