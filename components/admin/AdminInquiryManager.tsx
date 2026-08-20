"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Eye, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { Input, Textarea } from "@/components/ui/input";
import type { InquiryContent, InquiryQuestionKey } from "@/lib/website/inquiry-content";

const coreKeys = new Set<InquiryQuestionKey>([
  "fullName",
  "email",
  "phone",
  "projectType",
  "servicesNeeded",
  "message",
  "consent",
]);

function lines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function questionHelp(key: InquiryQuestionKey) {
  const help: Partial<Record<InquiryQuestionKey, string>> = {
    fullName: "Required for the lead record.",
    email: "Required for confirmation emails and client follow-up.",
    phone: "Required for consultation follow-up.",
    projectType: "Choices are controlled below.",
    servicesNeeded: "Choices are controlled below.",
    referralSource: "Choices are controlled below.",
    preferredConsultationMethod: "Phone, video, and in-person remain the supported scheduling methods.",
    message: "Required so the owner receives useful event context.",
    consent: "Required contact consent. The wording can be changed, but the question cannot be hidden.",
  };
  return help[key] ?? "Optional question — the owner may show or hide it.";
}

export function AdminInquiryManager({ initialContent }: { initialContent: InquiryContent }) {
  const [content, setContent] = useState(initialContent);
  const [projectTypesText, setProjectTypesText] = useState(initialContent.projectTypeOptions.join("\n"));
  const [servicesText, setServicesText] = useState(initialContent.serviceOptions.join("\n"));
  const [referralsText, setReferralsText] = useState(initialContent.referralOptions.join("\n"));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const hasOptionWarning = useMemo(
    () => !lines(projectTypesText).length || !lines(servicesText).length || !lines(referralsText).length,
    [projectTypesText, servicesText, referralsText],
  );

  function updateQuestion(key: InquiryQuestionKey, patch: { label?: string; visible?: boolean }) {
    setContent((current) => ({
      ...current,
      questions: current.questions.map((question) => (question.key === key ? { ...question, ...patch } : question)),
    }));
  }

  async function save() {
    if (hasOptionWarning) {
      setStatus("Project types, services, and referral choices must each have at least one option.");
      return;
    }

    setSaving(true);
    setStatus("");
    const next: InquiryContent = {
      ...content,
      projectTypeOptions: lines(projectTypesText),
      serviceOptions: lines(servicesText),
      referralOptions: lines(referralsText),
    };

    const response = await fetch("/api/admin/inquiry-config", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: next }),
    });
    const payload = await response.json().catch(() => ({}));
    setSaving(false);

    if (!response.ok || !payload.content) {
      setStatus(payload.message ?? "Unable to save inquiry questions.");
      return;
    }

    setContent(payload.content as InquiryContent);
    setProjectTypesText((payload.content as InquiryContent).projectTypeOptions.join("\n"));
    setServicesText((payload.content as InquiryContent).serviceOptions.join("\n"));
    setReferralsText((payload.content as InquiryContent).referralOptions.join("\n"));
    setStatus("Saved. The public questionnaire now uses these questions and choices.");
  }

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Website · Inquiry</span>
          <h1>Inquiry Questions</h1>
          <p className="mini-meta">
            Control the public questionnaire without changing the lead pipeline. Required contact and consent questions stay protected.
          </p>
        </div>
        <div className="topbar-actions">
          <Link className="btn btn-light" href="/inquire" target="_blank">
            <Eye size={16} /> Preview questionnaire
          </Link>
          <Button disabled={saving || hasOptionWarning} onClick={save} type="button">
            <Save size={16} /> {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {status ? <p className={/unable|must|error|failed/i.test(status) ? "form-error" : "form-success"}>{status}</p> : null}

      <div className="dashboard-grid">
        <section className="panel span-2">
          <h2>Questionnaire Header</h2>
          <div className="form-grid">
            <Field label="Eyebrow">
              <Input value={content.eyebrow} onChange={(event) => setContent((current) => ({ ...current, eyebrow: event.target.value }))} />
            </Field>
            <Field label="Heading">
              <Input value={content.heading} onChange={(event) => setContent((current) => ({ ...current, heading: event.target.value }))} />
            </Field>
            <Field label="Intro" wide>
              <Textarea value={content.intro} onChange={(event) => setContent((current) => ({ ...current, intro: event.target.value }))} rows={4} />
            </Field>
            <Field label="Submit button text">
              <Input value={content.submitButtonText} onChange={(event) => setContent((current) => ({ ...current, submitButtonText: event.target.value }))} />
            </Field>
          </div>
        </section>

        <section className="panel span-2">
          <h2>Questions</h2>
          <p className="mini-meta">
            Rename any question. Optional questions can be hidden. Core contact, event, service, message, and consent fields remain enabled so every inquiry can still create a usable lead.
          </p>
          <div className="form-grid" style={{ marginTop: 14 }}>
            {content.questions.map((question) => {
              const locked = coreKeys.has(question.key);
              return (
                <div className="panel wide" key={question.key} style={{ padding: 14 }}>
                  <Field label="Question wording" wide>
                    <Input value={question.label} onChange={(event) => updateQuestion(question.key, { label: event.target.value })} />
                  </Field>
                  <p className="mini-meta" style={{ marginTop: 8 }}>{questionHelp(question.key)}</p>
                  <label className="check-row" style={{ marginTop: 8 }}>
                    <input
                      checked={locked ? true : question.visible}
                      disabled={locked}
                      onChange={(event) => updateQuestion(question.key, { visible: event.target.checked })}
                      type="checkbox"
                    />
                    <span>{locked ? "Required and always shown" : "Show this question"}</span>
                  </label>
                </div>
              );
            })}
          </div>
        </section>

        <section className="panel">
          <h2>Project Type Choices</h2>
          <p className="mini-meta">One choice per line.</p>
          <Textarea value={projectTypesText} onChange={(event) => setProjectTypesText(event.target.value)} rows={9} />
        </section>

        <section className="panel">
          <h2>Service Choices</h2>
          <p className="mini-meta">One choice per line. Clients may select more than one.</p>
          <Textarea value={servicesText} onChange={(event) => setServicesText(event.target.value)} rows={9} />
        </section>

        <section className="panel">
          <h2>Referral Choices</h2>
          <p className="mini-meta">One choice per line.</p>
          <Textarea value={referralsText} onChange={(event) => setReferralsText(event.target.value)} rows={9} />
        </section>

        <section className="panel">
          <h2>Consultation Method Labels</h2>
          <p className="mini-meta">Scheduling continues to use the existing phone, video, and in-person workflow.</p>
          <div className="form-grid">
            <Field label="Phone label">
              <Input
                value={content.consultationMethodLabels.phone}
                onChange={(event) => setContent((current) => ({ ...current, consultationMethodLabels: { ...current.consultationMethodLabels, phone: event.target.value } }))}
              />
            </Field>
            <Field label="Video label">
              <Input
                value={content.consultationMethodLabels.video}
                onChange={(event) => setContent((current) => ({ ...current, consultationMethodLabels: { ...current.consultationMethodLabels, video: event.target.value } }))}
              />
            </Field>
            <Field label="In-person label">
              <Input
                value={content.consultationMethodLabels.in_person}
                onChange={(event) => setContent((current) => ({ ...current, consultationMethodLabels: { ...current.consultationMethodLabels, in_person: event.target.value } }))}
              />
            </Field>
          </div>
        </section>
      </div>
    </div>
  );
}
