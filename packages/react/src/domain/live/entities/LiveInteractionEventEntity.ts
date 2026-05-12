export type LiveInteractionEventEntity = {
  kind:
    | 'recipient_pasted'
    | 'amount_pasted'
    | 'warning_shown'
    | 'warning_confirmed'
    | 'warning_scrolled'
    | 'form_fill_order_observed'
    | 'page_hidden'
    | 'page_visible'
    | 'page_visibility_observed'
    | 'pointer_anomaly_observed'
    | 'rapid_scroll_observed'
    | 'click_burst_observed'
    | 'keystroke_anomaly_observed'
    | 'voice_to_text_no_keystroke_factor'
    | 'phishing_text_observed'
    | 'phishing_url_observed'
    | 'native_tampering_observed'
    | 'dev_environment_observed'
    | 'client_environment_observed'
    | 'environment_conflict_observed'
    | 'device_fingerprint_observed';
  atMs: number;
  metadata?: Record<string, unknown>;
};
