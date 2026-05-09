
'use client';

import { useChatStore } from '@/store/useChatStore';
import { Search, PlusSquare, RefreshCw, LogOut, Trash2, Settings } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { getSocket } from '@/lib/socket';
import { deleteMessagesForChat, deleteContact } from '@/lib/storage';

interface ChatListProps {
  onOpenSettings: () => void;
  onAddContact: () => void;
}

export const ChatList = ({ onOpenSettings, onAddContact }: ChatListProps) => {
  const { contacts, setActiveChatId, activeChatId, currentUser, removeContact, logout } = useChatStore();

  const formatPreview = (msg: string | undefined) => {
    if (!msg) return 'End-to-end encrypted';
    if (msg.startsWith('LOC:')) return '📍 Location';
    if (msg.startsWith('data:image')) return '📷 Photo';
    if (msg.startsWith('data:video')) return '🎬 Video';
    if (msg.startsWith('data:audio')) return '🎵 Audio';
    return msg;
  };

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
      window.location.reload();
    } catch (error) {
      console.error("Logout failed:", error);
      logout();
      window.location.reload();
    }
  };

  return (
    <div className="flex flex-col h-full bg-black border-r border-white/5 w-full flex-shrink-0">
      {/* Header */}
      <div className="p-6 pb-2">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-black tracking-tighter text-white">Messages</h1>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onAddContact()}
              className="p-3 text-zinc-400 hover:text-purple-400 hover:bg-purple-500/10 rounded-2xl transition-all active:scale-90"
              title="New Message"
            >
              <PlusSquare size={22} />
            </button>
            <button
              onClick={() => window.location.reload()}
              className="p-3 text-zinc-400 hover:text-purple-400 hover:bg-purple-500/10 rounded-2xl transition-all active:scale-90"
              title="Sync Contacts"
            >
              <RefreshCw size={20} className={getSocket()?.connected ? '' : 'animate-spin'} />
            </button>
            <button
              onClick={onOpenSettings}
              className="p-3 text-zinc-400 hover:text-purple-400 hover:bg-purple-500/10 rounded-2xl transition-all active:scale-90"
              title="Settings"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-purple-500 transition-colors">
            <Search size={18} />
          </div>
          <input
            type="text"
            placeholder="Search conversations..."
            className="w-full bg-zinc-900/50 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all placeholder:text-zinc-600"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {contacts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-40">
            <div className="w-16 h-16 bg-zinc-800 rounded-3xl mb-4 flex items-center justify-center">
              <PlusSquare size={32} />
            </div>
            <p className="text-sm font-medium">No messages yet</p>
            <p className="text-[10px] uppercase tracking-widest mt-2">Tap + to start a chat</p>
          </div>
        ) : (
          contacts.map(contact => (
            <button
              key={contact.id}
              onClick={() => setActiveChatId(contact.id)}
              className={`w-full p-4 flex items-center gap-4 rounded-[2rem] transition-all relative group ${activeChatId === contact.id
                ? 'bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border border-purple-500/20 shadow-lg'
                : 'hover:bg-white/5 border border-transparent'
                }`}
            >
              <div className="relative">
                <div className="w-14 h-14 rounded-[1.25rem] bg-gradient-to-br from-indigo-500 to-purple-600 p-[1px] shadow-lg">
                  <div className="w-full h-full rounded-[1.2rem] bg-zinc-900 flex items-center justify-center overflow-hidden font-black text-xl text-white">
                    {contact.profilePic ? (
                      <img src={contact.profilePic} className="w-full h-full object-cover" />
                    ) : (
                      contact.username[0].toUpperCase()
                    )}
                  </div>
                </div>
                <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-4 border-black bg-green-500 shadow-xl ${activeChatId === contact.id ? 'animate-pulse' : ''}`}></div>
              </div>

              <div className="flex-1 text-left overflow-hidden">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="font-bold text-white tracking-tight truncate">
                    {contact.username} {contact.id === currentUser?.id && <span className="text-[10px] text-zinc-500 ml-1 font-mono">(You)</span>}
                  </h3>
                  {contact.lastMessageTime && (
                    <span className="text-[10px] font-bold text-zinc-500 uppercase">
                      {new Date(contact.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                <p className={`text-xs truncate ${contact.unreadCount && contact.unreadCount > 0 ? 'text-white font-bold' : 'text-zinc-500'}`}>
                  {contact.lastMessage || 'End-to-end encrypted'}
                </p>
              </div>

              {contact.unreadCount !== undefined && contact.unreadCount > 0 && (
                <div className="bg-purple-600 text-white text-[10px] font-black min-w-[1.5rem] h-6 flex items-center justify-center rounded-full px-2 shadow-lg shadow-purple-600/30">
                  {contact.unreadCount}
                </div>
              )}
            </button>
          ))
        )}
      </div>

      {/* Bottom Profile */}
      <div className="p-4">
        <div className="bg-zinc-900/50 backdrop-blur-2xl border border-white/5 rounded-3xl p-3 flex items-center justify-between shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 p-[1px]">
              <div className="w-full h-full rounded-2xl bg-zinc-900 flex items-center justify-center overflow-hidden font-black text-sm">
                {currentUser?.profilePic ? (
                  <img src={currentUser.profilePic} className="w-full h-full object-cover" />
                ) : (
                  currentUser?.username?.[0]?.toUpperCase()
                )}
              </div>
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-black text-white truncate">{currentUser?.username}</p>
              <p className="text-[10px] text-zinc-500 font-mono truncate">{currentUser?.id}</p>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleLogout();
            }}
            className="p-3 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all active:scale-90"
            title="Sign Out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
