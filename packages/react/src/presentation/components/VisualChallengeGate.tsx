import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CameraPermissionRiskFactorBuildingService } from '../../application/services/CameraPermissionRiskFactorBuildingService';
import {
  VisualChallengeCameraRequestingService,
  type VisualChallengeMediaRequest,
} from '../../application/services/VisualChallengeCameraRequestingService';
import type { VisualChallengeCameraState } from '../../domain/value-objects/VisualChallengeCameraState';
import { useDeepFraud } from '../hooks/useDeepFraud';

export type VisualChallengeGateProps = {
  autoRequest?: boolean;
  className?: string;
  includeAudio?: boolean;
  requestCamera?: VisualChallengeMediaRequest;
};

export function VisualChallengeGate({
  autoRequest = false,
  className,
  includeAudio = false,
  requestCamera,
}: VisualChallengeGateProps) {
  const { assessment, replaceScopeFactors } = useDeepFraud();
  const cameraPermissionRiskFactorBuildingService = useMemo(() => new CameraPermissionRiskFactorBuildingService(), []);
  const visualChallengeCameraRequestingService = useMemo(() => new VisualChallengeCameraRequestingService(), []);
  const [cameraState, setCameraState] = useState<VisualChallengeCameraState>('idle');
  const requestedAutomatically = useRef(false);
  const shouldChallenge = assessment.decision.level === 'step_up' || assessment.decision.level === 'block';
  const classNames = ['deepfraud-visual-challenge-gate', className].filter(Boolean).join(' ');

  const startCameraChallenge = useCallback(async () => {
    if (cameraState === 'requesting') return;
    setCameraState('requesting');

    const nextState = await visualChallengeCameraRequestingService.request({
      includeAudio,
      requestCamera,
    });
    setCameraState(nextState);

    replaceScopeFactors('challenge', cameraPermissionRiskFactorBuildingService.build(nextState));
  }, [
    cameraPermissionRiskFactorBuildingService,
    cameraState,
    includeAudio,
    replaceScopeFactors,
    requestCamera,
    visualChallengeCameraRequestingService,
  ]);

  useEffect(() => {
    if (!autoRequest || !shouldChallenge || requestedAutomatically.current) return;
    requestedAutomatically.current = true;
    void startCameraChallenge();
  }, [autoRequest, shouldChallenge, startCameraChallenge]);

  if (!shouldChallenge) return null;

  return (
    <section className={classNames} data-camera-state={cameraState}>
      <button disabled={cameraState === 'requesting'} onClick={startCameraChallenge} type="button">
        {cameraState === 'requesting' ? 'Checking camera' : 'Verify camera'}
      </button>
      {cameraState === 'granted' ? <span>Camera verified</span> : null}
      {cameraState === 'denied' ? <span>Camera denied</span> : null}
      {cameraState === 'unavailable' ? <span>Camera unavailable</span> : null}
    </section>
  );
}
