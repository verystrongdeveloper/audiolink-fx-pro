# AudioLink FX Pro

Real-time audio effects processor with virtual cable routing and a hardware-inspired UI.

## Highlights

- Low-latency Web Audio graph (input gain, delay, reverb, master gain)
- Live spectrum visualizer + input/output meters
- Device routing for input/output selection
- Fully static build, ready for CDN hosting

## Tech Stack

- React + TypeScript (Vite)
- Web Audio API
- Tailwind CSS

## Local Setup

1. Install dependencies:
   `npm install`
2. Start dev server:
   `npm run dev`

## Build

`npm run build`

Output is generated in `dist/`.


## Notes

- The app requests microphone access for audio input.
- No server or external API calls are required.
