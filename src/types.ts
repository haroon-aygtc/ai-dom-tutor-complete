export interface Language {
  code: string;
  label: string;
  ttsVoice: string;
  rtl: boolean;
}

export interface AIProvider {
  name: string;
  endpoint: string;
  model: string;
  apiKey: string;
  supportedLanguages: string[];
}

export interface Config {
  activeProvider: string;
  language: string;
  providers: Record<string, AIProvider>;
  languages: Language[];
  isActive: boolean;
  voiceEnabled: boolean;
  tooltipEnabled: boolean;
}

export interface ElementData {
  tagName: string;
  type: string;
  label: string;
  placeholder?: string;
  name?: string;
  id?: string;
  value?: string;
  ariaLabel?: string;
}

export interface Message {
  action: string;
  config?: Partial<Config>;
  elementData?: ElementData;
  language?: string;
  data?: any;
}

export interface MessageResponse {
  success?: boolean;
  explanation?: string;
  error?: string;
  config?: Config;
  data?: any;
}

export interface TutorState {
  isActive: boolean;
  currentLanguage: string;
  currentElement: HTMLElement | null;
  tooltip: HTMLElement | null;
}