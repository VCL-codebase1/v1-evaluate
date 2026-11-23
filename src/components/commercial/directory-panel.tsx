"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { DirectoryKind, DirectoryRecord } from "@/lib/db/commercial";

export function DirectoryPanel() {
  const [kind, setKind] = useState<DirectoryKind>("client");
  const [records, setRecords] = useState<DirectoryRecord[]>([]);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/api/directory?kind=${kind}`)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Unable to load records.");
        if (active) setRecords(payload.records ?? []);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to load records.");
      });
    return () => {
      active = false;
    };
  }, [kind]);

  async function add(event: FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/directory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, name, contact, email }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "Unable to add this record.");
      return;
    }
    setRecords((current) => [payload.record, ...current]);
    setName("");
    setContact("");
    setEmail("");
  }

  async function onImport(file: File) {
    const text = await file.text();
    const rows = text
      .split(/\r?\n/)
      .slice(1)
      .map((line) => line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, "")))
      .filter((cells) => cells[0])
      .map((cells) => ({ name: cells[0] ?? "", contact: cells[1] ?? "", email: cells[2] ?? "" }));
    const response = await fetch("/api/directory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, rows }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "Unable to import records.");
      return;
    }
    setRecords((current) => [...(payload.records ?? []), ...current]);
  }

  const noun = kind === "client" ? "Clients" : "Suppliers";
  const nameLabel = kind === "client" ? "Customer" : "Supplier";

  return (
    <div className="page-stack">
      <h1 className="text-page-title">Clients and suppliers</h1>
      <div className="segmented">
        <button type="button" className={kind === "client" ? "is-selected" : ""} onClick={() => setKind("client")}>Clients</button>
        <button type="button" className={kind === "supplier" ? "is-selected" : ""} onClick={() => setKind("supplier")}>Suppliers</button>
      </div>
      <section className="surface-card panel-card">
        <h2>Add to {noun}</h2>
        <form className="directory-form" onSubmit={add}>
          <label>{nameLabel}<input value={name} onChange={(event) => setName(event.target.value)} required /></label>
          <label>Contact<input value={contact} onChange={(event) => setContact(event.target.value)} /></label>
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <button type="submit" className="solid-action">Add record</button>
        </form>
        {error ? <p className="text-error" role="alert">{error}</p> : null}
      </section>
      <section className="surface-card panel-card">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">{kind === "client" ? "Customer" : "Suppliers"}</th>
              <th scope="col">Contact</th>
              <th scope="col">Email</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <div className="dashed-empty">
                    <strong>Nothing here yet</strong>
                    <span>Add your first record above, or import several at once.</span>
                  </div>
                </td>
              </tr>
            ) : (
              records.map((record) => (
                <tr key={record.id}>
                  <td>{record.name}</td>
                  <td>{record.contact || "[Contact]"}</td>
                  <td>{record.email}</td>
                  <td><span className="status-pill">{record.status}</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <label className="import-record">
          <span className="solid-action">Import record</span>
          <input
            type="file"
            accept=".csv,.xls,.xlsx,text/csv"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onImport(file);
              event.target.value = "";
            }}
          />
          <small>Import xls, xlsx or csv</small>
        </label>
      </section>
    </div>
  );
}
