import React, { useState, useEffect, useCallback } from 'react';
import { AudioDevice, EffectParams } from './types';
import { audioEngine } from './services/audioEngine';
import Knob from './components/Knob';
import Visualizer from './components/Visualizer';
import LevelMeter from './components/LevelMeter';

const DEFAULT_PARAMS: EffectParams = {
  inputGain: 1.0,
  masterGain: 1.0,
  reverbMix: 0.0,
  reverbDecay: 2.0,
  delayTime: 0.3,
  delayFeedback: 0.3,
  delayMix: 0.0,
  isMuted: false
};

// Decorative Screw Component
const Screw: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`absolute w-3 h-3 rounded-full bg-slate-700 border border-slate-900 flex items-center justify-center screw-head ${className}`}>
    <div className="w-full h-0.5 bg-slate-900 transform rotate-45"></div>
    <div className="absolute w-full h-0.5 bg-slate-900 transform -rotate-45"></div>
  </div>
);

type LangCode = 'ko' | 'en' | 'ja';

const TROUBLESHOOTING_TEXT = {
  ko: {
    title: "문제 해결 가이드",
    steps: [
      <>윈도우 입력 형식: <b>48000Hz (필수)</b></>,
      <>디스코드 입력 감도: <b>수동 (낮게)</b></>,
      <>디스코드 노이즈 제거: <b>전부 OFF</b></>,
      <>출력 장치(OUT): <b>VB-Audio Cable 권장</b></>
    ]
  },
  en: {
    title: "TROUBLESHOOTING",
    steps: [
      <>Win Input Format: <b>48000Hz (Req)</b></>,
      <>Discord Input Sens: <b>Manual (Low)</b></>,
      <>Discord Noise Supp: <b>All OFF</b></>,
      <>Output Device: <b>VB-Audio Cable Rec.</b></>
    ]
  },
  ja: {
    title: "トラブルシューティング",
    steps: [
      <>Win入力形式: <b>48000Hz (必須)</b></>,
      <>Discord入力感度: <b>手動 (低め)</b></>,
      <>Discordノイズ除去: <b>すべてOFF</b></>,
      <>出力デバイス: <b>VB-Audio Cable 推奨</b></>
    ]
  }
};

