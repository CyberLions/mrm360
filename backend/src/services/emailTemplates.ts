export interface TemplateData {
  userName: string;
  eventTitle?: string;
  eventDate?: string;
  eventTime?: string;
  eventDescription?: string;
  eventLocation?: string;
  orgName?: string;
  [key: string]: any;
}

function baseLayout(content: string, orgName: string = 'MRM360'): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; background-color: #f4f4f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .card { background: #ffffff; border-radius: 8px; padding: 32px; margin: 20px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { text-align: center; padding-bottom: 24px; border-bottom: 2px solid #e8e8eb; margin-bottom: 24px; }
    .header h1 { color: #1a1a2e; margin: 0; font-size: 24px; }
    .content { color: #3d3d4e; line-height: 1.6; font-size: 15px; }
    .content h2 { color: #1a1a2e; font-size: 20px; margin-top: 0; }
    .event-details { background: #f4f4f7; border-radius: 6px; padding: 16px; margin: 16px 0; }
    .event-details dt { font-weight: 600; color: #1a1a2e; margin-top: 8px; }
    .event-details dt:first-child { margin-top: 0; }
    .event-details dd { margin: 4px 0 0 0; color: #3d3d4e; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; }
    .badge-confirmed { background: #d4edda; color: #155724; }
    .badge-waitlist { background: #fff3cd; color: #856404; }
    .badge-declined { background: #f8d7da; color: #721c24; }
    .badge-promoted { background: #cce5ff; color: #004085; }
    .footer { text-align: center; padding-top: 24px; color: #8e8ea0; font-size: 13px; }
    .footer a { color: #8e8ea0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <h1>${orgName}</h1>
      </div>
      <div class="content">
        ${content}
      </div>
    </div>
    <div class="footer">
      <p>${orgName}</p>
    </div>
  </div>
</body>
</html>`;
}

function eventDetailsBlock(data: TemplateData): string {
  let details = `
    <dl class="event-details">
      <dt>Event</dt>
      <dd>${data.eventTitle}</dd>
      <dt>Date</dt>
      <dd>${data.eventDate}</dd>
      <dt>Time</dt>
      <dd>${data.eventTime}</dd>`;
  if (data.eventLocation) {
    details += `
      <dt>Location</dt>
      <dd>${data.eventLocation}</dd>`;
  }
  details += `
    </dl>`;
  return details;
}

function inventoryDetailsBlock(data: TemplateData): string {
  return `
    <dl class="event-details">
      <dt>Item</dt>
      <dd>${data.itemName}</dd>
      <dt>Barcode</dt>
      <dd>${data.itemBarcode}</dd>
      <dt>${data.transactionLabel}</dt>
      <dd>${data.transactionDate}</dd>
      ${data.binName ? `<dt>Return location</dt><dd>${data.binName}</dd>` : ''}
    </dl>`;
}

export const emailTemplates = {
  rsvpConfirmed(data: TemplateData): { subject: string; html: string } {
    return {
      subject: `You're confirmed for ${data.eventTitle}`,
      html: baseLayout(`
        <h2>You're in, ${data.userName}!</h2>
        <p>Your RSVP has been confirmed.</p>
        ${eventDetailsBlock(data)}
        <p><span class="badge badge-confirmed">Confirmed</span></p>
        ${data.eventDescription ? `<p>${data.eventDescription}</p>` : ''}
        <p>See you there!</p>
      `, data.orgName),
    };
  },

  rsvpDeclined(data: TemplateData): { subject: string; html: string } {
    return {
      subject: `RSVP updated for ${data.eventTitle}`,
      html: baseLayout(`
        <h2>RSVP Updated</h2>
        <p>Hi ${data.userName}, your RSVP has been updated.</p>
        ${eventDetailsBlock(data)}
        <p><span class="badge badge-declined">Declined</span></p>
        <p>Changed your mind? You can update your RSVP any time before the event.</p>
      `, data.orgName),
    };
  },

  rsvpWaitlisted(data: TemplateData): { subject: string; html: string } {
    return {
      subject: `You're on the waitlist for ${data.eventTitle}`,
      html: baseLayout(`
        <h2>You're on the Waitlist</h2>
        <p>Hi ${data.userName}, the event is currently at capacity. You've been added to the waitlist and we'll notify you if a spot opens up.</p>
        ${eventDetailsBlock(data)}
        <p><span class="badge badge-waitlist">Waitlisted</span></p>
        <p>We'll email you immediately if you're promoted to confirmed.</p>
      `, data.orgName),
    };
  },

  waitlistPromoted(data: TemplateData): { subject: string; html: string } {
    return {
      subject: `A spot opened up - you're confirmed for ${data.eventTitle}!`,
      html: baseLayout(`
        <h2>Good news, ${data.userName}!</h2>
        <p>A spot has opened up and you've been promoted from the waitlist. You're now confirmed!</p>
        ${eventDetailsBlock(data)}
        <p><span class="badge badge-promoted">Promoted from Waitlist</span></p>
        <p>See you there!</p>
      `, data.orgName),
    };
  },

  eventReminder(data: TemplateData): { subject: string; html: string } {
    return {
      subject: `Reminder: ${data.eventTitle} is coming up`,
      html: baseLayout(`
        <h2>Event Reminder</h2>
        <p>Hi ${data.userName}, just a reminder about an upcoming event you RSVP'd to.</p>
        ${eventDetailsBlock(data)}
        ${data.eventDescription ? `<p>${data.eventDescription}</p>` : ''}
        <p>See you soon!</p>
      `, data.orgName),
    };
  },

  checkInConfirmed(data: TemplateData): { subject: string; html: string } {
    return {
      subject: `Checked in to ${data.eventTitle}`,
      html: baseLayout(`
        <h2>You're checked in, ${data.userName}!</h2>
        <p>Your attendance has been recorded.</p>
        ${eventDetailsBlock(data)}
        <p><span class="badge badge-confirmed">Checked In</span></p>
        ${data.seriesProgress ? `<p><strong>Series progress:</strong> ${data.seriesProgress}</p>` : ''}
        ${data.eventDescription ? `<p>${data.eventDescription}</p>` : ''}
      `, data.orgName),
    };
  },

  itemCheckedOut(data: TemplateData): { subject: string; html: string } {
    return {
      subject: `${data.itemName} checked out to you`,
      html: baseLayout(`
        <h2>Item checked out</h2>
        <p>Hi ${data.userName}, this confirms that the following item was checked out to you.</p>
        ${inventoryDetailsBlock(data)}
        <p><span class="badge badge-confirmed">Checked Out</span></p>
        <p>Please return the item when you are finished with it.</p>
      `, data.orgName),
    };
  },

  itemCheckedIn(data: TemplateData): { subject: string; html: string } {
    return {
      subject: `${data.itemName} return confirmed`,
      html: baseLayout(`
        <h2>Item returned</h2>
        <p>Hi ${data.userName}, this confirms that the following item has been checked in.</p>
        ${inventoryDetailsBlock(data)}
        <p><span class="badge badge-confirmed">Returned</span></p>
        <p>Thank you for returning it!</p>
      `, data.orgName),
    };
  },

  postEventThankYou(data: TemplateData): { subject: string; html: string } {
    return {
      subject: `Thanks for attending ${data.eventTitle}!`,
      html: baseLayout(`
        <h2>Thanks for Coming!</h2>
        <p>Hi ${data.userName}, thanks for attending the event.</p>
        ${eventDetailsBlock(data)}
        ${data.customMessage ? `<p>${data.customMessage}</p>` : '<p>We hope you enjoyed it. Keep an eye out for more upcoming events!</p>'}
      `, data.orgName),
    };
  },
} as const;

export type EmailTemplateName = keyof typeof emailTemplates;
