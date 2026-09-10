import { describe, expect, it } from 'vitest';
import {
  canConfigureBalanceAutopay,
  resolveSubscriptionStatus,
  shouldShowLegacyTariffNotice,
} from './subscriptionStatus';

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

describe('shouldShowLegacyTariffNotice', () => {
  it.each([
    [{ status: 'active', isTrial: false, tariffId: null }, true],
    [{ status: 'disabled', isTrial: false, tariffId: null }, false],
    [{ status: 'expired', isTrial: false, tariffId: null }, false],
    [{ status: 'active', isTrial: true, tariffId: null }, false],
    [{ status: 'active', isTrial: false, tariffId: 7 }, false],
  ] as const)('maps %o to %s', (input, expected) => {
    expect(shouldShowLegacyTariffNotice(input)).toBe(expected);
  });
});

describe('canConfigureBalanceAutopay', () => {
  it.each([
    [{ status: 'active', tariffId: 7, isTariffsMode: true }, true],
    [{ status: 'limited', tariffId: 7, isTariffsMode: true }, true],
    [{ status: 'active', tariffId: null, isTariffsMode: true }, false],
    [{ status: 'disabled', tariffId: 7, isTariffsMode: true }, false],
    [{ status: 'expired', tariffId: 7, isTariffsMode: true }, false],
    [{ status: 'active', tariffId: 7, isTariffsMode: true, isTrial: true }, false],
    [{ status: 'active', tariffId: 7, isTariffsMode: true, isDaily: true }, false],
    [{ status: 'active', tariffId: null, isTariffsMode: false }, true],
    [{ status: 'disabled', tariffId: null, isTariffsMode: true, isEnabled: true }, true],
  ] as const)('maps %o to %s', (input, expected) => {
    expect(canConfigureBalanceAutopay(input)).toBe(expected);
  });
});
