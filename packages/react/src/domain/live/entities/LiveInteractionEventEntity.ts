export type LiveInteractionEventEntity = {
  kind:
    | 'recipient_pasted'
    | 'warning_shown'
    | 'warning_confirmed'
    | 'page_hidden'
    | 'page_visible'
    | 'pointer_anomaly_observed'
    | 'keystroke_anomaly_observed'
    | 'phishing_text_observed'
    | 'native_tampering_observed'
    | 'dev_environment_observed'
    | 'client_environment_observed'
    | 'environment_conflict_observed';
  atMs: number;
  metadata?: Record<string, unknown>;
};
