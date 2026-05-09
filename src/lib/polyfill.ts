import { Buffer } from 'buffer';

if (typeof window !== 'undefined') {
  window.Buffer = window.Buffer || Buffer;
  window.process = window.process || { nextTick: (cb: any) => setTimeout(cb, 0), env: {} };
}
