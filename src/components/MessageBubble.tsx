'use client';

import { useState, useRef } from 'react';
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
  const [isFullscreen, setIsFullscreen] = useState(false);

  const OptionsMenu = () => (
    <div className={`absolute top-0 ${isMe ? 'right-full mr-2' : 'left-full ml-2'} flex flex-col gap-2 z-50 animate-scale-in`}>
      <div className="bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-2 shadow-2xl min-w-[160px]">
        {/* Reactions */}
        <div className="flex items-center justify-around pb-2 border-b border-white/5 mb-2 px-1">
          {['❤️', '😂', '😮', '😢', '🔥'].map(emoji => (
            <button key={emoji} className="hover:scale-125 transition-transform text-sm active:scale-90">{emoji}</button>
          ))}
        </div>
        
        <div className="space-y-1">
          <button 
            onClick={() => { onReply(id, content); setShowOptions(false); }}
            className="w-full flex items-center gap-3 px-3 py-2 text-[11px] text-zinc-300 hover:bg-white/5 rounded-xl transition-colors text-left"
          >
            <Reply size={14} className="text-purple-400" /> Reply
          </button>
          
          <button 
            onClick={() => {
              setShowOptions(false);
              if (navigator.share) {
                navigator.share({ text: content }).catch(() => {});
              } else {
                alert('Sharing not supported on this browser');
              }
            }}
            className="w-full flex items-center gap-3 px-3 py-2 text-[11px] text-zinc-300 hover:bg-white/5 rounded-xl transition-colors text-left"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
            Share
          </button>

          <button 
            onClick={() => {
              setShowOptions(false);
              alert(`Sent: ${new Date(timestamp).toLocaleString()}\nStatus: ${status || 'Sent'}`);
            }}
            className="w-full flex items-center gap-3 px-3 py-2 text-[11px] text-zinc-300 hover:bg-white/5 rounded-xl transition-colors text-left"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            Info
          </button>
          
          {(content.startsWith('data:image') || content.startsWith('data:video') || content.startsWith('data:audio')) && (
            <button 
              onClick={() => {
                const link = document.createElement('a');
                link.href = content;
                const extension = content.split(';')[0].split('/')[1];
                link.download = `emessage_${Date.now()}.${extension}`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setShowOptions(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-[11px] text-green-400 hover:bg-green-500/10 rounded-xl transition-colors text-left"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download
            </button>
          )}

          <div className="h-px bg-white/5 my-1" />

          <button 
            onClick={() => { onDelete(id, 'me'); setShowOptions(false); }} 
            className="w-full flex items-center gap-3 px-3 py-2 text-[11px] text-red-400 hover:bg-red-500/10 rounded-xl transition-colors text-left"
          >
            <Trash2 size={14} /> Delete for me
          </button>
          
          <button 
            onClick={() => { onDelete(id, 'everyone'); setShowOptions(false); }} 
            className="w-full flex items-center gap-3 px-3 py-2 text-[11px] text-red-400 hover:bg-red-500/10 rounded-xl transition-colors font-bold text-left"
          >
            <Trash2 size={14} /> Delete for everyone
          </button>
        </div>
      </div>
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
        className={`flex ${isMe ? 'justify-end' : 'justify-start'} group mb-4 relative animate-scale-in`}
      >
        <div className={`max-w-[80%] rounded-2xl p-1 shadow-2xl relative chat-bubble-shadow ${isMe ? 'bg-purple-600' : 'bg-zinc-800'}`}>
          <ReplyPreview />
          <div 
            onClick={() => setIsFullscreen(true)}
            className="w-48 h-48 rounded-xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
          >
            <img src={content} alt="Shared" className="w-full h-full object-cover" />
          </div>
          <div className="px-2 py-1 flex justify-end items-center gap-2 opacity-60">
             <span className="text-[9px]">{new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
             {isMe && status === 'read' && <CheckCheck size={10} className="text-blue-300" />}
             <button 
               onClick={() => setShowOptions(!showOptions)}
               className="p-1 hover:bg-white/10 rounded-lg transition-colors"
             >
               <MoreHorizontal size={12} />
             </button>
          </div>
          {showOptions && <OptionsMenu />}
        </div>

        {isFullscreen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-fade-in">
            <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={() => setIsFullscreen(false)}></div>
            <img src={content} className="relative max-w-full max-h-full rounded-2xl shadow-2xl animate-scale-in" />
            <button 
              onClick={() => setIsFullscreen(false)}
              className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        )}
      </div>
    );
  }

  if (content.startsWith('data:video')) {
    return (
      <div 
        className={`flex ${isMe ? 'justify-end' : 'justify-start'} group mb-4 relative animate-scale-in`}
      >
        <div className={`max-w-[80%] rounded-2xl p-1 shadow-2xl relative chat-bubble-shadow ${isMe ? 'bg-purple-600' : 'bg-zinc-800'}`}>
          <ReplyPreview />
          <div 
            onClick={() => setIsFullscreen(true)}
            className="w-48 h-48 rounded-xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity bg-black relative group"
          >
            <video src={content} className="w-full h-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-all">
              <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-full flex items-center justify-center text-white border border-white/20">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </div>
            </div>
          </div>
          <div className="px-2 py-1 flex justify-end items-center gap-2 opacity-60">
             <span className="text-[9px]">{new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
             {isMe && status === 'read' && <CheckCheck size={10} className="text-blue-300" />}
             <button 
               onClick={() => setShowOptions(!showOptions)}
               className="p-1 hover:bg-white/10 rounded-lg transition-colors"
             >
               <MoreHorizontal size={12} />
             </button>
          </div>
          {showOptions && <OptionsMenu />}
        </div>

        {isFullscreen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-fade-in">
            <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={() => setIsFullscreen(false)}></div>
            <video 
              src={content} 
              controls 
              autoPlay
              className="relative max-w-full max-h-full rounded-2xl shadow-2xl animate-scale-in" 
            />
            <button 
              onClick={() => setIsFullscreen(false)}
              className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        )}
      </div>
    );
  }

  if (content.startsWith('data:audio')) {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);

    const togglePlay = () => {
      if (audioRef.current) {
        if (isPlaying) audioRef.current.pause();
        else audioRef.current.play();
        setIsPlaying(!isPlaying);
      }
    };

    return (
      <div 
        className={`flex ${isMe ? 'justify-end' : 'justify-start'} group mb-4 relative animate-scale-in`}
      >
        <div className={`max-w-[85%] rounded-2xl p-3 shadow-2xl relative chat-bubble-shadow ${isMe ? 'bg-indigo-600' : 'bg-zinc-800'}`}>
          <ReplyPreview />
          <div className="flex items-center gap-4 min-w-[200px]">
            <button 
              onClick={togglePlay}
              className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-all active:scale-90 flex-shrink-0"
            >
              {isPlaying ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="m7 3 14 9-14 9z"/></svg>
              )}
            </button>
            
            <div className="flex-1 flex flex-col gap-1">
              <div className="flex items-baseline gap-1">
                {[...Array(20)].map((_, i) => (
                  <div 
                    key={i} 
                    className={`w-0.5 rounded-full transition-all duration-300 ${isMe ? 'bg-white/40' : 'bg-zinc-500'}`}
                    style={{ 
                      height: `${10 + Math.sin(i * 0.8) * 10 + Math.random() * 5}px`,
                      animation: isPlaying ? `wave 1s ease-in-out infinite ${i * 0.05}s` : 'none'
                    }}
                  />
                ))}
              </div>
              <p className={`text-[9px] uppercase tracking-[0.2em] font-bold ${isMe ? 'text-indigo-200' : 'text-zinc-500'}`}>
                Voice Message
              </p>
            </div>

            <audio 
              ref={audioRef}
              src={content} 
              onEnded={() => setIsPlaying(false)}
              className="hidden"
            />
          </div>
          
          <div className="mt-2 flex justify-end items-center gap-2 opacity-60">
             <span className="text-[9px]">{new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
             {isMe && status === 'read' && <CheckCheck size={10} className="text-blue-300" />}
             <button 
               onClick={() => setShowOptions(!showOptions)}
               className="p-1 hover:bg-white/10 rounded-lg transition-colors"
             >
               <MoreHorizontal size={12} />
             </button>
          </div>
          {showOptions && <OptionsMenu />}
        </div>
        
        <style jsx>{`
          @keyframes wave {
            0%, 100% { transform: scaleY(1); }
            50% { transform: scaleY(1.5); }
          }
        `}</style>
      </div>
    );
  }

  if (content.startsWith('LOC:')) {
    const coords = content.replace('LOC:', '');
    return (
      <div 
        className={`flex ${isMe ? 'justify-end' : 'justify-start'} group mb-4 relative animate-scale-in`}
      >
        <div className={`max-w-[80%] rounded-2xl shadow-2xl overflow-hidden border border-white/5 relative chat-bubble-shadow ${isMe ? 'bg-purple-600' : 'bg-zinc-800'}`}>
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
      className={`flex ${isMe ? 'justify-end' : 'justify-start'} group mb-4 relative animate-scale-in`}
    >
      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 shadow-2xl relative chat-bubble-shadow ${isMe ? 'bg-purple-600 text-white rounded-tr-none' : 'bg-zinc-800 text-zinc-100 rounded-tl-none'}`}>
        <ReplyPreview />
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
        <div className={`flex items-center gap-2 mt-1 opacity-60 ${isMe ? 'justify-end' : 'justify-start'}`}>
          <span className="text-[9px]">{new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          {isMe && (
            <span>
              {status === 'read' ? <CheckCheck size={10} className="text-blue-300" /> : <Check size={10} />}
            </span>
          )}
          <button 
            onClick={() => setShowOptions(!showOptions)}
            className="p-1 hover:bg-white/10 rounded-lg transition-colors"
          >
            <MoreHorizontal size={12} />
          </button>
        </div>
        {showOptions && <OptionsMenu />}
      </div>
    </div>
  );
}
