"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { inquirySchema, type InquiryInput } from "@/lib/validation/inquiry-schema";

const serviceOptions = [
  "Weddings",
  "Baby Showers",
  "Birthdays",
  "Corporate Events",
  "Luxury Balloons",
  "Full Planning",
];

export function InquiryForm() {
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<InquiryInput>({
    resolver: zodResolver(inquirySchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      eventType: "Wedding",
      preferredConsultationMethod: "phone",
      servicesNeeded: ["Weddings"],
      inspirationFileNames: [],
      consent: false,
      company: "",
    },
  });

  async function submit(input: InquiryInput) {
    setStatus("idle");
    setMessage("");
    const response = await fetch("/api/inquiries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const payload = await response.json();

    if (!response.ok) {
      setStatus("error");
      setMessage(payload.message ?? "Unable to submit the inquiry.");
      return;
    }

    setStatus("success");
    setMessage(
      `Thank you — your consultation request was received. We will review your details and follow up shortly. Request Reference Number: ${payload.leadNumber}`,
    );
  }

  return (
    <section className="section">
      <div className="container">
        <div className="section-heading">
          <span className="eyebrow">Start your event</span>
          <h1>Book a Consultation</h1>
          <p>Share the details you know today. We will review your request and follow up to schedule a consultation.</p>
        </div>
        <form className="card" onSubmit={handleSubmit(submit)} style={{ margin: "0 auto", maxWidth: 920, padding: 28 }}>
          <input aria-hidden="true" suppressHydrationWarning tabIndex={-1} style={{ display: "none" }} {...register("company")} />
          <div className="form-grid">
            <Field label="First Name">
              <Input placeholder="First name" {...register("firstName")} />
              {errors.firstName && <small>{errors.firstName.message}</small>}
            </Field>
            <Field label="Last Name">
              <Input placeholder="Last name" {...register("lastName")} />
              {errors.lastName && <small>{errors.lastName.message}</small>}
            </Field>
            <Field label="Email">
              <Input placeholder="client@example.com" type="email" {...register("email")} />
              {errors.email && <small>{errors.email.message}</small>}
            </Field>
            <Field label="Phone">
              <Input placeholder="(629) 295-4210" {...register("phone")} />
              {errors.phone && <small>{errors.phone.message}</small>}
            </Field>
            <Field label="Event Type">
              <Select defaultValue="Wedding" {...register("eventType")}>
                <option>Wedding</option>
                <option>Baby Shower</option>
                <option>Birthday</option>
                <option>Corporate Event</option>
                <option>Luxury Balloons</option>
                <option>Full Planning</option>
              </Select>
            </Field>
            <Field label="Event Date">
              <Input type="date" {...register("eventDate")} />
            </Field>
            <Field label="Guest Count">
              <Input placeholder="125" type="number" {...register("guestCount")} />
            </Field>
            <Field label="Venue">
              <Input placeholder="Venue name" {...register("venue")} />
            </Field>
            <Field label="City">
              <Input placeholder="Murfreesboro" {...register("city")} />
            </Field>
            <Field label="Estimated Budget">
              <Input placeholder="$5,000 - $8,000" {...register("estimatedBudget")} />
            </Field>
            <Field label="Consultation Method">
              <Select {...register("preferredConsultationMethod")}>
                <option value="phone">Phone</option>
                <option value="video">Video call</option>
                <option value="in_person">In person</option>
              </Select>
            </Field>
            <Field label="Preferred Date">
              <Input type="date" {...register("preferredConsultationDate")} />
            </Field>
            <Field label="Preferred Time">
              <Input placeholder="10:00 AM" {...register("preferredConsultationTime")} />
            </Field>
            <Field label="Event Colors">
              <Input placeholder="Blush, ivory, gold" {...register("eventColors")} />
            </Field>
            <Field label="Event Theme">
              <Input placeholder="Elegant garden wedding" {...register("eventTheme")} />
            </Field>
            <div className="field wide">
              <span>Services Needed</span>
              <div className="checkbox-grid">
                {serviceOptions.map((service) => (
                  <label key={service} className="check-row">
                    <input suppressHydrationWarning type="checkbox" value={service} {...register("servicesNeeded")} />
                    <span>{service}</span>
                  </label>
                ))}
              </div>
              {errors.servicesNeeded && <small>{errors.servicesNeeded.message}</small>}
            </div>
            <Field label="Inspiration File Names" wide>
              <Input
                placeholder="Optional: list files you plan to upload, separated by commas"
                onChange={(event) => {
                  const names = event.target.value
                    .split(",")
                    .map((name) => name.trim())
                    .filter(Boolean);
                  setValue("inspirationFileNames", names, { shouldValidate: true });
                }}
              />
              <small>Private image upload storage is handled by the authenticated file workflow.</small>
            </Field>
            <Field label="Vision" wide>
              <Textarea placeholder="Tell us about colors, venue, inspiration, and the experience you want guests to remember." {...register("message")} />
              {errors.message && <small>{errors.message.message}</small>}
            </Field>
            <label className="check-row wide">
              <input suppressHydrationWarning type="checkbox" {...register("consent")} />
              <span>I consent to Bridget Pope Designs contacting me about this event inquiry.</span>
            </label>
          </div>
          {message && (
            <p className={status === "success" ? "form-success" : "form-error"}>
              {status === "success" && <CheckCircle2 size={16} />} {message}
            </p>
          )}
          <div style={{ marginTop: 20 }}>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Submitting..." : "Submit Inquiry"} <ArrowRight size={16} />
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}
