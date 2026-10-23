import { Resend } from "resend";

// One email through Resend. Never throws: returns { data, error } like the SDK, so the outbox can record the reason and move on.
// MAIL_TEST_MODE=1 sends everything to MAIL_TEST_TO (the owner's own inbox) and says who it was meant for.
let resend = null;

export function mailSetup() {
  const testMode = process.env.MAIL_TEST_MODE === "1";
  return {
    configured: Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM),
    testMode,
    testTo: testMode ? process.env.MAIL_TEST_TO || null : null,
  };
}

const fail = (name, message) => ({ data: null, error: { name, message } });

export async function sendMail({ to, subject, text, fromName, idempotencyKey }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key) return fail("not_configured", "Email is not set up yet: RESEND_API_KEY is missing on the server");
  if (!from) return fail("not_configured", "Email is not set up yet: MAIL_FROM is missing on the server");
  const { testMode, testTo } = mailSetup();
  if (testMode && !testTo) return fail("not_configured", "Test mode is on but MAIL_TEST_TO is missing");
  const recipient = testMode ? testTo : to;
  if (!recipient) return fail("no_recipient", "This customer has no email address");
  // Sent in the business's name: "Arora Auto Components <reminders@domain>" unless MAIL_FROM already carries a name.
  const sender = from.includes("<") || !fromName ? from : `${fromName.replace(/[<>"]/g, "")} <${from}>`;
  try {
    resend ??= new Resend(key);
    const { data, error } = await resend.emails.send(
      {
        from: sender,
        to: [recipient],
        replyTo: process.env.MAIL_REPLY_TO || undefined,
        subject: testMode ? `[Test, meant for ${to || "no address"}] ${subject}` : subject,
        text,
      },
      idempotencyKey ? { idempotencyKey } : undefined,
    );
    if (error) return fail(error.name || "send_failed", error.message || "The email service refused the message");
    return { data, error: null };
  } catch (err) {
    return fail("send_failed", `Could not reach the email service: ${err?.message ?? err}`);
  }
}
