import { describe, expect, it } from 'vitest';
import { emailTemplates } from '../services/emailTemplates';

describe('itemReportedLost template', () => {
  it('escapes text typed by the anonymous reporter', () => {
    const { subject, html } = emailTemplates.itemReportedLost({
      userName: '',
      itemName: 'Multimeter',
      itemBarcode: 'ITEM-1',
      transactionDate: 'today',
      reportNote: '<script>alert(1)</script>',
      reporterContact: '"><img src=x onerror=alert(1)>',
    });

    expect(subject).toBe('Lost item reported: Multimeter');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('omits optional rows that were not provided', () => {
    const { html } = emailTemplates.itemReportedLost({
      userName: '',
      itemName: 'Multimeter',
      itemBarcode: 'ITEM-1',
      transactionDate: 'today',
    });

    expect(html).not.toContain('Note from reporter');
    expect(html).not.toContain('Reporter contact');
    expect(html).not.toContain('Last checked out to');
  });
});
