import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIcon,
  AlertIcon,
  ArrowDownIcon,
  CopyIcon,
  LayersIcon,
  MicIcon,
  MoreIcon,
  PanelRightIcon,
  PlaneIcon,
  PlusIcon,
  SendIcon,
  SearchIcon,
  SidebarIcon,
  StopIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  TrashIcon,
  VolumeIcon,
} from "../components/Icons";
import type {
  ActionView, ChatMessage, ChatResponse, Citation, CommercePayload, EvidencePreview,
  FareOption, FlightOption, SessionView,
} from "../types";
import { useChat } from "./useChat";
import EvidencePanel from "./EvidencePanel";
import TracePanel from "./TracePanel";
import { ChatActionCard } from "./ChatActionCard";
import { useSpeechSynthesis } from "../voice/useSpeechSynthesis";
import { useDictation } from "../voice/useDictation";
import { api } from "../api/client";
import BookingCheckout from "../passenger/BookingCheckout";

export interface Starter {
  title: string;
  prompt: string;
}

interface Props {
  title: string;
  subtitle: string;
  starters: Starter[];
}

const HISTORY_GROUPS = ["Today", "Yesterday", "Previous 7 days", "Older"] as const;
type HistoryGroup = (typeof HISTORY_GROUPS)[number];

function startOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

