export type KeystrokeDynamicsInputEntity = {
  intervalsMs: number[];
  baselineIntervalsMs?: number[];
  baselineMedianMs: number;
  baselineSampleCount?: number;
  minimumBaselineSampleCount?: number;
  inputMethod?: string;
  baselineInputMethod?: string;
  keyboardLayout?: string;
  baselineKeyboardLayout?: string;
};
