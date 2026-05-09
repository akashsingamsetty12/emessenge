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

const normalize = (id) => {
  if (!id) return '';
  let cleaned = id.replace(/\D/g, '');
  if (cleaned.length === 10) cleaned = '91' + cleaned;
  return cleaned;
};

io.on("connection", (socket) => {
  const rawUserId = socket.handshake.query.userId;
  const userId = normalize(rawUserId);
  
  if (userId) {
    if (!users.has(userId)) users.set(userId, new Set());
    users.get(userId).add(socket.id);
  console.log(`[Connect] User ${userId} (${rawUserId}) connected. Sockets: ${users.get(userId).size}`);

  // 1. Deliver offline messages immediately
  if (offlineMessages.has(userId)) {
    const messages = offlineMessages.get(userId);
    console.log(`[Sync] Delivering ${messages.length} offline messages to ${userId}`);
    messages.forEach(msg => {
      socket.emit("message_relay", msg);
    });
    offlineMessages.delete(userId);
  }

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

  socket.on("message_relay", ({ to, content, id, timestamp, type }) => {
    const normalizedTo = normalize(to);
    const normalizedFrom = normalize(userId);

    const messagePayload = { 
      from: normalizedFrom, 
      content, 
      id, 
      timestamp: timestamp || Date.now(), 
      type: type || 'text' 
    };

    // 1. Deliver to all active sockets of the recipient
    const targetSockets = users.get(normalizedTo);
    if (targetSockets && targetSockets.size > 0) {
      targetSockets.forEach(sId => {
        io.to(sId).emit("message_relay", messagePayload);
      });
      console.log(`[Relay] Delivered to ${targetSockets.size} sockets of user ${normalizedTo}`);
    } else {
      // 2. Store for offline delivery if no sockets are active
      if (!offlineMessages.has(normalizedTo)) {
        offlineMessages.set(normalizedTo, []);
      }
      offlineMessages.get(normalizedTo).push(messagePayload);
      console.log(`[Relay] Stored offline message for ${normalizedTo}`);
    }

    // 3. Sync to sender's other devices (Self-Sync)
    const senderSockets = users.get(normalizedFrom);
    if (senderSockets && senderSockets.size > 1) {
      senderSockets.forEach(sId => {
        if (sId !== socket.id) {
          io.to(sId).emit("message_relay", { ...messagePayload, chatId: normalizedTo });
        }
      });
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

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Signaling server running on port ${PORT}`);
});