function historyGroup(lastActivityAt: string, now: Date): HistoryGroup {
  const activity = new Date(lastActivityAt);
  const daysAgo = Math.floor(
    (startOfLocalDay(now) - startOfLocalDay(activity)) / 86_400_000,
  );
  if (daysAgo <= 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  if (daysAgo < 7) return "Previous 7 days";
  return "Older";
}

function relativeActivity(lastActivityAt: string, now: Date) {
  const activity = new Date(lastActivityAt);
  const elapsedMs = Math.max(0, now.getTime() - activity.getTime());
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return activity.toLocaleDateString([], { month: "short", day: "numeric" });
}

function usesActiveBookingContext(message: ChatMessage | undefined): boolean {
  if (!message) return false;
  if (message.response?.proposedAction) return true;
  if (message.response?.commerce
    && ["OWNED_BOOKING_OPTIONS", "CANCELLATION_QUOTE", "TICKET_CONFIRMED"]
      .includes(message.response.commerce.type)) {
    return true;
  }
  return (message.toolCalls ?? []).some((tool) =>
    /booking|refund|flightstatus|check.?in|seat|disruption/i.test(tool.toolName));
}

function isRagAnswer(response: ChatResponse): boolean {
  if (response.status !== "GROUNDED") return false;
  return response.generationSource === "HOSTED_MODEL"
    || response.generationSource === "GROUNDED_EXTRACTIVE"
    || response.citations.some((citation) => !citation.toolName);
}

function sourceLabel(response: ChatResponse): string | null {
  const count = response.citations.length;
  const sources = `${count} source${count === 1 ? "" : "s"}`;
  if (response.generationSource === "HOSTED_MODEL") {
    return `Hosted AI, grounded in ${sources}`;
  }
  if (response.generationSource === "GROUNDED_EXTRACTIVE") {
    return `Grounded local composition, ${sources}`;
  }
  if (response.generationSource === "STRUCTURED_TOOL" || response.status === "TOOL_GROUNDED") {
    const citation = response.citations.find((item) => item.toolName);
    const provider = citation?.provider?.toUpperCase() ?? "";
    if (citation?.providerLive && provider.includes("NDC")) {
      return "Verified NDC sandbox result";
    }
    if (citation?.providerLive && provider.includes("RESERVATION")) {
      return "Verified reservation sandbox result";
    }
    if (provider.includes("SIMULATOR") || citation?.providerLive === false) {
      return "Verified simulator result";
    }
    return "Verified operational result";
  }
  if (response.generationSource === "DETERMINISTIC_CONVERSATION") {
    return "Deterministic conversation";
  }
  return null;
}

function citationToEvidence(citation: Citation): EvidencePreview {
  return {
    handle: citation.handle,
    documentCode: citation.documentCode,
    documentTitle: citation.documentTitle ?? citation.documentCode,
    section: citation.section ?? (citation.toolName ? "Verified tool result" : "Source"),
    page: citation.page ?? 0,
    relevance: citation.relevance ?? 1,
    excerpt: citation.excerpt,
    toolName: citation.toolName,
    toolOperation: citation.toolOperation,
    provider: citation.provider,
    providerLive: citation.providerLive,
    retrievedAt: citation.retrievedAt,
  };
}

/**
 * The conversation surface, shared by the Passenger and Staff workspaces.
 *
 * <p>The two differ only in their suggested starters and framing. What each role may
 * retrieve is decided on the server, so there is nothing role-specific to express here.
 *
 * <p>The delivery control changes presentation only. Stream reveals the validated answer
 * progressively; One shot waits and then presents the complete answer at once. Retrieval,
 * grounding and safety checks are identical in both modes.
 */
export default function ChatWorkspace({ title, subtitle, starters }: Props) {
  const chat = useChat();
  const [draft, setDraft] = useState("");
  const [tab, setTab] = useState<"evidence" | "trace">("evidence");
  const [focusedHandle, setFocusedHandle] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<"stream" | "oneShot">("stream");
  const [railOpen, setRailOpen] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [sessionQuery, setSessionQuery] = useState("");
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [sessionMenu, setSessionMenu] = useState<string | null>(null);
  const [historyNow, setHistoryNow] = useState(() => new Date());

  // On a narrow viewport the rail and panel are slide-over sheets; on desktop the
  // rail collapses in place and the panel is a dockable column that stays closed
  // until the reader asks to see the sources behind an answer.
  const isNarrow = () =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches;
  const toggleRail = () =>
    isNarrow() ? setRailOpen((o) => !o) : setRailCollapsed((c) => !c);
  const speech = useSpeechSynthesis();
  const dictation = useDictation((text) =>
    setDraft((current) => `${current}${current ? " " : ""}${text}`.slice(0, 4000)),
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const lastAssistant = useMemo(
    () => [...chat.messages].reverse().find((m) => m.role === "assistant"),
    [chat.messages],
  );

  const evidence: EvidencePreview[] = lastAssistant?.evidence
    ?? lastAssistant?.response?.citations.map(citationToEvidence)
    ?? [];
  const showBookingContext = Boolean(
    chat.bookingContext && usesActiveBookingContext(lastAssistant),
  );
  const visibleSessions = useMemo(() => {
    const query = sessionQuery.trim().toLowerCase();
    return chat.sessions
      .filter((session) => !session.expired && session.messageCount > 0)
      .filter((session) =>
        !query || (session.title ?? "Conversation").toLowerCase().includes(query),
      );
  }, [chat.sessions, sessionQuery]);
  const groupedSessions = useMemo(() => {
    const groups = new Map<HistoryGroup, SessionView[]>();
    for (const session of visibleSessions) {
      const group = historyGroup(session.lastActivityAt, historyNow);
      groups.set(group, [...(groups.get(group) ?? []), session]);
    }
    return HISTORY_GROUPS
      .map((label) => ({ label, sessions: groups.get(label) ?? [] }))
      .filter((group) => group.sessions.length > 0);
  }, [historyNow, visibleSessions]);

  useEffect(() => {
    const timer = window.setInterval(() => setHistoryNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setSessionMenu(null);
  }, [chat.sessionId]);

  useEffect(() => {
    setShowJumpToLatest(false);
    if (chat.messages.length === 0) return;
    const frame = window.requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [chat.sessionId]);

  useEffect(() => {
    if (chat.messages.length === 0) setShowJumpToLatest(false);
  }, [chat.messages.length]);

  useEffect(() => {
    // Keep the empty state pinned to the top; only follow the conversation once
    // there is one, so the greeting and starters are never scrolled out of view.
    if (chat.messages.length === 0) {
      setShowJumpToLatest(false);
      return;
    }
    if (!showJumpToLatest || chat.busy) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [chat.busy, chat.messages, showJumpToLatest]);

  useEffect(() => {
    if (!railOpen && !panelOpen && !sessionMenu) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setRailOpen(false);
        setPanelOpen(false);
        setSessionMenu(null);
        textareaRef.current?.focus();
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [railOpen, panelOpen, sessionMenu]);

  function submit(text: string) {
    if (!text.trim() || chat.busy) return;
    void chat.send(text, { delivery });
    setShowJumpToLatest(false);
    setDraft("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  return (
    <div
      className={`workspace${railCollapsed ? " rail-collapsed" : ""}${panelOpen ? " panel-open" : ""}`}
    >
      {(railOpen || panelOpen) && (
        <button
          className="sheet-scrim"
          aria-label="Close open panel"
          onClick={() => {
            setRailOpen(false);
            setPanelOpen(false);
          }}
        />
      )}
      {/* ---------------------------------------------------------- rail --- */}
      <aside className={`rail ${railOpen ? "open" : ""}`} aria-label="Conversation history">
        <div className="rail-head">
          <button
            className="rail-toggle"
            onClick={toggleRail}
            aria-label="Hide conversations"
            title="Hide conversations"
          >
            <SidebarIcon size={18} />
          </button>
          <button
            className="new-chat"
            onClick={() => {
              setSessionMenu(null);
              void chat.startSession();
            }}
            disabled={chat.messages.length === 0 && Boolean(chat.sessionId)}
            title={chat.messages.length === 0 ? "This conversation is already new" : "New conversation"}
          >
            <PlusIcon size={16} /> <span>New chat</span>
          </button>
        </div>

        <div className="rail-scroll">
          <label className="session-search">
            <SearchIcon size={15} />
            <span className="sr-only">Search conversations</span>
            <input
              type="search"
              value={sessionQuery}
              onChange={(event) => setSessionQuery(event.target.value)}
              placeholder="Search conversations"
            />
          </label>
          {visibleSessions.length === 0 && (
            <p className="rail-hint">
              {sessionQuery ? "No conversations match your search." : "Start a conversation here."}
            </p>
          )}
          {groupedSessions.map((group) => (
            <div className="rail-group" key={group.label}>
              <div className="rail-label">{group.label}</div>
              {group.sessions.map((session) => (
                <div
              key={session.sessionUuid}
              className={`session-row ${session.sessionUuid === chat.sessionId ? "active" : ""}`}
                >
              <button
                className="session-item"
                onClick={() => {
                  setSessionMenu(null);
                  void chat.openSession(session.sessionUuid);
                  setRailOpen(false);
                }}
              >
                <strong>{session.title ?? "Conversation"}</strong>
                <span>{relativeActivity(session.lastActivityAt, historyNow)}</span>
              </button>
              <button
                className="session-more"
                onClick={() => setSessionMenu((current) =>
                  current === session.sessionUuid ? null : session.sessionUuid)}
                aria-label={`Options for ${session.title ?? "conversation"}`}
                aria-expanded={sessionMenu === session.sessionUuid}
                title="Conversation options"
              >
                <MoreIcon size={16} />
              </button>
              {sessionMenu === session.sessionUuid && (
                <div className="session-menu" role="menu">
                  <button
                    role="menuitem"
                    onClick={() => {
                      setSessionMenu(null);
                      void chat.deleteSession(session.sessionUuid);
                    }}
                  >
                    <TrashIcon size={15} /> Delete chat
                  </button>
                </div>
              )}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="rail-foot">
          <div className="rail-note">
            <ShieldGlyph />
            <span>Answers are grounded in policy and cited.</span>
          </div>
        </div>
      </aside>

      {/* ---------------------------------------------------------- chat --- */}
      <section className="chat">
        <div className="chat-edge-tools">
          <button
            className="chat-icon-btn show-rail"
            onClick={toggleRail}
            aria-label="Show conversations"
            title="Show conversations"
          >
            <SidebarIcon size={18} />
          </button>
        </div>
        {showBookingContext && chat.bookingContext && (
          <div className="booking-context" aria-label="Active booking context">
            <span className="booking-context-label">Current trip</span>
            <span className="booking-context-trip">
              <strong>{chat.bookingContext.flightNo}</strong>
              {" · "}{chat.bookingContext.origin} to {chat.bookingContext.destination}
              {" · "}{new Date(`${chat.bookingContext.travelDate}T00:00:00`).toLocaleDateString(
                undefined,
                { day: "numeric", month: "short" },
              )}
            </span>
            <button
              type="button"
              onClick={() => void chat.clearBookingContext()}
              aria-label="Forget active booking"
            >
              Clear
            </button>
          </div>
        )}
        <div
          className="chat-scroll"
          ref={scrollRef}
          onScroll={(event) => {
            const element = event.currentTarget;
            const hasConversation = chat.messages.length > 0;
            const hasOverflow = element.scrollHeight > element.clientHeight + 1;
            setShowJumpToLatest(
              hasConversation
                && hasOverflow
                && element.scrollHeight - element.scrollTop - element.clientHeight > 96,
            );
          }}
        >
          <div className="chat-inner">
            {chat.messages.length === 0 && (
              <div className="empty-state">
                <span className="hero-mark">
                  <PlaneIcon size={24} />
                </span>
                <h2>{title}</h2>
                <p>{subtitle}</p>
                <div className="starters">
                  {starters.map((starter) => (
                    <button
                      key={starter.title}
                      className="starter"
                      onClick={() => submit(starter.prompt)}
                    >
                      <strong>{starter.title}</strong>
                      <span>{starter.prompt}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chat.messages.map((message) =>
              message.role === "user" ? (
                <div key={message.id} className="msg msg-user">
                  <span>{message.text}</span>
                  <MessageTime createdAt={message.createdAt} />
                </div>
              ) : (
                <AssistantMessage
                  key={message.id}
                  message={message}
                  onCitationClick={(handle) => {
                    setTab("evidence");
                    setFocusedHandle(handle);
                    setPanelOpen(true);
                  }}
                  onFollowup={submit}
                  onRegenerate={() => chat.regenerate(message.id, delivery)}
                  onShowSources={() => {
                    setTab("evidence");
                    setPanelOpen(true);
                  }}
                  onActionSettled={async (action) => {
                    if (action.type === "CANCEL_BOOKING" && action.status === "CONFIRMED") {
                      await chat.clearBookingContext();
                    } else {
                      await chat.refreshCurrentContext();
                    }
                  }}
                  speech={speech}
                />
              ),
            )}
          </div>
        </div>

        {/* ------------------------------------------------------ composer --- */}
        {showJumpToLatest && (
          <button
            type="button"
            className="jump-latest"
            onClick={() => {
              scrollRef.current?.scrollTo({
                top: scrollRef.current.scrollHeight,
                behavior: "smooth",
              });
              setShowJumpToLatest(false);
            }}
            aria-label="Scroll to latest message"
            title="Scroll to latest message"
          >
            <ArrowDownIcon size={20} />
          </button>
        )}
        <div className="composer-wrap">
          {chat.error && (
            <div className="operational-failure composer-alert" role="status">
              <AlertIcon size={15} />
              <span>{chat.error}</span>
              {lastAssistant && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => chat.regenerate(lastAssistant.id, delivery)}
                >
                  Try again
                </button>
              )}
            </div>
          )}

          <div className="composer">
            <textarea
              ref={textareaRef}
              rows={1}
              maxLength={4000}
              placeholder="Ask about flights, bookings, baggage, refunds or check-in…"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 190)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  submit(draft);
                }
              }}
            />
            <div className="composer-bar">
              <div className="composer-bar-tools">
                <div className="mode-switch" aria-label="Answer delivery">
                  <button
                    className={delivery === "stream" ? "active" : ""}
                    onClick={() => setDelivery("stream")}
                    title="Reveal the answer progressively as it arrives"
                  >
                    Stream
                  </button>
                  <button
                    className={delivery === "oneShot" ? "active" : ""}
                    onClick={() => setDelivery("oneShot")}
                    title="Wait, then show the complete validated answer"
                  >
                    One shot
                  </button>
                </div>
              </div>
              <div className="composer-bar-actions">
                {dictation.supported && (
                  <button
                    className={`composer-tool ${dictation.listening ? "listening" : ""}`}
                    onClick={dictation.listening ? dictation.stop : dictation.start}
                    aria-label={dictation.listening ? "Stop dictation" : "Dictate message"}
                    title={dictation.listening ? "Stop dictation" : "Dictate your message"}
                  >
                    <MicIcon size={16} />
                  </button>
                )}
                <button
                  className="icon-btn send"
                  disabled={!chat.busy && !draft.trim()}
                  onClick={() => chat.busy ? chat.stop() : submit(draft)}
                  aria-label={chat.busy ? "Stop response" : "Send message"}
                >
                  {chat.busy ? <StopIcon size={14} /> : <SendIcon size={15} />}
                </button>
              </div>
            </div>
          </div>

          <div className="composer-hint">
            <span>Enter to send · Shift + Enter for a new line</span>
            <span className="char-count">
              {draft.length >= 3500
                ? `${draft.length}/4000`
                : delivery === "stream" ? "Progressive reply" : "Complete reply"}
            </span>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- panel --- */}
      <aside className={`panel ${panelOpen ? "open" : ""}`} aria-label="Answer inspector">
        <div className="panel-tabs">
          <button
            className={`panel-tab ${tab === "evidence" ? "active" : ""}`}
            onClick={() => setTab("evidence")}
          >
            <LayersIcon size={14} /> Evidence
            {evidence.length > 0 && <span className="panel-count">{evidence.length}</span>}
          </button>
          <button
            className={`panel-tab ${tab === "trace" ? "active" : ""}`}
            onClick={() => setTab("trace")}
          >
            <ActivityIcon size={14} /> Trace
          </button>
          <button
            className="panel-close"
            onClick={() => setPanelOpen(false)}
            aria-label="Hide sources panel"
            title="Hide sources panel"
          >
            <PanelRightIcon size={17} />
          </button>
        </div>

        <div className="panel-scroll">
          {tab === "evidence" ? (
            <EvidencePanel evidence={evidence} focusedHandle={focusedHandle} />
          ) : (
            <TracePanel message={lastAssistant} />
          )}
        </div>
      </aside>
    </div>
  );
}

/* ------------------------------------------------------- assistant turn --- */

function AssistantMessage({
  message,
  onCitationClick,
  onFollowup,
  onRegenerate,
  onShowSources,
  onActionSettled,
  speech,
}: {
  message: ChatMessage;
  onCitationClick: (handle: string) => void;
  onFollowup: (text: string) => void;
  onRegenerate: () => void;
  onShowSources: () => void;
  onActionSettled: (action: ActionView) => void | Promise<void>;
  speech: ReturnType<typeof useSpeechSynthesis>;
}) {
  const response = message.response;
  const hasStages = (message.stages?.length ?? 0) > 0;
  const [rating, setRating] = useState<"UP" | "DOWN" | null>(null);
  const [copied, setCopied] = useState(false);
  const capacityReached = response?.degradedReason === "MODEL_CAPACITY"
    || response?.degradedReason === "RATE_LIMIT";
  const label = response && !capacityReached ? sourceLabel(response) : null;
  const showFollowups = Boolean(
    response
      && !capacityReached
      && response.status !== "EMPTY_CONTEXT"
      && response.followups.length > 0,
  );

  return (
    <div className="msg msg-assistant">
      <span className="msg-avatar">
        <PlaneIcon size={15} />
      </span>

      <div className="msg-body">
        {hasStages && (
          <details className="stages-disclosure" open={message.streaming && !message.text}>
            <summary>
              {message.streaming && !message.text ? "Working on your answer" : "How this answer was prepared"}
            </summary>
            <div className="stages">
            {message.stages?.map((stage, index) => (
              <div
                key={`${stage.type}-${index}`}
                className={`stage ${index === (message.stages?.length ?? 0) - 1 ? "running" : ""}`}
              >
                <span className="stage-dot" />
                <strong>{stage.label}</strong>
                {stage.detail && <span>· {stage.detail}</span>}
              </div>
            ))}
            </div>
          </details>
        )}

        {message.stopped ? (
          <div className="alert alert-info">
            <StopIcon size={15} />
            <span>Response stopped. You can edit your question or regenerate it.</span>
          </div>
        ) : capacityReached ? (
          <div className="operational-failure" role="status">
            <span className="operational-failure-icon"><AlertIcon size={15} /></span>
            <div>
              <strong>Model capacity reached</strong>
              <p>Please try again shortly.</p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={onRegenerate}>Try again</button>
          </div>
        ) : message.error ? (
          <div className="operational-failure" role="status">
            <span className="operational-failure-icon"><AlertIcon size={15} /></span>
            <div>
              <strong>That request did not finish</strong>
              <p>{message.error}</p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={onRegenerate}>Try again</button>
          </div>
        ) : (
          <div className="msg-text">
            {renderRich(message.text, onCitationClick, response?.citations ?? [])}
            {message.streaming && message.text && (
              <span className="caret" aria-hidden="true" />
            )}
          </div>
        )}

        {response && (
          <div className="msg-meta">
            <StatusChip
              status={capacityReached ? "ERROR" : response.status}
              escalated={capacityReached ? false : response.escalated}
            />
            {isRagAnswer(response) && response.confidence != null && response.confidence > 0 && (
              <span className="chip chip-muted">
                Evidence match {(response.confidence * 100).toFixed(0)}%
              </span>
            )}
            {label && <span className="chip chip-muted">{label}</span>}
            {response.repairAttempts > 0 && <span className="chip chip-warn">re-checked</span>}
            <span className="chip chip-muted">{(response.durationMs / 1000).toFixed(1)}s</span>
          </div>
        )}

        {response?.proposedAction && (
          <ChatActionCard action={response.proposedAction} onSettled={onActionSettled} />
        )}
        {response?.commerce && <ChatCommerceCard commerce={response.commerce} />}

        {showFollowups && response && (
          <div className="followup-block">
            <div className="followup-heading">
              <span>Related questions</span>
              {response.citations.length > 0 && (
                <button type="button" onClick={onShowSources}>
                  Based on {response.citations.length} cited source{response.citations.length === 1 ? "" : "s"}
                </button>
              )}
            </div>
            <ul className="followups" aria-label="Related questions">
              {response.followups.map((followup) => (
                <li key={followup}>
                  <button className="followup-btn" onClick={() => onFollowup(followup)}>
                    {followup}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {response && !capacityReached && (
          <div className="message-actions" aria-label="Answer actions">
            <button
              className={`message-action ${copied ? "active" : ""}`}
              onClick={() => {
                void navigator.clipboard?.writeText(message.text);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1600);
              }}
              title="Copy answer"
            >
              <CopyIcon size={14} /> {copied ? "Copied" : "Copy"}
            </button>
            {speech.supported && (
              <button
                className={`message-action ${speech.speakingId === message.id ? "active" : ""}`}
                onClick={() =>
                  speech.speakingId === message.id
                    ? speech.stop()
                    : speech.speak(message.id, message.text)
                }
                title="Uses the voice installed in your browser or operating system"
              >
                {speech.speakingId === message.id
                  ? <StopIcon size={14} />
                  : <VolumeIcon size={14} />}
                {speech.speakingId === message.id ? "Stop reading" : "Read aloud"}
              </button>
            )}
            <button className="message-action" onClick={onRegenerate} title="Ask again">
              <ActivityIcon size={14} /> Regenerate
            </button>
            {response.citations.length > 0 && (
              <button className="message-action" onClick={onShowSources}>
                <LayersIcon size={14} /> Sources
              </button>
            )}
            <span className="message-action-separator" />
            <button
              className={`message-action ${rating === "UP" ? "active" : ""}`}
              onClick={() => {
                setRating("UP");
                void api.submitFeedback(response.traceId, "UP").catch(() => setRating(null));
              }}
              aria-label="Helpful answer"
            >
              <ThumbsUpIcon size={14} />
            </button>
            <button
              className={`message-action ${rating === "DOWN" ? "active" : ""}`}
              onClick={() => {
                setRating("DOWN");
                void api.submitFeedback(response.traceId, "DOWN", "OTHER")
                  .catch(() => setRating(null));
              }}
              aria-label="Not helpful answer"
            >
              <ThumbsDownIcon size={14} />
            </button>
          </div>
        )}
        <MessageTime createdAt={message.createdAt} />
      </div>
    </div>
  );
}

function StatusChip({ status, escalated }: { status: string; escalated: boolean }) {
  if (escalated || status === "ESCALATED") {
    return <span className="chip chip-warn">referred to a person</span>;
  }
  if (status === "CONVERSATIONAL") {
    return <span className="chip chip-info">conversation</span>;
  }
  if (status === "CLARIFICATION") {
    return <span className="chip chip-warn">needs details</span>;
  }
  if (status === "OUT_OF_SCOPE") {
    return <span className="chip chip-muted">outside scope</span>;
  }
  if (status === "EMPTY_CONTEXT") {
    return <span className="chip chip-danger">not covered by policy</span>;
  }
  if (status === "TOOL_GROUNDED") {
    return <span className="chip chip-ok">verified result</span>;
  }
  if (status === "ERROR") {
    return <span className="chip chip-danger">temporarily unavailable</span>;
  }
  return <span className="chip chip-ok">grounded</span>;
}

function MessageTime({ createdAt }: { createdAt?: string }) {
  if (!createdAt) return null;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;
  return (
    <time className="message-time" dateTime={createdAt} title={date.toLocaleString()}>
      {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
    </time>
  );
}

function ChatCommerceCard({ commerce }: { commerce: CommercePayload }) {
  const [selection, setSelection] = useState<{
    flight: FlightOption; fare: FareOption;
  } | null>(null);
  return (
    <div className="chat-commerce">
      {commerce.flights?.map((flight) => (
        <article key={flight.flightInstanceId} className="chat-flight">
          <header>
            <span className="flight-no">{flight.flightNo}</span>
            <strong>{flight.departureTime.slice(0, 5)} <i>→</i> {flight.arrivalTime.slice(0, 5)}</strong>
            <small>{flight.origin} to {flight.destination} · {flight.durationMinutes} min</small>
          </header>
          <div className="chat-fares">
            {flight.fares.filter((fare) => fare.seatsAvailable > 0).slice(0, 4).map((fare) => (
              <button key={fare.fareId} onClick={() => setSelection({ flight, fare })}>
                <span><strong>{fare.fareBrand}</strong><small>{fare.cabin.toLowerCase()}</small></span>
                <b>{new Intl.NumberFormat("en-IN", {
                  style: "currency", currency: "INR", maximumFractionDigits: 0,
                }).format(fare.totalFare)}</b>
              </button>
            ))}
          </div>
        </article>
      ))}
      {commerce.alternatives?.length > 0 && (
        <div className="commerce-alternatives">
          {commerce.alternatives.slice(0, 8).map((airport) => (
            <span key={airport.code}><strong>{airport.code}</strong> {airport.city}</span>
          ))}
        </div>
      )}
      {selection && (
        <BookingCheckout flight={selection.flight} fare={selection.fare}
          draft={commerce.draft} onClose={() => setSelection(null)} />
      )}
    </div>
  );
}

/**
 * Renders the answer: markdown-ish lists and bold, plus citation markers as chips that
 * reveal the source passage. Deliberately small — the backend returns plain text, and a
 * markdown library would be a dependency for four constructs.
 */
function renderRich(
  text: string,
  onCitation: (handle: string) => void,
  citations: ChatResponse["citations"],
) {
  if (!text) return null;

  return text.split("\n").map((line, lineIndex) => {
    const trimmed = line.trim();

    if (!trimmed) {
      return <div key={lineIndex} style={{ height: 8 }} />;
    }

    const bullet = /^[-*•]\s+(.*)$/.exec(trimmed);
    const numbered = /^(\d+)[.)]\s+(.*)$/.exec(trimmed);

    if (bullet) {
      return (
        <div key={lineIndex} className="md-li">
          <span className="md-bullet" />
          <span>{inline(bullet[1], onCitation, citations)}</span>
        </div>
      );
    }
    if (numbered) {
      return (
        <div key={lineIndex} className="md-li">
          <span className="md-num">{numbered[1]}</span>
          <span>{inline(numbered[2], onCitation, citations)}</span>
        </div>
      );
    }
    return (
      <p key={lineIndex} className="md-p">
        {inline(trimmed, onCitation, citations)}
      </p>
    );
  });
}

function inline(
  text: string,
  onCitation: (handle: string) => void,
  citations: ChatResponse["citations"],
) {
  // Split on citation markers and **bold** runs in one pass.
  return text.split(/(\[[^\]\n]{1,80}\]|\*\*[^*]+\*\*)/g).map((part, index) => {
    const cite = /^\[([^\]\n]{1,80})\]$/.exec(part);
    if (cite) {
      const label = cite[1];
      const handle = /^E\d{1,2}$/.test(label) ? label : label.split(/\s+/)[0];
      const source = citations.find((item) => item.handle === handle);
      return (
        <button
          key={index}
          className="cite"
          onClick={() => onCitation(handle)}
          title={source
            ? `${source.documentCode} · ${source.section ?? "Source"} — ${source.excerpt.slice(0, 180)}`
            : "Show the source passage"}
        >
          {label}
        </button>
      );
    }
    const bold = /^\*\*([^*]+)\*\*$/.exec(part);
    if (bold) {
      return <strong key={index}>{bold[1]}</strong>;
    }
    return <span key={index}>{part}</span>;
  });
}

function ShieldGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1 1 0 0 1 1.5 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1Z" />
    </svg>
  );
}
