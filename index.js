const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: process.env.PORT || 3000 });

console.log("SpinnyWFC Matchmaking Server Running");

let waitingPlayer = null;

wss.on("connection", (ws) => {
    console.log("Client connected");

    ws.on("message", (msg) => {
        console.log("Received:", msg.toString());

        if (msg.toString() === "quick_match") {

            // No one waiting → store this player
            if (waitingPlayer === null) {
                waitingPlayer = ws;
                console.log("Player added to queue");
            }

            // Someone IS waiting → pair them
            else {
                console.log("Match found! Pairing players...");

                waitingPlayer.send("match_found");
                ws.send("match_found");

                waitingPlayer = null;
            }
        }
    });

    ws.on("close", () => {
        if (waitingPlayer === ws) {
            waitingPlayer = null;
            console.log("Waiting player disconnected, queue cleared");
        }
    });
});
