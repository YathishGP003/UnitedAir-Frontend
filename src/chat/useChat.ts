import { useCallback, useEffect, useRef, useState } from "react";
import { api, streamChat } from "../api/client";
import type {
  BookingContextView,
  ChatMessage,
  ChatResponse,
  EvidencePreview,
  PipelineStage,
  SessionView,
  ToolCall,
  Citation,
} from "../types";
import { displayRedactedText } from "../privacy/piiDisplay";

/** Human labels for the pipeline stages the backend streams. */
const STAGE_LABELS: Record<string, string> = {
  start: "Session opened",
  redaction: "Personal data redacted",
  rewrite: "Question resolved against conversation history",
  intent: "Intent classified and routed",
  tools: "Live systems queried",
  evidence: "Knowledge Base evidence retrieved",
  generating: "Composing a grounded answer",
  validated: "Validated from a structured source",
  repair: "Answer rejected by validation, retrying on the deep lane",
  escalated: "Referred to a human queue",
};

function citationToEvidence(citation: Citation): EvidencePreview {
  return {
    handle: citation.handle,
    documentCode: citation.documentCode,
    documentTitle: citation.documentTitle ?? citation.toolName ?? "Source",
    section: citation.section ?? (citation.toolName ? "Live data" : ""),
    page: citation.page ?? 1,
    relevance: citation.relevance ?? 1,
    excerpt: citation.excerpt,
    toolName: citation.toolName,
    toolOperation: citation.toolOperation,
    provider: citation.provider,
    providerLive: citation.providerLive,
    retrievedAt: citation.retrievedAt,
  };
}

/** Prevent proxy pages, stack traces and raw transport payloads reaching chat. */
export function userFacingChatFailure(reason: unknown): string {
  const raw = reason instanceof Error ? reason.message : String(reason ?? "");
  const unsafe = /<!doctype|<html|unexpected token|stack trace|java\.|org\.springframework|^\s*\{[\s\S]*\}\s*$|(?:^|\s)(?:502|503|504)(?:\s|$)/i;
  if (!raw.trim() || unsafe.test(raw)) {
    return "UnitedAir could not complete that request. Please try again.";
  }
  if (/failed to fetch|networkerror|network request failed|assistant could not be reached/i.test(raw)) {
    return "The UnitedAir service is temporarily unreachable. Check your connection and try again.";
  }
  return raw.length > 180
    ? "UnitedAir could not complete that request. Please try again."
    : raw;
}

function restoredGenerationSource(turn: {
  status: string;
  degradedReason?: ChatResponse["degradedReason"];
  citations: Citation[];
}): ChatResponse["generationSource"] {
  if (turn.status === "TOOL_GROUNDED" || turn.citations.some((citation) => citation.toolName)) {
    return "STRUCTURED_TOOL";
  }
  if (turn.status === "CONVERSATIONAL" || turn.status === "CLARIFICATION"
    || turn.status === "OUT_OF_SCOPE") {
    return "DETERMINISTIC_CONVERSATION";
  }
  if (turn.status === "GROUNDED") {
    return turn.degradedReason ? "GROUNDED_EXTRACTIVE" : "HOSTED_MODEL";
  }
  return undefined;
}

/**
 * Owns the conversation: sessions, message list, and the SSE stream.
 *
 * Streaming is preferred, but a stream that fails to open falls back to the
 * synchronous endpoint rather than losing the turn. A proxy or corporate
 * network that mishandles text/event-stream should degrade the experience,
 * not break it.
 */
