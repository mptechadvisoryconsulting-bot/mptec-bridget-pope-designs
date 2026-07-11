export function getTwilioConfig() {
  return {
    configured: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
    phoneNumber: process.env.TWILIO_PHONE_NUMBER ?? "",
  };
}
