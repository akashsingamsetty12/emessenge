'use client';

import { useState, useRef, useEffect } from 'react';
import { Paperclip, Send, MapPin, Smile, X, Reply } from 'lucide-react';

interface InputBoxProps {
  onSend: (content: string, replyTo?: { id: string, content: string }) => void;
  onTyping: (isTyping: boolean) => void;
  replyingTo: { id: string, content: string } | null;
  onCancelReply: () => void;
}

export function InputBox({ onSend, onTyping, replyingTo, onCancelReply }: InputBoxProps) {
  const [text, setText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (replyingTo) {
      inputRef.current?.focus();
    }
  }, [replyingTo]);

  const handleSend = () => {
    if (text.trim()) {
      onSend(text, replyingTo || undefined);
      setText('');
      onTyping(false);
      onCancelReply();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        onSend(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLocation = () => {
    if ("geolocation" in navigator) {
      console.log('Fetching location...');
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        console.log(`Location found: ${latitude}, ${longitude}`);
        onSend(`LOC:${latitude},${longitude}`);
      }, (err) => {
        console.error('Location error:', err);
        alert("Failed to get location: " + err.message);
      });
    } else {
      alert("Geolocation is not supported by your browser");
    }
  };

  return (
    <div className="bg-zinc-900/30 backdrop-blur-xl border-t border-white/5 sticky bottom-0 z-20">
      {replyingTo && (
        <div className="max-w-4xl mx-auto px-4 py-2 border-b border-white/5 bg-purple-500/5 animate-in slide-in-from-bottom-2 duration-300 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="text-purple-400">
              <Reply size={16} />
            </div>
            <div className="border-l-2 border-purple-500 pl-3 overflow-hidden">
              <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">Replying to</p>
              <p className="text-xs text-zinc-400 truncate italic">
                {replyingTo.content.startsWith('data:image') ? '📷 Photo' : (replyingTo.content.startsWith('LOC:') ? '📍 Location' : replyingTo.content)}
              </p>
            </div>
          </div>
          <button 
            onClick={onCancelReply}
            className="p-1 hover:bg-white/10 rounded-full text-zinc-500 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      )}
      
      <div className="p-4 flex items-center gap-2 max-w-4xl mx-auto">
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="p-3 text-zinc-400 hover:text-white hover:bg-white/5 rounded-2xl transition-all"
        >
          <Paperclip size={20} />
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*"
          onChange={handleFileChange}
        />
        
        <div className="relative flex-1 flex items-center bg-black/50 rounded-2xl border border-white/5 focus-within:ring-2 focus-within:ring-purple-500/50 transition-all">
          <button 
            onClick={handleLocation}
            className="pl-4 pr-2 text-zinc-400 hover:text-purple-400 transition-all"
            title="Share Location"
          >
            <MapPin size={18} />
          </button>
          <input
            type="text"
            ref={inputRef}
            placeholder="Message..."
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              onTyping(e.target.value.length > 0);
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            className="w-full bg-transparent text-white px-2 py-3.5 text-sm focus:outline-none"
          />
          <button className="pr-4 text-zinc-500 hover:text-purple-400">
             <Smile size={18} />
          </button>
        </div>

        <button
          onClick={handleSend}
          disabled={!text.trim()}
          className="p-3.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-purple-500/20 disabled:opacity-50 disabled:grayscale"
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
}
