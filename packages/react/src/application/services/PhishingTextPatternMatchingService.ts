const PHISHING_TEXT_PATTERNS = [
  /safe\s*account/i,
  /security\s*account/i,
  /remote\s*access/i,
  /urgent\s+transfer/i,
  /do\s+not\s+tell\s+the\s+bank/i,
  /безопасн[а-я]+\s+сч[её]т/i,
  /сотрудник\s+(банка|мвд|фсб|цб)/i,
  /никому\s+не\s+говор/i,
  /переведите?\s+.*(срочно|немедленно)/i,
  /код\s+из\s+смс/i,
];

const WARNING_TEXT_PATTERNS = [
  /warning/i,
  /fraud/i,
  /scam/i,
  /подозритель/i,
  /мошен/i,
  /предупреж/i,
];

export class PhishingTextPatternMatchingService {
  hasPhishingText(text: string): boolean {
    return PHISHING_TEXT_PATTERNS.some((pattern) => pattern.test(text));
  }

  hasWarningText(text: string): boolean {
    return WARNING_TEXT_PATTERNS.some((pattern) => pattern.test(text));
  }
}
