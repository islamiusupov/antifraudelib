export class BrowserApiAllowlistingService {
  isAllowed(url: string | undefined, allowedUrls: Array<string | RegExp> = []): boolean {
    if (url === undefined || url.trim().length === 0) return false;
    return allowedUrls.some((pattern) => this.matches(url, pattern));
  }

  private matches(url: string, pattern: string | RegExp): boolean {
    if (typeof pattern === 'string') {
      return url.startsWith(pattern);
    }
    return pattern.test(url);
  }
}
