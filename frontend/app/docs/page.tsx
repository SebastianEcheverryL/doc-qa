"use client";

import { useRef, useState, type FormEvent } from "react";
import { describeError, ingestDocuments } from "@/lib/api";

interface Row {
  key: number;
  id: string;
  title: string;
  content: string;
}

type Status = { kind: "success"; message: string } | { kind: "error"; message: string; details: string[] };

const emptyRow = (key: number): Row => ({ key, id: "", title: "", content: "" });

export default function DocsPage() {
  const nextKey = useRef(1);
  const [rows, setRows] = useState<Row[]>([emptyRow(0)]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);

  function updateRow(key: number, field: "id" | "title" | "content", value: string) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, [field]: value } : row)));
  }

  function addRow() {
    setRows((current) => [...current, emptyRow(nextKey.current++)]);
  }

  function removeRow(key: number) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      const documents = rows.map((row) => ({
        id: row.id.trim(),
        title: row.title.trim(),
        content: row.content.trim(),
      }));
      const result = await ingestDocuments(documents);

      setStatus({
        kind: "success",
        message: `Ingested ${result.ingestedDocuments} document(s) as ${result.ingestedChunks} chunk(s). It can take a few seconds before they show up in answers.`,
      });
      setRows([emptyRow(nextKey.current++)]);
    } catch (err) {
      setStatus({ kind: "error", ...describeError(err) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1>Documents</h1>
      <p className="lead">
        Add plain-text documents. Uploading a document with an existing id replaces the old version. Up to 10 documents
        and 60,000 characters in total per upload.
      </p>

      <form onSubmit={handleSubmit} className="stack">
        {rows.map((row, index) => (
          <fieldset key={row.key} className="doc-card" disabled={loading}>
            <div className="doc-card-header">
              <span>Document {index + 1}</span>
              {rows.length > 1 && (
                <button type="button" onClick={() => removeRow(row.key)}>
                  Remove
                </button>
              )}
            </div>

            <div className="field">
              <label htmlFor={`id-${row.key}`}>Id</label>
              <input
                id={`id-${row.key}`}
                value={row.id}
                onChange={(event) => updateRow(row.key, "id", event.target.value)}
                placeholder="refund-policy"
                pattern="[A-Za-z0-9_\-]+"
                title="Letters, numbers, '-' and '_' only"
                maxLength={50}
                required
              />
              <span className="hint">Letters, numbers, &quot;-&quot; and &quot;_&quot; only.</span>
            </div>

            <div className="field">
              <label htmlFor={`title-${row.key}`}>Title</label>
              <input
                id={`title-${row.key}`}
                value={row.title}
                onChange={(event) => updateRow(row.key, "title", event.target.value)}
                placeholder="Refund Policy"
                maxLength={200}
                required
              />
            </div>

            <div className="field">
              <label htmlFor={`content-${row.key}`}>Content</label>
              <textarea
                id={`content-${row.key}`}
                value={row.content}
                onChange={(event) => updateRow(row.key, "content", event.target.value)}
                placeholder="Full refund within 30 days with receipt. No refunds on digital goods."
                maxLength={50000}
                required
              />
            </div>
          </fieldset>
        ))}

        <div className="actions">
          <button type="button" onClick={addRow} disabled={loading || rows.length >= 10}>
            Add another document
          </button>
          <button type="submit" className="primary" disabled={loading}>
            {loading ? "Uploading…" : `Upload ${rows.length} document${rows.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </form>

      {status && (
        <div role={status.kind === "error" ? "alert" : "status"} className={`alert alert-${status.kind}`}>
          <p>{status.message}</p>
          {status.kind === "error" && status.details.length > 0 && (
            <ul>
              {status.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
