import { useContext } from 'react';
import { DeepFraudContext } from '../context/DeepFraudContext';
import type { DeepFraudContextValueEntity } from '../../domain/common/entities/DeepFraudContextValueEntity';

export function useDeepFraud(): DeepFraudContextValueEntity {
  const context = useContext(DeepFraudContext);
  if (context === undefined) {
    throw new Error('useDeepFraud must be used inside DeepFraudRoot');
  }
  return context;
}
