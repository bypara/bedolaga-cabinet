import { describe, expect, it } from 'vitest';
import { getFallbackParentPath } from './navigation';

describe('getFallbackParentPath', () => {
  it.each(['/balance', '/info', '/referral', '/profile/accounts'])(
    'returns to profile from profile-owned section %s',
    (pathname) => {
      expect(getFallbackParentPath(pathname)).toBe('/profile');
    },
  );

  it('keeps deriving parents for other nested routes', () => {
    expect(getFallbackParentPath('/balance/top-up')).toBe('/balance');
    expect(getFallbackParentPath('/admin/users/123')).toBe('/admin/users');
  });
});
