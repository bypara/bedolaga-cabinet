import { describe, expect, it } from 'vitest';
import { isConfiguredLegalDocument, type LegalDocumentState } from './legalFooterState';

const configured: PromiseFulfilledResult<LegalDocumentState> = {
  status: 'fulfilled',
  value: {
    content: '<p>Условия сервиса</p>',
    updated_at: '2026-08-24T10:00:00+00:00',
  },
};

describe('isConfiguredLegalDocument', () => {
  it('показывает сохранённый и включённый документ', () => {
    expect(isConfiguredLegalDocument(true, configured)).toBe(true);
  });

  it('скрывает документ, выключенный настройкой видимости', () => {
    expect(isConfiguredLegalDocument(false, configured)).toBe(false);
  });

  it('скрывает серверную заглушку без даты сохранения', () => {
    expect(
      isConfiguredLegalDocument(true, {
        status: 'fulfilled',
        value: { content: '# Рекуррентные платежи', updated_at: null },
      }),
    ).toBe(false);
  });

  it('скрывает пустой сохранённый документ', () => {
    expect(
      isConfiguredLegalDocument(true, {
        status: 'fulfilled',
        value: { content: '   ', updated_at: '2026-08-24T10:00:00+00:00' },
      }),
    ).toBe(false);
  });

  it('скрывает ссылку, если документ не загрузился', () => {
    expect(
      isConfiguredLegalDocument(true, {
        status: 'rejected',
        reason: new Error('not found'),
      }),
    ).toBe(false);
  });
});
