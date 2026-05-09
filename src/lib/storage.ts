import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'emessage_db';
const STORE_NAME = 'messages';
const KEYS_STORE = 'keys';
const CONTACTS_STORE = 'contacts';

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  chatId: string; // The other person's ID (for easy indexing)
  content: string; // Encrypted
  timestamp: number;
  status?: 'sent' | 'delivered' | 'read';
  replyToId?: string;
  replyToContent?: string;
  type?: 'text' | 'image' | 'location' | 'video' | 'audio';
}

export interface Contact {
  id: string;
  username: string;
  publicKey: string;
  sharedSecret?: string;
  profilePic?: string;
  lastMessage?: string;
  lastMessageTime?: number;
  unreadCount?: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

const getDB = () => {
  if (typeof window === 'undefined') return null;
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          db.createObjectStore(KEYS_STORE);
        }
        if (oldVersion < 2) {
          db.createObjectStore(CONTACTS_STORE, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
};

const normalize = (id: string) => {
  if (!id) return '';
  let cleaned = id.replace(/\D/g, '');
  if (cleaned.length === 10) cleaned = '91' + cleaned;
  return cleaned;
};

export const saveContact = async (contact: Contact) => {
  const db = await getDB();
  if (!db) return;
  await db.put(CONTACTS_STORE, contact);
};

export const deleteContact = async (contactId: string) => {
  const db = await getDB();
  if (!db) return;
  await db.delete(CONTACTS_STORE, contactId);
};

export const getContacts = async () => {
  const db = await getDB();
  if (!db) return [];
  return db.getAll(CONTACTS_STORE);
};

export const saveMessage = async (message: Message) => {
  const db = await getDB();
  if (!db) return;
  
  // Ensure we have a normalized chatId for the conversation
  const otherId = normalize(message.senderId) === normalize(message.receiverId) 
    ? message.senderId 
    : (normalize(message.senderId) === 'me' ? message.receiverId : message.senderId);

  await db.put(STORE_NAME, {
    ...message,
    chatId: message.chatId || otherId,
    status: message.status || 'sent'
  });
};

export const updateMessageStatus = async (messageId: string, status: 'delivered' | 'read') => {
  const db = await getDB();
  if (!db) return;
  const msg = await db.get(STORE_NAME, messageId);
  if (msg) {
    msg.status = status;
    await db.put(STORE_NAME, msg);
  }
};

export const deleteMessagesForChat = async (chatId: string) => {
  const db = await getDB();
  if (!db) return;
  const normalizedTarget = normalize(chatId);
  const tx = db.transaction(STORE_NAME, 'readwrite');
  let cursor = await tx.store.openCursor();
  
  let count = 0;
  while (cursor) {
    const msg = cursor.value;
    if (normalize(msg.senderId) === normalizedTarget || normalize(msg.receiverId) === normalizedTarget) {
      await cursor.delete();
      count++;
    }
    cursor = await cursor.continue();
  }
  await tx.done;
  console.log(`Deleted ${count} messages for chat: ${chatId}`);
};

export const deleteMessage = async (messageId: string) => {
  const db = await getDB();
  if (!db) return;
  await db.delete(STORE_NAME, messageId);
};

export const getMessagesForChat = async (chatId: string) => {
  const db = await getDB();
  if (!db) return [];
  const normalizedTarget = normalize(chatId);
  const allMessages = await db.getAll(STORE_NAME);
  return allMessages.filter(
    (m: Message) => normalize(m.senderId) === normalizedTarget || normalize(m.receiverId) === normalizedTarget
  ).sort((a, b) => a.timestamp - b.timestamp);
};

export const saveKey = async (userId: string, key: string) => {
  const db = await getDB();
  if (!db) return;
  await db.put(KEYS_STORE, key, userId);
};

export const getKey = async (userId: string) => {
  const db = await getDB();
  if (!db) return null;
  return db.get(KEYS_STORE, userId);
};
