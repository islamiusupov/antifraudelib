import type { CameraPermissionState } from '../value-objects/CameraPermissionState';

export type VisualChallengeFrameEntity = {
  cameraPermission: CameraPermissionState;
  faceCount?: number;
  blinkDetected?: boolean;
  movementDetected?: boolean;
};
