import { create } from 'zustand';

export interface User {
  id: string;
  username: string;
  phoneNumber?: string;
  publicKey: string;
  lastMessage?: string;
  lastMessageTime?: number;
  unreadCount?: number;
  profilePic?: string;
}

interface ChatState {
  currentUser: User | null;
  contacts: User[];
  activeChatId: string | null;
  typingUsers: { [key: string]: boolean };
  setCurrentUser: (user: User) => void;
  setContacts: (contacts: User[]) => void;
  addContact: (user: User) => void;
  setActiveChatId: (id: string | null) => void;
  setTyping: (userId: string, isTyping: boolean) => void;
  markAsRead: (userId: string) => void;
  removeContact: (userId: string) => void;
  logout: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  currentUser: null,
  contacts: [],
  activeChatId: null,
  typingUsers: {},
  setCurrentUser: (user) => set({ currentUser: user }),
  setContacts: (contacts) => set({ contacts }),
  addContact: (user) => set((state) => ({
    contacts: [user, ...state.contacts.filter(c => c.id !== user.id)]
  })),
  setActiveChatId: (id) => set({ activeChatId: id }),
  setTyping: (userId, isTyping) => set((state) => ({
    typingUsers: { ...state.typingUsers, [userId]: isTyping }
  })),
  markAsRead: (userId) => set((state) => ({
    contacts: state.contacts.map(c => 
      c.id === userId ? { ...c, unreadCount: 0 } : c
    )
  })),
  removeContact: (userId) => set((state) => ({
    contacts: state.contacts.filter(c => c.id !== userId)
  })),
  logout: () => set({ currentUser: null, activeChatId: null, contacts: [], typingUsers: {} }),
}));
