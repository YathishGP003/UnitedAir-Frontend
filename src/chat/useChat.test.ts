import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useChat, userFacingChatFailure } from "./useChat";

const mocks = vi.hoisted(() => ({
  listSessions: vi.fn(),
  createSession: vi.fn(),
  chatSync: vi.fn(),
  auditTrail: vi.fn(),
  endSession: vi.fn(),
  bookingContext: vi.fn(),
  clearBookingContext: vi.fn(),
  streamChat: vi.fn(),
}));

vi.mock("../api/client", () => ({
  api: {
    listSessions: mocks.listSessions,
    createSession: mocks.createSession,
    chatSync: mocks.chatSync,
    auditTrail: mocks.auditTrail,
    endSession: mocks.endSession,
    bookingContext: mocks.bookingContext,
    clearBookingContext: mocks.clearBookingContext,
  },
  streamChat: mocks.streamChat,
}));

describe("useChat delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listSessions.mockResolvedValue([]);
    mocks.createSession.mockResolvedValue({ sessionUuid: "session-1" });
    mocks.auditTrail.mockResolvedValue({ turns: [] });
    mocks.endSession.mockResolvedValue(undefined);
    mocks.bookingContext.mockResolvedValue(undefined);
    mocks.clearBookingContext.mockResolvedValue(undefined);
    mocks.chatSync.mockResolvedValue({
      answer: "The allowance is 7 kg.",
      status: "GROUNDED",
      citations: [],
      followups: [],
      toolCalls: [],
      confidence: 0.9,
      citationCoverage: 1,
      repairAttempts: 0,
      intent: "KB_LOOKUP",
      lane: "FAST",
      sessionId: "session-1",
      traceId: "trace-1",
      aiMode: "LIVE",
    });
    mocks.streamChat.mockResolvedValue(undefined);
  });

  it("redacts raw proxy pages and stack-shaped failures", () => {
    expect(userFacingChatFailure("<!doctype html><h1>502 Bad Gateway</h1>"))
      .toBe("UnitedAir could not complete that request. Please try again.");
    expect(userFacingChatFailure("org.springframework.web.ServerError: stack trace"))
      .not.toMatch(/springframework|stack trace/i);
  });

  it("uses the synchronous endpoint when One shot delivery is selected", async () => {
    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(result.current.sessionId).toBe("session-1"));

    await act(async () => {
      const send = result.current.send as (
        text: string,
        options: { delivery: "oneShot" },
      ) => Promise<void>;
      await send("What is my baggage allowance?", { delivery: "oneShot" });
    });

    expect(mocks.chatSync).toHaveBeenCalledWith(
      "What is my baggage allowance?",
      "session-1",
      false,
    );
    expect(mocks.streamChat).not.toHaveBeenCalled();
    expect(result.current.messages.at(-1)?.text).toBe("The allowance is 7 kg.");
  });

  it("restores the latest conversation instead of creating a blank one on refresh", async () => {
    mocks.listSessions.mockResolvedValue([
      {
        sessionUuid: "existing-session",
        title: "Baggage allowance",
        messageCount: 2,
        lastActivityAt: "2026-07-26T16:00:00Z",
      },
    ]);

    const { result } = renderHook(() => useChat());

    await waitFor(() => expect(result.current.sessionId).toBe("existing-session"));
    expect(mocks.auditTrail).toHaveBeenCalledWith("existing-session");
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("humanises a protected booking token in a newly delivered answer", async () => {
    mocks.chatSync.mockResolvedValueOnce({
      ...await mocks.chatSync(),
      answer: "[AIR-PNR-REDACTED]: UA404 DEL-LHR, status CONFIRMED [T1].",
    });
    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(result.current.sessionId).toBe("session-1"));

    await act(async () => {
      await result.current.send("Retrieve booking B6X9K2.", { delivery: "oneShot" });
    });

    expect(result.current.messages.at(-1)?.text).toBe(
      "Your booking: UA404 DEL-LHR, status CONFIRMED [T1].",
    );
  });

  it("restores saved citations, answer metadata, follow-ups and timestamps", async () => {
    mocks.listSessions.mockResolvedValue([
      {
        sessionUuid: "cited-session",
        title: "Flights to Delhi",
        messageCount: 2,
        lastActivityAt: "2026-07-26T17:20:00Z",
      },
    ]);
    mocks.auditTrail.mockResolvedValue({
      turns: [
        {
          traceId: "trace-cited",
          at: "2026-07-26T17:19:00Z",
          queryRedacted: "What flights are available from Bangalore to Delhi tomorrow?",
          answerRedacted: "Three flights are available [T1].",
          status: "TOOL_GROUNDED",
          escalated: false,
          citations: [
            {
              handle: "T1",
              documentCode: "FlightSearchTool",
              documentTitle: "Live tool result",
              section: null,
              page: null,
              category: "tool-result",
              relevance: null,
              excerpt: "3 departures BLR to DEL",
              toolName: "FlightSearchTool",
              retrievedAt: "2026-07-26T17:19:00Z",
            },
          ],
          followups: ["Show fare details for these flights."],
          confidence: 1,
          citationCoverage: 1,
          repairAttempts: 0,
          intent: "TOOL_PLUS_KB",
          lane: "FAST",
          aiMode: "LIVE",
          degradedReason: "RATE_LIMIT",
          durationMs: 1200,
          evidence: [],
          toolCalls: [],
        },
      ],
    });

    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(result.current.sessionId).toBe("cited-session"));

    const user = result.current.messages[0];
    const assistant = result.current.messages[1];
    expect(user.createdAt).toBe("2026-07-26T17:19:00Z");
    expect(assistant.createdAt).toBe("2026-07-26T17:19:00Z");
    expect(assistant.response?.citations[0]?.handle).toBe("T1");
    expect(assistant.response?.followups).toEqual(["Show fare details for these flights."]);
    expect(assistant.response?.degradedReason).toBe("RATE_LIMIT");
    expect(assistant.evidence?.[0]?.documentCode).toBe("FlightSearchTool");
  });

  it("restores interactive commerce cards when a booking chat is reopened", async () => {
    mocks.listSessions.mockResolvedValue([
      {
        sessionUuid: "booking-session",
        title: "Book Bengaluru to Delhi",
        messageCount: 2,
        lastActivityAt: "2026-07-27T09:00:00Z",
      },
    ]);
    const commerce = {
      type: "FLIGHT_OPTIONS" as const,
      draft: null,
      flights: [],
      alternatives: [],
      detail: { origin: "BLR", destination: "DEL" },
    };
    mocks.auditTrail.mockResolvedValue({
      turns: [{
        traceId: "trace-commerce",
        at: "2026-07-27T09:00:00Z",
        queryRedacted: "Show flights from Bengaluru to Delhi tomorrow",
        answerRedacted: "I found three flights.",
        status: "TOOL_GROUNDED",
        escalated: false,
        citations: [],
        followups: [],
        confidence: 1,
        citationCoverage: 1,
        repairAttempts: 0,
        intent: "BOOK_FLIGHT",
        lane: "FAST",
        aiMode: "LIVE",
        degradedReason: null,
        durationMs: 12,
        evidence: [],
        toolCalls: [],
        commerce,
      }],
    });

    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(result.current.sessionId).toBe("booking-session"));

    expect(result.current.messages[1].response?.commerce).toEqual(commerce);
  });

  it("renders stored PNR redaction tokens as human-readable private text", async () => {
    mocks.listSessions.mockResolvedValue([
      {
        sessionUuid: "private-session",
        title: "Booking",
        messageCount: 2,
        lastActivityAt: "2026-07-26T17:20:00Z",
      },
    ]);
    mocks.auditTrail.mockResolvedValue({
      turns: [
        {
          traceId: "trace-private",
          at: "2026-07-26T17:19:00Z",
          queryRedacted: "Retrieve booking [AIR-PNR-REDACTED] for servicing.",
          answerRedacted: "[AIR-PNR-REDACTED]: UA404 DEL-LHR, status CONFIRMED [T1].",
          status: "TOOL_GROUNDED",
          escalated: false,
          citations: [],
          followups: [],
          confidence: 1,
          citationCoverage: 1,
          repairAttempts: 0,
          intent: "TOOL_PLUS_KB",
          lane: "FAST",
          aiMode: "LIVE",
          degradedReason: null,
          durationMs: 500,
          evidence: [],
          toolCalls: [],
        },
      ],
    });

    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(result.current.sessionId).toBe("private-session"));

    expect(result.current.messages[0].text).toBe(
      "Retrieve my booking reference for servicing.",
    );
    expect(result.current.messages[1].text).toBe(
      "Your booking: UA404 DEL-LHR, status CONFIRMED [T1].",
    );
    expect(result.current.messages.map((message) => message.text).join(" "))
      .not.toContain("AIR-PNR-REDACTED");
  });

  it("does not create more blank conversations while the current one is empty", async () => {
    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(result.current.sessionId).toBe("session-1"));

    await act(async () => {
      await result.current.startSession();
      await result.current.startSession();
    });

    expect(mocks.createSession).toHaveBeenCalledTimes(1);
  });

  it("deletes a conversation and opens the next available one", async () => {
    mocks.listSessions.mockResolvedValue([
      {
        sessionUuid: "session-a",
        title: "First",
        messageCount: 2,
        lastActivityAt: "2026-07-26T16:00:00Z",
      },
      {
        sessionUuid: "session-b",
        title: "Second",
        messageCount: 4,
        lastActivityAt: "2026-07-26T15:00:00Z",
      },
    ]);

    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(result.current.sessionId).toBe("session-a"));

    await act(async () => {
      await result.current.deleteSession("session-a");
    });

    expect(mocks.endSession).toHaveBeenCalledWith("session-a");
    expect(result.current.sessionId).toBe("session-b");
  });
});
