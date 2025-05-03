// Polyfills for Node.js modules in the browser
import { Buffer } from 'buffer';

// Add Buffer to window
window.Buffer = Buffer;

// Add process.env
if (!window.process) {
  window.process = { env: {} } as any;
}

// Add global
window.global = window;

export { };

// Declare Buffer on Window
declare global {
  interface Window {
    Buffer: typeof Buffer;
    process: any;
    global: any;
  }
} 