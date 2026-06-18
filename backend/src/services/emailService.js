import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

const createTransporter = () => {
  if (!env.smtpHost) {
    return null;
  }

  return nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth:
      env.smtpUser && env.smtpPass
        ? {
            user: env.smtpUser,
            pass: env.smtpPass,
          }
        : undefined,
  });
};

const transporter = createTransporter();

const renderEmailEmblem = () => {
  const emblemUrl =
    env.emailEmblemUrl ||
    'https://braumasta.github.io/passport-system-assets/passportsecuritylogo-email-transparent.png';

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
      <tr>
        <td align="center">
          <img
            src="${emblemUrl}"
            width="96"
            height="96"
            alt="Passport Security emblem"
            style="width: 96px; height: 96px; object-fit: contain; display: block;"
          />
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-top: 8px; font-size: 11px; line-height: 1.4; letter-spacing: 0.12em; text-transform: uppercase; color: #1a3a5c; font-weight: 700;">
          Passport Security
        </td>
      </tr>
    </table>
  `;
};

const sendEmail = async ({ to, subject, html, text, fallbackValue }) => {
  if (!transporter) {
    console.log(`[Email fallback] ${subject} -> ${to}`);
    if (fallbackValue) {
      console.log(`[Email fallback value] ${fallbackValue}`);
    }

    return {
      delivered: false,
      previewValue: fallbackValue || null,
    };
  }

  await transporter.sendMail({
    from: env.mailFrom,
    to,
    subject,
    html,
    text,
  });

  return {
    delivered: true,
    previewValue: null,
  };
};

const renderEmailLayout = ({ eyebrow, title, greeting, intro, contentHtml, supportHtml }) => `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="color-scheme" content="light only" />
      <meta name="supported-color-schemes" content="light only" />
      <title>${title}</title>
      <style>
        body,
        table,
        td,
        a {
          -webkit-text-size-adjust: 100%;
          -ms-text-size-adjust: 100%;
        }

        table,
        td {
          mso-table-lspace: 0pt;
          mso-table-rspace: 0pt;
        }

        img {
          -ms-interpolation-mode: bicubic;
          border: 0;
          outline: none;
          text-decoration: none;
          display: block;
        }

        @media screen and (max-width: 640px) {
          .email-shell {
            width: 100% !important;
          }

          .email-card {
            border-radius: 0 !important;
          }

          .email-body {
            padding: 28px 20px !important;
          }

          .email-title {
            font-size: 28px !important;
            line-height: 1.25 !important;
          }

          .verification-code {
            font-size: 28px !important;
            letter-spacing: 0.3em !important;
            padding: 18px 16px !important;
          }
        }
      </style>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f0f4f8; font-family: 'Segoe UI', Arial, sans-serif; color: #2d3748;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f0f4f8; margin: 0; padding: 24px 0;">
        <tr>
          <td align="center" style="padding: 0 16px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="620" class="email-shell" style="width: 620px; max-width: 620px;">
              <tr>
                <td align="center" style="padding: 0 0 16px;">
                  ${renderEmailEmblem()}
                </td>
              </tr>
              <tr>
                <td style="background-color: #ffffff; border: 1px solid #d7e0ea; border-radius: 22px; overflow: hidden;" class="email-card">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td style="background: linear-gradient(135deg, #102841 0%, #1a3a5c 65%, #2c5282 100%); padding: 28px 32px 24px;">
                        <div style="font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255, 255, 255, 0.78); font-weight: 700; margin-bottom: 10px;">
                          ${eyebrow}
                        </div>
                        <div class="email-title" style="font-size: 34px; line-height: 1.2; color: #ffffff; font-weight: 700; margin: 0;">
                          ${title}
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td class="email-body" style="padding: 34px 32px 20px;">
                        <div style="font-size: 20px; line-height: 1.5; color: #1a3a5c; font-weight: 700; margin-bottom: 12px;">
                          ${greeting}
                        </div>
                        <div style="font-size: 16px; line-height: 1.8; color: #4a5568; margin-bottom: 24px;">
                          ${intro}
                        </div>
                        ${contentHtml}
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 0 32px 32px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f8fbff; border: 1px solid #d8e4f0; border-radius: 16px;">
                          <tr>
                            <td style="padding: 18px 20px;">
                              <div style="font-size: 12px; line-height: 1.7; color: #5f6f82;">
                                ${supportHtml}
                              </div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 0 32px 28px; text-align: center;">
                        <div style="font-size: 12px; line-height: 1.7; color: #7a8796;">
                          Passport Security Information System
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
`;

export const sendVerificationEmail = async ({ email, firstName, verificationCode }) =>
  sendEmail({
    to: email,
    subject: 'Verify your passport system account',
    text: `Hello ${firstName},

Verify your Passport Security account with this 6-digit code:
${verificationCode}

This code expires shortly for your security.

If you did not create an account with this email address, you can safely ignore this message.`,
    html: renderEmailLayout({
      eyebrow: 'Passport System Verification',
      title: 'Verify Your Account',
      greeting: `Hello ${firstName},`,
      intro:
        'Use the verification code below to confirm your Passport Security account. Enter it exactly as shown on the verification page.',
      contentHtml: `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 22px;">
          <tr>
            <td class="verification-code" align="center" style="background-color: #f5f9fd; border: 1px solid #d9e3ee; border-radius: 18px; padding: 20px 24px; font-size: 34px; line-height: 1; letter-spacing: 0.42em; color: #1a3a5c; font-weight: 800;">
              ${verificationCode}
            </td>
          </tr>
        </table>
        <div style="font-size: 14px; line-height: 1.8; color: #5f6b7a;">
          This code is time-sensitive. If it expires, return to the verification page and request a new one.
        </div>
      `,
      supportHtml:
        'If you did not recently register for the Passport Security system, no action is required. You can safely ignore this email and your address will not be activated by this request.',
    }),
    fallbackValue: verificationCode,
  });

export const sendPasswordResetCodeEmail = async ({ email, firstName, resetCode }) =>
  sendEmail({
    to: email,
    subject: 'Reset your passport system password',
    text: `Hello ${firstName},

You requested a password reset for your Passport Security account.

Use this 8-digit password reset code:
${resetCode}

If you did not request a password reset, you can safely ignore this email.`,
    html: renderEmailLayout({
      eyebrow: 'Password Reset',
      title: 'Reset Your Password',
      greeting: `Hello ${firstName},`,
      intro:
        'A password reset request was received for your Passport Security account. Enter the code below on the reset password page to choose a new password.',
      contentHtml: `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 22px;">
          <tr>
            <td class="verification-code" align="center" style="background-color: #f5f9fd; border: 1px solid #d9e3ee; border-radius: 18px; padding: 20px 24px; font-size: 34px; line-height: 1; letter-spacing: 0.34em; color: #1a3a5c; font-weight: 800;">
              ${resetCode}
            </td>
          </tr>
        </table>
        <div style="font-size: 14px; line-height: 1.8; color: #5f6b7a;">
          This code is time-sensitive. If it expires, return to the password reset page and request a new one.
        </div>
      `,
      supportHtml:
        'If you did not request a password reset, you can safely ignore this email. Your current password will remain unchanged unless the reset code is entered on the password reset page.',
    }),
    fallbackValue: resetCode,
  });

export const sendChangePasswordCodeEmail = async ({ email, firstName, changeCode }) =>
  sendEmail({
    to: email,
    subject: 'Confirm your password change',
    text: `Hello ${firstName},

Use this 8-digit code to confirm the password change for your Passport Security account:
${changeCode}

If you did not request a password change, you can safely ignore this email.`,
    html: renderEmailLayout({
      eyebrow: 'Change Password',
      title: 'Confirm Password Change',
      greeting: `Hello ${firstName},`,
      intro:
        'Use the code below on your account page to confirm your password change. Enter it exactly as shown before the code expires.',
      contentHtml: `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 22px;">
          <tr>
            <td class="verification-code" align="center" style="background-color: #f5f9fd; border: 1px solid #d9e3ee; border-radius: 18px; padding: 20px 24px; font-size: 34px; line-height: 1; letter-spacing: 0.34em; color: #1a3a5c; font-weight: 800;">
              ${changeCode}
            </td>
          </tr>
        </table>
        <div style="font-size: 14px; line-height: 1.8; color: #5f6b7a;">
          This code is time-sensitive. If it expires, request a new change-password code from your account page.
        </div>
      `,
      supportHtml:
        'If you did not request this password change, no action is required. Your current password will remain unchanged unless this code is entered on the account page.',
    }),
    fallbackValue: changeCode,
  });

export const sendPasswordChangedNotificationEmail = async ({ email, firstName, changeType }) =>
  sendEmail({
    to: email,
    subject: 'Your passport system password was changed',
    text: `Hello ${firstName},

This is a confirmation that the password for your Passport Security account was changed successfully.

Change type: ${changeType}

If you did not make this change, you should reset your password immediately and contact support.`,
    html: renderEmailLayout({
      eyebrow: 'Security Notification',
      title: 'Password Changed Successfully',
      greeting: `Hello ${firstName},`,
      intro:
        'This is a security confirmation that your Passport Security system password was updated successfully.',
      contentHtml: `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 22px;">
          <tr>
            <td align="center" style="background-color: #f5f9fd; border: 1px solid #d9e3ee; border-radius: 18px; padding: 18px 20px; font-size: 16px; line-height: 1.7; color: #1a3a5c; font-weight: 700;">
              Change type: ${changeType}
            </td>
          </tr>
        </table>
        <div style="font-size: 14px; line-height: 1.8; color: #5f6b7a;">
          If this was you, no further action is required. If you do not recognize this activity, reset your password immediately and review your account.
        </div>
      `,
      supportHtml:
        'This message was sent to help you detect unauthorized account changes. If you did not perform this password change, treat this as a security alert.',
    }),
    fallbackValue: null,
  });

export const sendAccountVerificationSubmittedEmail = async ({
  email,
  firstName,
  verificationCode,
}) =>
  sendEmail({
    to: email,
    subject: `Account verification ${verificationCode} received`,
    text: `Hello ${firstName},

Your account verification submission was received by Passport Security.

Verification code: ${verificationCode}

Keep this code for any follow-up with staff. You will be notified when the review is complete.`,
    html: renderEmailLayout({
      eyebrow: 'Account Verification',
      title: 'Submission Received',
      greeting: `Hello ${firstName},`,
      intro:
        'Your account verification documents were received by Passport Security. Keep the verification code below for follow-up or staff review.',
      contentHtml: `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 22px;">
          <tr>
            <td align="center" style="background-color: #f5f9fd; border: 1px solid #d9e3ee; border-radius: 18px; padding: 20px 24px; font-size: 24px; line-height: 1.3; letter-spacing: 0.08em; color: #1a3a5c; font-weight: 800;">
              ${verificationCode}
            </td>
          </tr>
        </table>
        <div style="font-size: 14px; line-height: 1.8; color: #5f6b7a;">
          Your documents are now being checked. Staff may use this code to locate your verification application.
        </div>
      `,
      supportHtml:
        'This message confirms that your account verification application was submitted. Do not reply with personal documents by email.',
    }),
    fallbackValue: verificationCode,
  });

export const sendAccountVerificationFailedEmail = async ({
  email,
  firstName,
  verificationCode,
  failures = [],
}) => {
  const failureSummary = failures.length
    ? failures.map((failure) => `- ${failure}`).join('\n')
    : '- The uploaded documents could not be verified automatically.';

  return sendEmail({
    to: email,
    subject: `Account verification ${verificationCode} failed`,
    text: `Hello ${firstName},

Your account verification could not be approved automatically.

Verification code: ${verificationCode}

Please try again with clear, matching national ID front, national ID back, and selfie photos.

Reason:
${failureSummary}`,
    html: renderEmailLayout({
      eyebrow: 'Account Verification',
      title: 'Verification Failed',
      greeting: `Hello ${firstName},`,
      intro:
        'Your account verification could not be approved automatically. Please try again with clear, matching national ID front, national ID back, and selfie photos.',
      contentHtml: `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 18px;">
          <tr>
            <td align="center" style="background-color: #f5f9fd; border: 1px solid #d9e3ee; border-radius: 18px; padding: 18px 20px; font-size: 20px; line-height: 1.4; letter-spacing: 0.08em; color: #1a3a5c; font-weight: 800;">
              ${verificationCode}
            </td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 22px;">
          <tr>
            <td style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 16px; padding: 16px 18px; font-size: 14px; line-height: 1.8; color: #7f1d1d;">
              <strong>What to do next:</strong><br />
              Upload new clear images where all text is readable, the ID is not cropped, and the selfie matches the ID photo.
            </td>
          </tr>
        </table>
      `,
      supportHtml:
        'This message was sent automatically after the verification check failed. Staff may use the verification code above to locate the submission.',
    }),
    fallbackValue: verificationCode,
  });
};

export const sendAccountVerificationCompletedEmail = async ({
  email,
  firstName,
  verificationCode,
  status,
  warnings = [],
}) => {
  const isVerified = status === 'verified';
  const warningSummary = warnings.length
    ? warnings.map((warning) => `- ${warning}`).join('\n')
    : '- Staff review is required before final approval.';

  return sendEmail({
    to: email,
    subject: isVerified
      ? `Account verification ${verificationCode} approved`
      : `Account verification ${verificationCode} requires review`,
    text: isVerified
      ? `Hello ${firstName},

Your account verification has been approved by Passport Security.

Verification code: ${verificationCode}

You can now continue with passport services.`
      : `Hello ${firstName},

Your account verification documents were checked automatically and require staff review.

Verification code: ${verificationCode}

Reason:
${warningSummary}`,
    html: renderEmailLayout({
      eyebrow: 'Account Verification',
      title: isVerified ? 'Verification Approved' : 'Staff Review Required',
      greeting: `Hello ${firstName},`,
      intro: isVerified
        ? 'Your account verification has been approved by Passport Security. You can now continue with passport services.'
        : 'Your account verification documents were checked automatically and require staff review before final approval.',
      contentHtml: `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 22px;">
          <tr>
            <td align="center" style="background-color: #f5f9fd; border: 1px solid #d9e3ee; border-radius: 18px; padding: 18px 20px; font-size: 20px; line-height: 1.4; letter-spacing: 0.08em; color: #1a3a5c; font-weight: 800;">
              ${verificationCode}
            </td>
          </tr>
        </table>
      `,
      supportHtml: isVerified
        ? 'This message confirms that the automatic account verification check completed successfully.'
        : 'Staff may use the verification code above to locate the submission and complete the review.',
    }),
    fallbackValue: verificationCode,
  });
};

export const sendApplicationCancelledEmail = async ({
  email,
  firstName,
  applicationReference,
  cancellationReason,
}) =>
  sendEmail({
    to: email,
    subject: `Application ${applicationReference} was cancelled`,
    text: `Hello ${firstName},

Your passport application ${applicationReference} has been cancelled by the Passport Security staff review team.

Reason:
${cancellationReason || 'No additional reason was provided.'}

If you believe this was a mistake, please contact support and provide your application reference.`,
    html: renderEmailLayout({
      eyebrow: 'Application Update',
      title: 'Application Cancelled',
      greeting: `Hello ${firstName},`,
      intro:
        'Your passport application was cancelled after a staff follow-up review. Keep the application reference below for any future inquiry.',
      contentHtml: `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 18px;">
          <tr>
            <td align="center" style="background-color: #f5f9fd; border: 1px solid #d9e3ee; border-radius: 18px; padding: 18px 20px; font-size: 18px; line-height: 1.5; color: #1a3a5c; font-weight: 700;">
              Application Reference: ${applicationReference}
            </td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 22px;">
          <tr>
            <td style="background-color: #fff8e1; border: 1px solid #f3d07a; border-radius: 16px; padding: 16px 18px; font-size: 14px; line-height: 1.8; color: #6b4f00;">
              <strong>Cancellation reason:</strong><br />
              ${cancellationReason || 'No additional reason was provided.'}
            </td>
          </tr>
        </table>
        <div style="font-size: 14px; line-height: 1.8; color: #5f6b7a;">
          If you need clarification, contact support and mention your application reference exactly as shown above.
        </div>
      `,
      supportHtml:
        'This notification was sent automatically to keep the applicant informed about staff intervention on a submitted passport application.',
    }),
    fallbackValue: null,
  });

export const sendPassportApplicationSubmittedEmail = async ({
  email,
  firstName,
  applicationReference,
}) =>
  sendEmail({
    to: email,
    subject: `Passport application ${applicationReference} received`,
    text: `Hello ${firstName},

Your passport application was received by Passport Security.

Application reference: ${applicationReference}

Keep this reference for follow-up. You will receive another email when staff accepts or rejects the application.`,
    html: renderEmailLayout({
      eyebrow: 'Passport Application',
      title: 'Application Received',
      greeting: `Hello ${firstName},`,
      intro:
        'Your passport application was received by Passport Security. Keep the application reference below for follow-up.',
      contentHtml: `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 22px;">
          <tr>
            <td align="center" style="background-color: #f5f9fd; border: 1px solid #d9e3ee; border-radius: 18px; padding: 18px 20px; font-size: 20px; line-height: 1.4; letter-spacing: 0.06em; color: #1a3a5c; font-weight: 800;">
              ${applicationReference}
            </td>
          </tr>
        </table>
        <div style="font-size: 14px; line-height: 1.8; color: #5f6b7a;">
          Your application is now in the review workflow. Staff may use this reference to locate your request.
        </div>
      `,
      supportHtml:
        'This message confirms that your passport application was submitted. Do not reply with personal documents by email.',
    }),
    fallbackValue: applicationReference,
  });

export const sendPassportApplicationDecisionEmail = async ({
  email,
  firstName,
  applicationReference,
  status,
  notes,
}) => {
  const isAccepted = status === 'ai_verified';
  const title = isAccepted ? 'Application Accepted' : 'Application Rejected';
  const decision = isAccepted ? 'accepted' : 'rejected';

  return sendEmail({
    to: email,
    subject: `Passport application ${applicationReference} ${decision}`,
    text: `Hello ${firstName},

Your passport application ${applicationReference} was ${decision} by Passport Security.

${notes ? `Staff notes:\n${notes}` : 'No additional staff notes were provided.'}`,
    html: renderEmailLayout({
      eyebrow: 'Passport Application',
      title,
      greeting: `Hello ${firstName},`,
      intro: `Your passport application was ${decision} by Passport Security.`,
      contentHtml: `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 18px;">
          <tr>
            <td align="center" style="background-color: #f5f9fd; border: 1px solid #d9e3ee; border-radius: 18px; padding: 18px 20px; font-size: 18px; line-height: 1.5; color: #1a3a5c; font-weight: 700;">
              Application Reference: ${applicationReference}
            </td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 22px;">
          <tr>
            <td style="background-color: ${isAccepted ? '#ecfdf3' : '#fff1f2'}; border: 1px solid ${isAccepted ? '#bbf7d0' : '#fecdd3'}; border-radius: 16px; padding: 16px 18px; font-size: 14px; line-height: 1.8; color: ${isAccepted ? '#14532d' : '#7f1d1d'};">
              <strong>Status:</strong> ${isAccepted ? 'Accepted' : 'Rejected'}<br />
              ${notes ? `<strong>Staff notes:</strong><br />${notes}` : 'No additional staff notes were provided.'}
            </td>
          </tr>
        </table>
      `,
      supportHtml:
        'This notification was sent automatically after staff completed a passport application decision.',
    }),
    fallbackValue: applicationReference,
  });
};

export const sendAccountDeletionReminderEmail = async ({ email, firstName, minutesUntilDeletion }) =>
  sendEmail({
    to: email,
    subject: 'Verify your account before it is deleted',
    text: `Hello ${firstName},

Your Passport Security account is still not email verified.

Please verify your account soon. If it remains unverified, it will be deleted in about ${minutesUntilDeletion} minutes and you will need to create a new account.

If you already verified your account, no action is needed.`,
    html: renderEmailLayout({
      eyebrow: 'Account Verification Reminder',
      title: 'Verify Your Account',
      greeting: `Hello ${firstName},`,
      intro:
        'Your Passport Security account is still not email verified. Please complete email verification before the account cleanup window expires.',
      contentHtml: `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 22px;">
          <tr>
            <td align="center" style="background-color: #fff8e1; border: 1px solid #f3d07a; border-radius: 18px; padding: 18px 20px; font-size: 16px; line-height: 1.7; color: #6b4f00; font-weight: 700;">
              This account will be deleted in about ${minutesUntilDeletion} minutes if it remains unverified.
            </td>
          </tr>
        </table>
        <div style="font-size: 14px; line-height: 1.8; color: #5f6b7a;">
          Open the verification page and enter the code sent during registration. After deletion, you will need to create a new account.
        </div>
      `,
      supportHtml:
        'This reminder is sent automatically before unverified account cleanup. Production timing should be set to seven days with a 24-hour reminder.',
    }),
    fallbackValue: null,
  });
