import { describe, expect, it } from 'vitest';
import { resolveSubscriptionStatus } from './subscriptionStatus';

describe('resolveSubscriptionStatus', () => {
  it.each([
    [{ status: 'active', daysLeft: 30 }, 'active'],
    [{ status: 'active', daysLeft: 14 }, 'expiring'],
    [{ status: 'trial', isTrial: true }, 'trial'],
    [{ status: 'expired', isTrial: true }, 'trialExpired'],
    [{ status: 'expired' }, 'expired'],
    [{ status: 'limited' }, 'limited'],
    [{ status: 'disabled' }, 'disabled'],
    [{ status: 'disabled', isDaily: true }, 'paused'],
    [{ status: 'active', isDailyPaused: true }, 'paused'],
    [{ status: 'pending' }, 'pending'],
    [{ status: 'something-new' }, 'inactive'],
  ] as const)('maps %o to %s', (input, expected) => {
    expect(resolveSubscriptionStatus(input)).toBe(expected);
  });
});
