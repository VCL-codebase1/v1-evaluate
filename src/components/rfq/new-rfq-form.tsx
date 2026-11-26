"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/cn";

type FieldName = "clientName" | "title";

type FormState = {
  clientName: string;
  qref: string;
  tenderNumber: string;
  title: string;
  contact: string;
  department: string;
  dateReceived: string;
  deadline: string;
  accountManager: string;
  originator: string;
  description: string;
  remarks: string;
};

const EMPTY: FormState = {
  clientName: "",
  qref: "",
  tenderNumber: "",
  title: "",
  contact: "",
  department: "",
  dateReceived: "",
  deadline: "",
  accountManager: "",
  originator: "",
  description: "",
  remarks: "",
};

function TextInput({
  label,
  name,
  value,
  placeholder,
  error,
  onChange,
}: {
  label: string;
  name: keyof FormState;
  value: string;
  placeholder: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="rfq-field">
      <span className="rfq-label">{label}</span>
      <input
        className={cn("rfq-input", error && "is-invalid")}
        name={name}
        value={value}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <span className="text-error">{error}</span> : null}
    </label>
  );
}

function DateInput({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: keyof FormState;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="rfq-field">
      <span className="rfq-label">{label}</span>
      <input
        className="rfq-input"
        type="date"
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function NewRfqForm({ originator }: { originator: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY, originator });
  const [attachments, setAttachments] = useState<string[]>([]);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);

  function setField(name: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
    if (name === "clientName" || name === "title") {
      setErrors((current) => ({ ...current, [name]: undefined }));
    }
  }

  async function onFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) {
        const body = new FormData();
        body.set("file", file);
        const response = await fetch("/api/uploads", { method: "POST", body });
        const payload = (await response.json().catch(() => null)) as { error?: string; url?: string; name?: string } | null;
        if (!response.ok || !payload?.url) {
          toast.error(payload?.error ?? `Unable to upload ${file.name}.`);
          continue;
        }
        setAttachments((current) => [...current, `${payload.name || file.name}||${payload.url}`]);
        toast.success(`${file.name} uploaded`);
      }
    } catch {
      toast.error("Unable to upload files. Check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setFormError("");

    const nextErrors: Partial<Record<FieldName, string>> = {};
    if (!form.clientName.trim()) nextErrors.clientName = "Enter the client name.";
    if (!form.title.trim()) nextErrors.title = "Enter the RFQ title.";
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/estimates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, attachments }),
      });
      const payload = (await response.json()) as {
        error?: string;
        field?: FieldName;
        estimate?: { id?: string };
      };
      if (!response.ok) {
        const message = payload.error ?? "Unable to create this estimate.";
        if (payload.field) setErrors({ [payload.field]: payload.error });
        else setFormError(message);
        toast.error(message);
        return;
      }

      const estimateId = payload.estimate?.id;
      toast.success("RFQ created", { persist: true });
      router.push(estimateId ? `/estimation?estimate=${encodeURIComponent(estimateId)}` : "/estimation");
      router.refresh();
    } catch {
      const message = "Unable to create this estimate. Check your connection and try again.";
      setFormError(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="page-stack">
      <div className="page-heading">
        <h1 className="text-page-title">New RFQ registration</h1>
      </div>

      <form className="rfq-form" onSubmit={onSubmit} noValidate>
        <section className="surface-card panel-card">
          <div className="rfq-fields">
            <TextInput
              label="Client name"
              name="clientName"
              value={form.clientName}
              placeholder="[Client name]"
              error={errors.clientName}
              onChange={(value) => setField("clientName", value)}
            />
            <TextInput
              label="Qref"
              name="qref"
              value={form.qref}
              placeholder="[Zoho quotation reference]"
              onChange={(value) => setField("qref", value)}
            />
            <TextInput
              label="Client RFQ/tender number"
              name="tenderNumber"
              value={form.tenderNumber}
              placeholder="[RFQ/Tender no]"
              onChange={(value) => setField("tenderNumber", value)}
            />
            <TextInput
              label="RFQ title"
              name="title"
              value={form.title}
              placeholder="[RFQ title]"
              error={errors.title}
              onChange={(value) => setField("title", value)}
            />
            <TextInput
              label="Contact person"
              name="contact"
              value={form.contact}
              placeholder="[Contact]"
              onChange={(value) => setField("contact", value)}
            />
            <TextInput
              label="Client department"
              name="department"
              value={form.department}
              placeholder="[Department]"
              onChange={(value) => setField("department", value)}
            />
            <DateInput
              label="Date received"
              name="dateReceived"
              value={form.dateReceived}
              onChange={(value) => setField("dateReceived", value)}
            />
            <DateInput
              label="Submission deadline"
              name="deadline"
              value={form.deadline}
              onChange={(value) => setField("deadline", value)}
            />
            <TextInput
              label="Account manager"
              name="accountManager"
              value={form.accountManager}
              placeholder="[Account manager]"
              onChange={(value) => setField("accountManager", value)}
            />
            <TextInput
              label="Originator"
              name="originator"
              value={form.originator}
              placeholder="[Logged-in user]"
              onChange={(value) => setField("originator", value)}
            />
          </div>
        </section>

        <section className="surface-card panel-card" aria-labelledby="attachments-title">
          <h2 id="attachments-title" className="text-block-title">
            Attachments (PDF, XLSX, DOCX, CSV, images)
          </h2>
          <input
            ref={fileRef}
            className="file-input"
            type="file"
            multiple
            accept=".pdf,.xlsx,.xls,.docx,.csv,image/*"
            onChange={onFiles}
          />
          <Button type="button" variant="primary" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? "Uploading…" : "+ Upload document"}
          </Button>
          {attachments.length > 0 ? (
            <ul className="file-list">
              {attachments.map((entry, index) => (
                <li key={`${entry}-${index}`}>
                  <span>{entry.split("||")[0]}</span>
                  <button
                    type="button"
                    className="file-remove"
                    onClick={() =>
                      setAttachments((current) => current.filter((_, item) => item !== index))
                    }
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <div className="rfq-split">
          <section className="surface-card panel-card">
            <label className="rfq-field">
              <span className="text-block-title">RFQ description</span>
              <textarea
                className="rfq-textarea"
                name="description"
                value={form.description}
                onChange={(event) => setField("description", event.target.value)}
              />
            </label>
          </section>
          <section className="surface-card panel-card">
            <label className="rfq-field">
              <span className="text-block-title">Remarks</span>
              <textarea
                className="rfq-textarea"
                name="remarks"
                value={form.remarks}
                onChange={(event) => setField("remarks", event.target.value)}
              />
            </label>
          </section>
        </div>

        {formError ? <p className="text-error">{formError}</p> : null}

        <div className="form-actions">
          <Button type="submit" variant="primary" size="sm" disabled={pending} aria-busy={pending || undefined}>
            {pending ? "Creating…" : "Create estimate"}
          </Button>
          <ButtonLink href="/rfqs" variant="quiet" size="sm">
            Cancel
          </ButtonLink>
        </div>
      </form>
    </div>
  );
}
