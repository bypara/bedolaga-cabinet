/**
 * Opens the shared purchase flow in the context of a concrete subscription.
 * In tariff mode it starts with tariff selection; in classic mode it falls
 * back to the configured purchase-period wizard.
 */
export function subscriptionPurchasePath(subscriptionId?: number | null): string {
  return subscriptionId != null
    ? `/subscription/purchase?subscriptionId=${subscriptionId}`
    : '/subscription/purchase';
}
