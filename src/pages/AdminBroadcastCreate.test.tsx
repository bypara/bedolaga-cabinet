// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminBroadcastCreate from './AdminBroadcastCreate';

const mocks = vi.hoisted(() => ({
  options: {
    legacy_available: true,
    migration_button_available: true,
    current_is_target: true,
    migration_url: 'https://t.me/censetbot',
    migration_button_text: 'Перейти и получить 75 ₽',
    bonus_enabled: true,
    bonus_amount_rubles: 75,
  },
  create: vi.fn(),
  confirm: vi.fn(),
  t: (key: string, fallback?: string | Record<string, unknown>) =>
    typeof fallback === 'string' ? fallback : String(fallback?.defaultValue ?? key),
}));

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: mocks.t }) }));
vi.mock('../platform/hooks/useNativeDialog', () => ({
  useNativeDialog: () => ({ confirm: mocks.confirm }),
}));
vi.mock('react-router', () => ({ useNavigate: () => vi.fn() }));
vi.mock('../components/admin', () => ({ AdminBackButton: () => null }));
vi.mock('../components/broadcasts/BroadcastPreview', () => ({
  TelegramPreview: (props: {
    open: boolean;
    senderLabel: string;
    buttons: { text: string }[][];
  }) =>
    props.open ? (
      <div data-testid="preview">
        {props.senderLabel}
        {props.buttons.flat().map((button, i) => (
          <span key={i}>{button.text}</span>
        ))}
      </div>
    ) : null,
  EmailPreview: () => null,
}));
vi.mock('../api/adminBroadcasts', () => ({
  adminBroadcastsApi: {
    getDeliveryOptions: async () => ({ ...mocks.options }),
    getFilters: async () => ({
      filters: [{ key: 'all', label: 'Все пользователи', count: 3, group: 'basic' }],
      tariff_filters: [],
      custom_filters: [],
    }),
    getButtons: async () => ({ buttons: [] }),
    getEmailFilters: async () => ({ filters: [] }),
    preview: async () => ({ target: 'all', count: 3 }),
    createCombined: mocks.create,
  },
}));

let client: QueryClient;
beforeEach(() => {
  mocks.options.legacy_available = true;
  mocks.create.mockReset().mockResolvedValue({ id: 42 });
  mocks.confirm.mockReset().mockResolvedValue(false);
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.restoreAllMocks();
});

function mount() {
  render(
    <QueryClientProvider client={client}>
      <AdminBroadcastCreate />
    </QueryClientProvider>,
  );
}
async function selectLegacy() {
  const sender = await screen.findByRole('combobox', { name: 'Отправить от бота' });
  await waitFor(() =>
    expect((screen.getByRole('option', { name: 'Старый бот' }) as HTMLOptionElement).disabled).toBe(
      false,
    ),
  );
  fireEvent.change(sender, { target: { value: 'legacy' } });
  return sender;
}
async function fillMessage() {
  fireEvent.click(screen.getByText('admin.broadcasts.selectFilterPlaceholder'));
  fireEvent.click(await screen.findByText('Все пользователи'));
  fireEvent.change(screen.getByPlaceholderText('admin.broadcasts.messageTextPlaceholder'), {
    target: { value: 'Мы переехали' },
  });
}

describe('old bot broadcast controls', () => {
  it('defaults to main bot and no migration button; target cannot send itself a move link', async () => {
    mount();
    const sender = await screen.findByRole('combobox', { name: 'Отправить от бота' });
    expect((sender as HTMLSelectElement).value).toBe('current');
    const button = screen.getByRole('checkbox', {
      name: 'Добавить кнопку перехода в нового бота',
    }) as HTMLInputElement;
    expect(button.checked).toBe(false);
    expect(button.disabled).toBe(true);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('enables optional button for legacy sender and displays it in preview', async () => {
    mount();
    await selectLegacy();
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Добавить кнопку перехода в нового бота' }),
    );
    fireEvent.change(screen.getByPlaceholderText('admin.broadcasts.messageTextPlaceholder'), {
      target: { value: 'Мы переехали' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Предпросмотр' }));
    expect(screen.getByTestId('preview').textContent).toContain('Старый бот');
    expect(screen.getByTestId('preview').textContent).toContain('Перейти и получить 75 ₽');
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('does not allow an unconfigured legacy sender', async () => {
    mocks.options.legacy_available = false;
    mount();
    await screen.findByText(
      'Отправка от старого бота появится после настройки его токена на сервере.',
    );
    expect((screen.getByRole('option', { name: 'Старый бот' }) as HTMLOptionElement).disabled).toBe(
      true,
    );
  });
  it('cancelled confirmation sends nothing; confirmed send passes explicit legacy options', async () => {
    mount();
    await selectLegacy();
    await fillMessage();
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Добавить кнопку перехода в нового бота' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'admin.broadcasts.send' }));
    expect(mocks.confirm).toHaveBeenCalled();
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'admin.broadcasts.send' }) as HTMLButtonElement)
          .disabled,
      ).toBe(false),
    );
    expect(mocks.create).not.toHaveBeenCalled();
    mocks.confirm.mockResolvedValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'admin.broadcasts.send' }));
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'telegram',
          telegram_sender: 'legacy',
          add_migration_button: true,
        }),
        expect.anything(),
      ),
    );
  });
});
