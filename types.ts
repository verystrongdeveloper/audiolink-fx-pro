export interface AudioDevice {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

export interface EffectParams {
  reverbMix: number; // 0 to 1
  reverbDecay: number; // 0 to 10
  delayTime: number; // 0 to 1 (seconds)
  delayFeedback: number; // 0 to 1
  delayMix: number; // 0 to 1
  masterGain: number; // 0 to 2
  inputGain: number; // 0 to 2
  isMuted: boolean;
  monitoringEnabled: boolean;
}

// Extend HTMLMediaElement to support setSinkId (experimental feature in some TS libs)
export interface AudioOutputElement extends HTMLAudioElement {
  setSinkId(deviceId: string): Promise<void>;
  sinkId: string;
}

export interface AnalyzerData {
  timeDomain: Uint8Array;
  frequency: Uint8Array;
}
