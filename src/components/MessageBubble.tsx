'use client';

import { useState } from 'react';
import { UserX, Users, Check, CheckCheck, MapPin, Reply, Trash2, MoreHorizontal } from 'lucide-react';

interface MessageBubbleProps {
  id: string;
  content: string;
  isMe: boolean;
  timestamp: number;
  status?: 'sent' | 'delivered' | 'read';
  replyToId?: string;
  replyToContent?: string;
  onDelete: (id: string, mode: 'me' | 'everyone') => void;
  onReply: (id: string, content: string) => void;
}

export function MessageBubble({ 
  id, content, isMe, timestamp, status, 
  replyToId, replyToContent, 
  onDelete, onReply 
}: MessageBubbleProps) {
  const [showOptions, setShowOptions] = useState(false);

  const OptionsMenu = () => (
    <div className={`absolute top-0 ${isMe ? '-left-28' : '-right-28'} flex flex-col gap-1 z-20 animate-in fade-in slide-in-from-top-1 duration-200`}>
      <button 
        onClick={() => onReply(id, content)} 
        className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/90 backdrop-blur text-[10px] rounded-xl border border-white/10 hover:bg-zinc-800 transition-colors"
      >
        <Reply size={10} /> Reply
      </button>
      <button 
        onClick={() => onDelete(id, 'me')} 
        className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/90 backdrop-blur text-[10px] rounded-xl border border-white/10 hover:bg-zinc-800 transition-colors"
      >
        <Trash2 size={10} /> Delete for me
      </button>
      <button 
        onClick={() => onDelete(id, 'everyone')} 
        className="flex items-center gap-2 px-3 py-1.5 bg-red-900/90 backdrop-blur text-[10px] rounded-xl border border-red-500/20 hover:bg-red-800 transition-colors"
      >
        <Trash2 size={10} /> Delete for everyone
      </button>
    </div>
  );

  const ReplyPreview = () => (
    replyToContent && (
      <div className={`mb-1 p-2 rounded-xl border-l-4 border-purple-500 bg-black/20 text-[10px] opacity-80 max-w-full truncate ${isMe ? 'text-zinc-300' : 'text-zinc-400'}`}>
        <p className="font-bold uppercase tracking-widest text-[8px] mb-0.5 text-purple-400">Replying to</p>
        <p className="italic truncate">
          {replyToContent.startsWith('data:audio') ? '🎵 Audio' : 
           replyToContent.startsWith('data:video') ? '🎬 Video' : 
           replyToContent.startsWith('data:image') ? '📷 Photo' : 
           replyToContent.startsWith('LOC:') ? '📍 Location' : replyToContent}
        </p>
      </div>
    )
  );
  
  if (content.startsWith('data:image')) {
    return (
      <div 
        className={`flex ${isMe ? 'justify-end' : 'justify-start'} group mb-4 relative`}
        onMouseEnter={() => setShowOptions(true)}
        onMouseLeave={() => setShowOptions(false)}
      >
        <div className={`max-w-[80%] rounded-2xl p-1 shadow-lg relative ${isMe ? 'bg-purple-600' : 'bg-zinc-800'}`}>
          <ReplyPreview />
          <img src={content} alt="Shared media" className="rounded-xl max-w-full h-auto" />
          <div className="px-2 py-1 flex justify-end gap-1 opacity-60">
             <span className="text-[9px]">{new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
             {isMe && status === 'read' && <CheckCheck size={10} className="text-blue-300" />}
          </div>
          {showOptions && <OptionsMenu />}
        </div>
      </div>
    );
  }

  if (content.startsWith('data:video')) {
    return (
      <div 
        className={`flex ${isMe ? 'justify-end' : 'justify-start'} group mb-4 relative`}
        onMouseEnter={() => setShowOptions(true)}
        onMouseLeave={() => setShowOptions(false)}
      >
        <div className={`max-w-[80%] rounded-2xl p-1 shadow-lg relative ${isMe ? 'bg-purple-600' : 'bg-zinc-800'}`}>
          <ReplyPreview />
          <div className="relative overflow-hidden rounded-xl bg-black border border-white/5">
            <video 
              src={content} 
              controls 
              className="max-w-full h-auto max-h-[400px] block"
            />
          </div>
          <div className="px-2 py-1 flex justify-end gap-1 opacity-60">
             <span className="text-[9px]">{new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
             {isMe && status === 'read' && <CheckCheck size={10} className="text-blue-300" />}
          </div>
          {showOptions && <OptionsMenu />}
        </div>
      </div>
    );
  }

  if (content.startsWith('data:audio')) {
    return (
      <div 
        className={`flex ${isMe ? 'justify-end' : 'justify-start'} group mb-4 relative`}
        onMouseEnter={() => setShowOptions(true)}
        onMouseLeave={() => setShowOptions(false)}
      >
        <div className={`max-w-[80%] rounded-2xl p-3 shadow-lg relative ${isMe ? 'bg-purple-600' : 'bg-zinc-800'}`}>
          <ReplyPreview />
          <div className="flex items-center gap-3 bg-black/20 p-2 rounded-xl border border-white/5">
            <audio 
              src={content} 
              controls 
              className="w-full h-8 custom-audio"
            />
          </div>
          <div className="mt-2 flex justify-end gap-1 opacity-60">
             <span className="text-[9px]">{new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
             {isMe && status === 'read' && <CheckCheck size={10} className="text-blue-300" />}
          </div>
          {showOptions && <OptionsMenu />}
        </div>
      </div>
    );
  }

  if (content.startsWith('LOC:')) {
    const coords = content.replace('LOC:', '');
    return (
      <div 
        className={`flex ${isMe ? 'justify-end' : 'justify-start'} group mb-4 relative`}
        onMouseEnter={() => setShowOptions(true)}
        onMouseLeave={() => setShowOptions(false)}
      >
        <div className={`max-w-[80%] rounded-2xl shadow-lg overflow-hidden border border-white/5 relative ${isMe ? 'bg-purple-600' : 'bg-zinc-800'}`}>
          <ReplyPreview />
          <a 
            href={`https://www.google.com/maps?q=${coords}`}
            target="_blank"
            className="block"
          >
            <div className="w-48 h-24 bg-zinc-700/50 flex flex-col items-center justify-center gap-2 hover:bg-zinc-700 transition-colors">
              <MapPin className="text-white animate-bounce" size={24} />
              <span className="text-[10px] font-bold text-white/70 uppercase">Location Card</span>
            </div>
            <div className="px-3 py-2 bg-black/20 text-[9px] font-mono opacity-80">{coords}</div>
          </a>
          {showOptions && <OptionsMenu />}
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`flex ${isMe ? 'justify-end' : 'justify-start'} group mb-4 relative`}
      onMouseEnter={() => setShowOptions(true)}
      onMouseLeave={() => setShowOptions(false)}
    >
      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 shadow-lg relative ${isMe ? 'bg-purple-600 text-white rounded-tr-none' : 'bg-zinc-800 text-zinc-100 rounded-tl-none'}`}>
        <ReplyPreview />
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
        <div className={`flex items-center gap-1 mt-1 opacity-60 ${isMe ? 'justify-end' : 'justify-start'}`}>
          <span className="text-[9px]">{new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          {isMe && (
            <span>
              {status === 'read' ? <CheckCheck size={10} className="text-blue-300" /> : <Check size={10} />}
            </span>
          )}
        </div>
        {showOptions && <OptionsMenu />}
      </div>
    </div>
  );
}
