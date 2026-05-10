'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw, Youtube } from 'lucide-react';

interface TheaterProps {
  onSync: (event: { type: string, time: number, url?: string }) => void;
  syncData: { type: string, time: number, url?: string } | null;
}

export const Theater = ({ onSync, syncData }: TheaterProps) => {
  const [url, setUrl] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (syncData && videoRef.current) {
      if (syncData.type === 'play') {
        videoRef.current.currentTime = syncData.time;
        videoRef.current.play();
        setIsPlaying(true);
      } else if (syncData.type === 'pause') {
        videoRef.current.currentTime = syncData.time;
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  }, [syncData]);

  const handlePlayPause = () => {
    if (!videoRef.current) return;
    const type = isPlaying ? 'pause' : 'play';
    const time = videoRef.current.currentTime;
    onSync({ type, time });
    
    if (isPlaying) videoRef.current.pause();
    else videoRef.current.play();
    setIsPlaying(!isPlaying);
  };

  const handleLoad = () => {
    if (url) {
      onSync({ type: 'load', time: 0, url });
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-black rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
      <div className="flex-1 relative group">
        {url ? (
          <video 
            ref={videoRef}
            src={url}
            className="w-full h-full object-contain"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-zinc-500">
            <Youtube className="w-16 h-16 opacity-20" />
            <p className="text-sm font-medium tracking-widest uppercase opacity-50">Theater Mode</p>
          </div>
        )}
        
        {url && (
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={handlePlayPause}
              className="p-3 bg-white text-black rounded-full hover:scale-110 transition-transform"
            >
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
            </button>
          </div>
        )}
      </div>

      <div className="p-4 bg-zinc-900/50 border-t border-white/5 flex gap-2">
        <input 
          type="text" 
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste Video URL..."
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-purple-500/50"
        />
        <button 
          onClick={handleLoad}
          className="px-4 py-2 bg-purple-600 rounded-xl text-sm font-bold hover:bg-purple-500 transition-colors"
        >
          Load
        </button>
      </div>
    </div>
  );
};
