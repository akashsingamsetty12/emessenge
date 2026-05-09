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

const users = new Map(); // normalizedId -> Set(socket.id)
const directory = new Map(); // normalizedId -> { publicKey, username, profilePic, rawId }
const offlineMessages = new Map(); // normalizedId -> [{ from, content, timestamp }]

const normalize = (id) => id ? id.replace(/\D/g, '') : '';

io.on("connection", (socket) => {
  const rawUserId = socket.handshake.query.userId;
  const userId = normalize(rawUserId);
  
  if (userId) {
    if (!users.has(userId)) users.set(userId, new Set());
    users.get(userId).add(socket.id);
    
    console.log(`[Connect] User ${userId} added socket ${socket.id}. Total active: ${users.get(userId).size}`);

    socket.on("client_ready", () => {
      if (offlineMessages.has(userId)) {
        const messages = offlineMessages.get(userId);
        messages.forEach(msg => {
          socket.emit("message_relay", msg);
        });
        offlineMessages.delete(userId);
        console.log(`Delivered ${messages.length} offline messages to ${userId} on socket ${socket.id}`);
      }
    });
  }

  const broadcastToUser = (targetUserId, event, data) => {
    const sockets = users.get(targetUserId);
    if (sockets && sockets.size > 0) {
      console.log(`[Relay] Sending ${event} to ${targetUserId} (${sockets.size} devices)`);
      sockets.forEach(sid => io.to(sid).emit(event, data));
      return true;
    }
    return false;
  };

  socket.on("signal", ({ to, signal }) => {
    const targetId = normalize(to);
    broadcastToUser(targetId, "signal", { from: rawUserId, signal });
  });

  socket.on("message_relay", (payload) => {
    const { to, type } = payload;
    const targetId = normalize(to);
    const msg = { ...payload, from: rawUserId };
    
    console.log(`[Relay] Request from ${userId} to ${targetId} (${type || 'message'})`);

    // 1. Deliver to Target
    const delivered = broadcastToUser(targetId, "message_relay", msg);
    
    // 2. Sync to Sender (other devices)
    const senderSockets = users.get(userId);
    if (senderSockets) {
      senderSockets.forEach(sid => {
        if (sid !== socket.id) io.to(sid).emit("message_relay", msg);
      });
    }

    if (!delivered) {
      if (!offlineMessages.has(targetId)) offlineMessages.set(targetId, []);
      offlineMessages.get(targetId).push(msg);
      console.log(`[Relay] Target ${targetId} offline. Queued. (Queue size: ${offlineMessages.get(targetId).length})`);
    }
  });

  socket.on("typing", ({ to, isTyping }) => {
    const targetId = normalize(to);
    broadcastToUser(targetId, "typing", { from: rawUserId, isTyping });
  });

  socket.on("identity_broadcast", ({ to, publicKey, username, profilePic }) => {
    const targetId = normalize(to);
    const msg = { type: 'identity', from: rawUserId, publicKey, username, profilePic, content: { publicKey, username, profilePic } };
    
    if (!broadcastToUser(targetId, "message_relay", msg)) {
      if (!offlineMessages.has(targetId)) offlineMessages.set(targetId, []);
      offlineMessages.get(targetId).push(msg);
    }
  });

  socket.on("register_identity", ({ publicKey, username, profilePic }) => {
    if (userId) {
      directory.set(userId, { publicKey, username, profilePic, rawId: rawUserId });
      console.log(`Identity registered for ${userId}`);
    }
  });

  socket.on("get_identity", (target, callback) => {
    const targetId = normalize(target);
    const identity = directory.get(targetId);
    callback(identity);
  });

  socket.on("disconnect", () => {
    if (userId && users.has(userId)) {
      users.get(userId).delete(socket.id);
      if (users.get(userId).size === 0) {
        users.delete(userId);
        console.log(`User ${userId} fully disconnected`);
      } else {
        console.log(`User ${userId} removed socket ${socket.id}. Remaining: ${users.get(userId).size}`);
      }
    }
  });
});

const PORT = 3001;
httpServer.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
