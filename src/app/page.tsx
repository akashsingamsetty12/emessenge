'use client';

import { useEffect, useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useChatStore, User } from '@/store/useChatStore';
import { initSodium, generateKeyPair, encryptMessage, decryptMessage, deriveSharedSecret } from '@/lib/crypto';
import { initSocket, getSocket } from '@/lib/socket';
import { saveMessage, getMessagesForChat, Message, saveKey, getKey, saveContact, getContacts, Contact, deleteMessagesForChat, deleteMessage, deleteContact, updateMessageStatus } from '@/lib/storage';
import { ChatList } from '@/components/ChatList';
import { MessageBubble } from '@/components/MessageBubble';
import { InputBox } from '@/components/InputBox';
import { auth, RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { UserX } from 'lucide-react';

export default function Home() {
  const normalize = (id: string) => id ? id.replace(/\D/g, '') : '';
  const { currentUser, setCurrentUser, activeChatId, setActiveChatId, contacts, addContact, setContacts, markAsRead, logout } = useChatStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [usernameInput, setUsernameInput] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [targetIdInput, setTargetIdInput] = useState('');
  const [isInitializing, setIsInitializing] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [peerStatuses, setPeerStatuses] = useState<{ [key: string]: boolean }>({});
  const sharedSecrets = useRef<{ [key: string]: string }>({});
  const activeChatIdRef = useRef<string | null>(null);
  const currentUserRef = useRef<User | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    let isMounted = true;

    initSodium().then(() => {
      if (!isMounted) return;

      // Load saved contacts with their latest messages
      getContacts().then(async (saved: Contact[]) => {
        if (!isMounted) return;
        if (saved && saved.length > 0) {
          const contactsWithMessages = await Promise.all(saved.map(async (c) => {
            const msgs = await getMessagesForChat(c.id);
            const last = msgs[msgs.length - 1];
            return {
              ...c,
              lastMessage: last?.content,
              lastMessageTime: last?.timestamp,
              unreadCount: msgs.filter(m => m.status !== 'read' && normalize(m.senderId) === normalize(c.id)).length
            };
          }));
          if (isMounted) setContacts(contactsWithMessages);
        }
      });

      try {
        onAuthStateChanged(auth, async (user) => {
          if (!isMounted) return;
          if (user && user.phoneNumber) {
            const savedPublicKey = await getKey(`${user.phoneNumber}_public`);
            const savedPrivateKey = await getKey(`${user.phoneNumber}_private`);
            const savedUsername = await getKey(`${user.phoneNumber}_username`);

            if (savedPublicKey && savedPrivateKey && isMounted) {
              const restoredUser = {
                id: user.phoneNumber,
                username: savedUsername || 'Anonymous',
                phoneNumber: user.phoneNumber,
                publicKey: savedPublicKey,
              };
              
              setCurrentUser(restoredUser);
              if (typeof window !== 'undefined') {
                (window as any).myPrivateKey = savedPrivateKey;
              }
              
              const socket = initSocket(restoredUser.id);
              setupSocketListeners(socket, restoredUser);
            }
          }
          if (isMounted) setIsInitializing(false);
        });
      } catch (error) {
        console.error("Firebase Auth failed to initialize:", error);
        if (isMounted) setIsInitializing(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (currentUser && typeof window !== 'undefined') {
      const privateKey = (window as any).myPrivateKey;
      if (privateKey) {
        console.log('[Security] Initializing key vault for:', currentUser.username);
        contacts.forEach(contact => {
          if (contact.publicKey) {
            const secret = deriveSharedSecret(currentUser.publicKey, privateKey, contact.publicKey);
            sharedSecrets.current[normalize(contact.id)] = secret;
          }
        });
      }
    }
  }, [currentUser, contacts]);

  const setupRecaptcha = () => {
    if (!(window as any).recaptchaVerifier) {
      (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible',
      });
    }
  };

  const handleSendOTP = async () => {
    if (!phoneNumber.trim()) return;
    try {
      setupRecaptcha();
      const appVerifier = (window as any).recaptchaVerifier;
      const result = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
      setConfirmationResult(result);
      setIsOtpSent(true);
    } catch (error) {
      console.error("OTP Error:", error);
      alert("Failed to send OTP. Check console.");
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp.trim() || !confirmationResult) return;
    try {
      const result = await confirmationResult.confirm(otp);
      const user = result.user;
      const phoneId = user.phoneNumber || user.uid;
      const defaultUsername = user.phoneNumber ? user.phoneNumber.slice(-4) : 'User';
      
      // Check for existing keys first
      let publicKey = await getKey(`${phoneId}_public`);
      let privateKey = await getKey(`${phoneId}_private`);
      let savedUsername = await getKey(`${phoneId}_username`);
      
      if (!publicKey || !privateKey) {
        const keyPair = generateKeyPair();
        publicKey = keyPair.publicKey;
        privateKey = keyPair.privateKey;
        
        // Save new keys
        await saveKey(`${phoneId}_public`, publicKey);
        await saveKey(`${phoneId}_private`, privateKey);
      }

      // Save username (use saved one or default)
      const username = savedUsername || usernameInput || `User-${defaultUsername}`;
      if (!savedUsername) {
        await saveKey(`${phoneId}_username`, username);
      }
      
      const newUser = {
        id: phoneId,
        username: username,
        phoneNumber: user.phoneNumber || undefined,
        publicKey: publicKey,
      };
      
      setCurrentUser(newUser);
      if (typeof window !== 'undefined') {
        (window as any).myPrivateKey = privateKey;
      }
      
      const socket = initSocket(newUser.id);
      setupSocketListeners(socket, newUser);
    } catch (error) {
      console.error("Verification Error:", error);
      alert("Invalid OTP code.");
    }
  };

  const setupSocketListeners = (socket: any, initialUser: User) => {
    socket.on('message_relay', (data: any) => {
      console.log(`[Socket] Data arrived from relay:`, data.type);
      processIncomingData(data.from, data);
    });
    socket.on('identity_broadcast', (data: any) => {
      const user = currentUserRef.current;
      if (user) {
        handleIdentityReceived(data.from, data, user);
        socket.emit('identity_broadcast', { to: data.from, publicKey: user.publicKey, username: user.username });
      }
    });

    socket.on('typing', ({ from, isTyping }: { from: string, isTyping: boolean }) => {
      useChatStore.getState().setTyping(from, isTyping);
    });

    // 3. Signal ready
    socket.emit('client_ready');
    socket.emit('register_identity', { publicKey: initialUser.publicKey, username: initialUser.username });
  };

  const processIncomingData = async (from: string, payload: any) => {
    const { type, content, timestamp, id } = payload;
    console.log(`[Relay] Incoming ${type} from ${from}`);
    console.log(`[Incoming] ${type || 'message'} from ${from}`);

    if (type === 'identity') {
      if (currentUser) handleIdentityReceived(from, content, currentUser);
      return;
    }

    if (type === 'message_status') {
      const { messageId, status } = content || payload; // Support both nested and flat for compatibility
      if (messageId && status) {
        await updateMessageStatus(messageId, status);
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, status } : m));
      }
      return;
    }

    if (type === 'delete_message') {
      await deleteMessage(content);
      setMessages(prev => prev.filter(m => m.id !== content));
      return;
    }

    if (type === 'typing') {
      useChatStore.getState().setTyping(from, content);
      return;
    }

    if (type === 'key_exchange') {
      if (currentUser) handleIdentityReceived(from, content, currentUser);
      return;
    }

    const user = currentUserRef.current;
    if (!user) {
      console.warn(`[Process] Message received but no user is logged in.`);
      return;
    }

    // Encrypted Message Handling
    const normalizedFrom = normalize(from);
    const secret = sharedSecrets.current[normalizedFrom];
    
    if (!secret) {
      console.warn(`[Sync] Missing keys for normalized ID ${normalizedFrom}. Requesting...`);
      getSocket()?.emit('get_identity', from, (identity: any) => {
        if (identity && user) {
          handleIdentityReceived(from, identity, user);
          setTimeout(() => processIncomingData(from, payload), 100);
        }
      });
      return;
    }

    const decrypted = decryptMessage(content, secret);
    if (decrypted) {
      console.log(`[Decryption] Success: "${decrypted.slice(0, 10)}..." from ${from}`);
      const msg: Message = {
        id: id || uuidv4(),
        senderId: from,
        receiverId: user.id,
        content: decrypted,
        timestamp: timestamp || Date.now(),
        status: normalize(activeChatIdRef.current || '') === normalize(from) ? 'read' : 'delivered'
      };

      // Atomic Save & Update
      const messagesInChat = await getMessagesForChat(from);
      if (!messagesInChat.some(m => m.id === msg.id)) {
        await saveMessage(msg);
        
        // Move contact to top and update snippet
        const contact = useChatStore.getState().contacts.find(c => normalize(c.id) === normalizedFrom);
        if (contact) {
          const isAppBackgrounded = typeof document !== 'undefined' && document.visibilityState === 'hidden';
          const isActiveChat = normalize(activeChatIdRef.current || '') === normalizedFrom;
          
          addContact({ 
            ...contact, 
            lastMessage: decrypted, 
            lastMessageTime: msg.timestamp,
            unreadCount: (!isActiveChat || isAppBackgrounded) ? (contact.unreadCount || 0) + 1 : 0
          });
        }

        // If this is the active chat, update state
        if (normalize(activeChatIdRef.current || '') === normalizedFrom) {
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, msg].sort((a, b) => a.timestamp - b.timestamp);
          });
          
          // Send receipt
          const statusUpdate = { messageId: msg.id, status: msg.status };
          getSocket()?.emit('message_relay', { to: from, type: 'message_status', content: statusUpdate });
        }
      }
    } else {
      console.warn(`[Security] Decryption failed for message from ${from}. Key rotation might be needed.`);
    }
  };

  const handleIdentityReceived = (from: string, payload: any, localUser: User) => {
    if (!payload || !payload.publicKey) {
      console.warn(`[Identity] Received empty identity payload from ${from}`);
      return;
    }
    const { publicKey, username } = payload;
    const normalizedFrom = normalize(from);
    const secret = deriveSharedSecret(localUser.publicKey, (window as any).myPrivateKey, publicKey);
    sharedSecrets.current[normalizedFrom] = secret;
    const newContact = { id: from, username: username || 'Anonymous', publicKey, sharedSecret: secret };
    addContact(newContact);
    saveContact(newContact).then(() => {
      console.log('Contact persisted for normalized ID:', normalizedFrom);
    });
    sharedSecrets.current[normalizedFrom] = secret;
  };


  // Separated connect logic
  useEffect(() => {
    // When peers connect, they might need to exchange keys
    // This is handled in onData 'key_exchange'
  }, []);

  const handleAddContact = () => {
    const id = `+${normalize(targetIdInput)}`;
    if (!id || id === currentUser?.id) return;
    
    // Immediately show the chat window for this ID
    setActiveChatId(id);
    
    // Add a temporary contact entry if it doesn't exist
    if (!contacts.find(c => c.id === id)) {
      addContact({ id, username: `User-${id.slice(-4)}`, publicKey: '' });
    }

    const socket = getSocket();
    if (socket && currentUser) {
      // 1. Immediately save the contact locally so it persists
      const tempContact = { id, username: `User-${id.slice(-4)}`, publicKey: '' };
      addContact(tempContact);
      saveContact(tempContact);

      // 2. Try to fetch their key from the server for instant chat
      socket.emit('get_identity', id, (identity: any) => {
        if (identity && currentUser) {
          handleIdentityReceived(id, identity, currentUser);
          console.log('[Instant] Keys discovered via server directory');
        }
      });

      // 3. Also broadcast our identity to them directly
      socket.emit('identity_broadcast', { to: id, publicKey: currentUser.publicKey, username: currentUser.username });
    }

    setTargetIdInput('');
  };

  const handleClearChat = async () => {
    if (!activeChatId) return;
    if (confirm('Clear all messages in this chat?')) {
      await deleteMessagesForChat(activeChatId);
      setMessages([]);
    }
  };

  const handleDeleteEntireChat = async () => {
    if (!activeChatId) return;
    if (confirm('Delete this entire chat and remove from messages?')) {
      await deleteMessagesForChat(activeChatId);
      await deleteContact(activeChatId);
      useChatStore.getState().removeContact(activeChatId);
      setActiveChatId(null);
      setMessages([]);
    }
  };

  const handleDeleteMessage = async (messageId: string, mode: 'me' | 'everyone') => {
    // Local deletion
    await deleteMessage(messageId);
    setMessages((prev) => prev.filter(m => m.id !== messageId));

    if (mode === 'everyone' && activeChatId) {
      const payload = JSON.stringify({ type: 'delete_message', content: messageId });
      
      // 1. Send via Relay for reliability
      const socket = getSocket();
      if (socket) {
        socket.emit('message_relay', {
          to: activeChatId,
          type: 'delete_message',
          content: messageId
        });
      }
    }
  };

  const sendMessage = async (content: string) => {
    if (!activeChatId || !currentUser) return;
    
    const normalizedChatId = normalize(activeChatId);
    if (normalizedChatId === normalize(currentUser.id)) {
      console.warn('[Security] You are sending a message to yourself. Use a different number for testing.');
    }
    
    let secret = sharedSecrets.current[normalizedChatId];
    
    // 0. If secret is missing, try to resolve it instantly
    if (!secret && currentUser) {
      console.log('[Security] Resolving missing keys for instant chat...');
      const socket = getSocket();
      if (socket) {
        socket.emit('get_identity', activeChatId, (identity: any) => {
          if (identity && currentUser) {
            handleIdentityReceived(activeChatId, identity, currentUser);
            // Wait a tiny bit for state to settle then retry
            setTimeout(() => sendMessage(content), 50);
          } else {
            alert(`Unable to find user ${activeChatId} on the network. Make sure they are registered.`);
          }
        });
        return;
      }
    }

    if (!secret) return;

    const encrypted = encryptMessage(content, secret);
    
    // 1. Create message object
    const msg: Message = {
      id: uuidv4(),
      senderId: currentUser.id,
      receiverId: activeChatId,
      chatId: activeChatId, // THE OTHER PERSON
      content: content,
      timestamp: Date.now(),
      status: 'sent',
    };
    
    // 2. Save and display locally immediately
    await saveMessage(msg);
    setMessages((prev) => [...prev, msg].sort((a, b) => a.timestamp - b.timestamp));

    // Move contact to top of list and update snippet
    const contact = useChatStore.getState().contacts.find(c => c.id === activeChatId);
    if (contact) {
      addContact({ 
        ...contact, 
        lastMessage: content, 
        lastMessageTime: msg.timestamp 
      });
    }

    // 4. ALWAYS send via Relay as well (or as fallback) for 100% reliability
    // The receiver will deduplicate using the msg.id
    const socket = getSocket();
    if (socket) {
      console.log(`[Relay] Sending ${msg.id.slice(0, 8)} to ${activeChatId}`);
      socket.emit('message_relay', {
        to: activeChatId,
        id: msg.id,
        content: encrypted,
        timestamp: msg.timestamp
      });
    } else {
      console.error('[Relay] Failed: Socket disconnected');
    }
  };

  const handleTyping = (isTyping: boolean) => {
    if (!activeChatId) return;
    getSocket()?.emit('typing', { to: activeChatId, isTyping });
  };

  useEffect(() => {
    activeChatIdRef.current = activeChatId; // Sync ref for message processor
    if (activeChatId) {
      markAsRead(activeChatId);
      getMessagesForChat(activeChatId).then(async (msgs) => {
        setMessages(msgs);
        
        // Mark unread messages as read when opening chat
        const unread = msgs.filter(m => m.senderId === activeChatId && m.status !== 'read');
        if (unread.length > 0) {
          const socket = getSocket();
          for (const msg of unread) {
            await updateMessageStatus(msg.id, 'read');
            const statusData = { messageId: msg.id, status: 'read' };
            if (socket) {
              console.log(`[Relay] Attempting delivery of read receipt for message: ${msg.id}`);
              socket.emit('message_relay', { to: activeChatId, type: 'message_status', content: statusData });
            }
          }
          // Refresh local state
          setMessages(prev => prev.map(m => unread.find(u => u.id === m.id) ? { ...m, status: 'read' } : m));
        }
      });
    }
  }, [activeChatId]);

  if (isInitializing) return (
    <div className="h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-zinc-400 font-mono">INITIALIZING SECURE LAYER...</p>
      </div>
    </div>
  );

  if (!currentUser) {
    return (
      <div className="h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
        <div id="recaptcha-container"></div>
        <div className="max-w-md w-full bg-zinc-900/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-cyan-500 to-purple-500 animate-gradient-x"></div>
          
          <div className="mb-10 text-center">
            <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-cyan-500 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-lg shadow-purple-500/20 rotate-3">
              <span className="text-5xl">💬</span>
            </div>
            <h1 className="text-4xl font-black text-white mb-3 tracking-tight">eMessage</h1>
            <p className="text-zinc-400 font-medium">Verified. Encrypted. Persistent.</p>
          </div>

          <div className="space-y-6">
            {!isOtpSent ? (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="+1 234 567 8900"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full bg-zinc-800/50 text-white rounded-2xl px-6 py-4 border border-zinc-700/50 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all placeholder:text-zinc-600 font-medium"
                  />
                </div>
                <button
                  onClick={handleSendOTP}
                  className="w-full bg-white text-black font-bold py-4 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-white/5"
                >
                  Send OTP Code
                </button>
                {process.env.NODE_ENV === 'development' && (
                  <button
                    onClick={async () => {
                      const phoneId = phoneNumber.trim() || '+19999999999';
                      let publicKey = await getKey(`${phoneId}_public`);
                      let privateKey = await getKey(`${phoneId}_private`);
                      let savedUsername = await getKey(`${phoneId}_username`);
                      
                      if (!publicKey || !privateKey) {
                        const keyPair = generateKeyPair();
                        publicKey = keyPair.publicKey;
                        privateKey = keyPair.privateKey;
                        await saveKey(`${phoneId}_public`, publicKey);
                        await saveKey(`${phoneId}_private`, privateKey);
                      }

                      const username = savedUsername || `DevUser-${phoneId.slice(-4)}`;
                      if (!savedUsername) await saveKey(`${phoneId}_username`, username);

                      const newUser = {
                        id: phoneId,
                        username: username,
                        phoneNumber: phoneId,
                        publicKey: publicKey,
                      };
                      
                      setCurrentUser(newUser);
                      if (typeof window !== 'undefined') {
                        (window as any).myPrivateKey = privateKey;
                      }
                      const socket = initSocket(newUser.id);
                      setupSocketListeners(socket, newUser);
                    }}
                    className="w-full bg-zinc-800 text-zinc-400 font-mono text-[10px] py-2 rounded-xl border border-white/5 uppercase tracking-widest hover:text-white transition-colors"
                  >
                    Bypass OTP (Development Only)
                  </button>
                )}
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Verification Code</label>
                  <input
                    type="text"
                    placeholder="Enter 6-digit OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="w-full bg-zinc-800/50 text-white rounded-2xl px-6 py-4 border border-zinc-700/50 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all placeholder:text-zinc-600 font-medium text-center tracking-[0.2em] text-xl"
                  />
                </div>
                <button
                  onClick={handleVerifyOTP}
                  className="w-full bg-purple-600 text-white font-bold py-4 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-purple-500/20"
                >
                  Confirm & Login
                </button>
                <button 
                  onClick={() => setIsOtpSent(false)}
                  className="w-full text-zinc-500 text-xs font-bold uppercase tracking-widest hover:text-zinc-300 transition-colors"
                >
                  Back to Phone
                </button>
              </>
            )}
            <p className="text-[10px] text-center text-zinc-600 font-mono">
              SECURE OTP ACCESS • E2EE PERSISTENCE
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black flex text-white overflow-hidden">
      <ChatList />
      
      <div className="flex-1 flex flex-col relative">
        {activeChatId ? (
          <>
            <div className="p-4 border-b border-zinc-800/50 flex justify-between items-center bg-zinc-900/30 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center font-bold border border-white/5">
                  {contacts.find(c => c.id === activeChatId)?.username[0].toUpperCase()}
                </div>
                <div>
                  <h2 className="font-bold text-lg leading-tight">{contacts.find(c => c.id === activeChatId)?.username}</h2>
                  <div className="flex items-center gap-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${getSocket()?.connected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)] animate-pulse' : 'bg-red-500'}`}></div>
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                      {useChatStore.getState().typingUsers[activeChatId] ? 'Typing...' : (getSocket()?.connected ? 'Secure Relay Active' : 'Connecting...')}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <button
                  onClick={handleDeleteEntireChat}
                  className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                  title="Delete Entire Chat"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                </button>
                <div className="group relative">
                  <div className="px-3 py-1 bg-zinc-800 rounded-full text-[10px] font-mono text-zinc-400 border border-zinc-700 cursor-help">
                    KEY: {contacts.find(c => c.id === activeChatId)?.publicKey.slice(0, 8)}...
                  </div>
                  <div className="absolute top-full right-0 mt-2 w-64 p-4 glass-card rounded-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                    <p className="text-[10px] font-bold text-purple-400 uppercase mb-2 tracking-widest">Security Verification</p>
                    <p className="text-[11px] text-zinc-300 leading-relaxed mb-2">To verify encryption, confirm this fingerprint matches on their screen:</p>
                    <div className="p-3 bg-black/50 rounded-xl font-mono text-[10px] break-all border border-white/5 text-zinc-500">
                      {contacts.find(c => c.id === activeChatId)?.publicKey}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-2">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-600">
                  <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-4 text-2xl">🔐</div>
                  <p className="text-sm font-bold text-white mb-1">Encrypted Tunnel Active</p>
                  <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500 max-w-xs text-center">
                    Messages are encrypted locally and sent directly to your peer.
                  </p>
                </div>
              ) : (
                messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    id={msg.id}
                    content={msg.content}
                    isMe={msg.senderId === currentUser.id}
                    timestamp={msg.timestamp}
                    status={msg.status}
                    onDelete={handleDeleteMessage}
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            
            <InputBox onSend={sendMessage} onTyping={handleTyping} />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-900 via-black to-black">
            <div className="max-w-sm relative">
              <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-purple-500/10 blur-[100px] rounded-full"></div>
              <div className="text-7xl mb-6 grayscale opacity-50">🛸</div>
              <h2 className="text-3xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-500">
                Ready for Privacy?
              </h2>
              <p className="text-zinc-500 mb-8 font-mono text-xs uppercase tracking-tighter">
                Your Secure Identity: <span className="text-purple-400 select-all font-bold">{currentUser.id}</span>
              </p>
              
              <div className="p-8 bg-zinc-900/50 backdrop-blur-xl rounded-[2rem] border border-white/5 shadow-2xl">
                <p className="text-sm text-zinc-300 mb-6 font-medium">Enter a friend's ID to initiate a handshake</p>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Paste Friend ID"
                    value={targetIdInput}
                    onChange={(e) => setTargetIdInput(e.target.value)}
                    className="w-full bg-black/50 text-white rounded-xl px-4 py-3 text-sm border border-zinc-800 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all font-mono"
                  />
                  <button
                    onClick={handleAddContact}
                    className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 px-4 py-3 rounded-xl text-sm font-black shadow-lg shadow-purple-500/10 hover:brightness-110 active:scale-[0.98] transition-all"
                  >
                    ESTABLISH CONNECTION
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
