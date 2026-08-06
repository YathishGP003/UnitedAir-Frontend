import type {
  ActionView,
  BookingContact,
  BookingContextView,
  BookingDraft,
  BookingView,
  ChatResponse,
  DemoUser,
  EscalationCase,
  FlightSearchResult,
  FlightNotificationSubscription,
  FlightChangeEvent,
  FlightStatusView,
  IngestionJob,
  IngestionAttempt,
  IngestionResult,
  AdminHealth,
  FeedbackStatistics,
  KbDocument,
  KbQualityReport,
  KbStatistics,
  LoginResponse,
  OperationsSummary,
  OperationalDecisionType,
  OperationalDecisionView,
  OwnedBookingView,
  PaymentView,
  PolicyImpactSummary,
  ProposeActionInput,
  RefundCaseView,
  RefundStatus,
  RefundQuote,
  QualitySummary,
  RegisterInput,
  SearchHit,
  SeatOption,
  SessionTrail,
  SessionView,
  TicketView,
  Traveller,
} from "../types";

const TOKEN_KEY = "unitedair.token";
const USER_KEY = "unitedair.user";

export function storedToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function storeSession(login: LoginResponse): void {
  localStorage.setItem(TOKEN_KEY, login.token);
  localStorage.setItem(USER_KEY, JSON.stringify(login.user));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function storedUser<T>(): T | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Thrown for any non-2xx response, carrying the backend's message and trace id. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly traceId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = storedToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, { ...init, headers });

  if (response.status === 401) {
    // The token expired or was revoked. Clearing it sends the guard to /login
    // rather than leaving the user staring at repeated failures.
    clearSession();
    throw new ApiError(401, "Your session has expired. Please sign in again.");
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    let traceId: string | undefined;
    try {
      const body = await response.json();
      message = body.message ?? message;
      traceId = body.traceId;
    } catch {
      // Non-JSON error body; keep the generic message.
    }
    throw new ApiError(response.status, message, traceId);
  }

  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get("Content-Type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    throw new ApiError(
      502,
      "The API route returned a web page instead of JSON. "
        + "Check that the backend and development proxy are running.",
    );
  }
  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError(502, "The API returned invalid JSON. Please retry the request.");
  }
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

