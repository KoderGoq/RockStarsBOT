import { DateTime } from 'luxon';
import type { Clock } from '../types/clock.js';

export const systemClock: Clock = {
  now: () => DateTime.now(),
};
