import { describe, expect, it } from 'vitest';
import { PointerMovementCollectingService } from '../../../src/application/services/PointerMovementCollectingService';
import type { LiveInteractionDomEventEntity } from '../../../src/domain/live/entities/LiveInteractionTargetEntity';

describe('PointerMovementCollectingService', () => {
  it('converts DOM pointer events into pointer verdicts', () => {
    const service = new PointerMovementCollectingService();
    const state = service.createState();

    expect(service.recordPointerMove(state, pointerMove(0, 0), 0)).toBeNull();
    expect(service.recordPointerMove(state, pointerMove(260, 0), 50)?.reasonCode).toBe('pointer_teleport_jump');
  });

  it('uses click target geometry to detect exact hits without hover exploration', () => {
    const service = new PointerMovementCollectingService();
    const state = service.createState();

    const verdict = service.recordClick(
      state,
      {
        clientX: 120,
        clientY: 110,
        pointerType: 'mouse',
        target: {
          textContent: 'Approve',
          getBoundingClientRect: () => ({ left: 100, top: 100, width: 40, height: 20 }),
        },
      },
      100,
    );

    expect(verdict).toMatchObject({
      level: 'step_up',
      reasonCode: 'pointer_exact_hit_no_hover_exploration',
      metadata: {
        targetText: 'Approve',
      },
    });
  });

  it('attaches fast reading-form completion metadata to the latest pointer risk', () => {
    const service = new PointerMovementCollectingService();
    const state = service.createState();

    service.recordFormInteraction(state, 0, true);
    service.recordPointerMove(state, pointerMove(0, 0), 100);
    service.recordPointerMove(state, pointerMove(260, 0), 200);

    expect(service.recordFormSubmit(state, 4200)).toMatchObject({
      reasonCode: 'pointer_teleport_jump',
      metadata: {
        formDurationMs: 4200,
        formRequiresReading: true,
      },
    });
  });
});

function pointerMove(clientX: number, clientY: number): LiveInteractionDomEventEntity {
  return { clientX, clientY, pointerType: 'mouse' };
}
