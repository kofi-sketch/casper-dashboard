import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { getEmailTemplate } from "../../lib/email-templates";

export async function POST(req: NextRequest) {
  try {
    const { subscriberId, emailNumber, name, email } = await req.json();

    if (!subscriberId || !emailNumber || !name || !email) {
      return NextResponse.json(
        { error: "Missing required fields: subscriberId, emailNumber, name, email" },
        { status: 400 }
      );
    }

    if (emailNumber < 1 || emailNumber > 8) {
      return NextResponse.json(
        { error: "emailNumber must be between 1 and 8" },
        { status: 400 }
      );
    }

    const template = getEmailTemplate(emailNumber, name);
    if (!template) {
      return NextResponse.json(
        { error: `No template found for email stage ${emailNumber}` },
        { status: 400 }
      );
    }

    const transporter = nodemailer.createTransport({
      host: process.env.CASPER_SMTP_HOST,
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.CASPER_EMAIL,
        pass: process.env.CASPER_EMAIL_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: "Traqd <Casperowens@traqd.io>",
      to: email,
      subject: template.subject,
      html: template.html,
    });

    return NextResponse.json({
      success: true,
      message: `Email #${emailNumber} sent to ${email}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Email send failed:", message);
    return NextResponse.json(
      { error: `Failed to send email: ${message}` },
      { status: 500 }
    );
  }
}
