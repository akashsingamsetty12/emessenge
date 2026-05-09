const { Server } = require("socket.io");
const http = require("http");

const httpServer = http.createServer();
const io = new Server(httpServer, {
  maxHttpBufferSize: 1e8, // 100MB for media sharing
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const users = new Map();
const directory = new Map(); // normalizedId -> { publicKey, username, rawId }
const offlineMessages = new Map(); // normalizedId -> [{ from, content, timestamp }]

const normalize = (id) => id ? id.replace(/\D/g, '') : '';

io.on("connection", (socket) => {
  const rawUserId = socket.handshake.query.userId;
  const userId = normalize(rawUserId);
  
  if (userId) {
    users.set(userId, socket.id);
    console.log(`[Connect] User ${userId} is on Socket ${socket.id}`);

    socket.on("client_ready", () => {
      if (offlineMessages.has(userId)) {
        const messages = offlineMessages.get(userId);
        messages.forEach(msg => {
          socket.emit("message_relay", msg);
        });
        offlineMessages.delete(userId);
        console.log(`Delivered ${messages.length} offline messages to ${userId}`);
      }
    });
  }

  socket.on("signal", ({ to, signal }) => {
    const targetId = normalize(to);
    const targetSocketId = users.get(targetId);
    if (targetSocketId) {
      io.to(targetSocketId).emit("signal", { from: rawUserId, signal });
    }
  });

  socket.on("message_relay", ({ to, content, timestamp, type, id }) => {
    const targetId = normalize(to);
    const targetSocketId = users.get(targetId);
    const msg = { from: rawUserId, content, timestamp, type, id };
    
    if (targetSocketId) {
      console.log(`[Relay] Delivering ${type || 'message'} to ${targetId} (Socket: ${targetSocketId})`);
      io.to(targetSocketId).emit("message_relay", msg);
    } else {
      if (!offlineMessages.has(targetId)) offlineMessages.set(targetId, []);
      offlineMessages.get(targetId).push(msg);
      console.log(`[Relay] User ${targetId} offline. Queued ${offlineMessages.get(targetId).length} messages.`);
    }
  });

  socket.on("typing", ({ to, isTyping }) => {
    const targetId = normalize(to);
    const targetSocketId = users.get(targetId);
    if (targetSocketId) {
      io.to(targetSocketId).emit("typing", { from: rawUserId, isTyping });
    }
  });

  socket.on("identity_broadcast", ({ to, publicKey, username, profilePic }) => {
    const targetId = normalize(to);
    const targetSocketId = users.get(targetId);
    if (targetSocketId) {
      io.to(targetSocketId).emit("identity_broadcast", { from: rawUserId, publicKey, username, profilePic });
    } else {
      if (!offlineMessages.has(targetId)) offlineMessages.set(targetId, []);
      offlineMessages.get(targetId).push({ type: 'identity', from: rawUserId, publicKey, username, profilePic });
    }
  });

  socket.on("register_identity", ({ publicKey, username, profilePic }) => {
    if (userId) {
      directory.set(userId, { publicKey, username, profilePic, rawId: rawUserId });
      console.log(`Identity registered for ${userId} (with ${profilePic ? 'photo' : 'no photo'})`);
    }
  });

  socket.on("get_identity", (target, callback) => {
    const targetId = normalize(target);
    const identity = directory.get(targetId);
    callback(identity);
  });

  socket.on("disconnect", () => {
    if (userId) {
      users.delete(userId);
      console.log(`User ${userId} disconnected`);
    }
  });
});

const PORT = 3001;
httpServer.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
