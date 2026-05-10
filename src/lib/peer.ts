import Peer from 'simple-peer';

export interface PeerOptions {
  initiator: boolean;
  stream?: MediaStream;
  onSignal: (data: any) => void;
  onConnect: () => void;
  onData: (data: any) => void;
  onError: (err: Error) => void;
  onStream?: (stream: MediaStream) => void;
}

export class PeerConnection {
  private peer: Peer.Instance | null = null;

  constructor(options: PeerOptions) {
    if (typeof window === 'undefined') return;

    this.peer = new Peer({
      initiator: options.initiator,
      trickle: true,
      stream: options.stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' },
          // Add your TURN servers here for 100% reliability on 4G/5G
          {
            urls: [
              'turn:global.metered.ca:80',
              'turn:global.metered.ca:443',
              'turn:global.metered.ca:443?transport=tcp'
            ],
            username: '51412f469359e1c54d55847c',
            credential: 'cEg67J6jpgvUA+pH'
          }
        ],
        iceCandidatePoolSize: 10,
      },
    });

    this.peer.on('signal', options.onSignal);
    this.peer.on('connect', options.onConnect);
    this.peer.on('data', options.onData);
    this.peer.on('error', options.onError);
    if (options.onStream) {
      this.peer.on('stream', options.onStream);
    }
  }

  signal(data: any) {
    this.peer?.signal(data);
  }

  send(data: string) {
    if (this.peer && this.peer.connected) {
      try {
        this.peer.send(data);
      } catch (e) {
        console.warn('Failed to send data:', e);
      }
    }
  }

  get isConnected() {
    return this.peer?.connected || false;
  }

  get isDestroyed() {
    return this.peer?.destroyed || false;
  }

  replaceTrack(oldTrack: MediaStreamTrack, newTrack: MediaStreamTrack, stream: MediaStream) {
    if (this.peer) {
      this.peer.replaceTrack(oldTrack, newTrack, stream);
    }
  }

  async getStats() {
    if (this.peer && (this.peer as any)._pc) {
      const pc = (this.peer as any)._pc as RTCPeerConnection;
      const stats = await pc.getStats();
      let ping = 0;
      stats.forEach(report => {
        if (report.type === 'remote-candidate' && report.roundTripTime) {
          ping = report.roundTripTime * 1000;
        }
      });
      return { ping: Math.round(ping) };
    }
    return { ping: 0 };
  }

  destroy() {
    this.peer?.destroy();
  }
}
