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
          { urls: 'stun:global.stun.twilio.com:3478' },
        ],
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

  destroy() {
    this.peer?.destroy();
  }
}
