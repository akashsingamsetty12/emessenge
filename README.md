# eMessage | Encrypted P2P Messenger

eMessage is a premium, secure, and decentralized messaging platform designed for maximum privacy. It features end-to-end encrypted messaging, real-time video/audio calling, and cross-device synchronization, all while maintaining a local-first philosophy.

![eMessage Preview](C:/Users/akash/.gemini/antigravity/brain/46756d1a-d1e1-4435-8066-fa3e5a063401/emessage_premium_chat_ui_1778310399529.png)

## 🚀 Key Features

- **End-to-End Encryption (E2EE)**: All messages are encrypted locally using `libsodium` (X25519 for key exchange and XSalsa20-Poly1305 for encryption). The server never sees your message content.
- **P2P Video & Audio Calls**: Secure, high-quality real-time communication powered by WebRTC (Simple-Peer).
- **Multi-Device Synchronization**: Use the same phone number across multiple devices (Laptop, Phone, Tablet) with seamless real-time syncing.
- **Secure Authentication**: Robust phone-number verification powered by Firebase Auth.
- **Local-First Persistence**: Messages and contacts are stored securely in your device's IndexedDB, ensuring fast performance and offline access.
- **Premium UI/UX**: A modern, glassmorphic dark-mode interface with smooth animations and responsive design.

## 🛠 Tech Stack

- **Frontend**: [Next.js 16](https://nextjs.org/) (React 19), [Tailwind CSS 4](https://tailwindcss.com/)
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs/)
- **Real-time Engine**: [Socket.IO](https://socket.io/)
- **WebRTC**: [Simple-Peer](https://github.com/feross/simple-peer)
- **Encryption**: [libsodium-wrappers](https://github.com/jedisct1/libsodium-js)
- **Backend**: [Node.js](https://nodejs.org/) (Standalone Signaling Server)
- **Database/Storage**: IndexedDB (via `idb`)
- **Mobile**: [Capacitor](https://capacitorjs.com/) (Android)

## 🔐 Security Architecture

1. **Identity**: Upon first login, each device generates a unique X25519 keypair. The public key is registered on the signaling server.
2. **Key Exchange**: When adding a contact, eMessage fetches the recipient's public key and derives a **Shared Secret** locally.
3. **Encryption**: Every message is stringified, encrypted with the shared secret and a random nonce, and then relayed through the server.
4. **Zero-Knowledge Relay**: The signaling server only sees the "To" and "From" IDs; it has no access to the decryption keys or the plaintext content.

## 📦 Setup & Development

### 1. Prerequisites
- Node.js v20+
- Android Studio (for mobile build)

### 2. Environment Configuration
Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_FIREBASE_API_KEY="..."
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="..."
...
NEXT_PUBLIC_SOCKET_URL=http://<YOUR_LAPTOP_IP>:3001
```

### 3. Run Signaling Server
```bash
npm run signaling
```

### 4. Run Web Application
```bash
npm run dev
```

### 5. Build & Run Android App
```bash
npm run mobile:build
npm run mobile:open
```

## 🌐 Deployment

1. **Frontend**: Deploy the Next.js app to [Vercel](https://vercel.com).
2. **Signaling Server**: Deploy `server.js` to a persistent Node.js host like [Railway](https://railway.app) or [Render](https://render.com).
3. **Important**: Update `NEXT_PUBLIC_SOCKET_URL` to your production URL and ensure **HTTPS** is enabled for WebRTC functionality.

---
*Created with ❤️ for absolute privacy.*
