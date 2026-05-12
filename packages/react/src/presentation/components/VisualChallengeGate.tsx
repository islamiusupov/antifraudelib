import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CameraPermissionRiskFactorBuildingService } from '../../application/services/CameraPermissionRiskFactorBuildingService';
import type { VisualChallengeCameraState } from '../../domain/value-objects/VisualChallengeCameraState';
import { useDeepFraud } from '../hooks/useDeepFraud';

export type VisualChallengeGateProps = {
  autoRequest?: boolean;
  className?: string;
  includeAudio?: boolean;
  requestCamera?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
};

export function VisualChallengeGate({
  autoRequest = false,
  className,
  includeAudio = false,
  requestCamera,
}: VisualChallengeGateProps) {
  const { assessment, replaceScopeFactors } = useDeepFraud();
  const cameraPermissionRiskFactorBuildingService = useMemo(() => new CameraPermissionRiskFactorBuildingService(), []);
  const [cameraState, setCameraState] = useState<VisualChallengeCameraState>('idle');
  const requestedAutomatically = useRef(false);
  const shouldChallenge = assessment.decision.level === 'step_up' || assessment.decision.level === 'block';
  const classNames = ['deepfraud-visual-challenge-gate', className].filter(Boolean).join(' ');

  const startCameraChallenge = useCallback(async () => {
    if (cameraState === 'requesting') return;
    setCameraState('requesting');

    try {
      const stream = await resolveCameraRequest(requestCamera)({
        video: true,
        audio: includeAudio,
      });
      stream.getTracks().forEach((track) => track.stop());
      setCameraState('granted');
      replaceScopeFactors('challenge', []);
    } catch {
      const nextState = hasCameraApi(requestCamera) ? 'denied' : 'unavailable';
      setCameraState(nextState);
      replaceScopeFactors('challenge', cameraPermissionRiskFactorBuildingService.build(nextState));
    }
  }, [cameraPermissionRiskFactorBuildingService, cameraState, includeAudio, replaceScopeFactors, requestCamera]);

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

function resolveCameraRequest(
  requestCamera?: (constraints: MediaStreamConstraints) => Promise<MediaStream>,
): (constraints: MediaStreamConstraints) => Promise<MediaStream> {
  if (requestCamera !== undefined) return requestCamera;
  if (typeof navigator === 'undefined' || navigator.mediaDevices?.getUserMedia === undefined) {
    return () => Promise.reject(new Error('Camera API unavailable'));
  }
  return (constraints) => navigator.mediaDevices.getUserMedia(constraints);
}

function hasCameraApi(requestCamera?: (constraints: MediaStreamConstraints) => Promise<MediaStream>): boolean {
  return requestCamera !== undefined || (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia !== undefined);
}
