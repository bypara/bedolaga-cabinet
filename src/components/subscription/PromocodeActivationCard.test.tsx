// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformProvider } from '../../platform/PlatformProvider';
import { PromocodeActivationCard } from './PromocodeActivationCard';

const { activatePromocode, refreshUser } = vi.hoisted(() => ({
  activatePromocode: vi.fn(),
  refreshUser: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../api/balance', () => ({
  balanceApi: { activatePromocode },
}));

vi.mock('../../store/auth', () => ({
  useAuthStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ refreshUser }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function renderCard(subscriptionId?: number) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PlatformProvider>
        <PromocodeActivationCard subscriptionId={subscriptionId} />
      </PlatformProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  activatePromocode.mockReset();
  refreshUser.mockClear();
});

afterEach(cleanup);

describe('промокод при покупке подписки', () => {
  it('активирует код для открытой подписки', async () => {
    activatePromocode.mockResolvedValue({ success: true, bonus_description: 'Скидка 20%' });
    renderCard(42);

    fireEvent.change(screen.getByPlaceholderText('balance.promocode.placeholder'), {
      target: { value: 'SALE20' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'balance.promocode.activate' }));

    await waitFor(() => expect(activatePromocode).toHaveBeenCalledWith('SALE20', 42));
    expect(await screen.findByText('Скидка 20%')).toBeTruthy();
    expect(refreshUser).toHaveBeenCalledOnce();
  });

  it('предлагает выбрать подписку, если это требует промокод', async () => {
    activatePromocode
      .mockResolvedValueOnce({
        success: false,
        error: 'select_subscription',
        code: 'DAYS30',
        eligible_subscriptions: [{ id: 7, tariff_name: 'Максимум', days_left: 5 }],
      })
      .mockResolvedValueOnce({ success: true, message: 'Готово' });
    renderCard();

    fireEvent.change(screen.getByPlaceholderText('balance.promocode.placeholder'), {
      target: { value: 'DAYS30' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'balance.promocode.activate' }));
    fireEvent.click(await screen.findByRole('button', { name: /Максимум/ }));

    await waitFor(() => expect(activatePromocode).toHaveBeenLastCalledWith('DAYS30', 7));
    expect(await screen.findByText('Готово')).toBeTruthy();
  });
});
