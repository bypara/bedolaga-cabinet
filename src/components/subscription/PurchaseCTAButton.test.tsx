// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Subscription } from '@/types';
import PurchaseCTAButton from './PurchaseCTAButton';

const labels: Record<string, string> = {
  'subscription.extend': 'Продлить подписку',
  'subscription.manageTariff': 'Продлить или сменить тариф',
  'subscription.cta.activeHint': 'Продление и смена тарифа',
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => labels[key] ?? key,
  }),
}));

const activeSubscription: Subscription = {
  id: 42,
  status: 'active',
  is_trial: false,
  start_date: '2026-09-01T00:00:00Z',
  end_date: '2026-10-01T00:00:00Z',
  days_left: 20,
  hours_left: 0,
  minutes_left: 0,
  time_left_display: '20 дней',
  traffic_limit_gb: 100,
  traffic_used_gb: 0,
  traffic_used_percent: 0,
  device_limit: 1,
  connected_squads: [],
  servers: [],
  autopay_enabled: false,
  autopay_days_before: 3,
  subscription_url: 'https://example.com/sub',
  hide_subscription_link: false,
  is_active: true,
  is_expired: false,
  is_limited: false,
};

afterEach(cleanup);

describe('PurchaseCTAButton', () => {
  it('объясняет переход к продлению и смене тарифа в полной карточке', () => {
    render(
      <MemoryRouter>
        <PurchaseCTAButton subscription={activeSubscription} isMultiTariff />
      </MemoryRouter>,
    );

    const link = screen.getByRole('link', { name: /Продлить или сменить тариф/ });
    expect(link.getAttribute('href')).toBe('/subscription/purchase?subscriptionId=42');
    expect(screen.getByText('Продление и смена тарифа')).toBeTruthy();
  });
});
