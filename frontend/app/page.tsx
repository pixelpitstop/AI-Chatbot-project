"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  clearMemory,
  generateArguments,
  loadStrategy,
  saveStrategy,
  streamChat,
  type ArgumentResult,
} from "../lib/munApi";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const defaultSessionId = "default";

function toList(raw: string) {
  return raw
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toOpponentMap(raw: string) {
  const lines = raw.split("\n").map((line) => line.trim()).filter(Boolean);
  const map: Record<string, string> = {};

  for (const line of lines) {
    const separator = line.indexOf(":");
    if (separator < 1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key && value) {
      map[key] = value;
    }
  }

  return map;
}

export default function Home() {
  const [sessionId, setSessionId] = useState(defaultSessionId);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatBusy, setChatBusy] = useState(false);
  const [statusText, setStatusText] = useState("Ready");

  const [country, setCountry] = useState("");
  const [alliesText, setAlliesText] = useState("");
  const [enemiesText, setEnemiesText] = useState("");
  const [notesText, setNotesText] = useState("");
  const [opponentModelsText, setOpponentModelsText] = useState("");
  const [strategyBusy, setStrategyBusy] = useState(false);

  const [opponent, setOpponent] = useState("");
  const [argumentContext, setArgumentContext] = useState("");
  const [argumentBusy, setArgumentBusy] = useState(false);
  const [argumentResult, setArgumentResult] = useState<ArgumentResult | null>(null);

  useEffect(() => {
    let mounted = true;

    loadStrategy(defaultSessionId)
      .then((strategy) => {
        if (!mounted) {
          return;
        }

        setCountry(strategy.country ?? "");
        setAlliesText((strategy.allies ?? []).join("\n"));
        setEnemiesText((strategy.enemies ?? []).join("\n"));
        setNotesText((strategy.strategy_notes ?? []).join("\n"));
        setOpponentModelsText(
          Object.entries(strategy.opponent_models ?? {})
            .map(([name, model]) => `${name}: ${model}`)
            .join("\n")
        );
      })
      .catch((error) => {
        if (mounted) {
          setStatusText(`Strategy load failed: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const strategyPayload = useMemo(() => {
    return {
      country: country.trim(),
      allies: toList(alliesText),
      enemies: toList(enemiesText),
      strategy_notes: toList(notesText),
      opponent_models: toOpponentMap(opponentModelsText),
    };
  }, [alliesText, country, enemiesText, notesText, opponentModelsText]);

  async function onSaveStrategy() {
    setStrategyBusy(true);
    setStatusText("Saving strategy memory...");

    try {
      await saveStrategy(sessionId, strategyPayload);
      setStatusText("Strategy memory saved.");
    } catch (error) {
      setStatusText(`Save failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setStrategyBusy(false);
    }
  }

  async function onClearMemory() {
    setStatusText("Clearing memory...");

    try {
      await clearMemory(sessionId);
      setChatMessages([]);
      setArgumentResult(null);
      setStatusText("Memory cleared for this session.");
    } catch (error) {
      setStatusText(`Clear failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async function onSendChat(event: FormEvent) {
    event.preventDefault();

    const message = chatInput.trim();
    if (!message || chatBusy) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      content: message,
    };

    const assistantId = `${Date.now()}-assistant`;
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
    };

    setChatInput("");
    setChatBusy(true);
    setStatusText("Streaming response...");
    setChatMessages((previous) => [...previous, userMessage, assistantMessage]);

    try {
      await streamChat(
        {
          sessionId,
          message,
        },
        {
          onChunk: (text) => {
            setChatMessages((previous) =>
              previous.map((entry) =>
                entry.id === assistantId
                  ? {
                    ...entry,
                    content: entry.content + text,
                  }
                  : entry
              )
            );
          },
          onDone: () => {
            setStatusText("Response complete.");
          },
        }
      );
    } catch (error) {
      setStatusText(`Chat failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      setChatMessages((previous) =>
        previous.map((entry) =>
          entry.id === assistantId
            ? {
              ...entry,
              content: "[Error: failed to stream response]",
            }
            : entry
        )
      );
    } finally {
      setChatBusy(false);
    }
  }

  async function onGenerateArguments(event: FormEvent) {
    event.preventDefault();

    if (!opponent.trim() || argumentBusy) {
      return;
    }

    setArgumentBusy(true);
    setStatusText("Generating argument set...");

    try {
      const result = await generateArguments({
        sessionId,
        opponent: opponent.trim(),
        country: country.trim(),
        context: argumentContext.trim(),
      });

      setArgumentResult(result);
      setStatusText("Argument set generated.");
    } catch (error) {
      setStatusText(`Argument generation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setArgumentBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--color-ink-100)] via-[var(--color-paper)] to-[var(--color-gold-100)] px-4 py-6 md:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="rounded-2xl border border-[var(--color-ink-300)]/45 bg-[var(--color-paper)]/80 p-5 shadow-[0_16px_40px_rgba(20,25,45,0.12)] backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-ink-700)]">
                AI MUN Research Assistant
              </p>
              <h1 className="mt-1 text-3xl font-semibold leading-tight text-[var(--color-ink-900)] md:text-4xl">
                Strategy Deck for Fast, Local Geopolitical Reasoning
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-[var(--color-ink-700)] md:text-base">
                Local LLM chat with memory, retrieval, and tactical argument synthesis for committee sessions.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                value={sessionId}
                onChange={(event) => setSessionId(event.target.value || defaultSessionId)}
                className="w-full rounded-xl border border-[var(--color-ink-400)] bg-white/80 px-3 py-2 text-sm text-[var(--color-ink-900)] outline-none ring-[var(--color-gold-500)] transition focus:ring-2 sm:w-52"
                placeholder="session id"
              />
              <button
                type="button"
                onClick={onClearMemory}
                className="rounded-xl bg-[var(--color-ink-800)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-ink-900)]"
              >
                Clear Memory
              </button>
            </div>
          </div>
          <p className="mt-4 text-sm text-[var(--color-ink-700)]">Status: {statusText}</p>
        </header>

        <main className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
          <section className="rounded-2xl border border-[var(--color-ink-300)]/45 bg-white/80 p-5 shadow-[0_14px_36px_rgba(20,25,45,0.1)] backdrop-blur">
            <h2 className="text-xl font-semibold text-[var(--color-ink-900)]">Strategic Chat</h2>
            <p className="mt-1 text-sm text-[var(--color-ink-700)]">Streaming response with short-term memory and RAG context.</p>

            <div className="mt-4 h-[420px] overflow-y-auto rounded-xl border border-[var(--color-ink-300)] bg-[var(--color-ink-100)]/45 p-3 md:h-[500px]">
              {chatMessages.length === 0 ? (
                <p className="text-sm text-[var(--color-ink-700)]">Send a message to begin strategic analysis.</p>
              ) : (
                <div className="space-y-3">
                  {chatMessages.map((entry) => (
                    <article
                      key={entry.id}
                      className={`max-w-[90%] rounded-xl px-3 py-2 text-sm leading-relaxed ${entry.role === "user"
                          ? "ml-auto bg-[var(--color-ink-800)] text-white"
                          : "bg-white text-[var(--color-ink-900)]"
                        }`}
                    >
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] opacity-75">{entry.role}</p>
                      <p className="whitespace-pre-wrap">{entry.content || "..."}</p>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={onSendChat} className="mt-4 flex flex-col gap-3">
              <textarea
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                rows={4}
                placeholder="Ask for negotiation strategy, amendment framing, rebuttal scaffolds, or bloc analysis..."
                className="w-full rounded-xl border border-[var(--color-ink-400)] bg-white px-3 py-2 text-sm text-[var(--color-ink-900)] outline-none ring-[var(--color-gold-500)] transition focus:ring-2"
              />
              <button
                disabled={chatBusy || !chatInput.trim()}
                type="submit"
                className="self-end rounded-xl bg-[var(--color-gold-500)] px-5 py-2 text-sm font-semibold text-[var(--color-ink-900)] transition hover:bg-[var(--color-gold-600)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {chatBusy ? "Streaming..." : "Send"}
              </button>
            </form>
          </section>

          <section className="flex flex-col gap-6">
            <article className="rounded-2xl border border-[var(--color-ink-300)]/45 bg-white/80 p-5 shadow-[0_14px_36px_rgba(20,25,45,0.1)] backdrop-blur">
              <h2 className="text-xl font-semibold text-[var(--color-ink-900)]">Strategy Panel</h2>
              <p className="mt-1 text-sm text-[var(--color-ink-700)]">Persistent geopolitical memory across sessions.</p>

              <div className="mt-4 grid gap-3">
                <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-700)]">
                  Country
                  <input
                    value={country}
                    onChange={(event) => setCountry(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-[var(--color-ink-400)] bg-white px-3 py-2 text-sm text-[var(--color-ink-900)] outline-none ring-[var(--color-gold-500)] transition focus:ring-2"
                    placeholder="e.g. India"
                  />
                </label>

                <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-700)]">
                  Allies (one per line)
                  <textarea
                    value={alliesText}
                    onChange={(event) => setAlliesText(event.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-xl border border-[var(--color-ink-400)] bg-white px-3 py-2 text-sm text-[var(--color-ink-900)] outline-none ring-[var(--color-gold-500)] transition focus:ring-2"
                  />
                </label>

                <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-700)]">
                  Enemies (one per line)
                  <textarea
                    value={enemiesText}
                    onChange={(event) => setEnemiesText(event.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-xl border border-[var(--color-ink-400)] bg-white px-3 py-2 text-sm text-[var(--color-ink-900)] outline-none ring-[var(--color-gold-500)] transition focus:ring-2"
                  />
                </label>

                <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-700)]">
                  Strategy Notes (one per line)
                  <textarea
                    value={notesText}
                    onChange={(event) => setNotesText(event.target.value)}
                    rows={4}
                    className="mt-1 w-full rounded-xl border border-[var(--color-ink-400)] bg-white px-3 py-2 text-sm text-[var(--color-ink-900)] outline-none ring-[var(--color-gold-500)] transition focus:ring-2"
                  />
                </label>

                <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-700)]">
                  Opponent Models (format: name: position)
                  <textarea
                    value={opponentModelsText}
                    onChange={(event) => setOpponentModelsText(event.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-xl border border-[var(--color-ink-400)] bg-white px-3 py-2 text-sm text-[var(--color-ink-900)] outline-none ring-[var(--color-gold-500)] transition focus:ring-2"
                  />
                </label>
              </div>

              <button
                type="button"
                disabled={strategyBusy}
                onClick={onSaveStrategy}
                className="mt-4 rounded-xl bg-[var(--color-ink-800)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-ink-900)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {strategyBusy ? "Saving..." : "Save Strategy"}
              </button>
            </article>

            <article className="rounded-2xl border border-[var(--color-ink-300)]/45 bg-white/80 p-5 shadow-[0_14px_36px_rgba(20,25,45,0.1)] backdrop-blur">
              <h2 className="text-xl font-semibold text-[var(--color-ink-900)]">Argument Generator</h2>
              <p className="mt-1 text-sm text-[var(--color-ink-700)]">Opening, 3 attacks, 2 counters, and a trap question.</p>

              <form onSubmit={onGenerateArguments} className="mt-4 grid gap-3">
                <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-700)]">
                  Opponent
                  <input
                    value={opponent}
                    onChange={(event) => setOpponent(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-[var(--color-ink-400)] bg-white px-3 py-2 text-sm text-[var(--color-ink-900)] outline-none ring-[var(--color-gold-500)] transition focus:ring-2"
                    placeholder="e.g. China"
                    required
                  />
                </label>

                <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-700)]">
                  Context
                  <textarea
                    value={argumentContext}
                    onChange={(event) => setArgumentContext(event.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-xl border border-[var(--color-ink-400)] bg-white px-3 py-2 text-sm text-[var(--color-ink-900)] outline-none ring-[var(--color-gold-500)] transition focus:ring-2"
                    placeholder="Topic scope, committee mood, red lines, timeline pressure..."
                  />
                </label>

                <button
                  type="submit"
                  disabled={argumentBusy || !opponent.trim()}
                  className="rounded-xl bg-[var(--color-gold-500)] px-4 py-2 text-sm font-semibold text-[var(--color-ink-900)] transition hover:bg-[var(--color-gold-600)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {argumentBusy ? "Generating..." : "Generate"}
                </button>
              </form>

              {argumentResult && (
                <div className="mt-4 space-y-3 rounded-xl border border-[var(--color-ink-300)] bg-[var(--color-paper)] p-3 text-sm text-[var(--color-ink-900)]">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-700)]">Opening Statement</p>
                    <p className="mt-1">{argumentResult.opening_statement}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-700)]">Attack Arguments</p>
                    <ol className="mt-1 list-decimal space-y-1 pl-5">
                      {argumentResult.attack_arguments.map((item, index) => (
                        <li key={`attack-${index}`}>{item}</li>
                      ))}
                    </ol>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-700)]">Counters</p>
                    <ol className="mt-1 list-decimal space-y-1 pl-5">
                      {argumentResult.counters.map((item, index) => (
                        <li key={`counter-${index}`}>{item}</li>
                      ))}
                    </ol>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-700)]">Trap Question</p>
                    <p className="mt-1">{argumentResult.trap_question}</p>
                  </div>
                </div>
              )}
            </article>
          </section>
        </main>
      </div>
    </div>
  );
}
