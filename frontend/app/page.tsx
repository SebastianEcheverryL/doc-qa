"use client";

import { useState, type FormEvent } from "react";
import { askQuestion, describeError, type AskResponse } from "@/lib/api";

export default function AskPage() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AskResponse | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      setResult(await askQuestion(question.trim()));
    } catch (err) {
      setError(describeError(err).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1>Ask your documents</h1>
      <p className="lead">Ask a question and get an answer based only on the documents you uploaded.</p>

      <form onSubmit={handleSubmit} className="stack">
        <label htmlFor="question">Your question</label>
        <textarea
          id="question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Can I get a refund on a digital product?"
          maxLength={1000}
          required
        />
        <div className="actions">
          <button type="submit" className="primary" disabled={loading || question.trim() === ""}>
            {loading ? "Thinking…" : "Ask"}
          </button>
        </div>
      </form>

      {error && (
        <p role="alert" className="alert alert-error">
          {error}
        </p>
      )}

      {result && (
        <section className="card" aria-live="polite">
          <h2>Answer</h2>
          <p className="answer">{result.answer}</p>

          <h3>Sources</h3>
          {result.sources.length > 0 ? (
            <ul className="sources">
              {result.sources.map((source) => (
                <li key={source.docId}>
                  <strong>{source.title}</strong> <code>{source.docId}</code>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No sources: nothing in your documents matched this question.</p>
          )}
        </section>
      )}
    </>
  );
}
