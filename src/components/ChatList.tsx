'use client';

import { useChatStore } from '@/store/useChatStore';
import { Search, MoreVertical, MessageSquarePlus, LogOut, Trash2 } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { deleteMessagesForChat, deleteContact } from '@/lib/storage';

export const ChatList = () => {
  const { contacts, setActiveChatId, activeChatId, currentUser, removeContact, logout } = useChatStore();

  const handleDeleteChat = async (e: React.MouseEvent, contactId: string) => {
    e.stopPropagation(); // Don't open the chat when clicking delete
    if (confirm('Delete this entire chat and remove from messages?')) {
      await deleteMessagesForChat(contactId);
      await deleteContact(contactId);
      removeContact(contactId);
      if (activeChatId === contactId) {
        setActiveChatId(null);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-black border-r border-white/5 w-80 md:w-96 flex-shrink-0">
      <div className="p-6 pb-2">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black text-white tracking-tight">Messages</h2>
          <div className="flex gap-2">
            <button className="p-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-400">
              <MessageSquarePlus size={20} />
            </button>
            <button className="p-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-400">
              <MoreVertical size={20} />
            </button>
          </div>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
          <input 
            type="text" 
            placeholder="Search conversations..."
            className="w-full bg-zinc-900/50 border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500/50 transition-all"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 space-y-1">
        {contacts.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center text-zinc-600 px-8 text-center">
            <p className="text-xs font-mono uppercase tracking-widest mb-2">No Connections</p>
            <p className="text-[10px]">Add a friend's ID to establish an E2EE handshake.</p>
          </div>
        ) : (
          contacts.map((contact) => (
            <div
              key={contact.id}
              onClick={() => setActiveChatId(contact.id)}
              className={`group p-4 flex items-center cursor-pointer rounded-2xl transition-all duration-200 ${
                activeChatId === contact.id 
                  ? 'bg-zinc-900 shadow-lg shadow-black/20' 
                  : 'hover:bg-zinc-900/40'
              }`}
            >
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center text-white font-black text-lg border border-white/5 overflow-hidden group-hover:scale-105 transition-transform">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-cyan-500 opacity-20 group-hover:opacity-40 transition-opacity"></div>
                  <span className="relative z-10">{contact.username[0].toUpperCase()}</span>
                </div>
                {/* Online status indicator */}
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-black shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
              </div>
              <div className="ml-4 flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-0.5">
                  <h3 className="text-white font-bold tracking-tight truncate">{contact.username}</h3>
                  <span className="text-[9px] text-zinc-500 font-mono flex-shrink-0 ml-2">
                    {contact.lastMessageTime 
                      ? new Date(contact.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : 'SECURE'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <p className={`text-xs truncate transition-colors ${contact.unreadCount && contact.unreadCount > 0 ? 'text-zinc-200 font-bold' : 'text-zinc-500'}`}>
                    {contact.lastMessage || 'End-to-end encrypted'}
                  </p>
                  <div className="flex items-center gap-2 ml-2">
                    {contact.unreadCount && contact.unreadCount > 0 && (
                      <div className="bg-purple-500 text-white text-[10px] font-black h-5 min-w-[20px] px-1.5 rounded-full flex items-center justify-center shadow-lg shadow-purple-500/20">
                        {contact.unreadCount}
                      </div>
                    )}
                    <button
                      onClick={(e) => handleDeleteChat(e, contact.id)}
                      className="p-1.5 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/10 rounded-lg"
                      title="Delete Chat"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {currentUser && (
        <div className="p-4 border-t border-white/5 bg-zinc-950/50 backdrop-blur-xl">
          <div className="flex items-center gap-3 p-2 rounded-2xl bg-zinc-900/30 border border-white/5">
            <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center font-bold text-xs border border-white/5">
              {currentUser.username[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">{currentUser.username}</p>
              <p className="text-[10px] text-zinc-500 font-mono truncate">{currentUser.id}</p>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