export const api = {
  // ------------------------------------------------------------------ auth ---
  login: (email: string, password: string) =>
    post<LoginResponse>("/auth/login", { email, password }),
  register: (input: RegisterInput) =>
    post<LoginResponse>("/auth/register", input),
  demoUsers: () => get<DemoUser[]>("/auth/demo-users"),
  me: () => get<LoginResponse["user"]>("/auth/me"),
  logout: () => post<void>("/auth/logout"),

  // -------------------------------------------------------------- sessions ---
  createSession: (title?: string) => post<SessionView>("/sessions", { title }),
  listSessions: () => get<SessionView[]>("/sessions"),
  endSession: (id: string) => request<void>(`/sessions/${id}`, { method: "DELETE" }),
  bookingContext: (id: string) =>
    get<BookingContextView>(`/sessions/${id}/booking-context`),
  clearBookingContext: (id: string) =>
    request<void>(`/sessions/${id}/booking-context`, { method: "DELETE" }),

  // ------------------------------------------------------------------ chat ---
  chatSync: (message: string, sessionId: string, deepSearch = false) =>
    post<ChatResponse>("/ai/airline/chat/sync", { message, sessionId, deepSearch }),

  // ----------------------------------------------------------------- tools ---
  searchFlights: (origin: string, destination: string, date: string, cabin?: string) => {
    const params = new URLSearchParams({ origin, destination, date });
    if (cabin) params.set("cabin", cabin);
    return get<FlightSearchResult>(`/tools/flights/search?${params}`);
  },
  booking: (pnr: string) => get<BookingView>(`/tools/booking/${encodeURIComponent(pnr)}`),
  refundQuote: (pnr: string) =>
    get<RefundQuote>(`/tools/booking/${encodeURIComponent(pnr)}/refund-quote`),
  flightStatus: (flightNo: string, date?: string) => {
    const params = date ? `?date=${date}` : "";
    return get<FlightStatusView>(`/tools/flightstatus/${encodeURIComponent(flightNo)}${params}`);
  },
  subscribeFlightNotifications: (flightNo: string, date: string) =>
    post<FlightNotificationSubscription>("/notifications/flights", { flightNo, date }),
  unsubscribeFlightNotifications: (subscriptionUuid: string) =>
    request<void>(`/notifications/flights/${encodeURIComponent(subscriptionUuid)}`, {
      method: "DELETE",
    }),
  flightNotifications: (since: string) =>
    get<FlightChangeEvent[]>(`/notifications/flights?since=${encodeURIComponent(since)}`),
  seatMap: (flightInstanceId: number) =>
    get<SeatOption[]>(`/tools/flights/${flightInstanceId}/seats`),

  // ------------------------------------------------------------ commerce ---
  startBookingDraft: (sessionUuid?: string) =>
    post<BookingDraft>("/commerce/drafts", { sessionUuid }),
  bookingDraft: (draftId: string) =>
    get<BookingDraft>(`/commerce/drafts/${draftId}`),
  updateBookingDraft: (
    draftId: string,
    patch: Partial<{
      origin: string;
      destination: string;
      travelDate: string;
      cabin: string;
      flightInstanceId: number;
      fareId: number;
      seatNumber: string;
      traveller: Traveller;
      contact: BookingContact;
    }>,
    expectedVersion: number,
  ) => request<BookingDraft>(`/commerce/drafts/${draftId}`, {
    method: "PATCH",
    body: JSON.stringify({ patch, expectedVersion }),
  }),
  bookingDraftSeats: (draftId: string) =>
    get<SeatOption[]>(`/commerce/drafts/${draftId}/seats`),
  authorizePayment: (input: {
    draftUuid: string;
    method: "CARD" | "UPI";
    cardNumber?: string;
    cvv?: string;
    upi?: string;
    amount: number;
    idempotencyKey: string;
  }) => post<PaymentView>("/commerce/payments/authorize", input),
  confirmBooking: (input: {
    draftUuid: string;
    paymentUuid: string;
    idempotencyKey: string;
  }) => post<TicketView>("/commerce/bookings/confirm", input),
  ownedBookings: () => get<OwnedBookingView[]>("/commerce/bookings"),
  ownedBooking: (pnr: string) =>
    get<TicketView>(`/commerce/bookings/${encodeURIComponent(pnr)}`),
  requestSupportCallback: (pnr: string, channel: "PHONE" | "EMAIL" = "PHONE") =>
    post<{ caseUuid: string; pnr: string; channel: string; status: string; createdAt: string }>(
      `/commerce/bookings/${encodeURIComponent(pnr)}/support-callback`,
      { channel },
    ),
  passengerRefundCases: () => get<RefundCaseView[]>("/commerce/refunds"),
  staffRefundCases: (status?: RefundStatus) =>
    get<RefundCaseView[]>(`/staff/refunds${status ? `?status=${status}` : ""}`),
  transitionRefund: (caseUuid: string, status: RefundStatus, note = "") =>
    post<RefundCaseView>(`/staff/refunds/${caseUuid}/transition`, { status, note }),

  // --------------------------------------------------------------- actions ---
  proposeAction: (input: ProposeActionInput) =>
    post<ActionView>("/actions", input),
  confirmAction: (id: string) => post<ActionView>(`/actions/${id}/confirm`),
  cancelAction: (id: string) => post<ActionView>(`/actions/${id}/cancel`),
  submitFeedback: (
    traceId: string,
    rating: "UP" | "DOWN",
    reason?: "INACCURATE" | "MISSING_DETAIL" | "HARD_TO_UNDERSTAND" | "WRONG_SOURCE" | "OTHER",
  ) => post<{ traceId: string; rating: string; updated: boolean }>("/feedback", {
    traceId,
    rating,
    reason,
  }),

  // -------------------------------------------------------------------- kb ---
  kbDocuments: () => get<KbDocument[]>("/kb/documents"),
  kbStatistics: () => get<KbStatistics>("/kb/statistics"),
  kbQuality: () => get<KbQualityReport>("/kb/quality"),
  ingestionAttempts: () => get<IngestionAttempt[]>("/kb/ingestion-attempts?limit=25"),
  kbSearch: (query: string, categories?: string[]) =>
    post<SearchHit[]>("/kb/search", { query, categories }),
  ingestionJobs: () => get<IngestionJob[]>("/admin/ingestion-jobs"),
  operationsSummary: () => get<OperationsSummary>("/admin/operations/summary"),
  adminHealth: () => get<AdminHealth>("/admin/health/details"),
  feedbackStatistics: () => get<FeedbackStatistics>("/admin/feedback/statistics"),
  qualitySummary: () => get<QualitySummary>("/admin/quality/summary"),
  policyImpact: () => get<PolicyImpactSummary>("/kb/impact"),
  escalations: () => get<EscalationCase[]>("/admin/escalations"),
  resolveEscalation: (caseUuid: string, note: string) =>
    post<{ status: string }>(`/admin/escalations/${caseUuid}/resolve`, { note }),

  uploadKbDocument: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<IngestionResult>("/kb/ingest", { method: "POST", body: form });
  },

  // ----------------------------------------------------------------- audit ---
  auditTrail: (sessionId: string) => get<SessionTrail>(`/audit/${sessionId}`),
  operationalDecisions: (filters: {
    types?: OperationalDecisionType[];
    pnr?: string;
    from?: string;
    to?: string;
    outcome?: string;
  }) => post<OperationalDecisionView[]>("/audit/decisions/search", filters),
};

/**
 * Opens the SSE chat stream.
 *
 * `EventSource` cannot send a POST body or an Authorization header, so the
 * stream is read from a `fetch` response instead and parsed here. The framing is
 * small and well defined, and doing it this way keeps one authentication path
 * for every request in the app.
 */
export async function streamChat(
  message: string,
  sessionId: string,
  deepSearch: boolean,
  onEvent: (type: string, data: unknown) => void,
  signal?: AbortSignal,
): Promise<void> {
  const token = storedToken();
  const response = await fetch("/ai/airline/chat/async", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ message, sessionId, deepSearch }),
    signal,
  });

  if (!response.ok || !response.body) {
    throw new ApiError(response.status, "The assistant stream could not be opened.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by a blank line. Anything after the last blank
    // line is a partial frame and stays in the buffer for the next chunk.
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      let eventName = "message";
      const dataLines: string[] = [];

      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) eventName = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }

      if (dataLines.length === 0) continue;
      const raw = dataLines.join("\n");
      try {
        onEvent(eventName, JSON.parse(raw));
      } catch {
        onEvent(eventName, raw);
      }
    }
  }
}

/** Downloads a private PDF with the same bearer-token boundary as JSON APIs. */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const token = storedToken();
  const response = await fetch(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    throw new ApiError(response.status, "The document could not be downloaded.");
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
