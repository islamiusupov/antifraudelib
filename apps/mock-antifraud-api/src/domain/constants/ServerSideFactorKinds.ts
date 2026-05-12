export const SERVER_SIDE_FACTOR_KINDS = [
  'new_recipient',
  'amount_anomaly',
  'time_of_day_anomaly',
  'velocity_anomaly',
  'recipient_velocity',
  'recipient_account_age',
  'geoip_jump',
  'time_since_login',
  'tls_fingerprint',
  'request_idempotency_breach',
  'recent_password_change',
  'recent_contact_change',
  'device_id_per_user_ratio',
  'shared_recipient_graph',
  'parallel_session',
  'incoming_call_correlation',
] as const;

export type ServerSideFactorKind = typeof SERVER_SIDE_FACTOR_KINDS[number];
