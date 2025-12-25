import React, { useState, useEffect, useRef } from 'react';

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
  format?: (val: number) => string;
  color?: string;
}

const Knob: React.FC<KnobProps> = ({ label, value, min, max, onChange, format, color = '#3b82f6' }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  
  const knobRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number>(0);
  const startValue = useRef<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // SVG Configuration
  const size = 100;
  const center = size / 2;
  const strokeWidth = 8;
  const radius = 38; // Adjusted to prevent clipping (100/2 - stroke/2 - padding)
  const circumference = 2 * Math.PI * radius;
  
  // Angle logic: 135 degrees start to 405 degrees end (270 degree range)
  const percentage = (value - min) / (max - min);
  const offset = circumference - percentage * circumference * 0.75; 

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isEditing) return; // Don't drag if editing
    setIsDragging(true);
    startY.current = e.clientY;
    startValue.current = value;
    document.body.style.cursor = 'ns-resize';
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isEditing) return;
    setIsDragging(true);
    startY.current = e.touches[0].clientY;
    startValue.current = value;
  };

  useEffect(() => {
    const handleMove = (clientY: number) => {
      if (!isDragging) return;
      
      const deltaY = startY.current - clientY;
      const range = max - min;
      // Sensitivity factor
      const change = (deltaY / 200) * range;
      
      let newValue = startValue.current + change;
      newValue = Math.max(min, Math.min(max, newValue));
      
      onChange(newValue);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      handleMove(e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;
      // Prevent scrolling while adjusting knob
      if (e.cancelable) e.preventDefault();
      handleMove(e.touches[0].clientY);
    };

    const handleEnd = () => {
      setIsDragging(false);
      document.body.style.cursor = 'default';
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove, { passive: false });
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, max, min, onChange]);

  // Input Handling
  const startEditing = () => {
    setIsEditing(true);
    setInputValue(value.toFixed(2)); // Precise value for editing
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commitEdit = () => {
    setIsEditing(false);
    let parsed = parseFloat(inputValue);
    if (!isNaN(parsed)) {
      parsed = Math.max(min, Math.min(max, parsed));
      onChange(parsed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') setIsEditing(false);
  };

  // Generate tick marks
  const ticks = [];
  const totalTicks = 20;
  for (let i = 0; i <= totalTicks; i++) {
    const angle = 135 + (i / totalTicks) * 270;
    const radians = (angle * Math.PI) / 180;
    const isLit = (i / totalTicks) <= percentage;
    
    // Outer radius for ticks
    const r1 = 48; 
    const r2 = 54;
    
    const x1 = center + r1 * Math.cos(radians);
    const y1 = center + r1 * Math.sin(radians);
    const x2 = center + r2 * Math.cos(radians);
    const y2 = center + r2 * Math.sin(radians);

    ticks.push(
      <line
        key={i}
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={isLit ? color : '#1e293b'}
        strokeWidth={2}
        strokeLinecap="round"
        className="transition-colors duration-100"
      />
    );
  }

  return (
    <div className="flex flex-col items-center justify-center space-y-3 select-none group relative">
      <div 
        ref={knobRef}
        className="relative w-24 h-24 cursor-ns-resize touch-none"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <svg 
          width="100%" 
          height="100%" 
          viewBox={`0 0 ${size} ${size}`} 
          className="filter drop-shadow-lg"
        >
          {/* Ticks */}
          {ticks}

          {/* Background Track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke="#0f172a"
            strokeWidth={strokeWidth}
            fill="#1e293b"
            fillOpacity="0.5"
            strokeLinecap="round"
            transform={`rotate(135 ${center} ${center})`}
            strokeDasharray={circumference * 0.75} 
            strokeDashoffset={0}
          />
          
          {/* Progress Arc */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeLinecap="round"
            transform={`rotate(135 ${center} ${center})`}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-75"
            style={{ filter: `drop-shadow(0 0 6px ${color}80)` }}
          />
        </svg>

        {/* Center Display / Input */}
        <div className="absolute inset-0 flex items-center justify-center">
           {isEditing ? (
             <input
                ref={inputRef}
                type="number"
                step="0.01"
                className="w-16 bg-slate-900 text-center text-xs font-mono text-white border border-blue-500 rounded focus:outline-none shadow-lg z-50"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={handleKeyDown}
             />
           ) : (
             <div 
               className="group-hover:scale-110 transition-transform cursor-text flex flex-col items-center justify-center w-12 h-12 rounded-full hover:bg-white/5"
               onClick={(e) => { e.stopPropagation(); startEditing(); }}
               title="Click to edit value"
             >
               <span className="text-[10px] font-mono font-bold text-slate-200 drop-shadow-md">
                {format ? format(value) : value.toFixed(1)}
               </span>
             </div>
           )}
        </div>
      </div>

      <span className="text-[10px] text-slate-400 font-tech font-bold tracking-[0.15em] uppercase group-hover:text-slate-200 transition-colors">
        {label}
      </span>
    </div>
  );
};

export default Knob;
