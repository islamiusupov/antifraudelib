import { describe, expect, it } from 'vitest';
import { ClientEnvironmentInspectingService } from '../../../src/application/services/ClientEnvironmentInspectingService';

describe('ClientEnvironmentInspectingService', () => {
  it('reports webdriver, electron, devtools hook, and native tampering signals', () => {
    const service = new ClientEnvironmentInspectingService();

    expect(
      service.inspect({
        navigator: {
          userAgent: 'Mozilla/5.0 Chrome/124',
          platform: 'Win32',
          webdriver: true,
        },
        process: {
          versions: {
            electron: '30.0.0',
          },
        },
        hasDevtoolsHook: true,
        functionToStringTampered: true,
      }).map((event) => event.kind),
    ).toEqual(['dev_environment_observed', 'native_tampering_observed']);
  });

  it('reports outdated browser and platform conflicts', () => {
    const service = new ClientEnvironmentInspectingService();

    expect(
      service.inspect({
        navigator: {
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile MSIE Trident/7.0',
          platform: 'Win32',
          maxTouchPoints: 0,
        },
      }).map((event) => event.kind),
    ).toEqual(['client_environment_observed', 'environment_conflict_observed']);
  });

  it('returns no events for consistent modern browser metadata', () => {
    const service = new ClientEnvironmentInspectingService();

    expect(
      service.inspect({
        navigator: {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0',
          platform: 'Win32',
          maxTouchPoints: 0,
        },
      }),
    ).toEqual([]);
  });
});
