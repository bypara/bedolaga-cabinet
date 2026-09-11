// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/Toast';
import { PlatformProvider } from '@/platform/PlatformProvider';

const { getLinkedProviders, requestEmailChange, verifyEmailChange, getMe, setUser } = vi.hoisted(
  () => ({
    getLinkedProviders: vi.fn(),
    requestEmailChange: vi.fn(),
    verifyEmailChange: vi.fn(),
    getMe: vi.fn(),
    setUser: vi.fn(),
  }),
);

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../api/auth', () => ({
  authApi: {
    getLinkedProviders,
    requestEmailChange,
    verifyEmailChange,
    getMe,
  },
}));

vi.mock('../api/branding', () => ({
  brandingApi: {
    getEmailAuthEnabled: () => Promise.resolve({ enabled: true }),
  },
}));

vi.mock('../store/auth', () => ({
  useAuthStore: (selector: (state: Record<string, unknown>) => unknown) => selector({ setUser }),
}));

async function renderPage() {
  const { default: ConnectedAccounts } = await import('./ConnectedAccounts');
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PlatformProvider>
        <ToastProvider>
          <MemoryRouter>
            <ConnectedAccounts />
          </MemoryRouter>
        </ToastProvider>
      </PlatformProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  getLinkedProviders.mockReset();
  requestEmailChange.mockReset();
  verifyEmailChange.mockReset();
  getMe.mockReset();
  setUser.mockReset();

  getLinkedProviders.mockResolvedValue({
    providers: [{ provider: 'email', linked: true, identifier: 'old@example.com' }],
  });
  requestEmailChange.mockResolvedValue({
    message: 'sent',
    new_email: 'new@example.com',
    expires_in_minutes: 15,
  });
  verifyEmailChange.mockResolvedValue({ message: 'changed', email: 'new@example.com' });
  getMe.mockResolvedValue({ id: 1, email: 'new@example.com', email_verified: true });
});

afterEach(cleanup);

describe('ConnectedAccounts email replacement', () => {
  it('changes a linked email only after verifying the code sent to the new address', async () => {
    await renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'profile.changeEmail.button' }));
    fireEvent.change(screen.getByLabelText('profile.changeEmail.newEmail'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'profile.changeEmail.sendCode' }));

    await waitFor(() => expect(requestEmailChange).toHaveBeenCalledWith('new@example.com'));
    fireEvent.change(await screen.findByLabelText('profile.changeEmail.verificationCode'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'profile.changeEmail.verify' }));

    await waitFor(() => expect(verifyEmailChange).toHaveBeenCalledWith('123456'));
    expect(await screen.findByText('profile.changeEmail.success')).toBeTruthy();
    expect(setUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new@example.com', email_verified: true }),
    );
  });
});
