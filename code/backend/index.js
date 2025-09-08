
import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import axios from "axios";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const rooms = new Map();

io.on("connection", (socket) => {
  console.log("User Connected:", socket.id);

  let currentRoom = null;
  let currentUser = null;

  // ----- Join Room -----
  socket.on("join", ({ roomId, userName }) => {
    if (!roomId || !userName) return;

    if (currentRoom) {
      const oldRoom = rooms.get(currentRoom);
      if (oldRoom) {
        oldRoom.users.delete(currentUser);
        if (oldRoom.users.size === 0) rooms.delete(currentRoom);
        else io.to(currentRoom).emit("userJoined", Array.from(oldRoom.users));
      }
      socket.leave(currentRoom);
    }

    currentRoom = roomId;
    currentUser = userName;
    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, { users: new Set(), code: "// start code here" });
    }

    rooms.get(roomId).users.add(userName);

    socket.emit("codeUpdate", rooms.get(roomId).code);
    io.to(roomId).emit("userJoined", Array.from(rooms.get(roomId).users));
  });

  // ----- Code Collaboration -----
  socket.on("codeChange", ({ roomId, code }) => {
    if (!rooms.has(roomId)) return;
    rooms.get(roomId).code = code;
    socket.to(roomId).emit("codeUpdate", code);
  });

  socket.on("typing", ({ roomId, userName }) => {
    socket.to(roomId).emit("userTyping", userName);
  });

  socket.on("languageChange", ({ roomId, language }) => {
    io.to(roomId).emit("languageUpdate", language);
  });

  // ----- Code Execution -----
  socket.on("compileCode", async ({ code, roomId, language, version, input }) => {
    if (!rooms.has(roomId)) return;
    try {
      const response = await axios.post("https://emkc.org/api/v2/piston/execute", {
        language,
        version,
        files: [{ content: code }],
        stdin: input,
      });

      io.to(roomId).emit("codeResponse", response.data);
    } catch (err) {
      console.error("Execution Error:", err.message);
      io.to(roomId).emit("codeResponse", {
        run: { output: "Error executing code. Check server logs." },
      });
    }
  });

  // ----- Leave Room -----
  socket.on("leaveRoom", () => {
    if (currentRoom && currentUser) {
      const room = rooms.get(currentRoom);
      if (room) {
        room.users.delete(currentUser);
        if (room.users.size === 0) rooms.delete(currentRoom);
        else io.to(currentRoom).emit("userJoined", Array.from(room.users));
      }
      socket.leave(currentRoom);
      currentRoom = null;
      currentUser = null;
    }
  });

  // ----- Disconnect -----
  socket.on("disconnect", () => {
    if (currentRoom && currentUser) {
      const room = rooms.get(currentRoom);
      if (room) {
        room.users.delete(currentUser);
        if (room.users.size === 0) rooms.delete(currentRoom);
        else io.to(currentRoom).emit("userJoined", Array.from(room.users));
      }
    }
    console.log("User Disconnected:", socket.id);
  });
});

// ----- Serve Frontend -----
const port = process.env.PORT || 5000;
const __dirname = path.resolve();
app.use(express.static(path.join(__dirname, "/frontend/dist")));
app.get("*", (req, res) =>
  res.sendFile(path.join(__dirname, "frontend", "dist", "index.html"))
);

server.listen(port, () => console.log(`Server running on port ${port}`));
