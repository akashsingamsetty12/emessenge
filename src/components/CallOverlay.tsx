'use client';

import { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Maximize2, Monitor, MonitorOff, Camera, Circle, StopCircle, Download, Tv } from 'lucide-react';
import { Theater } from './Theater';

interface CallOverlayProps {
  state: 'idle' | 'calling' | 'receiving' | 'active';
  isVideo: boolean;
  callerInfo: { username: string, profilePic?: string };
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  onAnswer: () => void;
  onDecline: () => void;
  onEnd: () => void;
  onToggleMic: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onSwitchCamera: () => void;
  onSendReaction: (emoji: string) => void;
  reactions: Array<{ id: string, emoji: string }>;
  ping: number;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  isTheaterOpen: boolean;
  isBackgroundBlurred: boolean;
  onToggleTheater: () => void;
  onToggleBlur: () => void;
  onTheaterSync: (data: any) => void;
  theaterSyncData: any;
}

export const CallOverlay = ({
  state,
  isVideo,
  callerInfo,
  localStream,
  remoteStreams,
  onAnswer,
  onDecline,
  onEnd,
  onToggleMic,
  onToggleVideo,
  onToggleScreenShare,
  onSwitchCamera,
  onSendReaction,
  reactions,
  ping,
  isMuted,
  isCameraOff,
  isScreenSharing,
  isTheaterOpen,
  isBackgroundBlurred,
  onToggleTheater,
  onToggleBlur,
  onTheaterSync,
  theaterSyncData
}: CallOverlayProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const startRecording = () => {
    const firstRemoteStream = Array.from(remoteStreams.values())[0];
    if (!firstRemoteStream && !localStream) return;
    
    // Combine streams if possible, or just record local/remote
    // For simplicity, we record the remote stream as it's the primary content
    const streamToRecord = firstRemoteStream || localStream;
    if (!streamToRecord) return;

    recordedChunksRef.current = [];
    
    let mimeType = 'video/webm;codecs=vp9,opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm;codecs=vp8,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }
    }

    const options = { mimeType };
    
    try {
      const recorder = new MediaRecorder(streamToRecord, options);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `call-record-${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }, 100);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (e) {
      console.error('Recording failed:', e);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [pipPosition, setPipPosition] = useState({ x: 24, y: 24 }); // Bottom-right offsets
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const isMobile = typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      console.log('[CallOverlay] Attaching local stream');
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(e => console.warn('Local play failed:', e));
    }
  }, [localStream]);

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setDragStart({
      x: clientX + pipPosition.x,
      y: clientY + pipPosition.y
    });
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      
      setPipPosition({
        x: dragStart.x - clientX,
        y: dragStart.y - clientY
      });
    };

    const handleUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
      window.addEventListener('touchmove', handleMove);
      window.addEventListener('touchend', handleUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [isDragging, dragStart]);

  if (state === 'idle') return null;

  const emojis = ['❤️', '😂', '🔥', '👏', '😮', '👍'];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 overflow-hidden bg-black/90 backdrop-blur-3xl animate-fade-in">
      {/* Background Decor */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] bg-gradient-to-br from-purple-900/20 via-black to-blue-900/20 blur-[120px] -z-10 animate-pulse"></div>

      {/* Floating Reactions Layer */}
      <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
        {reactions.map((r) => (
          <div key={r.id} className="absolute bottom-20 left-1/2 -translate-x-1/2 text-4xl animate-float-up">
            {r.emoji}
          </div>
        ))}
      </div>

      {/* Quality Indicator */}
      {state === 'active' && (
        <div className="absolute top-8 left-8 z-[110] flex items-center gap-2 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/10">
          <div className={`w-2 h-2 rounded-full ${ping < 100 ? 'bg-green-500' : ping < 200 ? 'bg-yellow-500' : 'bg-red-500'}`} />
          <span className="text-[10px] font-mono font-bold text-zinc-300 uppercase tracking-widest">{ping}ms</span>
        </div>
      )}

      <div className="relative w-full max-w-4xl h-full max-h-[800px] flex flex-col items-center justify-between">
        
        {/* Header / Remote View Grid / Theater */}
        <div className="flex-1 w-full relative rounded-[3rem] overflow-hidden bg-zinc-900/50 border border-white/5 shadow-2xl">
          {isTheaterOpen ? (
            <Theater onSync={onTheaterSync} syncData={theaterSyncData} />
          ) : state === 'active' && isVideo ? (
            <div className="relative w-full h-full">
              <div className={`video-grid grid gap-2 p-2 h-full w-full ${remoteStreams.size > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {Array.from(remoteStreams.entries()).map(([peerId, stream]) => (
                  <div key={peerId} className="relative w-full h-full rounded-2xl overflow-hidden bg-black">
                    <RemoteVideo stream={stream} />
                    <div className="absolute bottom-4 left-4 px-3 py-1 bg-black/40 backdrop-blur-md rounded-lg border border-white/10">
                      <span className="text-[10px] text-zinc-300 font-bold uppercase tracking-wider">{peerId.slice(-4)}</span>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Local Video PIP - Now Draggable */}
              <div 
                className={`local-video-pip shadow-2xl cursor-move touch-none ${isDragging ? 'scale-105 opacity-80' : ''}`}
                style={{ 
                  bottom: `${pipPosition.y}px`, 
                  right: `${pipPosition.x}px`,
                  transition: isDragging ? 'none' : 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                }}
                onMouseDown={handleMouseDown}
                onTouchStart={handleMouseDown}
              >
                <video 
                  ref={localVideoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className={`w-full h-full object-cover mirror bg-zinc-900 ${isBackgroundBlurred ? 'blur-md scale-110' : ''}`}
                />
                {isCameraOff && (
                   <div className="absolute inset-0 bg-zinc-800 flex items-center justify-center">
                    <VideoOff className="w-8 h-8 text-zinc-600" />
                   </div>
                )}
                <div className="absolute inset-0 border-2 border-white/10 pointer-events-none rounded-[1.25rem] md:rounded-[1.5rem]"></div>
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

        {/* Controls Container */}
        <div className="w-full max-w-fit mx-auto mb-6 md:mb-10 px-4 py-3 md:px-8 md:py-6 rounded-[2.5rem] glass-morphism flex items-center justify-center gap-2 md:gap-4 shadow-2xl border border-white/10 animate-scale-in overflow-x-auto no-scrollbar">
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
              {/* Reaction Menu */}
              <div className="flex items-center gap-1 md:gap-2 bg-white/5 p-1.5 md:p-2 rounded-2xl border border-white/5">
                {emojis.map(e => (
                  <button 
                    key={e}
                    onClick={() => onSendReaction(e)}
                    className="p-1.5 md:p-2 hover:bg-white/10 rounded-xl transition-all hover:scale-125 active:scale-90"
                  >
                    <span className="text-lg md:text-xl">{e}</span>
                  </button>
                ))}
              </div>

              <div className="w-[1px] h-8 bg-white/10 hidden sm:block mx-1" />

              <button 
                onClick={onToggleMic}
                className={`p-4 md:p-5 rounded-2xl transition-all hover:scale-110 active:scale-95 border ${isMuted ? 'bg-red-500/20 text-red-500 border-red-500/20' : 'bg-white/5 text-zinc-400 hover:text-white border-white/5 shadow-lg shadow-white/5'}`}
              >
                {isMuted ? <MicOff className="w-5 h-5 md:w-6 md:h-6" /> : <Mic className="w-5 h-5 md:w-6 md:h-6 animate-pulse" />}
              </button>
              
              {isVideo && (
                <>
                  <button 
                    onClick={onToggleVideo}
                    className={`p-4 md:p-5 rounded-2xl transition-all hover:scale-110 active:scale-95 border ${isCameraOff ? 'bg-red-500/20 text-red-500 border-red-500/20' : 'bg-white/5 text-zinc-400 hover:text-white border-white/5 shadow-lg shadow-white/5'}`}
                  >
                    {isCameraOff ? <VideoOff className="w-5 h-5 md:w-6 md:h-6" /> : <Video className="w-5 h-5 md:w-6 md:h-6 animate-pulse" />}
                  </button>

                  {!isMobile && (
                    <button 
                      onClick={onToggleScreenShare}
                      className={`p-4 md:p-5 rounded-2xl transition-all hover:scale-110 active:scale-95 border ${isScreenSharing ? 'bg-purple-500/20 text-purple-500 border-purple-500/40 shadow-lg shadow-purple-500/20' : 'bg-white/5 text-zinc-400 hover:text-white border-white/5'}`}
                    >
                      {isScreenSharing ? <MonitorOff className="w-5 h-5 md:w-6 md:h-6" /> : <Monitor className="w-5 h-5 md:w-6 md:h-6" />}
                    </button>
                  )}

                  <button 
                    onClick={onSwitchCamera}
                    className="p-4 md:p-5 rounded-2xl bg-white/5 text-zinc-400 hover:text-white border border-white/5 transition-all hover:scale-110 active:scale-95 shadow-lg shadow-white/5"
                    title="Switch Camera"
                  >
                    <Camera className="w-5 h-5 md:w-6 md:h-6" />
                  </button>

                  <button 
                    onClick={onToggleTheater}
                    className={`p-4 md:p-5 rounded-2xl transition-all hover:scale-110 active:scale-95 border ${isTheaterOpen ? 'bg-blue-500/20 text-blue-500 border-blue-500/20' : 'bg-white/5 text-zinc-400 hover:text-white border-white/5'}`}
                    title="Watch Together"
                  >
                    <Tv className="w-5 h-5 md:w-6 md:h-6" />
                  </button>

                  <button 
                    onClick={onToggleBlur}
                    className={`p-4 md:p-5 rounded-2xl transition-all hover:scale-110 active:scale-95 border ${isBackgroundBlurred ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/20' : 'bg-white/5 text-zinc-400 hover:text-white border-white/5'}`}
                    title="Blur Background"
                  >
                    <Maximize2 className="w-5 h-5 md:w-6 md:h-6" />
                  </button>

                  <button 
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`p-4 md:p-5 rounded-2xl transition-all hover:scale-110 active:scale-95 border ${isRecording ? 'bg-red-500/20 text-red-500 border-red-500/20' : 'bg-white/5 text-zinc-400 hover:text-white border-white/5'}`}
                    title={isRecording ? "Stop Recording" : "Start Recording"}
                  >
                    {isRecording ? <StopCircle className="w-5 h-5 md:w-6 md:h-6 animate-pulse" /> : <Circle className="w-5 h-5 md:w-6 md:h-6" />}
                  </button>
                </>
              )}

              <button 
                onClick={onEnd}
                className="p-5 md:p-6 rounded-3xl bg-red-600 hover:bg-red-500 text-white transition-all hover:scale-110 active:scale-95 shadow-xl shadow-red-600/20 group"
              >
                <PhoneOff className="w-6 h-6 md:w-8 md:h-8 group-hover:rotate-12 transition-transform" />
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
          object-fit: contain;
          background: #000;
        }
        .local-video-pip {
          position: absolute;
          bottom: 1.5rem;
          right: 1.5rem;
          width: 90px;
          height: 135px;
          border-radius: 1.25rem;
          overflow: hidden;
          box-shadow: 0 20px 40px rgba(0,0,0,0.4);
          border: 2px solid rgba(255,255,255,0.1);
          z-index: 10;
        }
        @media (min-width: 768px) {
          .local-video-pip {
            bottom: 2rem;
            right: 2rem;
            width: 140px;
            height: 210px;
            border-radius: 1.5rem;
          }
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .mirror {
          transform: scaleX(-1);
        }
        @keyframes float-up {
          0% { transform: translate(-50%, 0) scale(0.5); opacity: 0; }
          10% { opacity: 1; }
          100% { transform: translate(-50%, -400px) scale(1.5); opacity: 0; }
        }
        .animate-float-up {
          animation: float-up 3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

const RemoteVideo = ({ stream }: { stream: MediaStream }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  useEffect(() => {
    if (videoRef.current && stream) {
      console.log('[RemoteVideo] Attaching stream:', stream.id);
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(e => {
        console.warn('[RemoteVideo] Play failed, trying muted play:', e);
        // Fallback: Some browsers require muted for autoplay even if user interacted
        if (videoRef.current) {
          videoRef.current.muted = true;
          videoRef.current.play().catch(err => console.error('[RemoteVideo] Muted play also failed:', err));
        }
      });
    }
  }, [stream]);

  return (
    <video
      key={stream.id}
      ref={videoRef}
      autoPlay
      playsInline
      /* @ts-ignore */
      webkit-playsinline="true"
      muted={false}
      className="remote-video w-full h-full object-contain bg-black"
    />
  );
};
