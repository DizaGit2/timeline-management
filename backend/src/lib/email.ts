import nodemailer from "nodemailer";
import { config } from "../config";

const transporter = nodemailer.createTransport({
  host: config.email.smtp.host,
  port: config.email.smtp.port,
  secure: config.email.smtp.port === 465,
  ...(config.email.smtp.user
    ? {
        auth: {
          user: config.email.smtp.user,
          pass: config.email.smtp.pass,
        },
      }
    : {}),
});

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  try {
    await transporter.sendMail({
      from: config.email.from,
      to,
      subject,
      html,
    });
  } catch (error) {
    // Fire-and-forget: log but don't throw
    console.error("Failed to send email:", error);
  }
}
