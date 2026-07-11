import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { differenceInCalendarDays, startOfDay } from "date-fns";

export const BUSINESS_TIMEZONE = "America/Chicago";

export function businessDate(value: Date | string) {
  return startOfDay(toZonedTime(value, BUSINESS_TIMEZONE));
}

export function daysUntilEvent(eventDate: string, now = new Date()) {
  return differenceInCalendarDays(businessDate(`${eventDate}T12:00:00`), businessDate(now));
}

export function formatBusinessDate(value: Date | string) {
  return formatInTimeZone(value, BUSINESS_TIMEZONE, "MMM d, yyyy h:mm a zzz");
}
