import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ChatWorkspace from "./ChatWorkspace";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  regenerate: vi.fn(),
  stop: vi.fn(),
  startSession: vi.fn(),
  openSession: vi.fn(),
  deleteSession: vi.fn(),
  clearBookingContext: vi.fn(),
  bookingContext: null as null | {
    flightNo: string;
    origin: string;
    destination: string;
    travelDate: string;
  },
  sessions: [] as Array<Record<string, unknown>>,
  messages: [] as Array<Record<string, unknown>>,
}));

vi.mock("./useChat", () => ({
  useChat: () => ({
    sessionId: "session-1",
    busy: false,
    error: null,
    ...mocks,
  }),
}));

vi.mock("../voice/useSpeechSynthesis", () => ({
  useSpeechSynthesis: () => ({
    supported: false,
    voices: [],
    speakingId: null,
    paused: false,
    speak: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    stop: vi.fn(),
  }),
}));

vi.mock("../voice/useDictation", () => ({
  useDictation: () => ({
    supported: false,
    listening: false,
    start: vi.fn(),
    stop: vi.fn(),
  }),
}));

function actionMessage(status: "PENDING" | "CONFIRMED") {
  return {
    id: `assistant-action-${status.toLowerCase()}`,
    role: "assistant",
    text: status === "PENDING"
      ? "Review the cancellation quote before confirming [T1]."
      : "Cancellation confirmed and refund tracking opened [T1].",
    response: {
      answer: status === "PENDING"
        ? "Review the cancellation quote before confirming [T1]."
        : "Cancellation confirmed and refund tracking opened [T1].",
      status: "TOOL_GROUNDED",
      escalated: false,
      citations: [],
      followups: [],
      confidence: 1,
      citationCoverage: 1,
      repairAttempts: 0,
      intent: "TOOL_CALL",
      lane: "FAST",
      sessionId: "session-1",
      traceId: `trace-action-${status.toLowerCase()}`,
      aiMode: "LIVE",
      generationSource: "STRUCTURED_TOOL",
      degradedReason: null,
      proposedAction: {
        actionUuid: "action-1",
        type: "CANCEL_BOOKING",
        status,
        pnr: "your booking reference",
        summary: {
          action: "Cancel booking",
          flight: "UA101 BLR-DEL",
          estimatedRefund: 2811,
        },
        citations: [{
          documentCode: "KB-AIR-004",
          section: "Cancellation fee matrix",
        }],
        result: status === "CONFIRMED"
          ? { message: "Cancellation confirmed and refund tracking opened." }
          : null,
        createdAt: "2026-07-28T18:00:00Z",
        confirmedAt: status === "CONFIRMED" ? "2026-07-28T18:01:00Z" : null,
        cancelledAt: null,
      },
      durationMs: 120,
    },
  };
}

