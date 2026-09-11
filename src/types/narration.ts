export type NarratorProvider = 'browser' | 'vieneu';

export interface NarratorVoice {
  id: string;
  name: string;
  isCloned?: boolean;
}

export interface SynthesizeNarrationRequest {
  text: string;
  voiceId?: string | null;
}
