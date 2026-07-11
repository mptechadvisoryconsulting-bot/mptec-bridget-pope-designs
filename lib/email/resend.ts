import { Resend } from "resend";
import { requireEnv } from "@/lib/env";

let resendClient: Resend | null = null;

export function getResend() {
  if (!resendClient) {
    resendClient = new Resend(requireEnv("RESEND_API_KEY"));
  }

  return resendClient;
}

export const resend = {
  emails: {
    send(input: Parameters<Resend["emails"]["send"]>[0]) {
      return getResend().emails.send(input);
    },
  },
};

export function emailFrom() {
  return process.env.EMAIL_FROM ?? "Bridget Pope Designs <inquiries@example.com>";
}