describe("ChatWorkspace response controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.messages.length = 0;
    mocks.sessions.length = 0;
    mocks.bookingContext = null;
    HTMLElement.prototype.scrollTo = vi.fn();
  });

  it("offers Stream and One shot instead of retrieval-depth controls", () => {
    render(
      <ChatWorkspace
        title="Ask UnitedAir"
        subtitle="Grounded travel help"
        starters={[]}
      />,
    );

    expect(screen.getByRole("button", { name: "Stream" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "One shot" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Quick" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Thorough" })).not.toBeInTheDocument();
  });

  it("keeps hosted-model diagnostics out of the normal answer metadata", () => {
    mocks.messages.push({
      id: "assistant-1",
      role: "assistant",
      text: "Three flights are available [T1].",
      response: {
        answer: "Three flights are available [T1].",
        status: "TOOL_GROUNDED",
        escalated: false,
        citations: [],
        followups: [],
        confidence: 0,
        citationCoverage: 1,
        repairAttempts: 0,
        intent: "TOOL_PLUS_KB",
        lane: "FAST",
        sessionId: "session-1",
        traceId: "trace-1",
        aiMode: "LIVE",
        degradedReason: null,
        durationMs: 1200,
      },
    });

    render(
      <ChatWorkspace
        title="Ask UnitedAir"
        subtitle="Grounded travel help"
        starters={[]}
      />,
    );

    expect(screen.queryByText("Live AI")).not.toBeInTheDocument();
  });

  it("renders conversational answers without fake evidence metadata", () => {
    mocks.messages.push({
      id: "assistant-small-talk",
      role: "assistant",
      text: "Hello! How can I help with your journey?",
      response: {
        answer: "Hello! How can I help with your journey?",
        status: "CONVERSATIONAL",
        escalated: false,
        citations: [],
        followups: ["Search for a flight?", "Help with baggage?"],
        confidence: null,
        citationCoverage: null,
        repairAttempts: 0,
        intent: "SMALL_TALK",
        lane: "-",
        sessionId: "session-1",
        traceId: "trace-small-talk",
        aiMode: "LIVE",
        degradedReason: null,
        durationMs: 700,
      },
    });

    render(
      <ChatWorkspace
        title="Ask UnitedAir"
        subtitle="Grounded travel help"
        starters={[]}
      />,
    );

    const metadata = screen.getByText("conversation").closest(".msg-meta");
    expect(metadata).toBeInTheDocument();
    expect(screen.queryByText("Live AI")).not.toBeInTheDocument();
    expect(metadata).not.toHaveTextContent(/confidence/i);
    expect(metadata).not.toHaveTextContent(/sources?/i);
  });

  it("shows active booking context only for a booking-relevant turn and lets the passenger forget it", () => {
    mocks.bookingContext = {
      flightNo: "UA404",
      origin: "DEL",
      destination: "LHR",
      travelDate: "2026-08-17",
    };

    const view = render(
      <ChatWorkspace
        title="Ask UnitedAir"
        subtitle="Grounded travel help"
        starters={[]}
      />,
    );

    expect(screen.queryByText("Current trip")).not.toBeInTheDocument();

    mocks.messages = [{
      id: "assistant-booking",
      role: "assistant",
      text: "UA404 is on time.",
      toolCalls: [{
        toolName: "FlightStatusTool",
        success: true,
        summary: "Live status",
        error: "",
        durationMs: 20,
      }],
      response: {
        answer: "UA404 is on time.",
        status: "TOOL_GROUNDED",
        escalated: false,
        citations: [],
        followups: [],
        confidence: 1,
        citationCoverage: 1,
        repairAttempts: 0,
        intent: "TOOL_CALL",
        lane: "FAST",
        sessionId: "session-1",
        traceId: "trace-booking",
        aiMode: "LIVE",
        degradedReason: null,
        durationMs: 20,
      },
    }];
    view.rerender(
      <ChatWorkspace
        title="Ask UnitedAir"
        subtitle="Grounded travel help"
        starters={[]}
      />,
    );

    expect(screen.getByText("Current trip")).toBeInTheDocument();
    expect(screen.getByLabelText("Active booking context"))
      .toHaveTextContent(/UA404.*DEL.*LHR/);
    expect(screen.queryByText(/Using UA404/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Forget active booking" }));
    expect(mocks.clearBookingContext).toHaveBeenCalledTimes(1);
  });

  it("does not label a deterministic clarification as Live AI", () => {
    mocks.messages.push({
      id: "assistant-clarification",
      role: "assistant",
      text: "Which origin and destination should I search?",
      createdAt: "2026-07-26T17:19:00Z",
      response: {
        answer: "Which origin and destination should I search?",
        status: "CLARIFICATION",
        escalated: false,
        citations: [],
        followups: [],
        confidence: null,
        citationCoverage: null,
        repairAttempts: 0,
        intent: "CLARIFICATION",
        lane: "-",
        sessionId: "session-1",
        traceId: "trace-clarification",
        aiMode: "LIVE",
        degradedReason: null,
        durationMs: 80,
      },
    });

    render(
      <ChatWorkspace
        title="Ask UnitedAir"
        subtitle="Grounded travel help"
        starters={[]}
      />,
    );

    expect(screen.getByText("needs details")).toBeInTheDocument();
    expect(screen.queryByText("Live AI")).not.toBeInTheDocument();
  });

  it("keeps fallback diagnostics out of the normal answer metadata", () => {
    mocks.messages.push({
      id: "assistant-tool-fallback",
      role: "assistant",
      text: "No UnitedAir flights were found [T1].",
      createdAt: "2026-07-26T17:19:00Z",
      response: {
        answer: "No UnitedAir flights were found [T1].",
        status: "TOOL_GROUNDED",
        escalated: false,
        citations: [],
        followups: [],
        confidence: null,
        citationCoverage: 1,
        repairAttempts: 0,
        intent: "TOOL_PLUS_KB",
        lane: "FAST",
        sessionId: "session-1",
        traceId: "trace-tool-fallback",
        aiMode: "LIVE",
        degradedReason: "UPSTREAM_UNAVAILABLE",
        durationMs: 900,
      },
    });

    render(
      <ChatWorkspace
        title="Ask UnitedAir"
        subtitle="Grounded travel help"
        starters={[]}
      />,
    );

    expect(screen.queryByText("verified live data")).not.toBeInTheDocument();
    expect(screen.queryByText("offline")).not.toBeInTheDocument();
    expect(screen.queryByText("local fallback")).not.toBeInTheDocument();
  });

  it("shows exhausted model capacity as retryable instead of a human referral", () => {
    mocks.messages.push({
      id: "assistant-capacity",
      role: "assistant",
      text: "The AI model is currently at capacity. Please try again shortly.",
      createdAt: "2026-07-28T18:00:00Z",
      response: {
        answer: "The AI model is currently at capacity. Please try again shortly.",
        status: "ERROR",
        escalated: false,
        citations: [],
        followups: [],
        confidence: null,
        citationCoverage: null,
        repairAttempts: 1,
        intent: "KB_LOOKUP",
        lane: "FAST",
        sessionId: "session-1",
        traceId: "trace-capacity",
        aiMode: "LIVE",
        generationSource: "DETERMINISTIC_CONVERSATION",
        degradedReason: "MODEL_CAPACITY",
        durationMs: 1200,
      },
    });

    render(
      <ChatWorkspace
        title="Ask UnitedAir"
        subtitle="Grounded travel help"
        starters={[]}
      />,
    );

    expect(screen.getByText("Model capacity reached")).toBeInTheDocument();
    expect(screen.getByText("Please try again shortly.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.getByText("temporarily unavailable")).toBeInTheDocument();
    expect(screen.queryByText("referred to a person")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Answer actions")).not.toBeInTheDocument();
  });

  it("renders streamed flight options from the unchanged commerce contract", () => {
    mocks.messages.push({
      id: "assistant-commerce",
      role: "assistant",
      text: "I found one flight [T1].",
      response: {
        answer: "I found one flight [T1].",
        status: "TOOL_GROUNDED",
        escalated: false,
        citations: [],
        followups: [],
        confidence: 1,
        citationCoverage: 1,
        repairAttempts: 0,
        intent: "BOOK_FLIGHT",
        lane: "FAST",
        sessionId: "session-1",
        traceId: "trace-commerce",
        aiMode: "LIVE",
        generationSource: "STRUCTURED_TOOL",
        degradedReason: null,
        commerce: {
          type: "FLIGHT_OPTIONS",
          draft: null,
          alternatives: [],
          detail: null,
          flights: [{
            flightInstanceId: 704,
            flightNo: "UA704",
            origin: "BLR",
            destination: "GOI",
            departureTime: "09:30:00",
            arrivalTime: "10:45:00",
            durationMinutes: 75,
            fares: [{
              fareId: 1,
              fareBrand: "Value",
              cabin: "ECONOMY",
              totalFare: 4811,
              seatsAvailable: 8,
            }],
          }],
        },
        durationMs: 90,
      },
    });

    render(<ChatWorkspace title="Ask UnitedAir" subtitle="Grounded travel help" starters={[]} />);

    expect(screen.getByText("UA704")).toBeInTheDocument();
    expect(screen.getByText(/BLR to GOI/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Value.*₹4,811/i })).toBeInTheDocument();
  });

  it("renders a pending cancellation proposal without treating it as completed", () => {
    mocks.messages.push(actionMessage("PENDING"));

    render(<ChatWorkspace title="Ask UnitedAir" subtitle="Grounded travel help" starters={[]} />);

    expect(screen.getByText("Confirmation required")).toBeInTheDocument();
    expect(screen.getByText("Cancel this booking?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm cancellation" })).toBeInTheDocument();
    expect(screen.queryByText("Booking cancelled")).not.toBeInTheDocument();
  });

  it("renders a semantically confirmed action as settled", () => {
    mocks.messages.push(actionMessage("CONFIRMED"));

    render(<ChatWorkspace title="Ask UnitedAir" subtitle="Grounded travel help" starters={[]} />);

    expect(screen.getByText("Cancellation complete")).toBeInTheDocument();
    expect(screen.getByText("Booking cancelled")).toBeInTheDocument();
    expect(screen.getByText("Cancellation confirmed and refund tracking opened."))
      .toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm cancellation" }))
      .not.toBeInTheDocument();
  });

  it("opens restored citation evidence from the source drawer", () => {
    mocks.messages.push({
      id: "assistant-restored-source",
      role: "assistant",
      text: "Economy cabin baggage is 7 kg [E1].",
      response: {
        answer: "Economy cabin baggage is 7 kg [E1].",
        status: "GROUNDED",
        escalated: false,
        citations: [{
          handle: "E1",
          documentCode: "KB-AIR-003",
          documentTitle: "Baggage Policy and Handling",
          section: "Cabin baggage",
          page: 3,
          category: "policy-manual",
          relevance: 0.91,
          excerpt: "Economy passengers may carry one cabin bag up to 7 kg.",
        }],
        followups: [],
        confidence: 0.91,
        citationCoverage: 1,
        repairAttempts: 0,
        intent: "KB_LOOKUP",
        lane: "FAST",
        sessionId: "session-1",
        traceId: "trace-restored",
        aiMode: "LIVE",
        generationSource: "HOSTED_MODEL",
        degradedReason: null,
        durationMs: 400,
      },
    });

    render(<ChatWorkspace title="Ask UnitedAir" subtitle="Grounded travel help" starters={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Sources" }));

    expect(screen.getByText("Baggage Policy and Handling")).toBeInTheDocument();
    expect(screen.getByText(/Economy passengers may carry one cabin bag up to 7 kg/))
      .toBeInTheDocument();
  });

  it("labels evidence relevance and the truthful generation source", () => {
    mocks.messages.push({
      id: "assistant-grounded-fallback",
      role: "assistant",
      text: "Checked baggage allowance is 15 kg [E1].",
      response: {
        answer: "Checked baggage allowance is 15 kg [E1].",
        status: "GROUNDED",
        escalated: false,
        citations: [],
        followups: [],
        confidence: 0.82,
        citationCoverage: 1,
        repairAttempts: 0,
        intent: "KB_LOOKUP",
        lane: "FAST",
        sessionId: "session-1",
        traceId: "trace-grounded-fallback",
        aiMode: "LIVE",
        generationSource: "GROUNDED_EXTRACTIVE",
        degradedReason: "UPSTREAM_UNAVAILABLE",
        durationMs: 900,
      },
    });

    render(
      <ChatWorkspace
        title="Ask UnitedAir"
        subtitle="Grounded travel help"
        starters={[]}
      />,
    );

    expect(screen.getByText("Evidence match 82%")).toBeInTheDocument();
    expect(screen.getByText("Grounded local composition, 0 sources")).toBeInTheDocument();
    expect(screen.queryByText(/confidence/i)).not.toBeInTheDocument();
  });

  it("labels simulator tool results truthfully and never presents tool certainty as RAG confidence", () => {
    mocks.messages.push({
      id: "assistant-simulator",
      role: "assistant",
      text: "UA101 departs at 06:15 [T1].",
      response: {
        answer: "UA101 departs at 06:15 [T1].",
        status: "TOOL_GROUNDED",
        escalated: false,
        citations: [{
          handle: "T1",
          documentCode: "SIM-FLIGHT",
          documentTitle: "Flight simulator",
          section: "Availability",
          page: null,
          category: "tool",
          relevance: 1,
          excerpt: "UA101 departs at 06:15",
          toolName: "FlightSearchTool",
          provider: "FLIGHT_SIMULATOR",
          providerLive: false,
          retrievedAt: "2026-07-27T12:00:00Z",
        }],
        followups: [],
        confidence: 1,
        citationCoverage: 1,
        repairAttempts: 0,
        intent: "TOOL_CALL",
        lane: "FAST",
        sessionId: "session-1",
        traceId: "trace-simulator",
        aiMode: "LIVE",
        generationSource: "STRUCTURED_TOOL",
        degradedReason: null,
        durationMs: 100,
      },
    });

    render(<ChatWorkspace title="Ask UnitedAir" subtitle="Grounded travel help" starters={[]} />);

    expect(screen.getByText("Verified simulator result")).toBeInTheDocument();
    expect(screen.queryByText(/Evidence match 100%/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Live AI/i)).not.toBeInTheDocument();
  });

  it("hides generic follow-ups when no evidence cleared the threshold", () => {
    mocks.messages.push({
      id: "assistant-empty",
      role: "assistant",
      text: "No matching policy was found.",
      response: {
        answer: "No matching policy was found.",
        status: "EMPTY_CONTEXT",
        escalated: false,
        citations: [],
        followups: ["Would you like me to search for a flight?"],
        confidence: null,
        citationCoverage: null,
        repairAttempts: 0,
        intent: "KB_LOOKUP",
        lane: "FAST",
        sessionId: "session-1",
        traceId: "trace-empty",
        aiMode: "LIVE",
        degradedReason: null,
        durationMs: 100,
      },
    });

    render(<ChatWorkspace title="Ask UnitedAir" subtitle="Grounded travel help" starters={[]} />);

    expect(screen.queryByRole("list", { name: "Related questions" })).not.toBeInTheDocument();
    expect(screen.queryByText("Would you like me to search for a flight?")).not.toBeInTheDocument();
  });

  it("renders a failed request as a recoverable answer instead of a red error banner", () => {
    mocks.messages.push({
      id: "assistant-error",
      role: "assistant",
      text: "",
      error: "UnitedAir could not complete that request. Please try again.",
    });

    render(<ChatWorkspace title="Ask UnitedAir" subtitle="Grounded travel help" starters={[]} />);

    expect(screen.getByText("That request did not finish")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(document.querySelector(".alert-error")).not.toBeInTheDocument();
  });

  it("renders the saved time for each message", () => {
    mocks.messages.push({
      id: "user-with-time",
      role: "user",
      text: "London to Dubai tomorrow?",
      createdAt: "2026-07-26T17:19:00Z",
    });

    const { container } = render(
      <ChatWorkspace
        title="Ask UnitedAir"
        subtitle="Grounded travel help"
        starters={[]}
      />,
    );

    expect(container.querySelector("time")?.getAttribute("datetime"))
      .toBe("2026-07-26T17:19:00Z");
  });

  it("keeps an empty draft out of recent chats until its first message", () => {
    mocks.sessions.push(
      {
        sessionUuid: "session-1",
        actorRole: "PASSENGER",
        title: null,
        createdAt: "2026-07-26T17:30:00Z",
        lastActivityAt: "2026-07-26T17:30:00Z",
        expired: false,
        messageCount: 0,
      },
      {
        sessionUuid: "completed-session",
        actorRole: "PASSENGER",
        title: "Baggage allowance",
        createdAt: "2026-07-26T16:00:00Z",
        lastActivityAt: "2026-07-26T16:05:00Z",
        expired: false,
        messageCount: 2,
      },
    );

    render(
      <ChatWorkspace
        title="Ask UnitedAir"
        subtitle="Grounded travel help"
        starters={[]}
      />,
    );

    expect(screen.queryByText("New conversation")).not.toBeInTheDocument();
    expect(screen.getByText("Baggage allowance")).toBeInTheDocument();
  });

  it("closes a conversation options menu when another chat is opened", () => {
    mocks.sessions.push(
      {
        sessionUuid: "session-1",
        actorRole: "PASSENGER",
        title: "First chat",
        createdAt: "2026-07-26T15:00:00Z",
        lastActivityAt: "2026-07-26T15:10:00Z",
        expired: false,
        messageCount: 2,
      },
      {
        sessionUuid: "session-2",
        actorRole: "PASSENGER",
        title: "Second chat",
        createdAt: "2026-07-26T14:00:00Z",
        lastActivityAt: "2026-07-26T14:10:00Z",
        expired: false,
        messageCount: 2,
      },
    );

    render(
      <ChatWorkspace
        title="Ask UnitedAir"
        subtitle="Grounded travel help"
        starters={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Options for First chat" }));
    expect(screen.getByRole("menuitem", { name: /delete chat/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^second chat/i }));

    expect(mocks.openSession).toHaveBeenCalledWith("session-2");
    expect(screen.queryByRole("menuitem", { name: /delete chat/i })).not.toBeInTheDocument();
  });

  it("groups recent chats by real activity time", () => {
    vi.setSystemTime(new Date("2026-07-26T18:00:00Z"));
    mocks.sessions.push(
      {
        sessionUuid: "today",
        actorRole: "PASSENGER",
        title: "Today chat",
        createdAt: "2026-07-26T17:00:00Z",
        lastActivityAt: "2026-07-26T17:55:00Z",
        expired: false,
        messageCount: 2,
      },
      {
        sessionUuid: "yesterday",
        actorRole: "PASSENGER",
        title: "Yesterday chat",
        createdAt: "2026-07-25T10:00:00Z",
        lastActivityAt: "2026-07-25T10:10:00Z",
        expired: false,
        messageCount: 2,
      },
      {
        sessionUuid: "week",
        actorRole: "PASSENGER",
        title: "Week chat",
        createdAt: "2026-07-22T10:00:00Z",
        lastActivityAt: "2026-07-22T10:10:00Z",
        expired: false,
        messageCount: 2,
      },
      {
        sessionUuid: "older",
        actorRole: "PASSENGER",
        title: "Older chat",
        createdAt: "2026-07-10T10:00:00Z",
        lastActivityAt: "2026-07-10T10:10:00Z",
        expired: false,
        messageCount: 2,
      },
    );

    render(
      <ChatWorkspace
        title="Ask UnitedAir"
        subtitle="Grounded travel help"
        starters={[]}
      />,
    );

    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Yesterday")).toBeInTheDocument();
    expect(screen.getByText("Previous 7 days")).toBeInTheDocument();
    expect(screen.getByText("Older")).toBeInTheDocument();
    expect(screen.getByText("5m ago")).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("hides the scroll-to-latest control when a conversation becomes empty", () => {
    mocks.messages.push({
      id: "assistant-long",
      role: "assistant",
      text: "A long answer with more content below.",
    });

    const { container, rerender } = render(
      <ChatWorkspace
        title="Ask UnitedAir"
        subtitle="Grounded travel help"
        starters={[]}
      />,
    );
    const scrollArea = container.querySelector(".chat-scroll") as HTMLDivElement;
    Object.defineProperties(scrollArea, {
      scrollHeight: { configurable: true, value: 1_000 },
      clientHeight: { configurable: true, value: 400 },
      scrollTop: { configurable: true, value: 0, writable: true },
    });

    fireEvent.scroll(scrollArea);
    expect(
      screen.getByRole("button", { name: "Scroll to latest message" }),
    ).toBeInTheDocument();

    mocks.messages.length = 0;
    rerender(
      <ChatWorkspace
        title="Ask UnitedAir"
        subtitle="Grounded travel help"
        starters={[]}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Scroll to latest message" }),
    ).not.toBeInTheDocument();
  });

  it("renders the scroll-to-latest affordance as an icon-only control", () => {
    mocks.messages.push({
      id: "assistant-overflow",
      role: "assistant",
      text: "A long answer with more content below.",
    });

    const { container } = render(
      <ChatWorkspace
        title="Ask UnitedAir"
        subtitle="Grounded travel help"
        starters={[]}
      />,
    );
    const scrollArea = container.querySelector(".chat-scroll") as HTMLDivElement;
    Object.defineProperties(scrollArea, {
      scrollHeight: { configurable: true, value: 1_000 },
      clientHeight: { configurable: true, value: 400 },
      scrollTop: { configurable: true, value: 0, writable: true },
    });

    fireEvent.scroll(scrollArea);

    expect(
      screen.getByRole("button", { name: "Scroll to latest message" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Latest")).not.toBeInTheDocument();
  });
});