export function useChat() {
  const [sessions, setSessions] = useState<SessionView[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookingContext, setBookingContext] = useState<BookingContextView | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refreshSessions = useCallback(async () => {
    try {
      const next = await api.listSessions();
      setSessions(next);
      return next;
    } catch {
      // A failed history fetch must not block the conversation itself.
      return [] as SessionView[];
    }
  }, []);

  const refreshBookingContext = useCallback(async (uuid: string) => {
    try {
      const context = await api.bookingContext(uuid);
      setBookingContext(context ?? null);
    } catch {
      setBookingContext(null);
    }
  }, []);

  const openSession = useCallback(async (uuid: string) => {
    setSessionId(uuid);
    setError(null);
    try {
      const [transcript, context] = await Promise.all([
        api.auditTrail(uuid),
        api.bookingContext(uuid).catch(() => undefined),
      ]);
      setBookingContext(context ?? null);
      const restored: ChatMessage[] = [];
      transcript.turns.forEach((turn, index) => {
        if (turn.queryRedacted) {
          restored.push({
            id: `${turn.traceId}-u${index}`,
            role: "user",
            text: displayRedactedText(turn.queryRedacted, "user"),
            createdAt: turn.at,
          });
        }
        const citations = turn.citations ?? [];
        const response: ChatResponse = {
          answer: displayRedactedText(turn.answerRedacted, "assistant"),
          status: turn.status as ChatResponse["status"],
          escalated: turn.escalated,
          citations,
          followups: turn.followups ?? [],
          confidence: turn.confidence,
          citationCoverage: turn.citationCoverage,
          repairAttempts: turn.repairAttempts,
          intent: turn.intent ?? "UNKNOWN",
          lane: turn.lane ?? "-",
          sessionId: uuid,
          traceId: turn.traceId,
          aiMode: turn.aiMode ?? "UNKNOWN",
          generationSource: restoredGenerationSource({
            status: turn.status,
            degradedReason: turn.degradedReason,
            citations,
          }),
          degradedReason: turn.degradedReason ?? null,
          commerce: turn.commerce ?? null,
          durationMs: turn.durationMs ?? 0,
        };
        restored.push({
          id: `${turn.traceId}-a${index}`,
          role: "assistant",
          text: displayRedactedText(turn.answerRedacted, "assistant"),
          createdAt: turn.at,
          response,
          evidence: citations.length > 0 ? citations.map(citationToEvidence) : turn.evidence.map((e) => ({
            handle: e.handle,
            documentCode: e.documentCode,
            documentTitle: e.documentTitle,
            section: e.section,
            page: e.page ?? 1,
            relevance: e.fusedScore ?? 0,
            excerpt: e.excerpt,
          })),
          toolCalls: turn.toolCalls.map((t) => ({
            toolName: t.toolName,
            success: t.status === "SUCCESS",
            summary: "",
            error: t.errorMessage ?? "",
            durationMs: t.durationMs ?? 0,
          })),
        });
      });
      setMessages(restored);
    } catch {
      setMessages([]);
      setBookingContext(null);
    }
  }, []);

  const startSession = useCallback(async () => {
    // Treat an empty current conversation as the available draft. Repeated clicks on
    // "New chat" must not create an unlimited stack of blank database sessions.
    if (sessionId && messages.length === 0) {
      setError(null);
      return sessionId;
    }

    const reusable = sessions.find((session) => !session.expired && session.messageCount === 0);
    if (reusable) {
      await openSession(reusable.sessionUuid);
      return reusable.sessionUuid;
    }

    const session = await api.createSession();
    setSessionId(session.sessionUuid);
    setMessages([]);
    setBookingContext(null);
    setError(null);
    setSessions((current) => [session, ...current]);
    return session.sessionUuid;
  }, [messages.length, openSession, sessionId, sessions]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const existing = await refreshSessions();
        if (cancelled) return;
        const latest = existing.find((session) => !session.expired);
        if (latest) {
          await openSession(latest.sessionUuid);
          return;
        }
        const created = await api.createSession();
        if (cancelled) return;
        setSessionId(created.sessionUuid);
        setMessages([]);
        setBookingContext(null);
        setSessions([created]);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not start a conversation.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [openSession, refreshSessions]);

  const deleteSession = useCallback(async (uuid: string) => {
    await api.endSession(uuid);
    const remaining = sessions.filter((session) => session.sessionUuid !== uuid);
    setSessions(remaining);

    if (sessionId !== uuid) return;
    const next = remaining.find((session) => !session.expired);
    if (next) {
      await openSession(next.sessionUuid);
    } else {
      setSessionId(null);
      setMessages([]);
      setBookingContext(null);
      setError(null);
    }
  }, [openSession, sessionId, sessions]);

  const send = useCallback(
    async (
      text: string,
      options: {
        delivery?: "stream" | "oneShot";
        regenerateOf?: string;
      } = {},
    ) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;

      let activeSession = sessionId;
      if (!activeSession) {
        activeSession = await startSession();
      }

      setError(null);
      setBusy(true);

      const turnId = `${Date.now()}`;
      const createdAt = new Date().toISOString();
      setMessages((prev) => [
        ...prev,
        { id: `${turnId}-u`, role: "user", text: trimmed, createdAt },
        {
          id: `${turnId}-a`,
          role: "assistant",
          text: "",
          streaming: true,
          stages: [],
          createdAt,
        },
      ]);

      const patch = (changes: Partial<ChatMessage>) =>
        setMessages((prev) =>
          prev.map((m) => (m.id === `${turnId}-a` ? { ...m, ...changes } : m)),
        );

      const addStage = (type: string, detail?: string) =>
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== `${turnId}-a`) return m;
            const stage: PipelineStage = {
              type,
              label: STAGE_LABELS[type] ?? type,
              detail,
              at: Date.now(),
            };
            return { ...m, stages: [...(m.stages ?? []), stage] };
          }),
        );

      const controller = new AbortController();
      abortRef.current = controller;
      let streamed = "";

      try {
        if (options.delivery === "oneShot") {
          addStage("generating", "Waiting for the complete validated answer");
          const response = await api.chatSync(trimmed, activeSession, false);
          const displayAnswer = displayRedactedText(response.answer, "assistant");
          patch({
            text: displayAnswer,
            streaming: false,
            response: { ...response, answer: displayAnswer },
            evidence: response.citations.map(citationToEvidence),
          });
          void refreshSessions();
          void refreshBookingContext(activeSession);
          return;
        }

        await streamChat(
          trimmed,
          activeSession,
          false,
          (event, data) => {
            switch (event) {
              case "token": {
                streamed += (data as { text: string }).text;
                patch({ text: streamed });
                break;
              }
              case "evidence": {
                patch({ evidence: data as EvidencePreview[] });
                addStage("evidence", `${(data as unknown[]).length} passages`);
                break;
              }
              case "tools": {
                const calls = data as ToolCall[];
                patch({ toolCalls: calls });
                addStage("tools", calls.map((c) => c.toolName).join(", "));
                break;
              }
              case "intent": {
                const payload = data as { intent: string; tool: string };
                addStage(
                  "intent",
                  payload.tool && payload.tool !== "NONE"
                    ? `${payload.intent} → ${payload.tool}`
                    : payload.intent,
                );
                break;
              }
              case "redaction": {
                const payload = data as { redactionCount: number };
                if (payload.redactionCount > 0) {
                  addStage("redaction", `${payload.redactionCount} value(s) masked`);
                }
                break;
              }
              case "complete": {
                const response = data as ChatResponse;
                const displayAnswer = displayRedactedText(response.answer, "assistant");
                patch({
                  text: displayAnswer,
                  streaming: false,
                  response: { ...response, answer: displayAnswer },
                  evidence: response.citations.map(citationToEvidence),
                });
                void refreshSessions();
                void refreshBookingContext(activeSession);
                break;
              }
              case "error": {
                patch({
                  streaming: false,
                  error: userFacingChatFailure((data as { message: string }).message),
                });
                break;
              }
              default: {
                if (STAGE_LABELS[event]) addStage(event);
              }
            }
          },
          controller.signal,
        );
      } catch (streamFailure) {
        if (controller.signal.aborted) {
          patch({ streaming: false, stopped: true });
          return;
        }
        // Streaming unavailable: complete the turn synchronously so the user
        // still gets their answer.
        try {
          const response = await api.chatSync(
            trimmed,
            activeSession,
            false,
          );
          const displayAnswer = displayRedactedText(response.answer, "assistant");
          patch({
            text: displayAnswer,
            streaming: false,
            response: { ...response, answer: displayAnswer },
            evidence: response.citations.map(citationToEvidence),
          });
          void refreshSessions();
          void refreshBookingContext(activeSession);
        } catch (e) {
          const rawMessage =
            e instanceof Error ? e.message : streamFailure instanceof Error
              ? streamFailure.message
              : "The assistant could not be reached.";
          const message = userFacingChatFailure(rawMessage);
          patch({ streaming: false, error: message });
          setError(message);
        }
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    [busy, refreshBookingContext, refreshSessions, sessionId, startSession],
  );

  const clearBookingContext = useCallback(async () => {
    if (!sessionId) return;
    await api.clearBookingContext(sessionId);
    setBookingContext(null);
  }, [sessionId]);

  const refreshCurrentContext = useCallback(async () => {
    if (!sessionId) {
      setBookingContext(null);
      return;
    }
    await refreshBookingContext(sessionId);
  }, [refreshBookingContext, sessionId]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setBusy(false);
  }, []);

  const regenerate = useCallback(
    (assistantId: string, delivery: "stream" | "oneShot" = "stream") => {
      const assistantIndex = messages.findIndex((message) => message.id === assistantId);
      if (assistantIndex < 1) return;
      const userMessage = [...messages.slice(0, assistantIndex)]
        .reverse()
        .find((message) => message.role === "user");
      if (userMessage) {
        void send(userMessage.text, { delivery, regenerateOf: assistantId });
      }
    },
    [messages, send],
  );

  return {
    sessions,
    sessionId,
    messages,
    busy,
    error,
    bookingContext,
    send,
    regenerate,
    stop,
    startSession,
    openSession,
    deleteSession,
    clearBookingContext,
    refreshCurrentContext,
  };
}
