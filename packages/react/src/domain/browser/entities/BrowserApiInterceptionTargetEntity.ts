export type BrowserApiInterceptionTargetEntity = {
  fetch?: (input: unknown, init?: unknown) => Promise<unknown>;
  XMLHttpRequest?: new (...args: unknown[]) => BrowserXmlHttpRequestEntity;
  navigator?: {
    mediaDevices?: {
      getUserMedia?: (constraints?: MediaStreamConstraints) => Promise<MediaStream>;
    };
    clipboard?: {
      readText?: () => Promise<string>;
      writeText?: (text: string) => Promise<void>;
    };
  };
};

export type BrowserXmlHttpRequestEntity = {
  open?: (method: string, url: string, ...args: unknown[]) => unknown;
  send?: (body?: unknown) => unknown;
};
