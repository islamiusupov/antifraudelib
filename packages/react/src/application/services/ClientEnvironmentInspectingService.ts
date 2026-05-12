import type { LiveInteractionEventEntity } from '../../domain/live/entities/LiveInteractionEventEntity';
import type { LiveInteractionTargetEntity } from '../../domain/live/entities/LiveInteractionTargetEntity';

export class ClientEnvironmentInspectingService {
  inspect(target: LiveInteractionTargetEntity = globalThis as unknown as LiveInteractionTargetEntity): LiveInteractionEventEntity[] {
    const events: LiveInteractionEventEntity[] = [];
    const navigator = target.navigator;
    const userAgent = navigator?.userAgent ?? '';
    const platform = navigator?.platform ?? '';

    if (navigator?.webdriver === true) {
      events.push(this.event('dev_environment_observed', { platform, reason: 'webdriver_enabled', userAgent }));
    }

    if (target.callPhantom !== undefined) {
      events.push(this.event('dev_environment_observed', {
        platform,
        reason: 'phantomjs_callphantom_defined',
        userAgent,
      }));
    }

    if (this.isHeadlessDevtools(target, userAgent)) {
      events.push(this.event('dev_environment_observed', {
        platform,
        reason: 'headless_devtools_test_stand',
        userAgent,
      }));
    } else if (this.isMobileRemoteDebugging(target, userAgent)) {
      events.push(this.event('dev_environment_observed', {
        platform,
        reason: 'devtools_mobile_remote_debugging',
        userAgent,
      }));
    } else if (target.process?.versions?.electron !== undefined || target.hasDevtoolsHook === true) {
      events.push(this.event('dev_environment_observed', { platform, reason: 'dev_environment', userAgent }));
    }

    if (target.functionToStringTampered === true) {
      events.push(this.event('native_tampering_observed', { check: 'function_to_string' }));
    }

    if (/MSIE|Trident\//i.test(userAgent)) {
      events.push(this.event('client_environment_observed', { reason: 'outdated_browser', userAgent }));
    }

    if (this.hasPlatformConflict(userAgent, platform, navigator?.maxTouchPoints ?? 0)) {
      events.push(this.event('environment_conflict_observed', { userAgent, platform }));
    }

    return events;
  }

  private hasPlatformConflict(userAgent: string, platform: string, maxTouchPoints: number): boolean {
    const mobileUa = /Android|iPhone|iPad|Mobile/i.test(userAgent);
    const desktopPlatform = /Win|MacIntel|Linux x86/i.test(platform);
    if (mobileUa && desktopPlatform && maxTouchPoints === 0) return true;

    const windowsUa = /Windows/i.test(userAgent);
    const applePlatform = /iPhone|iPad|Mac/i.test(platform);
    return windowsUa && applePlatform;
  }

  private isHeadlessDevtools(target: LiveInteractionTargetEntity, userAgent: string): boolean {
    return target.hasDevtoolsHook === true && /HeadlessChrome|PhantomJS/i.test(userAgent);
  }

  private isMobileRemoteDebugging(target: LiveInteractionTargetEntity, userAgent: string): boolean {
    return target.hasDevtoolsHook === true && /Android|iPhone|iPad|Mobile/i.test(userAgent);
  }

  private event(kind: LiveInteractionEventEntity['kind'], metadata: Record<string, unknown>): LiveInteractionEventEntity {
    return {
      kind,
      atMs: Date.now(),
      metadata,
    };
  }
}
