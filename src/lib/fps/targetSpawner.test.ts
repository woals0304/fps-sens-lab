import { describe, expect, it } from 'vitest';
import { getTurnMarkerPosition } from './targetSpawner';

describe('getTurnMarkerPosition', () => {
  it('places the turn marker on the same side as the requested yaw', () => {
    const left = getTurnMarkerPosition(90);
    const right = getTurnMarkerPosition(-90);
    const back = getTurnMarkerPosition(180);

    expect(left.x).toBeLessThan(0);
    expect(right.x).toBeGreaterThan(0);
    expect(back.z).toBeGreaterThan(0);
  });
});
