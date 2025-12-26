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
  isMuted: false,
  monitoringEnabled: false
};

const STORAGE_KEY = 'audiolink_fx_params';
const DEVICE_STORAGE_KEY = 'audiolink_fx_devices';
const AD_CLIENT_ID = 'ca-pub-3082216745798697';
const AD_SLOT_ID = 'YOUR_AD_SLOT_ID';
const HAS_VALID_AD_SLOT = AD_SLOT_ID && AD_SLOT_ID !== 'YOUR_AD_SLOT_ID';

// Decorative Screw Component
const Screw: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`absolute w-3 h-3 rounded-full bg-slate-700 border border-slate-900 flex items-center justify-center screw-head ${className}`}>
    <div className="w-full h-0.5 bg-slate-900 transform rotate-45"></div>
    <div className="absolute w-full h-0.5 bg-slate-900 transform -rotate-45"></div>
  </div>
);

// Modal Component
const Modal: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void; 
  title: string; 
  children: React.ReactNode 
}> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-[#0f172a] border border-slate-800 w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-sm shadow-2xl relative z-10 flex flex-col">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
          <h3 className="text-sm font-black font-tech text-white uppercase tracking-widest flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
            {title}
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-6 overflow-y-auto text-slate-400 text-sm leading-relaxed custom-scrollbar">
          {children}
        </div>
        <div className="p-4 border-t border-slate-800 bg-slate-900/30 text-right">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded-sm border border-slate-700 uppercase tracking-widest transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

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

const AdUnit: React.FC = () => (
  <div className="bg-[#131b2e] p-4 rounded-sm border border-slate-800 shadow-xl overflow-hidden min-h-[90px] flex items-center justify-center relative">
    <div className="absolute top-1 left-2 text-[8px] font-bold text-slate-700 uppercase tracking-tighter">Advertisement</div>
    {HAS_VALID_AD_SLOT ? (
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={AD_CLIENT_ID}
        data-ad-slot={AD_SLOT_ID}
        data-ad-format="auto"
        data-full-width-responsive="true"
      ></ins>
    ) : (
      <span className="text-[10px] text-slate-600 font-mono italic">Set your AdSense slot ID in App.tsx to show ads.</span>
    )}
  </div>
);

const App: React.FC = () => {
  const [engineStarted, setEngineStarted] = useState(false);
  const [inputs, setInputs] = useState<AudioDevice[]>([]);
  const [outputs, setOutputs] = useState<AudioDevice[]>([]);
  
  const [modalType, setModalType] = useState<'privacy' | 'terms' | 'contact' | null>(null);
  const [selectedInput, setSelectedInput] = useState<string>(() => {
    return localStorage.getItem(`${DEVICE_STORAGE_KEY}_input`) || '';
  });
  const [selectedOutput, setSelectedOutput] = useState<string>(() => {
    return localStorage.getItem(`${DEVICE_STORAGE_KEY}_output`) || '';
  });
  const [selectedMonitor, setSelectedMonitor] = useState<string>(() => {
    return localStorage.getItem(`${DEVICE_STORAGE_KEY}_monitor`) || '';
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Save devices to localStorage when changed
  useEffect(() => {
    if (selectedInput) localStorage.setItem(`${DEVICE_STORAGE_KEY}_input`, selectedInput);
  }, [selectedInput]);

  useEffect(() => {
    if (selectedOutput) localStorage.setItem(`${DEVICE_STORAGE_KEY}_output`, selectedOutput);
  }, [selectedOutput]);

  useEffect(() => {
    if (selectedMonitor) localStorage.setItem(`${DEVICE_STORAGE_KEY}_monitor`, selectedMonitor);
  }, [selectedMonitor]);
  
  const [levels, setLevels] = useState({ input: 0, output: 0 });
  const [params, setParams] = useState<EffectParams>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return { ...DEFAULT_PARAMS, ...JSON.parse(saved) };
      } catch (e) {
        console.error("Failed to parse saved params", e);
      }
    }
    return DEFAULT_PARAMS;
  });
  const [lang, setLang] = useState<LangCode>('en');

  // Save params to localStorage when changed
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(params));
  }, [params]);

  const refreshDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(d => d.kind === 'audioinput').map(d => ({ deviceId: d.deviceId, label: d.label || 'Unknown Input', kind: d.kind }));
      const audioOutputs = devices.filter(d => d.kind === 'audiooutput').map(d => ({ deviceId: d.deviceId, label: d.label || 'Unknown Output', kind: d.kind }));
      setInputs(audioInputs);
      setOutputs(audioOutputs);
      if (audioInputs.length > 0 && !selectedInput) setSelectedInput(audioInputs[0].deviceId);
      if (audioOutputs.length > 0 && !selectedOutput) setSelectedOutput(audioOutputs[0].deviceId);
      if (audioOutputs.length > 0 && !selectedMonitor) setSelectedMonitor(audioOutputs[0].deviceId);
    } catch (err) {
      console.error(err);
    }
  }, [selectedInput, selectedOutput]);

  const handleStartEngine = async () => {
    try {
      // Ask for permission with processing disabled early to minimize starting latency
      await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: false, 
          noiseSuppression: false, 
          autoGainControl: false 
        } 
      });
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

  useEffect(() => {
    if (selectedMonitor && engineStarted) {
      audioEngine.setMonitoringDevice(selectedMonitor);
    }
  }, [selectedMonitor, engineStarted]);

  useEffect(() => {
    if (engineStarted) {
      audioEngine.setMonitoringEnabled(params.monitoringEnabled);
    }
  }, [params.monitoringEnabled, engineStarted]);

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

  useEffect(() => {
    try {
      (window as any).adsbygoogle = (window as any).adsbygoogle || [];
      (window as any).adsbygoogle.push({});
    } catch (e) {
      console.error("AdSense error", e);
    }
  }, []);

  if (!engineStarted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#02040a] text-white p-6 relative overflow-hidden">
        {/* Background Decorative Elements */}
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)', backgroundSize: '60px 60px' }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-900/10 rounded-full blur-[160px] animate-pulse-slow"></div>
        <div className="scanline"></div>
        
        <div className="max-w-4xl w-full relative z-10 space-y-8">
          {/* Main Hero Card */}
          <div className="bg-slate-900/40 backdrop-blur-xl rounded-sm border border-slate-800/50 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"></div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2">
              {/* Left Side: Branding & CTA */}
              <div className="p-10 lg:p-14 border-b lg:border-b-0 lg:border-r border-slate-800/50 flex flex-col justify-center relative">
                <Screw className="top-3 left-3 opacity-30" />
                <Screw className="bottom-3 left-3 opacity-30" />
                
                <div className="relative mb-8">
                  <h1 className="text-6xl font-black font-tech tracking-tighter text-white italic leading-none">
                    AudioLink <span className="text-blue-500 drop-shadow-[0_0_20px_rgba(59,130,246,0.5)]">FX</span>
                  </h1>
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.4em] mt-4 flex items-center gap-2">
                    <span className="w-8 h-px bg-slate-800"></span>
                    Professional DSP Rack
                  </p>
                </div>

                <div className="space-y-6 mb-10">
                  <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
                    Professional low-latency real-time audio processing in your browser. Apply studio-grade effects to your microphone for streaming and recording.
                  </p>
                  
                  <div className="flex gap-4">
                    <div className="px-3 py-1 bg-blue-900/20 border border-blue-800/30 rounded-full text-[9px] font-bold text-blue-400 uppercase tracking-widest">Low Latency</div>
                    <div className="px-3 py-1 bg-purple-900/20 border border-purple-800/30 rounded-full text-[9px] font-bold text-purple-400 uppercase tracking-widest">48kHz Pro</div>
                  </div>
                </div>

                <button 
                  onClick={handleStartEngine}
                  className="group relative w-full overflow-hidden rounded-sm"
                >
                  <div className="absolute inset-0 bg-blue-600 transition-transform duration-300 group-hover:scale-105"></div>
                  <div className="relative py-5 flex items-center justify-center gap-3 border-b-4 border-blue-800 active:border-b-0 active:translate-y-1 transition-all">
                    <span className="text-white font-black uppercase tracking-[0.25em] text-sm">Initialize System</span>
                    <svg className="w-5 h-5 text-blue-200 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                </button>
              </div>

              {/* Right Side: Features/Info */}
              <div className="p-10 lg:p-14 bg-black/20 relative">
                <Screw className="top-3 right-3 opacity-30" />
                <Screw className="bottom-3 right-3 opacity-30" />
                
                <h2 className="text-xs font-black font-tech text-slate-400 uppercase tracking-widest mb-8 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_8px_#3b82f6]"></span>
                  Engine Specifications
                </h2>

                <div className="space-y-8">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded bg-slate-800/50 flex items-center justify-center shrink-0 border border-slate-700/50">
                      <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>
                    </div>
                    <div>
                      <h3 className="text-[11px] font-bold text-white uppercase tracking-wider mb-1">Pure Browser Power</h3>
                      <p className="text-[11px] text-slate-500 leading-relaxed">No installation required. Everything runs locally via Web Audio API for maximum privacy and performance.</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded bg-slate-800/50 flex items-center justify-center shrink-0 border border-slate-700/50">
                      <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>
                    </div>
                    <div>
                      <h3 className="text-[11px] font-bold text-white uppercase tracking-wider mb-1">Studio FX Chain</h3>
                      <p className="text-[11px] text-slate-500 leading-relaxed">High-fidelity Plate Reverb and Digital Delay with precise parameter controls and real-time monitoring.</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded bg-slate-800/50 flex items-center justify-center shrink-0 border border-slate-700/50">
                      <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                    </div>
                    <div>
                      <h3 className="text-[11px] font-bold text-white uppercase tracking-wider mb-1">Privacy Guaranteed</h3>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Audio never leaves your device. We use standard browser local storage to save your custom presets. See the{' '}
                        <a className="text-slate-300 hover:text-white transition-colors" href="/privacy.html">Privacy Policy</a>.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#131b2e]/50 border border-slate-800/50 p-6 rounded-sm backdrop-blur-sm relative">
               <Screw className="top-2 left-2 opacity-20 scale-75" />
               <Screw className="top-2 right-2 opacity-20 scale-75" />
               <h3 className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.2em] mb-4">Quick Start Guide</h3>
               <ul className="text-[11px] text-slate-500 space-y-3">
                 <li className="flex gap-3"><span className="text-blue-500 font-bold">01.</span> Initialize the engine and grant mic access.</li>
                 <li className="flex gap-3"><span className="text-blue-500 font-bold">02.</span> Select your physical input and virtual output (e.g., Cable Input).</li>
                 <li className="flex gap-3"><span className="text-blue-500 font-bold">03.</span> Adjust your FX and route to OBS/Discord.</li>
               </ul>
            </div>
            <div className="bg-[#1a1313]/50 border border-red-900/20 p-6 rounded-sm backdrop-blur-sm relative">
               <Screw className="top-2 left-2 opacity-20 scale-75" />
               <Screw className="top-2 right-2 opacity-20 scale-75" />
               <h3 className="text-[10px] font-bold text-red-400 uppercase tracking-[0.2em] mb-4">System Requirements</h3>
               <ul className="text-[11px] text-slate-500 space-y-3">
                 <li className="flex gap-3"><span className="text-red-500/50">•</span> Chromium-based browser (Chrome, Edge, etc.)</li>
                 <li className="flex gap-3"><span className="text-red-500/50">•</span> 48000Hz system sample rate (Recommended)</li>
                 <li className="flex gap-3"><span className="text-red-500/50">•</span> VB-Audio Virtual Cable (For routing)</li>
               </ul>
            </div>
          </div>

          <footer className="pt-8 border-t border-slate-900 flex flex-col md:flex-row justify-between items-center gap-6 opacity-50">
             <div className="text-[10px] font-mono text-slate-600 uppercase tracking-widest flex items-center gap-4">
               <span>Ver 1.2.0</span>
               <span className="w-1 h-1 bg-slate-800 rounded-full"></span>
               <span>Built with Web Audio API</span>
             </div>
             <div className="flex gap-6 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
               <button onClick={() => setModalType('privacy')} className="hover:text-blue-500 transition-colors">Privacy</button>
               <button onClick={() => setModalType('terms')} className="hover:text-blue-500 transition-colors">Terms</button>
               <button onClick={() => setModalType('contact')} className="hover:text-blue-500 transition-colors">Contact</button>
             </div>
          </footer>
        </div>

        {/* Modals */}
        <Modal 
          isOpen={modalType === 'privacy'} 
          onClose={() => setModalType(null)} 
          title="Privacy Policy"
        >
          <div className="space-y-4">
            <p className="text-blue-400 font-bold uppercase text-xs tracking-widest">Your Privacy Matters</p>
            <p>AudioLink FX Pro values your privacy. This service <b>processes all audio locally</b> within your browser and does not transmit any audio data to our servers.</p>
            <h4 className="text-white font-bold mt-4">1. Data Collection</h4>
            <p>We do not collect or store any audio files or microphone input. All configuration values (FX parameters, etc.) are stored exclusively in your browser's LocalStorage.</p>
            <h4 className="text-white font-bold">2. Cookies and Advertising</h4>
            <p>This site uses Google AdSense to display advertisements. Google may use cookies to serve ads based on your prior visits to this or other websites.</p>
          </div>
        </Modal>

        <Modal 
          isOpen={modalType === 'terms'} 
          onClose={() => setModalType(null)} 
          title="Terms of Service"
        >
          <div className="space-y-4">
            <p className="text-purple-400 font-bold uppercase text-xs tracking-widest">Usage Agreement</p>
            <p>By using AudioLink FX Pro, you agree to the following terms and conditions.</p>
            <h4 className="text-white font-bold mt-4">1. Service Usage</h4>
            <p>This service is a browser-based audio processing tool. Users must use the service for lawful purposes only.</p>
            <h4 className="text-white font-bold">2. Disclaimer</h4>
            <p>The service is provided "as is," and we are not responsible for any audio quality issues or system errors that may occur during its use.</p>
          </div>
        </Modal>

        <Modal 
          isOpen={modalType === 'contact'} 
          onClose={() => setModalType(null)} 
          title="Contact Support"
        >
          <div className="space-y-6 text-center py-4">
            <div className="w-16 h-16 bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-800/30">
              <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
            </div>
            <h4 className="text-white font-bold">Get in Touch</h4>
            <p className="text-sm">If you have any questions or feedback, please contact us at the email address below.</p>
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-sm inline-block">
              <p className="text-blue-400 font-mono text-lg">kys006417@gmail.com</p>
            </div>
          </div>
        </Modal>
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

              {/* Monitoring Section */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full transition-all ${params.monitoringEnabled ? 'bg-orange-500 shadow-[0_0_8px_#f97316]' : 'bg-slate-700'}`}></span>
                    Monitoring
                  </span>
                  <button 
                    onClick={() => updateParam('monitoringEnabled', !params.monitoringEnabled)}
                    className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${params.monitoringEnabled ? 'bg-orange-600' : 'bg-slate-700'}`}
                  >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${params.monitoringEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                {params.monitoringEnabled && (
                  <div className="flex gap-4 items-center bg-orange-900/10 p-3 rounded border border-orange-900/30 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex-1 min-w-0">
                      <label className="block text-[9px] text-orange-400 mb-1.5 font-bold uppercase tracking-wider">Monitor Device</label>
                      <select 
                        className="w-full bg-[#0a0a0a] border border-orange-900/50 rounded-sm px-2 py-2 text-xs focus:ring-1 focus:ring-orange-500 outline-none text-slate-300 font-mono truncate"
                        value={selectedMonitor}
                        onChange={(e) => setSelectedMonitor(e.target.value)}
                      >
                        {outputs.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
                      </select>
                    </div>
                  </div>
                )}
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

          <AdUnit />

          {/* About & Technical Info (Added for AdSense & SEO) */}
          <section className="bg-slate-900/40 border border-slate-800 p-8 rounded-sm text-slate-400 space-y-6 text-sm leading-relaxed font-sans">
            <div>
              <h2 className="text-xl font-tech font-black text-white mb-4 uppercase tracking-tight italic">Professional Browser Audio DSP</h2>
              <p>
                AudioLink FX Pro is a high-performance, real-time audio Digital Signal Processing (DSP) engine built for the web. 
                Designed for streamers, podcasters, and musicians, this tool allows you to process your microphone input with professional-grade effects 
                directly in your browser with ultra-low latency. 
                Using advanced Web Audio API techniques, we deliver studio-quality Reverb and Delay without the need for expensive hardware or complex software installations.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <h3 className="text-blue-400 font-bold uppercase text-xs tracking-widest">Core Capabilities</h3>
                <ul className="list-disc pl-5 space-y-2 text-[13px]">
                  <li><b>Ultra-Low Latency DSP:</b> Optimized processing path for near-instant audio feedback.</li>
                  <li><b>Dual-Channel Routing:</b> Independent control for main broadcast output and local monitoring.</li>
                  <li><b>Studio FX Rack:</b> High-fidelity Plate Reverb and Digital Delay units.</li>
                  <li><b>Zero Installation:</b> Pure browser-based power, compatible with Windows, Mac, and Linux.</li>
                </ul>
              </div>
              <div className="space-y-3">
                <h3 className="text-green-400 font-bold uppercase text-xs tracking-widest">Technical Excellence</h3>
                <p className="text-[13px]">
                  Our engine synchronizes with your hardware's native sample rate to eliminate resampling overhead. 
                  By utilizing Direct Destination routing, we bypass standard browser buffering to achieve the fastest possible response times. 
                  Your settings are automatically persisted to local storage for a seamless experience across sessions.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex flex-col md:flex-row justify-between gap-4">
              <div className="max-w-xl">
                <h3 className="text-slate-500 font-bold uppercase text-[11px] tracking-widest mb-2">Privacy & Local Processing</h3>
                <p className="text-[11px] text-slate-500 italic">
                  AudioLink FX Pro processes all audio locally on your machine. No audio data is ever sent to our servers. 
                  This site uses Google AdSense and associated cookies for advertising and analytics purposes. 
                  See the <a className="text-slate-300 hover:text-white transition-colors" href="/privacy.html">Privacy Policy</a>.
                </p>
              </div>
              <div className="text-[11px] text-slate-600">
                <p><b>AudioLink FX Pro</b> - The Ultimate Virtual Audio Rack</p>
                <p>Built with Web Audio API & React</p>
              </div>
            </div>

            {/* Korean Translation (Folded/Secondary for SEO focus on English) */}
            <details className="mt-4 pt-4 border-t border-slate-800/50 cursor-pointer">
              <summary className="text-[10px] uppercase font-bold text-slate-600 hover:text-slate-400">한국어 설명 (Korean Info)</summary>
              <div className="mt-4 text-[12px] space-y-2 opacity-70">
                <p>AudioLink FX Pro는 브라우저 기반의 전문 실시간 오디오 처리 엔진입니다. 마이크 입력에 리버브와 딜레이를 지연 없이 적용하여 방송이나 녹음 품질을 높여줍니다.</p>
              </div>
            </details>
          </section>

          <footer className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-[9px] font-mono text-slate-600 border-t border-slate-900 pt-6 mt-4">
             <div className="flex flex-wrap gap-4">
               <span className="flex items-center gap-1"><span className="w-1 h-1 bg-green-500 rounded-full"></span> SYSTEM ONLINE</span>
               <span className="flex items-center gap-1"><span className="w-1 h-1 bg-green-500 rounded-full"></span> 48000Hz LOCKED</span>
             </div>
             <div className="flex gap-4">
               <a className="hover:text-slate-300 transition-colors" href="/privacy.html">Privacy</a>
               <a className="hover:text-slate-300 transition-colors" href="/terms.html">Terms</a>
               <a className="hover:text-slate-300 transition-colors" href="/contact.html">Contact</a>
             </div>
             <span className="text-slate-700">AudioLink FX Pro v1.2.0 build 2024</span>
          </footer>
        </div>

      </main>
    </div>
  );
};

export default App;
