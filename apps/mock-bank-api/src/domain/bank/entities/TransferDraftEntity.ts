import type { TransferPrepareRequestEntity } from './TransferPrepareRequestEntity';
import type { TransferPrepareResponseEntity } from './TransferPrepareResponseEntity';

export type TransferDraftEntity = {
  draftId: string;
  request: TransferPrepareRequestEntity;
  response: TransferPrepareResponseEntity;
  createdAt: string;
  confirmed: boolean;
};
