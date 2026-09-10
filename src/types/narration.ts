export type NarratorProvider = 'browser' | 'vieneu';

export interface NarratorVoice {
  id: string;
  name: string;
}

export interface SynthesizeNarrationRequest {
  text: string;
  voiceId?: string | null;
}
