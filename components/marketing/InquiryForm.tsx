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
] as const;

const referralOptions = [
  "Instagram",
  "Facebook",
  "Google",
  "Friend or Family",
  "Wedding Vendor",
  "Previous Client",
  "Other",
] as const;

export function InquiryForm() {
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<InquiryInput>({
    resolver: zodResolver(inquirySchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      projectType: "Wedding",
      servicesNeeded: ["Weddings"],
      referralSource: "Instagram",
      preferredConsultationMethod: "phone",
      preferredConsultationDate: "",
      preferredConsultationTime: "",
      estimatedBudget: "",
      message: "",
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
            <Field label="Full Name" wide>
              <Input placeholder="Full name" {...register("fullName")} />
              {errors.fullName && <small>{errors.fullName.message}</small>}
            </Field>
            <Field label="Email Address">
              <Input placeholder="client@example.com" type="email" {...register("email")} />
              {errors.email && <small>{errors.email.message}</small>}
            </Field>
            <Field label="Phone Number">
              <Input placeholder="(629) 295-4210" {...register("phone")} />
              {errors.phone && <small>{errors.phone.message}</small>}
            </Field>
            <Field label="Project Type">
              <Select defaultValue="Wedding" {...register("projectType")}>
                <option>Wedding</option>
                <option>Baby Shower</option>
                <option>Birthday</option>
                <option>Corporate Event</option>
                <option>Luxury Balloons</option>
                <option>Full Planning</option>
              </Select>
            </Field>
            <Field label="Estimated Guest Count">
              <Input placeholder="125" type="number" {...register("guestCount")} />
            </Field>
            <Field label="Budget">
              <Input placeholder="$5,000 - $8,000" {...register("estimatedBudget")} />
            </Field>
            <div className="field wide">
              <span>Services Interested In</span>
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
            <Field label="How Did You Hear About Us?">
              <Select defaultValue="Instagram" {...register("referralSource")}>
                {referralOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
              {errors.referralSource && <small>{errors.referralSource.message}</small>}
            </Field>
            <Field label="Consultation Method">
              <Select {...register("preferredConsultationMethod")}>
                <option value="phone">Phone</option>
                <option value="video">Video call</option>
                <option value="in_person">In person</option>
              </Select>
            </Field>
            <Field label="Preferred Consultation Date">
              <Input type="date" {...register("preferredConsultationDate")} />
            </Field>
            <Field label="Preferred Consultation Time">
              <Input placeholder="10:00 AM" {...register("preferredConsultationTime")} />
            </Field>
            <Field label="Leave Us a Message" wide>
              <Textarea placeholder="Tell us about your event vision and any details that will help us prepare for your consultation." {...register("message")} />
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
