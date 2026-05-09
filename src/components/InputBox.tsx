'use client';

import { useState, useRef } from 'react';
import { Paperclip, Send, MapPin, Smile } from 'lucide-react';

interface InputBoxProps {
  onSend: (content: string) => void;
  onTyping: (isTyping: boolean) => void;
}

export function InputBox({ onSend, onTyping }: InputBoxProps) {
  const [text, setText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (text.trim()) {
      onSend(text);
      setText('');
      onTyping(false);
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
    <div className="p-4 bg-zinc-900/30 backdrop-blur-xl border-t border-white/5 sticky bottom-0">
      <div className="flex items-center gap-2 max-w-4xl mx-auto">
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
