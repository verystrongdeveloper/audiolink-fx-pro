import { EffectParams, AudioOutputElement } from '../types';

class AudioEngine {
  public context: AudioContext | null = null;
  public monitorContext: AudioContext | null = null;
  private inputStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private monitorSourceNode: MediaStreamAudioSourceNode | null = null;
  private monitorGain: GainNode | null = null;
  
  private inputGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private mainOutputGain: GainNode | null = null;
  private inputAnalyzer: AnalyserNode | null = null;
  private outputAnalyzer: AnalyserNode | null = null;
  
  private convolver: ConvolverNode | null = null;
  private reverbGain: GainNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;
  private delayWetGain: GainNode | null = null;

  private destinationNode: MediaStreamAudioDestinationNode | null = null;
  private outputAudioElement: AudioOutputElement | null = null;
  private monitorAudioElement: AudioOutputElement | null = null;

  private isInitialized = false;
  private isMonitoringViaContext = true;
  private monitoringEnabled = false;

  constructor() {
    this.outputAudioElement = new Audio() as AudioOutputElement;
    this.outputAudioElement.autoplay = true;
    // 일부 브라우저에서는 오디오 객체가 페이지에 연결되지 않으면 출력을 제한할 수 있음
    this.outputAudioElement.style.display = 'none';

    this.monitorAudioElement = new Audio() as AudioOutputElement;
    this.monitorAudioElement.autoplay = true;
    this.monitorAudioElement.muted = true; // Ensure it starts muted
    this.monitorAudioElement.style.display = 'none';
  }

  async init() {
    if (this.isInitialized) return;

    // Use hardware native sample rate to avoid software resampling latency
    this.context = new AudioContext({
      latencyHint: 'interactive',
    });

    // --- Critical Fix: Start all gains at 0 to prevent startup pop/noise ---
    this.inputGain = this.context.createGain();
    this.inputGain.gain.value = 0; 
    
    // Stereo to Mono summing: force 1 channel to sum L+R and apply -6dB (0.5x gain)
    // Web Audio default downmix for 'speakers' interpretation is (L+R)/2
    this.inputGain.channelCount = 1;
    this.inputGain.channelCountMode = 'explicit';
    this.inputGain.channelInterpretation = 'speakers';

    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = 0; 

    this.mainOutputGain = this.context.createGain();
    this.mainOutputGain.gain.value = 1.0;
    
    this.inputAnalyzer = this.context.createAnalyser();
    this.outputAnalyzer = this.context.createAnalyser();
    
    this.inputAnalyzer.fftSize = 256;
    this.outputAnalyzer.fftSize = 256;

    this.convolver = this.context.createConvolver();
    this.convolver.buffer = this.buildImpulseResponse(2.0, 2.0); 
    
    this.reverbGain = this.context.createGain();
    this.reverbGain.gain.value = 0; // Mute reverb initially

    this.delayNode = this.context.createDelay(5.0);
    
    this.delayFeedback = this.context.createGain();
    this.delayFeedback.gain.value = 0;
    
    this.delayWetGain = this.context.createGain();
    this.delayWetGain.gain.value = 0;

    this.destinationNode = this.context.createMediaStreamDestination();

    // Secondary AudioContext for Monitoring with same hardware rate
    this.monitorContext = new AudioContext({
      latencyHint: 'interactive',
      sampleRate: this.context.sampleRate,
    });
    this.monitorGain = this.monitorContext.createGain();
    this.monitorGain.gain.value = 0; // Start muted
    this.monitorGain.connect(this.monitorContext.destination);
    
    // Connect Main DSP to Monitor Context
    this.monitorSourceNode = this.monitorContext.createMediaStreamSource(this.destinationNode.stream);
    this.monitorSourceNode.connect(this.monitorGain);

    // 연결 그래프
    this.inputGain.connect(this.inputAnalyzer);
    this.inputGain.connect(this.masterGain);

    this.inputGain.connect(this.convolver);
    this.convolver.connect(this.reverbGain);
    this.reverbGain.connect(this.masterGain);

    this.inputGain.connect(this.delayNode);
    this.delayNode.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayNode);
    this.delayNode.connect(this.delayWetGain);
    this.delayWetGain.connect(this.masterGain);

