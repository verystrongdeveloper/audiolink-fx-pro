export interface AudioDevice {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

export type InputChannelMode = 'left' | 'right' | 'mix';

export interface EffectParams {
  reverbMix: number; // 0 to 1
  reverbDecay: number; // 0 to 10
  delayTime: number; // 0 to 1 (seconds)
  delayFeedback: number; // 0 to 1
  delayMix: number; // 0 to 1
  masterGain: number; // 0 to 2
  inputGain: number; // 0 to 2
  inputGain2: number; // 0 to 2
  inputPan: number; // -1 to 1
  inputPan2: number; // -1 to 1
  inputChannelMode: InputChannelMode;
  inputChannelMode2: InputChannelMode;
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
