import type { BrowserApiInterceptionConfigEntity } from '../../domain/entities/BrowserApiInterceptionConfigEntity';
import type { BrowserApiInterceptionEventEntity } from '../../domain/entities/BrowserApiInterceptionEventEntity';
import type {
  BrowserApiInterceptionTargetEntity,
  BrowserXmlHttpRequestEntity,
} from '../../domain/entities/BrowserApiInterceptionTargetEntity';
import { BrowserApiAllowlistingService } from './BrowserApiAllowlistingService';
import { BrowserTokenPatternMatchingService } from './BrowserTokenPatternMatchingService';

type UninstallingBrowserApiInterception = () => void;

export class BrowserApiInterceptionInstallingService {
  constructor(
    private readonly browserApiAllowlistingService = new BrowserApiAllowlistingService(),
    private readonly browserTokenPatternMatchingService = new BrowserTokenPatternMatchingService(),
  ) {}

  install(config: BrowserApiInterceptionConfigEntity): UninstallingBrowserApiInterception {
    const target = config.target ?? (globalThis as unknown as BrowserApiInterceptionTargetEntity);
    const uninstallers = [
      this.patchFetch(target, config),
      this.patchXmlHttpRequest(target, config),
      this.patchGetUserMedia(target, config),
      this.patchClipboard(target, config),
    ].filter((uninstall): uninstall is UninstallingBrowserApiInterception => uninstall !== undefined);

    return () => {
      uninstallers.reverse().forEach((uninstall) => uninstall());
    };
  }

  private patchFetch(
    target: BrowserApiInterceptionTargetEntity,
    config: BrowserApiInterceptionConfigEntity,
  ): UninstallingBrowserApiInterception | undefined {
    const originalFetch = target.fetch;
    if (originalFetch === undefined) return undefined;

    target.fetch = (input: unknown, init?: unknown) => {
      const url = this.resolveUrl(input);
      this.emit(config, {
        kind: 'fetch_requested',
        allowed: this.browserApiAllowlistingService.isAllowed(url, config.allowedUrls),
        metadata: {
          url,
          hasTokenLikePayload: this.browserTokenPatternMatchingService.hasTokenLikePayload([url, input, init]),
        },
      });
      return originalFetch(input, init);
    };

    return () => {
      target.fetch = originalFetch;
    };
  }

  private patchXmlHttpRequest(
    target: BrowserApiInterceptionTargetEntity,
    config: BrowserApiInterceptionConfigEntity,
  ): UninstallingBrowserApiInterception | undefined {
    const OriginalXmlHttpRequest = target.XMLHttpRequest;
    if (OriginalXmlHttpRequest === undefined) return undefined;
    const XmlHttpRequestConstructor = OriginalXmlHttpRequest;
    const service = this;

    function WrappedXmlHttpRequest(this: BrowserXmlHttpRequestEntity, ...args: unknown[]) {
      const xhr = new XmlHttpRequestConstructor(...args);
      let method = '';
      let url: string | undefined;
      const originalOpen = xhr.open;
      const originalSend = xhr.send;

      if (originalOpen !== undefined) {
        xhr.open = function open(methodArg: string, urlArg: string, ...openArgs: unknown[]) {
          method = String(methodArg);
          url = service.resolveUrl(urlArg);
          return originalOpen.call(xhr, methodArg, urlArg, ...openArgs);
        };
      }

      if (originalSend !== undefined) {
        xhr.send = function send(body?: unknown) {
          service.emit(config, {
            kind: 'xhr_requested',
            allowed: service.browserApiAllowlistingService.isAllowed(url, config.allowedUrls),
            metadata: {
              method,
              url,
              hasTokenLikePayload: service.browserTokenPatternMatchingService.hasTokenLikePayload([url, body]),
            },
          });
          return originalSend.call(xhr, body);
        };
      }

      return xhr;
    }

    WrappedXmlHttpRequest.prototype = OriginalXmlHttpRequest.prototype;
    target.XMLHttpRequest = WrappedXmlHttpRequest as unknown as BrowserApiInterceptionTargetEntity['XMLHttpRequest'];

    return () => {
      target.XMLHttpRequest = OriginalXmlHttpRequest;
    };
  }

  private patchGetUserMedia(
    target: BrowserApiInterceptionTargetEntity,
    config: BrowserApiInterceptionConfigEntity,
  ): UninstallingBrowserApiInterception | undefined {
    const mediaDevices = target.navigator?.mediaDevices;
    const originalGetUserMedia = mediaDevices?.getUserMedia;
    if (mediaDevices === undefined || originalGetUserMedia === undefined) return undefined;

    mediaDevices.getUserMedia = (constraints?: MediaStreamConstraints) => {
      this.emit(config, {
        kind: 'media_requested',
        allowed: false,
        metadata: {
          audio: this.hasConstraint(constraints?.audio),
          video: this.hasConstraint(constraints?.video),
        },
      });
      return originalGetUserMedia.call(mediaDevices, constraints);
    };

    return () => {
      mediaDevices.getUserMedia = originalGetUserMedia;
    };
  }

  private patchClipboard(
    target: BrowserApiInterceptionTargetEntity,
    config: BrowserApiInterceptionConfigEntity,
  ): UninstallingBrowserApiInterception | undefined {
    const clipboard = target.navigator?.clipboard;
    if (clipboard === undefined) return undefined;
    const originalReadText = clipboard.readText;
    const originalWriteText = clipboard.writeText;

    if (originalReadText !== undefined) {
      clipboard.readText = async () => {
        const text = await originalReadText.call(clipboard);
        this.emitClipboard(config, 'clipboard_read', text);
        return text;
      };
    }

    if (originalWriteText !== undefined) {
      clipboard.writeText = async (text: string) => {
        this.emitClipboard(config, 'clipboard_write', text);
        return originalWriteText.call(clipboard, text);
      };
    }

    return () => {
      clipboard.readText = originalReadText;
      clipboard.writeText = originalWriteText;
    };
  }

  private emitClipboard(
    config: BrowserApiInterceptionConfigEntity,
    kind: BrowserApiInterceptionEventEntity['kind'],
    text: string,
  ): void {
    this.emit(config, {
      kind,
      allowed: false,
      metadata: {
        textLength: text.length,
        hasOtpPattern: this.browserTokenPatternMatchingService.hasOtpPattern(text),
        hasTokenLikePayload: this.browserTokenPatternMatchingService.hasTokenLikePayload(text),
      },
    });
  }

  private emit(
    config: BrowserApiInterceptionConfigEntity,
    event: Omit<BrowserApiInterceptionEventEntity, 'atMs'>,
  ): void {
    config.onEvent({
      ...event,
      atMs: config.now?.() ?? Date.now(),
    });
  }

  private resolveUrl(input: unknown): string | undefined {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.toString();
    if (input !== null && typeof input === 'object' && 'url' in input) {
      const url = (input as { url?: unknown }).url;
      return typeof url === 'string' ? url : undefined;
    }
    return undefined;
  }

  private hasConstraint(constraint: MediaTrackConstraints | boolean | undefined): boolean {
    if (constraint === undefined) return false;
    if (typeof constraint === 'boolean') return constraint;
    return true;
  }
}
