/**
 * Email Service for LineLens
 * Handles sending email notifications for virtual check-in
 */

export interface EmailTemplate {
  to: string;
  from?: string;
  subject: string;
  text: string;
  html?: string;
}

export interface VirtualCheckInEmailData {
  userEmail: string;
  organizerEmail: string;
  queueID: string;
  reservationID: string;
  checkInTime: Date;
  arrivalWindow: [Date, Date];
}

/**
 * Simple email service that can be configured with different providers
 * For development/demo purposes, this logs emails to console
 * In production, this would integrate with services like SendGrid, AWS SES, etc.
 */
export class EmailService {
  private isProduction: boolean;
  private systemEmail: string;
  private sendGridApiKey: string | undefined;

  constructor() {
    this.isProduction = Deno.env.get("NODE_ENV") === "production";
    // Configure system email - can be overridden via environment variable
    this.systemEmail = Deno.env.get("SYSTEM_EMAIL") || "noreply@linelens.com";
    this.sendGridApiKey = Deno.env.get("SENDGRID_API_KEY");
  }

  /**
   * Get the configured system email address
   */
  getSystemEmail(): string {
    return this.systemEmail;
  }

  /**
   * Check email service configuration status
   */
  getEmailServiceStatus(): {
    mode: string;
    systemEmail: string;
    sendGridConfigured: boolean;
    willSendRealEmails: boolean;
  } {
    return {
      mode: this.isProduction ? "production" : "development",
      systemEmail: this.systemEmail,
      sendGridConfigured: !!this.sendGridApiKey,
      willSendRealEmails: !!this.sendGridApiKey,
    };
  }

  /**
   * Sends an email using SendGrid or logs it in development
   */
  async sendEmail(email: EmailTemplate): Promise<boolean> {
    try {
      if (this.isProduction && this.sendGridApiKey) {
        // Production mode with SendGrid
        return await this.sendWithSendGrid(email);
      } else if (this.sendGridApiKey && !this.isProduction) {
        // Development mode with SendGrid (for testing)
        console.log("🚀 SENDING REAL EMAIL via SendGrid (Development Mode)");
        return await this.sendWithSendGrid(email);
      } else {
        // Development mode - log email to console
        console.log("\n📧 EMAIL NOTIFICATION (Console Only)");
        console.log("=".repeat(50));
        console.log(`From: ${email.from || this.systemEmail}`);
        console.log(`To: ${email.to}`);
        console.log(`Subject: ${email.subject}`);
        console.log("-".repeat(50));
        console.log(email.text);
        console.log("=".repeat(50));
        // Simulate async operation
        await new Promise((resolve) => setTimeout(resolve, 10));
        return true;
      }
    } catch (error) {
      console.error("Failed to send email:", error);
      return false;
    }
  }

