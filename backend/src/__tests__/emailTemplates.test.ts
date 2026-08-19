import { describe, it, expect } from 'vitest';
import { emailTemplates, TemplateData } from '../services/emailTemplates';

const baseData: TemplateData = {
  userName: 'Alice',
  eventTitle: 'CTF Workshop',
  eventDate: 'Saturday, April 18, 2026',
  eventTime: '2:00 PM - 4:00 PM',
};

const inventoryData: TemplateData = {
  userName: 'Alice',
  itemName: 'Fluke Multimeter',
  itemBarcode: 'INV-0042',
  transactionLabel: 'Checked out',
  transactionDate: 'Wednesday, August 19, 2026 at 2:30 PM',
};

describe('emailTemplates', () => {
  describe('rsvpConfirmed', () => {
    it('returns correct subject', () => {
      const { subject } = emailTemplates.rsvpConfirmed(baseData);
      expect(subject).toBe("You're confirmed for CTF Workshop");
    });

    it('includes user name and event details in html', () => {
      const { html } = emailTemplates.rsvpConfirmed(baseData);
      expect(html).toContain('Alice');
      expect(html).toContain('CTF Workshop');
      expect(html).toContain('Saturday, April 18, 2026');
      expect(html).toContain('2:00 PM - 4:00 PM');
      expect(html).toContain('badge-confirmed');
    });

    it('includes description when provided', () => {
      const { html } = emailTemplates.rsvpConfirmed({ ...baseData, eventDescription: 'Bring your laptop' });
      expect(html).toContain('Bring your laptop');
    });

    it('omits description when not provided', () => {
      const { html } = emailTemplates.rsvpConfirmed(baseData);
      expect(html).not.toContain('undefined');
    });

    it('includes location when provided', () => {
      const { html } = emailTemplates.rsvpConfirmed({ ...baseData, eventLocation: 'Room 101' });
      expect(html).toContain('Room 101');
      expect(html).toContain('Location');
    });

    it('uses custom orgName in layout', () => {
      const { html } = emailTemplates.rsvpConfirmed({ ...baseData, orgName: 'PSU CCSO' });
      expect(html).toContain('PSU CCSO');
    });

    it('defaults orgName to MRM360', () => {
      const { html } = emailTemplates.rsvpConfirmed(baseData);
      expect(html).toContain('MRM360');
    });
  });

  describe('rsvpDeclined', () => {
    it('returns correct subject', () => {
      const { subject } = emailTemplates.rsvpDeclined(baseData);
      expect(subject).toBe('RSVP updated for CTF Workshop');
    });

    it('includes declined badge and event details', () => {
      const { html } = emailTemplates.rsvpDeclined(baseData);
      expect(html).toContain('Alice');
      expect(html).toContain('badge-declined');
      expect(html).toContain('CTF Workshop');
      expect(html).toContain('Changed your mind?');
    });
  });

  describe('rsvpWaitlisted', () => {
    it('returns correct subject', () => {
      const { subject } = emailTemplates.rsvpWaitlisted(baseData);
      expect(subject).toBe("You're on the waitlist for CTF Workshop");
    });

    it('includes waitlist badge and notification text', () => {
      const { html } = emailTemplates.rsvpWaitlisted(baseData);
      expect(html).toContain('Alice');
      expect(html).toContain('badge-waitlist');
      expect(html).toContain('at capacity');
      expect(html).toContain("we'll notify you");
    });
  });

  describe('waitlistPromoted', () => {
    it('returns correct subject', () => {
      const { subject } = emailTemplates.waitlistPromoted(baseData);
      expect(subject).toBe("A spot opened up - you're confirmed for CTF Workshop!");
    });

    it('includes promoted badge and congratulatory text', () => {
      const { html } = emailTemplates.waitlistPromoted(baseData);
      expect(html).toContain('Alice');
      expect(html).toContain('badge-promoted');
      expect(html).toContain('promoted from the waitlist');
    });
  });

  describe('eventReminder', () => {
    it('returns correct subject', () => {
      const { subject } = emailTemplates.eventReminder(baseData);
      expect(subject).toBe('Reminder: CTF Workshop is coming up');
    });

    it('includes reminder text and event details', () => {
      const { html } = emailTemplates.eventReminder(baseData);
      expect(html).toContain('Alice');
      expect(html).toContain('CTF Workshop');
      expect(html).toContain('reminder');
    });

    it('includes description when provided', () => {
      const { html } = emailTemplates.eventReminder({ ...baseData, eventDescription: 'Doors open at 1:30' });
      expect(html).toContain('Doors open at 1:30');
    });
  });

  describe('checkInConfirmed', () => {
    it('returns correct subject', () => {
      const { subject } = emailTemplates.checkInConfirmed(baseData);
      expect(subject).toBe('Checked in to CTF Workshop');
    });

    it('includes checked in badge', () => {
      const { html } = emailTemplates.checkInConfirmed(baseData);
      expect(html).toContain('Alice');
      expect(html).toContain('Checked In');
      expect(html).toContain('badge-confirmed');
    });

    it('includes series progress when provided', () => {
      const { html } = emailTemplates.checkInConfirmed({ ...baseData, seriesProgress: '3/5 events' });
      expect(html).toContain('3/5 events');
      expect(html).toContain('Series progress');
    });

    it('omits series progress when not provided', () => {
      const { html } = emailTemplates.checkInConfirmed(baseData);
      expect(html).not.toContain('Series progress');
    });
  });

  describe('inventory notifications', () => {
    it('renders an item checkout receipt', () => {
      const { subject, html } = emailTemplates.itemCheckedOut(inventoryData);

      expect(subject).toBe('Fluke Multimeter checked out to you');
      expect(html).toContain('Alice');
      expect(html).toContain('Fluke Multimeter');
      expect(html).toContain('INV-0042');
      expect(html).toContain('Checked Out');
    });

    it('renders an item return receipt with its return location', () => {
      const { subject, html } = emailTemplates.itemCheckedIn({
        ...inventoryData,
        transactionLabel: 'Returned',
        binName: 'Electronics Cabinet',
      });

      expect(subject).toBe('Fluke Multimeter return confirmed');
      expect(html).toContain('Returned');
      expect(html).toContain('Electronics Cabinet');
    });
  });

  describe('postEventThankYou', () => {
    it('returns correct subject', () => {
      const { subject } = emailTemplates.postEventThankYou(baseData);
      expect(subject).toBe('Thanks for attending CTF Workshop!');
    });

    it('includes custom message when provided', () => {
      const { html } = emailTemplates.postEventThankYou({ ...baseData, customMessage: 'Great job everyone!' });
      expect(html).toContain('Great job everyone!');
    });

    it('shows default message when no custom message', () => {
      const { html } = emailTemplates.postEventThankYou(baseData);
      expect(html).toContain('We hope you enjoyed it');
    });
  });

  describe('all templates', () => {
    it('produce valid HTML documents', () => {
      const templateNames = Object.keys(emailTemplates) as Array<keyof typeof emailTemplates>;
      for (const name of templateNames) {
        const data = name === 'itemCheckedOut' || name === 'itemCheckedIn' ? inventoryData : baseData;
        const { html } = emailTemplates[name](data);
        expect(html).toContain('<!DOCTYPE html>');
        expect(html).toContain('</html>');
      }
    });

    it('all include event details block', () => {
      const templateNames = Object.keys(emailTemplates).filter(
        name => name !== 'itemCheckedOut' && name !== 'itemCheckedIn'
      ) as Array<keyof typeof emailTemplates>;
      for (const name of templateNames) {
        const { html } = emailTemplates[name](baseData);
        expect(html).toContain('event-details');
        expect(html).toContain('CTF Workshop');
      }
    });
  });
});