    this.masterGain.connect(this.outputAnalyzer);
    
    // Low Latency Path: Connect to main output gain
    this.outputAnalyzer.connect(this.mainOutputGain);

    // Legacy/Monitoring Path: Connect to MediaStream for secondary devices
    this.outputAnalyzer.connect(this.destinationNode);

    this.outputAudioElement!.srcObject = this.destinationNode.stream;
    this.monitorAudioElement!.srcObject = this.destinationNode.stream;
    
    // Mute the legacy output element if we're using direct destination
    this.outputAudioElement!.muted = true; 
    
    this.isInitialized = true;
  }

  async resume() {
    if (this.context && this.context.state === 'suspended') {
      await this.context.resume();
    }
    if (this.monitorContext && this.monitorContext.state === 'suspended') {
      await this.monitorContext.resume();
    }
    if (this.outputAudioElement) {
      await this.outputAudioElement.play().catch(() => {});
    }
  }

  async setInputDevice(deviceId: string) {
    if (!this.context) await this.init();
    
    if (this.sourceNode) this.sourceNode.disconnect();
    if (this.inputStream) this.inputStream.getTracks().forEach(t => t.stop());

    try {
      this.inputStream = await navigator.mediaDevices.getUserMedia({
        audio: { 
          deviceId: { exact: deviceId }, 
          echoCancellation: false, 
          noiseSuppression: false, 
          autoGainControl: false 
        }
      });

      this.sourceNode = this.context!.createMediaStreamSource(this.inputStream);
      this.sourceNode.connect(this.inputGain!);
      await this.resume();
    } catch (err) {
      console.error("Input setup failed:", err);
      throw err;
    }
  }

  async setOutputDevice(deviceId: string) {
    if (!this.context || !this.mainOutputGain) return;
    
    try {
      // 1. Try modern AudioContext.setSinkId (Lowest Latency)
      if ('setSinkId' in this.context && typeof (this.context as any).setSinkId === 'function') {
        await (this.context as any).setSinkId(deviceId);
        this.mainOutputGain.disconnect(); // Prevent duplicate connections
        this.mainOutputGain.connect(this.context.destination);
        console.log(`Main output (Context) routed to: ${deviceId}`);
        if (this.outputAudioElement) this.outputAudioElement.muted = true; // Ensure legacy element is silent
        return;
      }

      // 2. Fallback to HTMLAudioElement (Legacy Latency)
      if (this.outputAudioElement) {
        this.mainOutputGain.disconnect(); // Prevent audio from going to default context destination
        this.outputAudioElement.muted = false; 
        if ('setSinkId' in this.outputAudioElement) {
          await this.outputAudioElement.setSinkId(deviceId);
          console.log(`Main output (Legacy) routed to: ${deviceId}`);
          await this.resume();
        }
      }
    } catch (e) {
      console.error("setOutputDevice failed", e);
    }
  }

  async setMonitoringDevice(deviceId: string) {
    if (!this.monitorContext) return;
    
    try {
      // 1. Try modern setSinkId on Monitor Context (Lowest Latency)
      if ('setSinkId' in this.monitorContext && typeof (this.monitorContext as any).setSinkId === 'function') {
        await (this.monitorContext as any).setSinkId(deviceId);
        console.log(`Monitor routed (Direct Context) to: ${deviceId}`);
        this.isMonitoringViaContext = true;
        if (this.monitorAudioElement) this.monitorAudioElement.muted = true;
      } else {
        // 2. Fallback to HTMLAudioElement
        if (this.monitorAudioElement) {
          this.isMonitoringViaContext = false;
          // Note: We don't unmute here, setMonitoringEnabled will handle it
          if ('setSinkId' in this.monitorAudioElement) {
            await this.monitorAudioElement.setSinkId(deviceId);
            console.log(`Monitor routed (Legacy Audio) to: ${deviceId}`);
          }
        }
      }
      
      // Re-apply monitoring enabled state with the new routing method
      this.setMonitoringEnabled(this.monitoringEnabled);

    } catch (e) {
      console.error("setMonitoringDevice failed", e);
    }
  }

  setMonitoringEnabled(enabled: boolean) {
    this.monitoringEnabled = enabled;
    if (this.monitorGain) {
      // Use gain instead of HTMLAudioElement.muted for faster response
      const now = this.monitorContext?.currentTime || 0;
      // Only set gain if using context-based monitoring
      this.monitorGain.gain.setTargetAtTime(enabled && this.isMonitoringViaContext ? 1 : 0, now, 0.01);
    }
    
    if (this.monitorAudioElement) {
      // Only unmute if NOT using context-based monitoring
      this.monitorAudioElement.muted = !enabled || this.isMonitoringViaContext;
    }
  }

  // 테스트 신호 발생 (디버깅용)
  playTestTone() {
    if (!this.context || !this.masterGain) return;
    const osc = this.context.createOscillator();
    const g = this.context.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, this.context.currentTime);
    
    g.gain.setValueAtTime(0.3, this.context.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, this.context.currentTime + 1);
    
    osc.connect(g);
    g.connect(this.masterGain);
    
    osc.start();
    osc.stop(this.context.currentTime + 1);
  }

  updateParameters(params: EffectParams) {
    if (!this.context) return;
    const now = this.context.currentTime;
    
    // Smooth transition to prevent clicks when changing values
    // Using 0.05 time constant ensures parameters "slide" to the new value
    this.inputGain?.gain.setTargetAtTime(params.inputGain, now, 0.05);
    
    const targetMasterGain = params.isMuted ? 0 : params.masterGain;
    this.masterGain?.gain.setTargetAtTime(targetMasterGain, now, 0.05);

    this.reverbGain?.gain.setTargetAtTime(params.reverbMix, now, 0.05);
    this.delayNode?.delayTime.setTargetAtTime(params.delayTime, now, 0.05);
    this.delayFeedback?.gain.setTargetAtTime(params.delayFeedback, now, 0.05);
    this.delayWetGain?.gain.setTargetAtTime(params.delayMix, now, 0.05);
  }

  getLevels() {
    if (!this.inputAnalyzer || !this.outputAnalyzer) return { input: 0, output: 0 };
    const dataIn = new Uint8Array(this.inputAnalyzer.frequencyBinCount);
    const dataOut = new Uint8Array(this.outputAnalyzer.frequencyBinCount);
    this.inputAnalyzer.getByteFrequencyData(dataIn);
    this.outputAnalyzer.getByteFrequencyData(dataOut);
    const getAvg = (arr: Uint8Array) => arr.reduce((a, b) => a + b, 0) / arr.length;
    return { input: getAvg(dataIn) / 128, output: getAvg(dataOut) / 128 };
  }

  getAnalyzerData(dataArray: Uint8Array) {
    if (this.outputAnalyzer) {
      this.outputAnalyzer.getByteFrequencyData(dataArray);
    }
  }

  private buildImpulseResponse(duration: number, decay: number): AudioBuffer {
    const rate = this.context?.sampleRate || 48000;
    const length = rate * duration;
    const impulse = this.context!.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);
    for (let i = 0; i < length; i++) {
      const envelope = Math.pow(1 - i / length, decay);
      left[i] = (Math.random() * 2 - 1) * envelope;
      right[i] = (Math.random() * 2 - 1) * envelope;
    }
    return impulse;
  }
}

export const audioEngine = new AudioEngine();