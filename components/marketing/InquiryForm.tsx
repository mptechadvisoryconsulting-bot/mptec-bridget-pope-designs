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
import type { InquiryContent, InquiryQuestionKey } from "@/lib/website/inquiry-content";

export function InquiryForm({ config }: { config: InquiryContent }) {
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const question = (key: InquiryQuestionKey) => config.questions.find((item) => item.key === key)!;
  const visible = (key: InquiryQuestionKey) => question(key).visible !== false;
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
      projectType: config.projectTypeOptions[0] ?? "Wedding",
      servicesNeeded: [config.serviceOptions[0] ?? "Weddings"],
      referralSource: config.referralOptions[0] ?? "Other",
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
          <span className="eyebrow">{config.eyebrow}</span>
          <h1>{config.heading}</h1>
          <p>{config.intro}</p>
        </div>
        <form className="card" onSubmit={handleSubmit(submit)} style={{ margin: "0 auto", maxWidth: 920, padding: 28 }}>
          <input aria-hidden="true" suppressHydrationWarning tabIndex={-1} style={{ display: "none" }} {...register("company")} />
          <div className="form-grid">
            <Field label={question("fullName").label} wide>
              <Input placeholder="Full name" {...register("fullName")} />
              {errors.fullName && <small>{errors.fullName.message}</small>}
            </Field>
            <Field label={question("email").label}>
              <Input placeholder="client@example.com" type="email" {...register("email")} />
              {errors.email && <small>{errors.email.message}</small>}
            </Field>
            <Field label={question("phone").label}>
              <Input placeholder="(629) 295-4210" {...register("phone")} />
              {errors.phone && <small>{errors.phone.message}</small>}
            </Field>
            <Field label={question("projectType").label}>
              <Select {...register("projectType")}>
                {config.projectTypeOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </Select>
              {errors.projectType && <small>{errors.projectType.message}</small>}
            </Field>
            {visible("guestCount") ? (
              <Field label={question("guestCount").label}>
                <Input placeholder="125" type="number" {...register("guestCount")} />
              </Field>
            ) : null}
            {visible("estimatedBudget") ? (
              <Field label={question("estimatedBudget").label}>
                <Input placeholder="$5,000 - $8,000" {...register("estimatedBudget")} />
              </Field>
            ) : null}
            <div className="field wide">
              <span>{question("servicesNeeded").label}</span>
              <div className="checkbox-grid">
                {config.serviceOptions.map((service) => (
                  <label key={service} className="check-row">
                    <input suppressHydrationWarning type="checkbox" value={service} {...register("servicesNeeded")} />
                    <span>{service}</span>
                  </label>
                ))}
              </div>
              {errors.servicesNeeded && <small>{errors.servicesNeeded.message}</small>}
            </div>
            {visible("referralSource") ? (
              <Field label={question("referralSource").label}>
                <Select {...register("referralSource")}>
                  {config.referralOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </Select>
                {errors.referralSource && <small>{errors.referralSource.message}</small>}
              </Field>
            ) : null}
            {visible("preferredConsultationMethod") ? (
              <Field label={question("preferredConsultationMethod").label}>
                <Select {...register("preferredConsultationMethod")}>
                  <option value="phone">{config.consultationMethodLabels.phone}</option>
                  <option value="video">{config.consultationMethodLabels.video}</option>
                  <option value="in_person">{config.consultationMethodLabels.in_person}</option>
                </Select>
              </Field>
            ) : null}
            {visible("preferredConsultationDate") ? (
              <Field label={question("preferredConsultationDate").label}>
                <Input type="date" {...register("preferredConsultationDate")} />
              </Field>
            ) : null}
            {visible("preferredConsultationTime") ? (
              <Field label={question("preferredConsultationTime").label}>
                <Input placeholder="10:00 AM" {...register("preferredConsultationTime")} />
              </Field>
            ) : null}
            <Field label={question("message").label} wide>
              <Textarea placeholder="Tell us about your event vision and any details that will help us prepare for your consultation." {...register("message")} />
              {errors.message && <small>{errors.message.message}</small>}
            </Field>
            <label className="check-row wide">
              <input suppressHydrationWarning type="checkbox" {...register("consent")} />
              <span>{question("consent").label}</span>
            </label>
          </div>
          {message && (
            <p className={status === "success" ? "form-success" : "form-error"}>
              {status === "success" && <CheckCircle2 size={16} />} {message}
            </p>
          )}
          <div style={{ marginTop: 20 }}>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Submitting..." : config.submitButtonText} <ArrowRight size={16} />
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}
