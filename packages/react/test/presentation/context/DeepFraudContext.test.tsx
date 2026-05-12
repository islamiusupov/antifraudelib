import { describe, expect, it } from 'vitest';
import { DeepFraudContext } from '../../../src/presentation/context/DeepFraudContext';

describe('DeepFraudContext', () => {
  it('starts without a default value', () => {
    expect(DeepFraudContext._currentValue).toBeUndefined();
  });
});
