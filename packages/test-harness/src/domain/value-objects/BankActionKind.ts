export type BankActionKind =
  | 'bank_opened'
  | 'transfer_opened'
  | 'recipient_pasted'
  | 'recipient_created'
  | 'transfer_submitted'
  | 'warning_shown'
  | 'warning_confirmed'
  | 'media_active'
  | 'page_hidden'
  | 'page_visible'
  | 'visual_challenge_started';
