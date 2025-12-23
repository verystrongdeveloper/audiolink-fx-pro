import React, { useEffect, useRef } from 'react';
import { audioEngine } from '../services/audioEngine';

const Visualizer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const dataArray = new Uint8Array(128); // Frequency bin count

    const render = () => {
      audioEngine.getAnalyzerData(dataArray);

      // Clear
      ctx.fillStyle = '#0f172a'; // Match bg
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / dataArray.length) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < dataArray.length; i++) {
        barHeight = dataArray[i] / 2; // Scale down

        // Gradient color based on frequency
        const r = barHeight + 25 * (i / dataArray.length);
        const g = 250 * (i / dataArray.length);
        const b = 50;

        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationId);
  }, []);

  return (
    <div className="w-full h-32 bg-slate-900 rounded-lg border border-slate-700 overflow-hidden shadow-inner relative">
        <canvas 
            ref={canvasRef} 
            width={600} 
            height={128} 
            className="w-full h-full"
        />
        <div className="absolute top-2 left-2 text-xs text-slate-500 font-mono">
            FREQ ANALYSIS
        </div>
    </div>
  );
};

export default Visualizer;