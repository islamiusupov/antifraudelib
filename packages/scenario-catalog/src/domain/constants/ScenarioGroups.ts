import type { ScenarioGroupEntity } from '../entities/ScenarioGroupEntity';

export const SCENARIO_GROUPS: ScenarioGroupEntity[] = [
  { factor: 'copy_paste_recipient', prefix: 'CPY', kind: 'factor', tier: 'LIVE', expectedCount: 20 },
  { factor: 'new_recipient', prefix: 'NRC', kind: 'factor', tier: 'MOCK', expectedCount: 20 },
  { factor: 'concurrent_media', prefix: 'CMD', kind: 'factor', tier: 'LIVE', expectedCount: 20 },
  { factor: 'warning_dwell', prefix: 'WDW', kind: 'factor', tier: 'LIVE', expectedCount: 20 },
  { factor: 'keystroke_dynamics', prefix: 'KST', kind: 'factor', tier: 'LIVE', expectedCount: 20 },
  { factor: 'pointer_pattern', prefix: 'PTR', kind: 'factor', tier: 'PAPER', expectedCount: 20 },
  { factor: 'native_tampering', prefix: 'NTV', kind: 'factor', tier: 'LIVE', expectedCount: 20 },
  { factor: 'dev_environment', prefix: 'DEV', kind: 'factor', tier: 'LIVE', expectedCount: 20 },
  { factor: 'bot_detection', prefix: 'BOT', kind: 'factor', tier: 'LIVE', expectedCount: 20 },
  { factor: 'phishing_text_dom', prefix: 'PTD', kind: 'factor', tier: 'LIVE', expectedCount: 20 },
  { factor: 'phishing_url', prefix: 'PUL', kind: 'factor', tier: 'LIVE', expectedCount: 20 },
  { factor: 'page_visibility', prefix: 'PGV', kind: 'factor', tier: 'LIVE', expectedCount: 20 },
  { factor: 'recent_token_injection', prefix: 'TKN', kind: 'factor', tier: 'PAPER', expectedCount: 20 },
  { factor: 'visual_challenge', prefix: 'VIS', kind: 'visual', tier: 'VISUAL', expectedCount: 20 },
  { factor: 'client_environment', prefix: 'ENV', kind: 'factor', tier: 'PAPER', expectedCount: 20 },
  { factor: 'environment_conflicts', prefix: 'CNF', kind: 'factor', tier: 'PAPER', expectedCount: 20 },
  { factor: 'device_fingerprint', prefix: 'DFP', kind: 'session', tier: 'SESSION', expectedCount: 20 },
];
