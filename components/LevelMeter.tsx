import React from 'react';

interface LevelMeterProps {
  level: number; // 0 to 1
  label: string;
}

const LevelMeter: React.FC<LevelMeterProps> = ({ level, label }) => {
  const segments = 15;
  const activeSegments = Math.floor(level * segments);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-3 h-24 bg-slate-900 rounded-sm overflow-hidden flex flex-col-reverse p-0.5 gap-0.5 border border-slate-700">
        {Array.from({ length: segments }).map((_, i) => {
          let colorClass = "bg-green-500/20";
          if (i < activeSegments) {
            if (i > segments * 0.8) colorClass = "bg-red-500 shadow-[0_0_5px_red]";
            else if (i > segments * 0.6) colorClass = "bg-yellow-500 shadow-[0_0_5px_yellow]";
            else colorClass = "bg-green-500 shadow-[0_0_5px_green]";
          }
          return <div key={i} className={`flex-1 w-full rounded-sm transition-all duration-75 ${colorClass}`} />;
        })}
      </div>
      <span className="text-[9px] font-bold text-slate-500">{label}</span>
    </div>
  );
};

export default LevelMeter;