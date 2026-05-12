import type { CatalogScenarioEntity } from '@deepcode/antifraud-scenario-catalog';
import type { BankActionEntity } from '../../domain/harness/entities/BankActionEntity';

export class ScenarioTraceBuildingService {
  build(scenario: CatalogScenarioEntity): BankActionEntity[] {
    const baseTrace = scenario.factor === 'visual_challenge' ? [this.action('bank_opened', 0)] : this.baseTransferTrace();
    const factorTrace = this.factorTrace(scenario.factor);
    const submitTrace = factorTrace.some((action) => action.kind === 'visual_challenge_started')
      ? []
      : [this.action('transfer_submitted', 1000)];

    return [...baseTrace, ...factorTrace, ...submitTrace];
  }

  private baseTransferTrace(): BankActionEntity[] {
    return [this.action('bank_opened', 0), this.action('transfer_opened', 100)];
  }

  private factorTrace(factor: string): BankActionEntity[] {
    const directTraces: Record<string, BankActionEntity[]> = {
      copy_paste_recipient: [this.action('recipient_pasted', 300)],
      new_recipient: [this.action('recipient_created', 300)],
      concurrent_media: [this.action('media_active', 50)],
      warning_dwell: [this.action('warning_shown', 300), this.action('warning_confirmed', 700)],
      page_visibility: [this.action('page_hidden', 300), this.action('page_visible', 800)],
      visual_challenge: [this.action('visual_challenge_started', 300)],
      keystroke_dynamics: [this.action('keystroke_anomaly_observed', 300)],
      pointer_pattern: [this.action('pointer_anomaly_observed', 300)],
      native_tampering: [this.action('native_tampering_observed', 300)],
      dev_environment: [this.action('dev_environment_observed', 300)],
      bot_detection: [this.action('bot_detected', 300)],
      phishing_text_dom: [this.action('phishing_text_observed', 300)],
      phishing_url: [this.action('phishing_url_observed', 300)],
      recent_token_injection: [this.action('token_injection_observed', 300)],
      client_environment: [this.action('client_environment_observed', 300)],
      environment_conflicts: [this.action('environment_conflict_observed', 300)],
      device_fingerprint: [this.action('device_fingerprint_observed', 300)],
    };

    return directTraces[factor] ?? [this.action('server_factor_observed', 300, { factor })];
  }

  private action(kind: BankActionEntity['kind'], atMs: number, metadata?: Record<string, unknown>): BankActionEntity {
    return { kind, atMs, metadata };
  }
}
