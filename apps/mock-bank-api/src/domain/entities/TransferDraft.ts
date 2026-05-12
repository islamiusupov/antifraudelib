import type { TransferPrepareRequest } from './TransferPrepareRequest';
import type { TransferPrepareResponse } from './TransferPrepareResponse';

export type TransferDraft = {
  draftId: string;
  request: TransferPrepareRequest;
  response: TransferPrepareResponse;
  createdAt: string;
  confirmed: boolean;
};