  /**
   * Send email using SendGrid API
   */
  private async sendWithSendGrid(email: EmailTemplate): Promise<boolean> {
    if (!this.sendGridApiKey) {
      throw new Error("SendGrid API key not configured");
    }

    try {
      const sendGridPayload = {
        from: {
          email: email.from || this.systemEmail,
          name: "LineLens",
        },
        personalizations: [
          {
            to: [{ email: email.to }],
            subject: email.subject,
          },
        ],
        content: [
          {
            type: "text/plain",
            value: email.text,
          },
        ],
      };

      // Add HTML content if available
      if (email.html) {
        sendGridPayload.content.push({
          type: "text/html",
          value: email.html,
        });
      }

      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.sendGridApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sendGridPayload),
      });

      if (response.ok) {
        console.log(`✅ Email sent successfully to ${email.to} via SendGrid`);
        return true;
      } else {
        const errorText = await response.text();
        console.error(`❌ SendGrid API error (${response.status}):`, errorText);
        return false;
      }
    } catch (error) {
      console.error("❌ SendGrid send error:", error);
      return false;
    }
  }

  /**
   * Generates and sends virtual check-in confirmation emails
   */
  async sendVirtualCheckInEmails(data: VirtualCheckInEmailData): Promise<{
    userEmailSent: boolean;
    organizerEmailSent: boolean;
  }> {
    const formatTime = (date: Date) => {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/New_York", // Adjust timezone as needed
      });
    };

    const formatDateTime = (date: Date) => {
      return date.toLocaleString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/New_York",
      });
    };

    // User confirmation email
    const userEmail: EmailTemplate = {
      from: this.systemEmail,
      to: data.userEmail,
      subject: `🎯 Virtual Check-in Confirmed - ${data.queueID}`,
      text: `
Virtual Check-in Confirmation

Hi there! 👋

Your virtual check-in has been confirmed for:

Queue: ${data.queueID}
Reservation ID: ${data.reservationID}

⏰ IMPORTANT TIMING INFORMATION:
• Check-in Time: ${formatDateTime(data.checkInTime)}
• Your Arrival Window: ${formatTime(data.arrivalWindow[0])} - ${
        formatTime(data.arrivalWindow[1])
      }

📍 What to do next:
1. Arrive within your 10-minute arrival window
2. Present this reservation ID: ${data.reservationID}
3. If you're late, your spot may be given to someone else

⚠️ Your reservation will expire if you don't arrive within the window above.

Need help? Reply to this email or contact the event organizer.

Thanks for using LineLens! 🚀

---
LineLens Virtual Check-in System
      `.trim(),
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">🎯 Virtual Check-in Confirmed</h2>
          
          <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1e40af;">Queue: ${data.queueID}</h3>
            <p><strong>Reservation ID:</strong> <code style="background: #e5e7eb; padding: 2px 6px; border-radius: 4px;">${data.reservationID}</code></p>
          </div>

          <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #d97706;">⏰ IMPORTANT TIMING</h3>
            <p><strong>Check-in Time:</strong> ${
        formatDateTime(data.checkInTime)
      }</p>
            <p><strong>Your Arrival Window:</strong> ${
        formatTime(data.arrivalWindow[0])
      } - ${formatTime(data.arrivalWindow[1])}</p>
          </div>

          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">📍 What to do next:</h3>
            <ol>
              <li>Arrive within your 10-minute arrival window</li>
              <li>Present this reservation ID: <strong>${data.reservationID}</strong></li>
              <li>If you're late, your spot may be given to someone else</li>
            </ol>
          </div>

          <p style="color: #dc2626;"><strong>⚠️ Your reservation will expire if you don't arrive within the window above.</strong></p>

          <hr style="margin: 30px 0;">
          <p style="color: #6b7280; font-size: 14px;">
            Need help? Reply to this email or contact the event organizer.<br>
            Thanks for using LineLens! 🚀
          </p>
        </div>
      `,
    };

    // Organizer notification email
    const organizerEmail: EmailTemplate = {
      from: this.systemEmail,
      to: data.organizerEmail,
      subject: `📱 New Virtual Check-in - ${data.queueID}`,
      text: `
New Virtual Check-in Notification

A user has reserved a virtual check-in spot for your queue.

Queue: ${data.queueID}
Reservation ID: ${data.reservationID}
Expected Check-in: ${formatDateTime(data.checkInTime)}
Arrival Window: ${formatTime(data.arrivalWindow[0])} - ${
        formatTime(data.arrivalWindow[1])
      }

The user has been notified and will arrive during their assigned window.

---
LineLens Queue Management System
      `.trim(),
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #059669;">📱 New Virtual Check-in</h2>
          
          <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #065f46;">Queue: ${data.queueID}</h3>
            <p><strong>Reservation ID:</strong> <code style="background: #e5e7eb; padding: 2px 6px; border-radius: 4px;">${data.reservationID}</code></p>
            <p><strong>Expected Check-in:</strong> ${
        formatDateTime(data.checkInTime)
      }</p>
            <p><strong>Arrival Window:</strong> ${
        formatTime(data.arrivalWindow[0])
      } - ${formatTime(data.arrivalWindow[1])}</p>
          </div>

          <p>The user has been notified and will arrive during their assigned window.</p>

          <hr style="margin: 30px 0;">
          <p style="color: #6b7280; font-size: 14px;">
            LineLens Queue Management System
          </p>
        </div>
      `,
    };

    // Send both emails
    const [userEmailSent, organizerEmailSent] = await Promise.all([
      this.sendEmail(userEmail),
      this.sendEmail(organizerEmail),
    ]);

    return {
      userEmailSent,
      organizerEmailSent,
    };
  }
}

// Singleton instance
export const emailService = new EmailService();
