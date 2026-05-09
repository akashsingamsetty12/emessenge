'use client';

import { useState } from 'react';
import { UserX, Users, Check, CheckCheck, MapPin } from 'lucide-react';

interface MessageBubbleProps {
  id: string;
  content: string;
  isMe: boolean;
  timestamp: number;
  status?: 'sent' | 'delivered' | 'read';
  onDelete: (id: string, mode: 'me' | 'everyone') => void;
}

export function MessageBubble({ id, content, isMe, timestamp, status, onDelete }: MessageBubbleProps) {
  const [showOptions, setShowOptions] = useState(false);
  
  if (content.startsWith('data:image')) {
    return (
      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} group mb-4 relative`}>
        <div className={`max-w-[80%] rounded-2xl p-1 shadow-lg ${isMe ? 'bg-purple-600' : 'bg-zinc-800'}`}>
          <img src={content} alt="Shared media" className="rounded-xl max-w-full h-auto" />
          <div className="px-2 py-1 flex justify-end gap-1 opacity-60">
             <span className="text-[9px]">{new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
             {isMe && status === 'read' && <CheckCheck size={10} className="text-blue-300" />}
          </div>
        </div>
      </div>
    );
  }

  if (content.startsWith('LOC:')) {
    const coords = content.replace('LOC:', '');
    return (
      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} group mb-4 relative`}>
        <a 
          href={`https://www.google.com/maps?q=${coords}`}
          target="_blank"
          className={`max-w-[80%] rounded-2xl shadow-lg overflow-hidden border border-white/5 ${isMe ? 'bg-purple-600' : 'bg-zinc-800'}`}
        >
          <div className="w-48 h-24 bg-zinc-700/50 flex flex-col items-center justify-center gap-2">
            <MapPin className="text-white animate-bounce" size={24} />
            <span className="text-[10px] font-bold text-white/70 uppercase">Location Card</span>
          </div>
          <div className="px-3 py-2 bg-black/20 text-[9px] font-mono opacity-80">{coords}</div>
        </a>
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
        <p className="text-sm leading-relaxed">{content}</p>
        <div className={`flex items-center gap-1 mt-1 opacity-60 ${isMe ? 'justify-end' : 'justify-start'}`}>
          <span className="text-[9px]">{new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          {isMe && (
            <span>
              {status === 'read' ? <CheckCheck size={10} className="text-blue-300" /> : <Check size={10} />}
            </span>
          )}
        </div>
        {showOptions && (
          <div className={`absolute top-0 ${isMe ? '-left-24' : '-right-24'} flex flex-col gap-1 z-10`}>
            <button onClick={() => onDelete(id, 'me')} className="px-2 py-1 bg-zinc-900 text-[10px] rounded border border-white/10">Delete for me</button>
            {isMe && <button onClick={() => onDelete(id, 'everyone')} className="px-2 py-1 bg-red-900 text-[10px] rounded border border-white/10">Delete for everyone</button>}
          </div>
        )}
      </div>
    </div>
  );
}
