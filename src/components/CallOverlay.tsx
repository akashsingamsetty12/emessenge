'use client';

import { useEffect, useRef } from 'react';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Maximize2 } from 'lucide-react';

interface CallOverlayProps {
  state: 'idle' | 'calling' | 'receiving' | 'active';
  isVideo: boolean;
  callerInfo: { username: string, profilePic?: string };
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onAnswer: () => void;
  onDecline: () => void;
  onEnd: () => void;
  onToggleMic: () => void;
  onToggleVideo: () => void;
  isMuted: boolean;
  isCameraOff: boolean;
}

export const CallOverlay = ({
  state,
  isVideo,
  callerInfo,
  localStream,
  remoteStream,
  onAnswer,
  onDecline,
  onEnd,
  onToggleMic,
  onToggleVideo,
  isMuted,
  isCameraOff
}: CallOverlayProps) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(e => console.warn('Local play failed:', e));
    }
  }, [localStream, state]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      console.log('[Call] Attaching remote stream to video element...');
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(e => console.warn('Remote play failed:', e));
    }
  }, [remoteStream, state]);

  if (state === 'idle') return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 overflow-hidden bg-black/90 backdrop-blur-3xl animate-fade-in">
      {/* Background Decor */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] bg-gradient-to-br from-purple-900/20 via-black to-blue-900/20 blur-[120px] -z-10 animate-pulse"></div>

      <div className="relative w-full max-w-4xl h-full max-h-[800px] flex flex-col items-center justify-between">
        
        {/* Header / Remote View */}
        <div className="flex-1 w-full relative rounded-[3rem] overflow-hidden bg-zinc-900/50 border border-white/5 shadow-2xl">
          {state === 'active' && isVideo ? (
            <div className="video-grid">
              <video 
                ref={remoteVideoRef} 
                autoPlay 
                playsInline 
                className="remote-video"
              />
              <div className="local-video-pip">
                <video 
                  ref={localVideoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className="w-full h-full object-cover mirror"
                />
                {isCameraOff && (
                   <div className="absolute inset-0 bg-zinc-800 flex items-center justify-center">
                    <VideoOff className="w-8 h-8 text-zinc-600" />
                   </div>
                )}
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className={`relative ${state === 'receiving' ? 'pulse-ring' : ''}`}>
                <div className="w-32 h-32 md:w-48 md:h-48 rounded-[3rem] bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-5xl md:text-7xl font-bold shadow-2xl border-4 border-white/10 overflow-hidden">
                  {callerInfo.profilePic ? (
                    <img src={callerInfo.profilePic} className="w-full h-full object-cover" />
                  ) : (
                    callerInfo.username[0].toUpperCase()
                  )}
                </div>
              </div>
              <h2 className="mt-8 text-3xl md:text-5xl font-black text-white tracking-tight">{callerInfo.username}</h2>
              <p className="mt-4 text-purple-400 font-mono tracking-[0.3em] uppercase text-sm animate-pulse">
                {state === 'calling' ? 'Calling...' : state === 'receiving' ? 'Incoming Call' : 'Active Call'}
              </p>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="mt-8 px-8 py-6 rounded-[2.5rem] glass-morphism flex items-center gap-6 md:gap-12 shadow-2xl border border-white/10 animate-scale-in">
          {state === 'receiving' ? (
            <>
              <button 
                onClick={onDecline}
                className="p-6 rounded-3xl bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-all hover:scale-110 active:scale-95 group"
              >
                <PhoneOff className="w-8 h-8 group-hover:rotate-12 transition-transform" />
              </button>
              <button 
                onClick={onAnswer}
                className="p-6 rounded-3xl bg-green-500 hover:bg-green-400 text-black transition-all hover:scale-110 active:scale-95 shadow-lg shadow-green-500/20 group"
              >
                <Phone className="w-8 h-8 animate-bounce group-hover:rotate-12 transition-transform" />
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={onToggleMic}
                className={`p-5 rounded-2xl transition-all hover:scale-110 active:scale-95 ${isMuted ? 'bg-red-500/20 text-red-500' : 'bg-white/5 text-zinc-400 hover:text-white'}`}
              >
                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>
              
              {isVideo && (
                <button 
                  onClick={onToggleVideo}
                  className={`p-5 rounded-2xl transition-all hover:scale-110 active:scale-95 ${isCameraOff ? 'bg-red-500/20 text-red-500' : 'bg-white/5 text-zinc-400 hover:text-white'}`}
                >
                  {isCameraOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                </button>
              )}

              <button 
                onClick={onEnd}
                className="p-6 rounded-3xl bg-red-600 hover:bg-red-500 text-white transition-all hover:scale-110 active:scale-95 shadow-xl shadow-red-600/20 group"
              >
                <PhoneOff className="w-8 h-8 group-hover:rotate-12 transition-transform" />
              </button>

              <button className="p-5 rounded-2xl bg-white/5 text-zinc-400 hover:text-white transition-all hover:scale-110 active:scale-95">
                <Maximize2 className="w-6 h-6" />
              </button>
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        .video-grid {
          position: absolute;
          inset: 0;
          background: #000;
        }
        .remote-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .local-video-pip {
          position: absolute;
          bottom: 2rem;
          right: 2rem;
          width: 120px;
          height: 180px;
          border-radius: 1.5rem;
          overflow: hidden;
          box-shadow: 0 20px 40px rgba(0,0,0,0.4);
          border: 2px solid rgba(255,255,255,0.1);
          z-index: 10;
        }
        .mirror {
          transform: scaleX(-1);
        }
      `}</style>
    </div>
  );
};