const App: React.FC = () => {
  const [engineStarted, setEngineStarted] = useState(false);
  const [inputs, setInputs] = useState<AudioDevice[]>([]);
  const [outputs, setOutputs] = useState<AudioDevice[]>([]);
  
  const [selectedInput, setSelectedInput] = useState<string>('');
  const [selectedOutput, setSelectedOutput] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [levels, setLevels] = useState({ input: 0, output: 0 });
  const [params, setParams] = useState<EffectParams>(DEFAULT_PARAMS);
  const [lang, setLang] = useState<LangCode>('ko');

  const refreshDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(d => d.kind === 'audioinput').map(d => ({ deviceId: d.deviceId, label: d.label || 'Unknown Input', kind: d.kind }));
      const audioOutputs = devices.filter(d => d.kind === 'audiooutput').map(d => ({ deviceId: d.deviceId, label: d.label || 'Unknown Output', kind: d.kind }));
      setInputs(audioInputs);
      setOutputs(audioOutputs);
      if (audioInputs.length > 0 && !selectedInput) setSelectedInput(audioInputs[0].deviceId);
      if (audioOutputs.length > 0 && !selectedOutput) setSelectedOutput(audioOutputs[0].deviceId);
    } catch (err) {
      console.error(err);
    }
  }, [selectedInput, selectedOutput]);

  const handleStartEngine = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      await audioEngine.init();
      
      // Fix: Apply current parameters immediately before resuming to prevent default value spikes
      audioEngine.updateParameters(params);
      
      await refreshDevices();
      await audioEngine.resume();
      setEngineStarted(true);
    } catch (err) {
      setErrorMsg("마이크 권한이 필요합니다.");
    }
  };

  const playTestSignal = () => {
    audioEngine.playTestTone();
  };

  const resetSettings = () => {
    setParams(DEFAULT_PARAMS);
    audioEngine.updateParameters(DEFAULT_PARAMS);
  };

  useEffect(() => {
    if (!engineStarted) return;
    const interval = setInterval(() => {
      setLevels(audioEngine.getLevels());
    }, 50);
    return () => clearInterval(interval);
  }, [engineStarted]);

  useEffect(() => {
    if (selectedInput && engineStarted) {
      audioEngine.setInputDevice(selectedInput).catch(e => setErrorMsg(e.message));
    }
  }, [selectedInput, engineStarted]);

  useEffect(() => {
    if (selectedOutput && engineStarted) {
      audioEngine.setOutputDevice(selectedOutput);
    }
  }, [selectedOutput, engineStarted]);

  const updateParam = useCallback((key: keyof EffectParams, val: number | boolean) => {
    setParams(prev => {
      const newParams = { ...prev, [key]: val };
      audioEngine.updateParameters(newParams);
      return newParams;
    });
  }, []);

  const toggleMute = () => {
    updateParam('isMuted', !params.isMuted);
  };

  if (!engineStarted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505] text-white p-6 relative overflow-hidden">
        {/* Background Grid */}
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
        
        <div className="max-w-md w-full bg-slate-900/90 backdrop-blur-md p-10 rounded-sm border border-slate-800 shadow-2xl text-center space-y-8 relative z-10">
          <div className="w-24 h-24 bg-gradient-to-br from-blue-900 to-slate-900 rounded-full flex items-center justify-center mx-auto border-4 border-slate-800 shadow-[0_0_20px_rgba(59,130,246,0.3)]">
            <svg className="w-10 h-10 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.983 5.983 0 01-1.414 4.243 1 1 0 11-1.415-1.415A3.987 3.987 0 0013 10a3.987 3.987 0 00-1.414-2.829 1 1 0 010-1.415z" clipRule="evenodd" /></svg>
          </div>
          <div>
            <h1 className="text-4xl font-black font-tech tracking-tight text-white">AudioLink <span className="text-blue-500">FX</span></h1>
            <p className="text-slate-400 text-sm mt-2 font-mono">VIRTUAL ROUTING DSP ENGINE</p>
          </div>
          <button 
            onClick={handleStartEngine}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded transition-all shadow-lg active:scale-95 uppercase tracking-widest text-xs border-b-4 border-blue-800"
          >
            Initialize System
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-200 p-4 md:p-8 flex flex-col items-center relative">
      {/* Background Texture */}
      <div className="fixed inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #333 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

      <header className="w-full max-w-6xl mb-8 flex flex-col md:flex-row justify-between items-end border-b border-slate-800 pb-6 relative z-10 gap-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-black font-tech text-white italic tracking-tighter drop-shadow-lg">
            AudioLink <span className="text-blue-500">FX</span>
          </h1>
          <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-[0.4em] font-bold pl-1">48kHz Pro Mastering Engine</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={resetSettings}
            className="px-4 py-2 bg-slate-800 hover:bg-red-900/30 hover:text-red-400 hover:border-red-800/50 text-slate-400 text-[10px] font-bold rounded-sm border border-slate-700 transition-all uppercase tracking-widest shadow-lg active:translate-y-0.5"
          >
            Reset FX
          </button>
          <button 
            onClick={playTestSignal}
            className="px-4 py-2 bg-slate-800 hover:bg-blue-900/30 hover:text-blue-400 hover:border-blue-800/50 text-slate-300 text-[10px] font-bold rounded-sm border border-slate-700 transition-all uppercase tracking-widest shadow-lg active:translate-y-0.5"
          >
             Test Signal
          </button>
        </div>
      </header>

      <main className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
        
        {/* Left Column: I/O & Diagnostics */}
        <div className="lg:col-span-4 space-y-6">
          {/* I/O Rack */}
          <div className="bg-[#131b2e] p-6 rounded-sm border border-slate-800 shadow-xl relative">
            <Screw className="top-2 left-2" />
            <Screw className="top-2 right-2" />
            <Screw className="bottom-2 left-2" />
            <Screw className="bottom-2 right-2" />

            <h2 className="text-xs font-bold font-tech text-slate-400 uppercase mb-6 tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_8px_#3b82f6]"></span>
              I/O Patch Bay
            </h2>
            
            <div className="space-y-6">
              <div className="flex gap-4 items-center bg-black/40 p-3 rounded border border-slate-800/50">
                <LevelMeter level={levels.input} label="IN" />
                <div className="flex-1 min-w-0">
                  <label className="block text-[9px] text-blue-400 mb-1.5 font-bold uppercase tracking-wider">Source</label>
                  <select 
                    className="w-full bg-[#0a0a0a] border border-slate-800 rounded-sm px-2 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none text-slate-300 font-mono truncate"
                    value={selectedInput}
                    onChange={(e) => setSelectedInput(e.target.value)}
                  >
                    {inputs.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex gap-4 items-center bg-black/40 p-3 rounded border border-slate-800/50">
                <LevelMeter level={levels.output} label="OUT" />
                <div className="flex-1 min-w-0">
                  <label className="block text-[9px] text-green-400 mb-1.5 font-bold uppercase tracking-wider">Destination</label>
                  <select 
                    className="w-full bg-[#0a0a0a] border border-slate-800 rounded-sm px-2 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none text-slate-300 font-mono truncate"
                    value={selectedOutput}
                    onChange={(e) => setSelectedOutput(e.target.value)}
                  >
                    {outputs.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
            
            {/* Master Gains */}
            <div className="mt-8 pt-6 border-t border-slate-800/50 flex items-center justify-around">
               <Knob label="Input Trim" value={params.inputGain} min={0} max={2} onChange={(v) => updateParam('inputGain', v)} color="#64748b" />
               
               <div className="flex flex-col items-center gap-2">
                 <button 
                   onClick={toggleMute}
                   className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all shadow-lg active:scale-90 ${
                     params.isMuted 
                       ? 'bg-red-600 border-red-400 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)]' 
                       : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-400'
                   }`}
                   title={params.isMuted ? "Unmute" : "Mute"}
                 >
                   {params.isMuted ? (
                     <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                   ) : (
                     <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.983 5.983 0 01-1.414 4.243 1 1 0 11-1.415-1.415A3.987 3.987 0 0013 10a3.987 3.987 0 00-1.414-2.829 1 1 0 010-1.415z" clipRule="evenodd" /></svg>
                   )}
                 </button>
                 <span className={`text-[9px] font-bold uppercase tracking-widest ${params.isMuted ? 'text-red-500' : 'text-slate-500'}`}>
                   {params.isMuted ? 'Muted' : 'Mute'}
                 </span>
               </div>

               <div className="w-px h-16 bg-gradient-to-b from-transparent via-slate-700 to-transparent"></div>
               <Knob label="Master Vol" value={params.masterGain} min={0} max={2} onChange={(v) => updateParam('masterGain', v)} color="#f59e0b" />
            </div>
          </div>

          {/* Troubleshooting Panel */}
          <div className="bg-[#1a1313] border border-red-900/30 p-5 rounded-sm relative group overflow-hidden">
             {/* Language Toggles */}
             <div className="absolute top-3 right-3 flex gap-1 z-20">
               {(['ko', 'en', 'ja'] as const).map((l) => (
                 <button 
                   key={l}
                   onClick={() => setLang(l)} 
                   className={`text-[9px] font-bold px-1.5 py-0.5 rounded border transition-colors ${
                     lang === l 
                       ? 'bg-red-900/40 border-red-500/50 text-red-200' 
                       : 'bg-transparent border-transparent text-slate-600 hover:text-slate-400'
                   }`}
                 >
                   {l.toUpperCase()}
                 </button>
               ))}
             </div>

             <div className="absolute top-0 left-0 w-1 h-full bg-red-900/50 transition-all group-hover:bg-red-600"></div>
             <h3 className="text-[10px] font-black font-tech text-red-500 uppercase tracking-widest mb-3 flex items-center gap-2">
               <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
               {TROUBLESHOOTING_TEXT[lang].title}
             </h3>
             <ul className="text-[10px] text-slate-400 space-y-2 font-medium leading-relaxed pl-2 relative z-10">
                {TROUBLESHOOTING_TEXT[lang].steps.map((step, index) => (
                  <li key={index}>
                    <span className="text-red-500 mr-1">{index + 1}.</span>
                    {step}
                  </li>
                ))}
             </ul>
          </div>
        </div>

        {/* Right Column: FX & Visuals */}
        <div className="lg:col-span-8 space-y-6">
          <Visualizer />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Delay Unit */}
            <div className="bg-[#131b2e] p-6 rounded-sm border border-slate-800 shadow-xl relative">
               <Screw className="top-2 left-2" />
               <Screw className="top-2 right-2" />
               <Screw className="bottom-2 left-2" />
               <Screw className="bottom-2 right-2" />
               
               <div className="absolute top-6 left-6 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full shadow-[0_0_8px_#06b6d4]"></div>
                  <h3 className="text-xs font-black font-tech text-cyan-500 uppercase tracking-widest">Digital Delay</h3>
               </div>

               <div className="flex justify-between mt-10 px-2">
                 <Knob label="Time" value={params.delayTime} min={0} max={1.0} onChange={(v) => updateParam('delayTime', v)} format={v => v.toFixed(2)+'s'} color="#06b6d4" />
                 <Knob label="Feedback" value={params.delayFeedback} min={0} max={0.9} onChange={(v) => updateParam('delayFeedback', v)} format={v => Math.round(v*100)+'%'} color="#06b6d4" />
                 <Knob label="Mix" value={params.delayMix} min={0} max={1} onChange={(v) => updateParam('delayMix', v)} format={v => Math.round(v*100)+'%'} color="#06b6d4" />
               </div>
            </div>

            {/* Reverb Unit */}
            <div className="bg-[#131b2e] p-6 rounded-sm border border-slate-800 shadow-xl relative">
               <Screw className="top-2 left-2" />
               <Screw className="top-2 right-2" />
               <Screw className="bottom-2 left-2" />
               <Screw className="bottom-2 right-2" />

               <div className="absolute top-6 left-6 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full shadow-[0_0_8px_#a855f7]"></div>
                  <h3 className="text-xs font-black font-tech text-purple-500 uppercase tracking-widest">Plate Reverb</h3>
               </div>

               <div className="flex justify-around mt-10 px-4">
                  <Knob label="Decay" value={params.reverbDecay} min={0.1} max={5.0} onChange={(v) => updateParam('reverbDecay', v)} format={v => v.toFixed(1)+'s'} color="#a855f7" />
                  <Knob label="Wet Level" value={params.reverbMix} min={0} max={1} onChange={(v) => updateParam('reverbMix', v)} format={v => Math.round(v*100)+'%'} color="#a855f7" />
               </div>
            </div>
          </div>

          <footer className="flex justify-between items-center text-[9px] font-mono text-slate-600 border-t border-slate-900 pt-6 mt-4">
             <div className="flex gap-4">
               <span className="flex items-center gap-1"><span className="w-1 h-1 bg-green-500 rounded-full"></span> SYSTEM ONLINE</span>
               <span className="flex items-center gap-1"><span className="w-1 h-1 bg-green-500 rounded-full"></span> 48000Hz LOCKED</span>
             </div>
             <span className="text-slate-700">AudioLink FX Pro v1.2.0 build 2024</span>
          </footer>
        </div>

      </main>
    </div>
  );
};

export default App;