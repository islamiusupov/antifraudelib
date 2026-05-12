export type LiveInteractionTargetEntity = {
  document?: LiveInteractionDocumentEntity;
  window?: LiveInteractionWindowEntity;
  MutationObserver?: new (callback: () => void) => LiveInteractionMutationObserverEntity;
  SpeechRecognition?: new () => LiveInteractionSpeechRecognitionEntity;
  webkitSpeechRecognition?: new () => LiveInteractionSpeechRecognitionEntity;
  navigator?: {
    userAgent?: string;
    platform?: string;
    languages?: string[];
    webdriver?: boolean;
    maxTouchPoints?: number;
  };
  process?: {
    versions?: Record<string, string | undefined>;
  };
  hasDevtoolsHook?: boolean;
  functionToStringTampered?: boolean;
};

export type LiveInteractionDocumentEntity = {
  body?: {
    innerText?: string;
    textContent?: string;
  };
  visibilityState?: 'hidden' | 'visible' | 'prerender' | string;
  addEventListener(type: string, listener: (event: LiveInteractionDomEventEntity) => void): void;
  removeEventListener(type: string, listener: (event: LiveInteractionDomEventEntity) => void): void;
};

export type LiveInteractionWindowEntity = {
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
};

export type LiveInteractionMutationObserverEntity = {
  observe(target: unknown, options: Record<string, unknown>): void;
  disconnect(): void;
};

export type LiveInteractionDomEventEntity = {
  target?: unknown;
  clipboardData?: {
    getData(type: string): string;
  };
  clientX?: number;
  clientY?: number;
  deltaX?: number;
  deltaY?: number;
  key?: string;
  isTrusted?: boolean;
};

export type LiveInteractionSpeechRecognitionEntity = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult?: (event: LiveInteractionSpeechRecognitionEventEntity) => void;
  onerror?: () => void;
  start(): void;
  stop(): void;
};

export type LiveInteractionSpeechRecognitionEventEntity = {
  results: {
    length: number;
    [index: number]: {
      length: number;
      [index: number]: {
        transcript: string;
      };
    };
  };
};
