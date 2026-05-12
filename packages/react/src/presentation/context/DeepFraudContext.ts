import { createContext } from 'react';
import type { DeepFraudContextValueEntity } from '../../domain/entities/DeepFraudContextValueEntity';

export const DeepFraudContext = createContext<DeepFraudContextValueEntity | undefined>(undefined);
