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
import { UserX, Phone, Video as VideoIcon } from 'lucide-react';
import { PeerConnection } from '@/lib/peer';
import { CallOverlay } from '@/components/CallOverlay';
import { initNotifications } from '@/lib/notifications';

export default function Home() {
  const normalize = (id: string) => {
    if (!id) return '';
    let cleaned = id.replace(/\D/g, '');
    if (cleaned.length === 10) cleaned = '91' + cleaned;
    return cleaned;
  };
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
  const sharedSecrets = useRef<{ [key: string]: string }>({});
  const secretsDerivedFor = useRef<string>(''); // Stores currentUser.id + contacts version
  const activeChatIdRef = useRef<string | null>(null);
  const currentUserRef = useRef<User | null>(null);
  const [replyingTo, setReplyingTo] = useState<{ id: string, content: string } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isServerSettingsOpen, setIsServerSettingsOpen] = useState(false);
  const [serverIp, setServerIp] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newProfilePic, setNewProfilePic] = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Call State
  const [callState, setCallState] = useState<'idle' | 'calling' | 'receiving' | 'active'>('idle');
  const [isVideoCall, setIsVideoCall] = useState(false);
  const [callerInfo, setCallerInfo] = useState({ username: '', profilePic: '' });
  const [callerId, setCallerId] = useState('');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [callReactions, setCallReactions] = useState<Array<{ id: string, emoji: string }>>([]);
  const [callPing, setCallPing] = useState(0);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isTheaterOpen, setIsTheaterOpen] = useState(false);
  const [isBackgroundBlurred, setIsBackgroundBlurred] = useState(false);
  const [theaterSyncData, setTheaterSyncData] = useState<any>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const peersRef = useRef<Map<string, PeerConnection>>(new Map());
  const signalBufferRef = useRef<Map<string, any[]>>(new Map());

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

      if (typeof window !== 'undefined') {
        setServerIp(localStorage.getItem('server_ip') || '');
      }

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
            const phoneId = user.phoneNumber;
            let publicKey = await getKey(`${phoneId}_public`);
            let privateKey = await getKey(`${phoneId}_private`);
            let savedUsername = await getKey(`${phoneId}_username`);
            let savedProfilePic = await getKey(`${phoneId}_profile_pic`);

            if (!publicKey || !privateKey) {
              console.log('[Security] No local keys found for authenticated user. Generating new pair...');
              const keyPair = generateKeyPair();
              publicKey = keyPair.publicKey;
              privateKey = keyPair.privateKey;
              await saveKey(`${phoneId}_public`, publicKey);
              await saveKey(`${phoneId}_private`, privateKey);
            }

            if (isMounted) {
              const restoredUser = {
                id: phoneId,
                username: savedUsername || `User-${phoneId.slice(-4)}`,
                phoneNumber: phoneId,
                publicKey: publicKey,
                profilePic: savedProfilePic
              };
              
              setCurrentUser(restoredUser);
              if (typeof window !== 'undefined') {
                (window as any).myPrivateKey = privateKey;
              }
              
              initNotifications(); // Register for push notifications
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
      const urlParams = new URLSearchParams(window.location.search);
      const action = urlParams.get('action');
      const from = urlParams.get('from');

      if (action === 'answer' && from) {
        console.log(`[Call] Handling background answer for: ${from}`);
        setCallerId(from);
        const contact = contacts.find(c => normalize(c.id) === normalize(from));
        setCallerInfo({ 
          username: contact?.username || from, 
          profilePic: contact?.profilePic || '' 
        });
        setIsVideoCall(true); // Default to video for background answers
        setCallState('receiving');
        // Clean up URL
        window.history.replaceState({}, '', '/');
      }
    }
  }, [currentUser, contacts]);

  useEffect(() => {
    if (currentUser && typeof window !== 'undefined') {
      const privateKey = (window as any).myPrivateKey;
      if (privateKey) {
        const derivationKey = `${currentUser.id}:${contacts.length}:${contacts.map(c => c.publicKey.slice(0, 5)).join(',')}`;
        if (secretsDerivedFor.current === derivationKey) return;

        console.log('[Security] Syncing key vault for:', currentUser.username);
        contacts.forEach(contact => {
          const normalizedId = normalize(contact.id);
          if (contact.publicKey && !sharedSecrets.current[normalizedId]) {
            const secret = deriveSharedSecret(currentUser.publicKey, privateKey, contact.publicKey);
            sharedSecrets.current[normalizedId] = secret;
          }
        });
        secretsDerivedFor.current = derivationKey;
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
    const register = () => {
      console.log(`[Socket] Registering identity for ${initialUser.id}...`);
      socket.emit('client_ready');
      socket.emit('register_identity', { 
        publicKey: initialUser.publicKey, 
        username: initialUser.username,
        profilePic: initialUser.profilePic
      });
    };

    socket.on('connect', () => {
      setIsConnected(true);
      register();
    });
    if (socket.connected) {
      setIsConnected(true);
      register();
    }

    socket.on('message_relay', (data: { from: string, type: string, content: any, id: string, timestamp: number, chatId?: string }) => {
      console.log(`[Socket] Data arrived from relay:`, data.type);
      processIncomingData(data.from, data);
    });

    socket.on('identity_broadcast', (data: any) => {
      const user = currentUserRef.current;
      if (user && data.from !== user.id) {
        handleIdentityReceived(data.from, data, user);
      }
    });

    socket.on('typing', ({ from, isTyping }: { from: string, isTyping: boolean }) => {
      useChatStore.getState().setTyping(from, isTyping);
    });

    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected from relay');
      setIsConnected(false);
    });

    socket.on('call_reconnect', () => {
      if (callState === 'active' && peersRef.current.size > 0) {
        console.log('[Call] Peer requested reconnect. Restarting signaling...');
        if (callerId) startCall(isVideoCall);
      }
    });

    socket.on('signal', ({ from, signal }: { from: string, signal: any }) => {
      console.log(`[Call] Received signal from ${from}`);
      const peer = peersRef.current.get(from);
      if (peer) {
        peer.signal(signal);
      } else {
        console.log('[Call] Buffering signal because peer is not ready');
        const buffer = signalBufferRef.current.get(from) || [];
        buffer.push(signal);
        signalBufferRef.current.set(from, buffer);
      }
    });

    socket.on('call_reaction', ({ emoji }: { emoji: string }) => {
      const id = uuidv4();
      setCallReactions(prev => [...prev, { id, emoji }]);
      setTimeout(() => {
        setCallReactions(prev => prev.filter(r => r.id !== id));
      }, 3000);
    });

    socket.on('theater_sync', (data: any) => {
      setTheaterSyncData(data);
      if (data.type === 'load') setIsTheaterOpen(true);
    });
  };

  const processIncomingData = async (from: string, payload: { type: string, content: any, id?: string, timestamp?: number, chatId?: string }) => {
    const { type, content, timestamp, id } = payload;
    console.log(`[Relay] Incoming ${type} from ${from}`);
    console.log(`[Incoming] ${type || 'message'} from ${from}`);

    if (type === 'identity') {
      if (currentUser) handleIdentityReceived(from, content || payload, currentUser);
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

    if (type === 'delete_chat') {
      await deleteMessagesForChat(from);
      await deleteContact(from);
      useChatStore.getState().removeContact(from);
      if (normalize(activeChatIdRef.current || '') === normalize(from)) {
        setActiveChatId(null);
        setMessages([]);
      }
      return;
    }

    if (type === 'identity_broadcast') {
      const user = currentUserRef.current;
      if (user) handleIdentityReceived(from, content, user);
      return;
    }

    if (type === 'typing') {
      useChatStore.getState().setTyping(from, content);
      return;
    }

    if (type === 'call_request') {
      const { isVideo, username, profilePic } = content;
      setCallerId(from);
      setCallerInfo({ username, profilePic });
      setIsVideoCall(isVideo);
      setCallState('receiving');
      return;
    }

    if (type === 'call_response') {
      if (content === 'accepted') {
        setCallState('active');
      } else {
        cleanupCall();
      }
      return;
    }

    if (type === 'call_reaction') {
      const id = uuidv4();
      const emoji = content.emoji;
      setCallReactions(prev => [...prev, { id, emoji }]);
      setTimeout(() => {
        setCallReactions(prev => prev.filter(r => r.id !== id));
      }, 3000);
      return;
    }

    if (type === 'call_end') {
      cleanupCall();
      return;
    }

    if (type === 'key_exchange') {
      if (currentUser) handleIdentityReceived(from, content || payload, currentUser);
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
      let finalContent = decrypted;
      let type: Message['type'] = 'text';
      let replyToId = undefined;
      let replyToContent = undefined;
      
      try {
        const parsed = JSON.parse(decrypted);
        if (parsed.content !== undefined) {
          finalContent = parsed.content;
          type = parsed.type || 'text';
          replyToId = parsed.replyToId;
          replyToContent = parsed.replyToContent;
        }
      } catch (e) {
        // Fallback for legacy plain text messages
        if (finalContent.startsWith('LOC:')) type = 'location';
        else if (finalContent.startsWith('data:image')) type = 'image';
      }

      console.log(`[Decryption] Success: "${finalContent.slice(0, 10)}..." from ${from}`);
      
      // If it's a self-sync message, use the chatId provided by the server
      const conversationId = (normalize(from) === normalize(user.id)) ? (payload.chatId || from) : from;

      const msg: Message = {
        id: id || uuidv4(),
        senderId: from,
        receiverId: (normalize(from) === normalize(user.id)) ? conversationId : user.id,
        chatId: conversationId,
        content: finalContent,
        type: type,
        timestamp: timestamp || Date.now(),
        status: normalize(activeChatIdRef.current || '') === normalize(conversationId) ? 'read' : 'delivered',
        replyToId,
        replyToContent
      };

      // Atomic Save & Update
      const messagesInChat = await getMessagesForChat(conversationId);
      if (!messagesInChat.some(m => m.id === msg.id)) {
        await saveMessage(msg);
        
        // Move contact to top and update snippet
        const existingContact = useChatStore.getState().contacts.find(c => normalize(c.id) === normalize(conversationId));
        const isAppBackgrounded = typeof document !== 'undefined' && document.visibilityState === 'hidden';
        const isActiveChat = normalize(activeChatIdRef.current || '') === normalize(conversationId);
        const preview = type === 'image' ? '📷 Photo' : type === 'location' ? '📍 Location' : finalContent;

        const updatedContact: Contact = {
          id: conversationId,
          username: existingContact?.username || `User-${conversationId.slice(-4)}`,
          publicKey: existingContact?.publicKey || '',
          profilePic: existingContact?.profilePic,
          lastMessage: preview,
          lastMessageTime: msg.timestamp,
          unreadCount: (!isActiveChat || isAppBackgrounded) ? (existingContact?.unreadCount || 0) + 1 : 0
        };

        addContact(updatedContact);
        saveContact(updatedContact);

        // If this is the active chat, update state
        if (normalize(activeChatIdRef.current || '') === normalize(conversationId)) {
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
    const { publicKey, username, profilePic } = payload;
    console.log(`[Identity] Updating profile for ${from}. Photo: ${profilePic ? 'Present' : 'Missing'}`);
    const normalizedFrom = normalize(from);
    const secret = deriveSharedSecret(localUser.publicKey, (window as any).myPrivateKey, publicKey);
    sharedSecrets.current[normalizedFrom] = secret;
    
    const existing = useChatStore.getState().contacts.find(c => normalize(c.id) === normalizedFrom);
    
    // Skip if nothing changed to prevent loops
    if (existing && existing.username === username && existing.profilePic === profilePic && existing.publicKey === publicKey) {
      return;
    }

    const newContact = { 
      ...existing,
      id: from, 
      username: username || existing?.username || 'Anonymous', 
      publicKey, 
      sharedSecret: secret,
      profilePic: profilePic || existing?.profilePic
    };
    addContact(newContact);
    saveContact(newContact).then(() => {
      // Only log if it's a meaningful update
      if (!existing || existing.profilePic !== profilePic) {
        console.log('[Sync] Profile persisted for:', from);
      }
    });
    sharedSecrets.current[normalizedFrom] = secret;
  };


  // Refresh all contacts' info on startup
  useEffect(() => {
    if (currentUser && contacts.length > 0) {
      const socket = getSocket();
      if (socket && socket.connected) {
        console.log('[Sync] Refreshing contact directory...');
        contacts.forEach(contact => {
          socket.emit('get_identity', contact.id, (identity: any) => {
            if (identity) {
              handleIdentityReceived(contact.id, identity, currentUser);
            }
          });
        });
      }
    }
  }, [currentUser?.id, contacts.length]);

  const handleAddContact = (id?: string) => {
    const targetId = typeof id === 'string' ? id : prompt('Enter phone number (e.g., +91888...):');
    if (!targetId) return;

    const cleanDigits = normalize(targetId);
    let cleanId = '';
    
    if (targetId.startsWith('+')) {
      cleanId = targetId;
    } else if (cleanDigits.length === 10) {
      // If 10 digits, assume it's a local number and prepend the sender's country code if available
      const myCountryCode = (currentUser?.id && currentUser.id.startsWith('+')) 
        ? currentUser.id.slice(0, currentUser.id.length - 10) 
        : '+91';
      cleanId = `${myCountryCode}${cleanDigits}`;
    } else {
      cleanId = `+${cleanDigits}`;
    }

    if (normalize(cleanId) === normalize(currentUser?.id || '')) return;
    
    // Immediately show the chat window for this ID
    setActiveChatId(cleanId);
    
    // Add a temporary contact entry if it doesn't exist
    if (!contacts.find(c => c.id === cleanId)) {
      const tempContact = { id: cleanId, username: `User-${cleanId.slice(-4)}`, publicKey: '' };
      addContact(tempContact);
      saveContact(tempContact);
    }

    const socket = getSocket();
    if (socket && currentUser) {
      // 1. Try to fetch their key from the server for instant chat
      socket.emit('get_identity', cleanId, (identity: any) => {
        if (identity && currentUser) {
          handleIdentityReceived(cleanId, identity, currentUser);
        }
      });

      // 2. Also broadcast our identity to them directly
      socket.emit('identity_broadcast', { 
        to: cleanId, 
        publicKey: currentUser.publicKey, 
        username: currentUser.username,
        profilePic: currentUser.profilePic
      });
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
    const mode = confirm('Delete for everyone? Click Cancel to delete only for me.') ? 'everyone' : 'me';
    
    await deleteMessagesForChat(activeChatId);
    await deleteContact(activeChatId);
    useChatStore.getState().removeContact(activeChatId);
    setActiveChatId(null);
    setMessages([]);

    if (mode === 'everyone') {
      const socket = getSocket();
      if (socket) {
        socket.emit('message_relay', {
          to: activeChatId,
          type: 'delete_chat',
          content: 'ALL'
        });
      }
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

  const handleReply = (id: string, content: string) => {
    setReplyingTo({ id, content });
  };

  const handleUpdateProfile = async () => {
    if (!currentUser || !newUsername.trim()) return;
    const updatedUser = { ...currentUser, username: newUsername.trim(), profilePic: newProfilePic };
    setCurrentUser(updatedUser);
    await saveKey(`${currentUser.id}_username`, newUsername.trim());
    if (newProfilePic) await saveKey(`${currentUser.id}_profile_pic`, newProfilePic);
    
    // Broadcast change to relay server
    const socket = getSocket();
    if (socket) {
      socket.emit('register_identity', { 
        publicKey: currentUser.publicKey, 
        username: newUsername.trim(),
        profilePic: newProfilePic
      });

      // Notify all known contacts immediately so they see the new profile pic
      const contacts = useChatStore.getState().contacts;
      contacts.forEach(contact => {
        socket.emit('identity_broadcast', { 
          to: contact.id, 
          publicKey: currentUser.publicKey, 
          username: newUsername.trim(),
          profilePic: newProfilePic
        });
      });
    }
    setIsSettingsOpen(false);
  };

  const sendMessage = async (content: string, type: Message['type'] = 'text', replyTo?: { id: string, content: string }) => {
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
            setTimeout(() => sendMessage(content, type, replyTo), 50);
          } else {
            alert(`Unable to find user ${activeChatId} on the network. Make sure they are registered.`);
          }
        });
        return;
      }
    }

    if (!secret) return;

    const msgId = uuidv4();
    const payload = JSON.stringify({ 
      content,
      type,
      replyToId: replyTo?.id,
      replyToContent: replyTo?.content 
    });
    const encrypted = encryptMessage(payload, secret);
    
    // 1. Create message object
    const msg: Message = {
      id: msgId,
      senderId: currentUser.id,
      receiverId: activeChatId,
      chatId: activeChatId, // THE OTHER PERSON
      content: content,
      type: type,
      timestamp: Date.now(),
      status: 'sent',
      replyToId: replyTo?.id,
      replyToContent: replyTo?.content
    };
    
    // 2. Save and display locally immediately
    await saveMessage(msg);
    setMessages((prev) => [...prev, msg].sort((a, b) => a.timestamp - b.timestamp));

    // Move contact to top of list and update snippet
    const contact = useChatStore.getState().contacts.find(c => normalize(c.id) === normalizedChatId);
    if (contact) {
      const preview = type === 'image' ? '📷 Photo' : type === 'location' ? '📍 Location' : content;
      addContact({ 
        ...contact, 
        lastMessage: preview, 
        lastMessageTime: msg.timestamp,
        unreadCount: 0
      });
    }

    // 4. Send via Relay
    const socket = getSocket();
    if (socket) {
      socket.emit('message_relay', {
        to: activeChatId,
        id: msg.id,
        content: encrypted,
        timestamp: msg.timestamp
      });
    }
    setReplyingTo(null);
  };

  const handleTyping = (isTyping: boolean) => {
    if (!activeChatId) return;
    getSocket()?.emit('typing', { to: activeChatId, isTyping });
  };

  const startCall = async (isVideo: boolean) => {
    if (!activeChatId || !currentUser) return;
    
    console.log(`[Call] Starting ${isVideo ? 'video' : 'audio'} call to ${activeChatId}`);
    
    try {
      // Android WebView sometimes needs an explicit check or a simple getUserMedia call first
      if (navigator.permissions && (navigator.permissions as any).query) {
        try {
          const cam = await navigator.permissions.query({ name: 'camera' as any });
          const mic = await navigator.permissions.query({ name: 'microphone' as any });
          console.log('[Call] Permissions:', { camera: cam.state, mic: mic.state });
        } catch (e) {
          console.warn('[Call] Permission query not supported');
        }
      }
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: isVideo ? {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        } : false, 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      setLocalStream(stream);
      setIsVideoCall(isVideo);
      setCallState('calling');
      setCallerId(activeChatId);
      const target = contacts.find(c => c.id === activeChatId);
      setCallerInfo({ username: target?.username || activeChatId, profilePic: target?.profilePic || '' });

      const peer = new PeerConnection({
        initiator: true,
        stream,
        onSignal: (data) => {
          getSocket()?.emit('signal', { to: activeChatId, signal: data });
        },
        onConnect: () => console.log(`[Call] WebRTC Connected with ${activeChatId}`),
        onData: (data) => console.log('[Call] Data:', data),
        onError: (err) => {
          console.error('[Call] Error:', err);
          cleanupCall();
        },
        onStream: (remote) => {
          setRemoteStreams(prev => {
            const next = new Map(prev);
            next.set(activeChatId, remote);
            return next;
          });
        }
      });

      peersRef.current.set(activeChatId, peer);

      getSocket()?.emit('message_relay', {
        to: activeChatId,
        type: 'call_request',
        content: { 
          isVideo, 
          username: currentUser.username, 
          profilePic: currentUser.profilePic 
        }
      });
    } catch (err) {
      console.error('[Call] Failed to get media:', err);
      alert('Could not access camera/microphone');
    }
  };

  const answerCall = async () => {
    if (!callerId || !currentUser) return;

    console.log(`[Call] Answering ${isVideoCall ? 'video' : 'audio'} call from ${callerId}`);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: isVideoCall ? {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        } : false, 
        audio: true 
      });
      setLocalStream(stream);
      setCallState('active');

      const peer = new PeerConnection({
        initiator: false,
        stream,
        onSignal: (data) => {
          getSocket()?.emit('signal', { to: callerId, signal: data });
        },
        onConnect: () => console.log(`[Call] WebRTC Connected with ${callerId}`),
        onData: (data) => console.log('[Call] Data:', data),
        onError: (err) => {
          console.error('[Call] Error:', err);
          cleanupCall();
        },
        onStream: (remote) => {
          setRemoteStreams(prev => {
            const next = new Map(prev);
            next.set(callerId, remote);
            return next;
          });
        }
      });

      peersRef.current.set(callerId, peer);

      // 4. Flush the buffer (Apply all signals that arrived before we hit answer)
      const buffer = signalBufferRef.current.get(callerId) || [];
      if (buffer.length > 0) {
        console.log(`[Call] Applying ${buffer.length} buffered signals for ${callerId}`);
        buffer.forEach(sig => peer.signal(sig));
        signalBufferRef.current.delete(callerId);
      }

      getSocket()?.emit('message_relay', {
        to: callerId,
        type: 'call_response',
        content: 'accepted'
      });
    } catch (err) {
      console.error('[Call] Failed to get media:', err);
      cleanupCall();
    }
  };

  const declineCall = () => {
    if (callerId) {
      getSocket()?.emit('message_relay', {
        to: callerId,
        type: 'call_response',
        content: 'declined'
      });
    }
    cleanupCall();
  };

  const endCall = () => {
    if (callerId) {
      getSocket()?.emit('message_relay', {
        to: callerId,
        type: 'call_end',
        content: 'ended'
      });
    }
    cleanupCall();
  };

  const cleanupCall = () => {
    peersRef.current.forEach(peer => peer.destroy());
    peersRef.current.clear();
    signalBufferRef.current.clear();
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    setRemoteStreams(new Map());
    setCallState('idle');
    setCallerId('');
    setIsMuted(false);
    setIsCameraOff(false);
    setIsScreenSharing(false);
  };

  const toggleMic = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOff(!videoTrack.enabled);
      }
    }
  };

  const toggleScreenShare = async () => {
    if (!localStream || peersRef.current.size === 0) return;

    try {
      if (!isScreenSharing) {
        // Start screen sharing
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        const videoTrack = localStream.getVideoTracks()[0];

        peersRef.current.forEach(peer => peer.replaceTrack(videoTrack, screenTrack, localStream));
        setIsScreenSharing(true);

        screenTrack.onended = () => {
           toggleScreenShare(); // Revert to camera when user stops sharing via browser UI
        };
      } else {
        // Stop screen sharing and revert to camera
        const newCameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const newVideoTrack = newCameraStream.getVideoTracks()[0];
        const currentVideoTrack = localStream.getVideoTracks()[0];

        peersRef.current.forEach(peer => peer.replaceTrack(currentVideoTrack, newVideoTrack, localStream));
        setIsScreenSharing(false);
        
        // Update local stream to keep audio but update video track
        const audioTrack = localStream.getAudioTracks()[0];
        setLocalStream(new MediaStream([newVideoTrack, audioTrack]));
      }
    } catch (err) {
      console.error('[Call] Screen share failed:', err);
    }
  };

  const switchCamera = async () => {
    if (!localStream || peersRef.current.size === 0 || isScreenSharing) return;

    try {
      const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
      const newStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: newFacingMode },
        audio: true 
      });
      
      const newVideoTrack = newStream.getVideoTracks()[0];
      const oldVideoTrack = localStream.getVideoTracks()[0];

      peersRef.current.forEach(peer => peer.replaceTrack(oldVideoTrack, newVideoTrack, localStream));
      
      // Stop the old track
      oldVideoTrack.stop();
      
      // Update local state
      const audioTrack = localStream.getAudioTracks()[0];
      setLocalStream(new MediaStream([newVideoTrack, audioTrack]));
      setFacingMode(newFacingMode);
      
      console.log(`[Call] Switched to ${newFacingMode} camera`);
    } catch (err) {
      console.error('[Call] Camera switch failed:', err);
      alert('Could not switch camera. Device might not have a second camera.');
    }
  };

  const handleTheaterSync = (data: any) => {
    setTheaterSyncData(data);
    peersRef.current.forEach((_, peerId) => {
      getSocket()?.emit('message_relay', {
        to: peerId,
        type: 'theater_sync',
        content: data
      });
    });
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callState === 'active' && peersRef.current.size > 0) {
      interval = setInterval(async () => {
        const firstPeer = Array.from(peersRef.current.values())[0];
        if (firstPeer) {
          const stats = await firstPeer.getStats();
          setCallPing(stats.ping);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [callState]);

  const handleSendReaction = (emoji: string) => {
    const id = uuidv4();
    setCallReactions(prev => [...prev, { id, emoji }]);
    
    peersRef.current.forEach((_, peerId) => {
      getSocket()?.emit('message_relay', {
        to: peerId,
        type: 'call_reaction',
        content: { emoji }
      });
    });

    setTimeout(() => {
      setCallReactions(prev => prev.filter(r => r.id !== id));
    }, 3000);
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
            <p className="text-[10px] text-center text-zinc-600 font-mono mb-2">
              SECURE OTP ACCESS • E2EE PERSISTENCE
            </p>

            <div className="pt-2 border-t border-white/5">
              <button 
                onClick={() => setIsServerSettingsOpen(!isServerSettingsOpen)}
                className="w-full text-[10px] text-zinc-700 hover:text-zinc-500 font-mono uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
              >
                <span>{isServerSettingsOpen ? '▼' : '▶'} Server Settings</span>
              </button>
              
              {isServerSettingsOpen && (
                <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-zinc-600 uppercase ml-1">Laptop IP (e.g. 192.168.1.5)</label>
                    <input
                      type="text"
                      placeholder="Enter Laptop IP"
                      value={serverIp}
                      onChange={(e) => {
                        setServerIp(e.target.value);
                        localStorage.setItem('server_ip', e.target.value);
                      }}
                      className="w-full bg-zinc-900/50 text-white rounded-xl px-4 py-2 border border-zinc-800 focus:outline-none focus:ring-1 focus:ring-purple-500/50 transition-all placeholder:text-zinc-700 font-mono text-xs"
                    />
                  </div>
                  <p className="text-[9px] text-zinc-600 italic px-1">
                    * Restart app after changing IP to apply settings.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setNewProfilePic(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="h-screen bg-black flex text-white overflow-hidden relative">
      <div className={`${activeChatId ? 'hidden md:flex' : 'flex'} w-full md:w-80 h-full border-r border-white/5`}>
        <ChatList 
          onOpenSettings={() => {
            setNewUsername(currentUser?.username || '');
            setNewProfilePic(currentUser?.profilePic || '');
            setIsSettingsOpen(true);
          }} 
          onAddContact={handleAddContact}
        />
      </div>
      
      <div className={`${activeChatId ? 'flex' : 'hidden md:flex'} flex-1 flex flex-col relative h-full bg-zinc-950`}>
        {activeChatId ? (
          <>
            <div className="p-4 border-b border-zinc-800/50 flex justify-between items-center bg-zinc-900/30 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setActiveChatId(null)}
                  className="md:hidden p-2 -ml-2 text-zinc-400 hover:text-white"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center font-bold border border-white/5 overflow-hidden shadow-lg shadow-purple-500/20">
                  {contacts.find(c => c.id === activeChatId)?.profilePic ? (
                    <img src={contacts.find(c => c.id === activeChatId)?.profilePic} className="w-full h-full object-cover" />
                  ) : (
                    contacts.find(c => c.id === activeChatId)?.username[0].toUpperCase()
                  )}
                </div>
                <div>
                  <h2 className="font-bold text-base leading-tight text-white tracking-tight">
                    {contacts.find(c => c.id === activeChatId)?.username}
                  </h2>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className={`w-2 h-2 rounded-full ${getSocket()?.connected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)] animate-pulse' : 'bg-red-500'}`}></div>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                      {useChatStore.getState().typingUsers[activeChatId] ? 'Typing...' : (getSocket()?.connected ? 'Online' : 'Offline')}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <button
                  onClick={() => startCall(false)}
                  className="p-2 text-zinc-500 hover:text-green-400 hover:bg-green-500/10 rounded-xl transition-all"
                  title="Audio Call"
                >
                  <Phone className="w-[18px] h-[18px]" />
                </button>
                <button
                  onClick={() => startCall(true)}
                  className="p-2 text-zinc-500 hover:text-purple-400 hover:bg-purple-500/10 rounded-xl transition-all"
                  title="Video Call"
                >
                  <VideoIcon className="w-[18px] h-[18px]" />
                </button>
                <button
                  onClick={() => handleAddContact(activeChatId)}
                  className="p-2 text-zinc-500 hover:text-purple-400 hover:bg-purple-500/10 rounded-xl transition-all"
                  title="Sync Profile Info"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.85.83 6.72 2.24L21 8"/><path d="M21 3v5h-5"/></svg>
                </button>
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
                    replyToId={msg.replyToId}
                    replyToContent={msg.replyToContent}
                    onDelete={handleDeleteMessage}
                    onReply={handleReply}
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            
            <InputBox 
              onSend={sendMessage} 
              onTyping={handleTyping} 
              replyingTo={replyingTo}
              onCancelReply={() => setReplyingTo(null)}
            />
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
                    onClick={() => handleAddContact()}
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
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsSettingsOpen(false)}></div>
          <div className="relative w-full max-w-md bg-zinc-900 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-2xl font-black mb-6 text-white tracking-tight">Profile Settings</h2>
            
            <div className="space-y-6">
              <div className="flex flex-col items-center gap-4 mb-8">
                <div 
                  className="relative group cursor-pointer"
                  onClick={() => photoInputRef.current?.click()}
                >
                  <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-4xl font-black shadow-xl shadow-purple-500/20 overflow-hidden border-2 border-white/5 transition-transform group-hover:scale-105">
                    {newProfilePic ? (
                      <img src={newProfilePic} className="w-full h-full object-cover" />
                    ) : (
                      currentUser?.username[0].toUpperCase()
                    )}
                  </div>
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-3xl backdrop-blur-[2px]">
                    <div className="bg-white/20 p-2 rounded-full border border-white/20">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    </div>
                  </div>
                </div>
                <input 
                  type="file" 
                  ref={photoInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handlePhotoChange}
                />
                {newProfilePic && (
                  <button 
                    onClick={() => setNewProfilePic('')}
                    className="text-[10px] font-bold text-red-400 hover:text-red-300 uppercase tracking-[0.2em] transition-colors"
                  >
                    Remove Photo
                  </button>
                )}
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">{currentUser?.id}</p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 tracking-widest">Display Name</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full bg-black/50 text-white rounded-2xl px-6 py-4 border border-zinc-800 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all font-medium"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="flex-1 px-6 py-4 rounded-2xl bg-zinc-800 text-zinc-300 font-bold hover:bg-zinc-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateProfile}
                  className="flex-1 px-6 py-4 rounded-2xl bg-white text-black font-bold hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <CallOverlay 
        state={callState}
        isVideo={isVideoCall}
        callerInfo={callerInfo}
        localStream={localStream}
        remoteStreams={remoteStreams}
        onAnswer={answerCall}
        onDecline={declineCall}
        onEnd={endCall}
        onToggleMic={toggleMic}
        onToggleVideo={toggleVideo}
        onToggleScreenShare={toggleScreenShare}
        onSwitchCamera={switchCamera}
        onSendReaction={handleSendReaction}
        reactions={callReactions}
        ping={callPing}
        isMuted={isMuted}
        isCameraOff={isCameraOff}
        isScreenSharing={isScreenSharing}
        isTheaterOpen={isTheaterOpen}
        isBackgroundBlurred={isBackgroundBlurred}
        onToggleTheater={() => setIsTheaterOpen(!isTheaterOpen)}
        onToggleBlur={() => setIsBackgroundBlurred(!isBackgroundBlurred)}
        onTheaterSync={handleTheaterSync}
        theaterSyncData={theaterSyncData}
      />
    </div>
  );
}
