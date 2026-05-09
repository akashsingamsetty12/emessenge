'use client';

import { useState, useRef, useEffect } from 'react';
import { Paperclip, Send, MapPin, Smile, X, Reply } from 'lucide-react';

interface InputBoxProps {
  onSend: (content: string, type: 'text' | 'image' | 'location' | 'video' | 'audio', replyTo?: { id: string, content: string }) => void;
  onTyping: (isTyping: boolean) => void;
  replyingTo: { id: string, content: string } | null;
  onCancelReply: () => void;
}

export function InputBox({ onSend, onTyping, replyingTo, onCancelReply }: InputBoxProps) {
  const [text, setText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const emojis = ['😊', '😂', '❤️', '👍', '🔥', '✨', '🙌', '🎉', '😎', '🤔', '😢', '😍', '👋', '🙏', '💯', '🚀'];

  useEffect(() => {
    if (replyingTo) {
      inputRef.current?.focus();
    }
  }, [replyingTo]);

  const handleEmojiClick = (emoji: string) => {
    setText(prev => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const handleSend = () => {
    if (text.trim()) {
      onSend(text, 'text', replyingTo || undefined);
      setText('');
      onTyping(false);
      onCancelReply();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      let type: 'image' | 'video' | 'audio' = 'image';
      if (file.type.startsWith('video')) type = 'video';
      else if (file.type.startsWith('audio')) type = 'audio';
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        onSend(base64, type, replyingTo || undefined);
        onCancelReply();
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
        onSend(`LOC:${latitude},${longitude}`, 'location', replyingTo || undefined);
        onCancelReply();
      }, (err) => {
        console.error('Location error:', err);
        alert("Failed to get location: " + err.message);
      });
    } else {
      alert("Geolocation is not supported by your browser");
    }
  };

  return (
    <div className="glass-morphism sticky bottom-0 z-20 mx-4 mb-4 rounded-3xl overflow-hidden shadow-2xl border border-white/10 animate-fade-in">
      {replyingTo && (
        <div className="px-4 py-2 border-b border-white/5 bg-purple-500/10 animate-scale-in flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="text-purple-400">
              <Reply size={16} />
            </div>
            <div className="border-l-2 border-purple-500 pl-3 overflow-hidden">
              <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">Replying to</p>
              <p className="text-xs text-zinc-400 truncate italic">
                {replyingTo.content.startsWith('data:audio') ? '🎵 Audio' : (replyingTo.content.startsWith('data:video') ? '🎬 Video' : (replyingTo.content.startsWith('data:image') ? '📷 Photo' : (replyingTo.content.startsWith('LOC:') ? '📍 Location' : replyingTo.content)))}
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
      
      <div className="p-3 flex items-center gap-2">
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="p-3 text-zinc-400 hover:text-white hover:bg-white/5 rounded-2xl transition-all active:scale-90"
        >
          <Paperclip size={20} />
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*,video/*,audio/*"
          onChange={handleFileChange}
        />
        
        <div className="relative flex-1 flex items-center bg-black/40 rounded-2xl border border-white/5 focus-within:ring-2 focus-within:ring-purple-500/50 transition-all">
          {showEmojiPicker && (
            <div className="absolute bottom-full left-0 mb-4 p-3 bg-zinc-900/90 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-2xl grid grid-cols-4 gap-2 animate-scale-in z-50">
              {emojis.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => handleEmojiClick(emoji)}
                  className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-xl transition-all active:scale-90 text-xl"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
          <button 
            onClick={handleLocation}
            className="pl-4 pr-2 text-zinc-400 hover:text-purple-400 transition-all active:scale-90"
            title="Share Location"
          >
            <MapPin size={18} />
          </button>
          <input
            type="text"
            ref={inputRef}
            placeholder="Type a message..."
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              onTyping(e.target.value.length > 0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend();
              setShowEmojiPicker(false);
            }}
            onFocus={() => setShowEmojiPicker(false)}
            className="w-full bg-transparent text-white px-2 py-3 text-sm focus:outline-none"
          />
          <button 
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className={`pr-4 transition-colors ${showEmojiPicker ? 'text-purple-400' : 'text-zinc-500 hover:text-purple-400'}`}
          >
             <Smile size={18} />
          </button>
        </div>

        <button
          onClick={handleSend}
          disabled={!text.trim()}
          className="p-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl shadow-purple-500/20 disabled:opacity-50 disabled:grayscale"
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
}
