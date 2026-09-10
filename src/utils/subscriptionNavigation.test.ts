import { describe, expect, it } from 'vitest';
import { subscriptionPurchasePath } from './subscriptionNavigation';

describe('subscriptionPurchasePath', () => {
  it('keeps the exact subscription in the tariff-selection flow', () => {
    expect(subscriptionPurchasePath(42)).toBe('/subscription/purchase?subscriptionId=42');
  });

  it('opens a regular purchase when there is no subscription yet', () => {
    expect(subscriptionPurchasePath()).toBe('/subscription/purchase');
  });
});
