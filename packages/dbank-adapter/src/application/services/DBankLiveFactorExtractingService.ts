import type { RiskSignalEntity } from '@deepcode/antifraud-core';
import type { DBankObservedEventEntity } from '../../domain/dbank/entities/DBankObservedEventEntity';

export class DBankLiveFactorExtractingService {
  extract(events: DBankObservedEventEntity[]): RiskSignalEntity[] {
    const signals: RiskSignalEntity[] = [];

    if (this.hasEvent(events, 'recipient_pasted')) {
      signals.push({
        kind: 'copy_paste_recipient',
        detected: true,
        confidence: 1,
        reasonCodes: ['copy_paste_recipient'],
        source: 'live',
      });
    }
    if (this.hasEvent(events, 'recipient_created')) {
      signals.push({
        kind: 'new_recipient',
        detected: true,
        confidence: 1,
        reasonCodes: ['new_recipient_in_flow'],
        source: 'server',
      });
    }
    if (this.hasEvent(events, 'media_active')) {
      signals.push({
        kind: 'concurrent_media',
        detected: true,
        confidence: 1,
        reasonCodes: ['concurrent_media_active'],
        source: 'live',
      });
    }
    if (this.hasFastWarningConfirmation(events)) {
      signals.push({
        kind: 'warning_dwell',
        detected: true,
        confidence: 0.9,
        reasonCodes: ['warning_dwell_too_short'],
        source: 'live',
      });
    }
    if (this.hasEvent(events, 'page_hidden') && this.hasEvent(events, 'page_visible')) {
      signals.push({
        kind: 'page_visibility',
        detected: true,
        confidence: 0.8,
        reasonCodes: ['page_visibility_oscillation'],
        source: 'live',
      });
    }
    if (this.hasEvent(events, 'visual_challenge_started')) {
      signals.push({
        kind: 'visual_challenge',
        detected: true,
        confidence: 1,
        reasonCodes: ['visual_challenge_started'],
        source: 'live',
      });
    }
    if (this.hasEvent(events, 'keystroke_anomaly_observed')) {
      signals.push({
        kind: 'keystroke_dynamics',
        detected: true,
        confidence: 0.8,
        reasonCodes: ['keystroke_dynamics_anomaly'],
        source: 'live',
      });
    }
    if (this.hasEvent(events, 'pointer_anomaly_observed')) {
      signals.push({
        kind: 'pointer_pattern',
        detected: true,
        confidence: 0.8,
        reasonCodes: ['pointer_pattern_anomaly'],
        source: 'paper',
      });
    }
    if (this.hasEvent(events, 'native_tampering_observed')) {
      signals.push({
        kind: 'native_tampering',
        detected: true,
        confidence: 1,
        reasonCodes: ['native_tampering'],
        source: 'live',
      });
    }
    if (this.hasEvent(events, 'dev_environment_observed')) {
      signals.push({
        kind: 'dev_environment',
        detected: true,
        confidence: 1,
        reasonCodes: ['dev_environment'],
        source: 'live',
      });
    }
    if (this.hasEvent(events, 'bot_detected')) {
      signals.push({
        kind: 'bot_detection',
        detected: true,
        confidence: 1,
        reasonCodes: ['bot_detection'],
        source: 'live',
      });
    }
    if (this.hasEvent(events, 'phishing_text_observed')) {
      signals.push({
        kind: 'phishing_text_dom',
        detected: true,
        confidence: 1,
        reasonCodes: ['phishing_text_dom'],
        source: 'live',
      });
    }
    if (this.hasEvent(events, 'phishing_url_observed')) {
      signals.push({
        kind: 'phishing_url',
        detected: true,
        confidence: 1,
        reasonCodes: ['phishing_url_pattern'],
        source: 'live',
      });
    }
    if (this.hasEvent(events, 'token_injection_observed')) {
      signals.push({
        kind: 'recent_token_injection',
        detected: true,
        confidence: 1,
        reasonCodes: ['recent_token_injection'],
        source: 'paper',
      });
    }
    if (this.hasEvent(events, 'client_environment_observed')) {
      signals.push({
        kind: 'client_environment',
        detected: true,
        confidence: 0.8,
        reasonCodes: ['client_environment'],
        source: 'paper',
      });
    }
    if (this.hasEvent(events, 'environment_conflict_observed')) {
      signals.push({
        kind: 'environment_conflicts',
        detected: true,
        confidence: 0.9,
        reasonCodes: ['environment_conflicts'],
        source: 'paper',
      });
    }
    if (this.hasEvent(events, 'device_fingerprint_observed')) {
      signals.push({
        kind: 'device_fingerprint',
        detected: true,
        confidence: 1,
        reasonCodes: ['device_fingerprint'],
        source: 'server',
      });
    }
    events
      .filter((event) => event.kind === 'server_factor_observed')
      .forEach((event) => {
        const factor = event.metadata?.factor;
        if (typeof factor !== 'string') return;
        signals.push({
          kind: factor,
          detected: true,
          confidence: 1,
          reasonCodes: [`${factor}_server_helper`],
          source: 'server',
        });
      });

    return signals;
  }

  private hasEvent(events: DBankObservedEventEntity[], kind: DBankObservedEventEntity['kind']): boolean {
    return events.some((event) => event.kind === kind);
  }

  private hasFastWarningConfirmation(events: DBankObservedEventEntity[]): boolean {
    const warningShown = events.find((event) => event.kind === 'warning_shown');
    const warningConfirmed = events.find((event) => event.kind === 'warning_confirmed');
    if (warningShown === undefined || warningConfirmed === undefined) return false;
    return warningConfirmed.atMs - warningShown.atMs < 1000;
  }
}
