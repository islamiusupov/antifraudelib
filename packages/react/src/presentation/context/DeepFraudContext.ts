import { createContext } from 'react';
import type { DeepFraudContextValueEntity } from '../../domain/common/entities/DeepFraudContextValueEntity';

export const DeepFraudContext = createContext<DeepFraudContextValueEntity | undefined>(undefined);
