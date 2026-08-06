/** Shapes returned by the backend. Mirrors the Java DTOs. */

export type RoleName = "PASSENGER" | "AIRLINE_STAFF" | "ADMIN";

export interface UserProfile {
  id: number;
  email: string;
  displayName: string;
  role: RoleName;
  roleDisplayName: string;
  readableAudiences: string[];
}

export interface LoginResponse {
  token: string;
  tokenType: string;
  expiresInSeconds: number;
  expiresAt: string;
  user: UserProfile;
}

export interface DemoUser {
  email: string;
  password: string;
  role: RoleName;
  displayName: string;
  description: string;
}

export interface Citation {
  handle: string;
  documentCode: string;
  documentTitle: string | null;
  section: string | null;
  page: number | null;
  category: string | null;
  relevance: number | null;
  excerpt: string;
  toolName: string | null;
  toolOperation?: string | null;
  provider?: string | null;
  providerLive?: boolean | null;
  retrievedAt: string | null;
}

export type AnswerStatus =
  | "CONVERSATIONAL"
  | "CLARIFICATION"
  | "OUT_OF_SCOPE"
  | "GROUNDED"
  | "TOOL_GROUNDED"
  | "EMPTY_CONTEXT"
  | "ESCALATED"
  | "ERROR";

export interface ChatResponse {
  answer: string;
  status: AnswerStatus;
  escalated: boolean;
  citations: Citation[];
  followups: string[];
  confidence: number | null;
  citationCoverage: number | null;
  repairAttempts: number;
  intent: string;
  lane: string;
  sessionId: string;
  traceId: string;
  aiMode: string;
  generationSource?:
    | "HOSTED_MODEL"
    | "GROUNDED_EXTRACTIVE"
    | "STRUCTURED_TOOL"
    | "DETERMINISTIC_CONVERSATION";
  degradedReason:
    | "MODEL_CAPACITY"
    | "RATE_LIMIT"
    | "UPSTREAM_UNAVAILABLE"
    | "OFFLINE_CONFIGURED"
    | "MODEL_CITATION_VALIDATION_FAILED"
    | null;
  operationalFailure?: {
    toolFamily: string;
    operation: string;
    code:
      | "UNSUPPORTED_AIRPORT"
      | "NO_ROUTE"
      | "NO_INVENTORY"
      | "NOT_FOUND"
      | "VALIDATION"
      | "UNAVAILABLE"
      | "UNAUTHORIZED";
    message: string;
    details: Record<string, unknown>;
  } | null;
  proposedAction?: ActionView | null;
  commerce?: CommercePayload | null;
  durationMs: number;
}

export interface RegisterInput {
  displayName: string;
  email: string;
  phone: string;
  password: string;
  passwordConfirmation: string;
}

/** A tool call as reported over the SSE stream. */
export interface ToolCall {
  toolName: string;
  success: boolean;
  summary: string;
  error: string;
  durationMs: number;
}

/** One stage of the pipeline, rendered live in the trace panel. */
export interface PipelineStage {
  type: string;
  label: string;
  detail?: string;
  at: number;
}

export interface EvidencePreview {
  handle: string;
  documentCode: string;
  documentTitle: string;
  section: string;
  page: number;
  relevance: number;
  excerpt: string;
  toolName?: string | null;
  toolOperation?: string | null;
  provider?: string | null;
  providerLive?: boolean | null;
  retrievedAt?: string | null;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  streaming?: boolean;
  stopped?: boolean;
  response?: ChatResponse;
  evidence?: EvidencePreview[];
  toolCalls?: ToolCall[];
  stages?: PipelineStage[];
  error?: string;
  createdAt?: string;
}

export interface OperationsSummary {
  departures: number;
  delayed: number;
  cancelled: number;
  openEscalations: Array<{ queue: string; count: number }>;
  fareRules: Array<{
    code: string;
    brand: string;
    cabin: string;
    changeable: boolean;
    refundable: boolean;
    changeFee: number;
    cancelFee: number;
    ffpAccrualPct: number;
  }>;
}

export interface FeedbackStatistics {
  total: number;
  up: number;
  down: number;
  helpfulRatio: number;
  byRoleAndDay: Array<{
    day: string;
    actorRole: string;
    up: number;
    down: number;
  }>;
}

export interface AdminHealth {
  database: string;
  aiMode: string;
  indexedPassages: number;
  documents: number;
  failedIngestions: number;
}

export interface QualitySummary {
  windowAnswers: number;
  hostedCompletions: number;
  rateLimitFallbacks: number;
  toolOnlyAnswers: number;
  fallbackRate: number;
  averageConfidence: number;
  averageCitationCoverage: number;
  averageDurationMs: number;
  escalations: number;
  validationRepairs: number;
}

export interface PolicyImpactSummary {
  documents: number;
  versionedDocuments: number;
  inactiveCitationCount: number;
  declaredFunctionalRequirements: string[];
  documentImpact: Array<{
    documentCode: string;
    servesFrs: string | null;
    versionCount: number;
  }>;
  authoritativeBoundaries: string[];
}

export interface KbQualityIssue {
  type:
    | "EMPTY_CONTENT"
    | "HEADER_ONLY"
    | "METADATA_ONLY"
    | "EXACT_DUPLICATE"
    | "MISSING_METADATA"
    | "MISSING_VECTOR"
    | "WRONG_VECTOR_DIMENSION";
  chunkId: number;
  versionId: number;
  documentCode: string;
  detail: string;
}

export interface KbRetrievalProbe {
  name: string;
  role: "PASSENGER" | "AIRLINE_STAFF" | "ADMIN";
  query: string;
  topRelevance: number;
  selectedDocumentCodes: string[];
  audienceViolation: boolean;
  evidenceCount: number;
}

export interface KbQualityReport {
  activeDocuments: number;
  activeChunks: number;
  expectedVectorDimensions: number;
  issueCounts: Record<KbQualityIssue["type"], number>;
  issues: KbQualityIssue[];
  probes: KbRetrievalProbe[];
  embeddingProvenance: Array<{
    documentCode: string;
    versionId: number;
    modelIdentifier: string | null;
    dimensions: number | null;
    generationSource: "HOSTED" | "DETERMINISTIC" | null;
    embeddedAt: string | null;
    contentChecksum: string | null;
  }>;
  inspectedAt: string;
}

export interface SessionView {
  sessionUuid: string;
  actorRole: string;
  title: string | null;
  createdAt: string;
  lastActivityAt: string;
  expired: boolean;
  messageCount: number;
}

export interface BookingContextView {
  flightNo: string;
  origin: string;
  destination: string;
  travelDate: string;
}

// ------------------------------------------------------------------- tools ---

export interface FareOption {
  fareId: number;
  fareClass: string;
  cabin: string;
  fareBrand: string;
  baseFare: number;
  taxes: number;
  totalFare: number;
  refundable: boolean;
  changeable: boolean;
  changeFee: number;
  cancelFee: number;
  checkedBaggageKg: number;
  cabinBaggageKg: number;
  seatsAvailable: number;
  ffpAccrualPct: number;
}

export interface Traveller {
  fullName: string;
  dateOfBirth: string;
  nationality: string;
}

export interface BookingContact {
  email: string;
  phone: string;
}

export interface BookingDraft {
  draftUuid: string;
  state: "COLLECTING" | "FLIGHTS_SHOWN" | "CHECKOUT" | "PAYMENT_PENDING" | "CONFIRMED";
  origin: string | null;
  destination: string | null;
  travelDate: string | null;
  cabin: string | null;
  flightInstanceId: number | null;
  fareId: number | null;
  seatNumber: string | null;
  traveller: Traveller | null;
  contact: BookingContact | null;
  version: number;
  expiresAt: string;
}

export interface AirportView {
  code: string;
  city: string;
  name: string;
  country: string;
  domestic: boolean;
}

export interface CommercePayload {
  type:
    | "BOOKING_DETAILS_REQUIRED"
    | "FLIGHT_OPTIONS"
    | "CHECKOUT_READY"
    | "OWNED_BOOKING_OPTIONS"
    | "CANCELLATION_QUOTE"
    | "TICKET_CONFIRMED";
  draft: BookingDraft | null;
  flights: FlightOption[];
  alternatives: AirportView[];
  detail: unknown;
}

export interface PaymentView {
  paymentUuid: string;
  status: "AUTHORIZED" | "CAPTURED" | "DECLINED" | "VOIDED" | "REFUNDED";
  method: "CARD" | "UPI";
  maskedAccount: string;
  providerReference: string | null;
  amount: number;
  createdAt: string;
  statusMessage: string;
}

export interface TicketView {
  pnr: string;
  ticketNumber: string | null;
  status: string;
  travellerName: string;
  dateOfBirth: string | null;
  nationality: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  flightNo: string;
  origin: string;
  destination: string;
  flightDate: string;
  departureTime: string;
  arrivalTime: string;
  terminal: string | null;
  gate: string | null;
  cabin: string;
  fareClass: string;
  fareBrand: string;
  seatNumber: string | null;
  checkedBaggageKg: number;
  cabinBaggageKg: number;
  baseFare: number;
  taxes: number;
  seatFee: number;
  totalPaid: number;
  paymentMethod: string;
  maskedPayment: string;
  paymentReference: string;
  issuedAt: string;
  cancelledAt: string | null;
  refundAmount: number | null;
}

export interface OwnedBookingView {
  pnr: string;
  ticketNumber: string | null;
  passengerName: string;
  status: string;
  flightNo: string;
  origin: string;
  destination: string;
  flightDate: string;
  seatNumber: string | null;
  cabin: string;
  fareBrand: string;
  amountPaid: number;
  bookedAt: string;
}

export interface FlightOption {
  flightInstanceId: number;
  flightNo: string;
  origin: string;
  originCity: string;
  destination: string;
  destinationCity: string;
  flightDate: string;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  aircraft: string;
  international: boolean;
  status: string;
  delayMinutes: number;
  terminal: string | null;
  gate: string | null;
  fares: FareOption[];
  mealAvailability?: MealAvailability | null;
}

export type OperationalDecisionType =
  | "REFUND_APPROVAL"
  | "UPGRADE_AUTHORIZATION"
  | "BOARDING_OVERRIDE"
  | "SPECIAL_SERVICE_EXCEPTION";

export interface OperationalDecisionView {
  decisionUuid: string;
  actionUuid: string | null;
  decisionType: OperationalDecisionType;
  outcome: string;
  actorUserId: number | null;
  actorRole: string;
  pnrDisplay: string | null;
  reason: string | null;
  sourcePolicyCode: string | null;
  sourcePolicySection: string | null;
  traceId: string | null;
  sessionUuid: string | null;
  detail: Record<string, unknown>;
  createdAt: string;
  decidedAt: string | null;
}

export interface IngestionAttempt {
  attemptUuid: string;
  sourceFilename: string;
  status: "STARTED" | "SUCCEEDED" | "FAILED";
  failurePhase: string | null;
  failureReason: string | null;
  chunksCreated: number;
  ingestionTimeMs: number | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface MealAvailability {
  flightNo: string;
  date: string;
  mealService: boolean;
  availableCodes: string[];
  orderDeadline: string | null;
}

export interface FlightSearchResult {
  origin: string;
  destination: string;
  departureDate: string;
  resultCount: number;
  flights: FlightOption[];
  retrievedAt: string;
}

export interface BookingView {
  pnr: string;
  passengerName: string;
  status: string;
  flightNo: string;
  origin: string;
  destination: string;
  flightDate: string;
  departureTime: string;
  arrivalTime: string;
  flightStatus: string;
  delayMinutes: number;
  terminal: string | null;
  gate: string | null;
  cabin: string;
  fareClass: string;
  fareBrand: string;
  refundable: boolean;
  changeable: boolean;
  changeFee: number;
  cancelFee: number;
  amountPaid: number;
  refundAmount: number | null;
  seatNumber: string | null;
  checkedBaggageKg: number;
  ffpTier: string | null;
  checkedIn: boolean;
  boardingGate: string | null;
  bookedAt: string;
}

export interface RefundQuote {
  pnr: string;
  fareBrand: string;
  refundable: boolean;
  hoursToDeparture: number;
  timingBand: string;
  amountPaid: number;
  cancellationFee: number;
  estimatedRefund: number;
  refundTimeline: string;
  basis: string;
}

export type RefundStatus =
  | "PENDING"
  | "PROCESSING"
  | "CONTACT_NEEDED"
  | "COMPLETED"
  | "FAILED";

export interface RefundHistoryView {
  fromStatus: RefundStatus | null;
  toStatus: RefundStatus;
  note: string | null;
  changedBy: string | null;
  changedAt: string;
}

export interface RefundCaseView {
  caseUuid: string;
  pnr: string;
  passengerUserId: number;
  passengerName: string;
  flightNo: string;
  origin: string;
  destination: string;
  flightDate: string;
  fareBrand: string;
  cancellationBasis: string;
  amountPaid: number;
  cancellationFee: number;
  refundAmount: number;
  paymentMethod: string | null;
  maskedPayment: string | null;
  dueAt: string;
  status: RefundStatus;
  callbackStatus: string | null;
  staffNote: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  history: RefundHistoryView[];
}

export interface FlightStatusView {
  flightNo: string;
  flightDate: string;
  origin: string;
  destination: string;
  status: string;
  delayMinutes: number;
  scheduledDeparture: string;
  estimatedDeparture: string;
  terminal: string | null;
  gate: string | null;
  belt: string | null;
}

export interface FlightNotificationSubscription {
  subscriptionUuid: string;
  flightNo: string;
  date: string;
  gate: string | null;
  terminal: string | null;
  active: boolean;
  createdAt: string;
}

export interface FlightChangeEvent {
  eventUuid: string;
  flightNo: string;
  date: string;
  previousGate: string | null;
  gate: string | null;
  previousTerminal: string | null;
  terminal: string | null;
  detectedAt: string;
}

export interface SeatOption {
  seatNumber: string;
  cabin: string;
  seatType: "WINDOW" | "AISLE" | "MIDDLE";
  extraLegroom: boolean;
  exitRow: boolean;
  feeInr: number;
  available: boolean;
}

export interface ActionView {
  actionUuid: string;
  type: string;
  status: string;
  pnr: string;
  summary: Record<string, unknown>;
  citations: Array<Record<string, string>> | null;
  result: Record<string, unknown> | null;
  createdAt: string;
  expiresAt: string | null;
  failureReason: string | null;
}

export interface ProposeActionInput {
  type: "CANCEL_BOOKING" | "RESCHEDULE_BOOKING" | "SEAT_CHANGE" | "CHECK_IN";
  pnr: string;
  sessionId: string;
  targetFlightInstanceId?: number;
  targetFareClass?: string;
  seatNumber?: string;
}

// --------------------------------------------------------------------- kb ---

export interface KbDocument {
  documentId: number;
  documentCode: string;
  title: string;
  activeVersionId: number | null;
  activeVersionLabel: string | null;
  status: string | null;
  fileType: string | null;
  category: string | null;
  audience: string | null;
  effectiveFrom: string | null;
  approvedBy: string | null;
  servesFrs: string | null;
  chunkCount: number;
  versionCount: number;
  createdAt: string;
}

export interface KbStatistics {
  documentCount: number;
  activeVersionCount: number;
  chunkCount: number;
  jobsSucceeded: number;
  jobsFailed: number;
  categories: string[];
  audiences: string[];
}

export interface IngestionJob {
  jobUuid: string;
  versionId: number;
  documentCode: string;
  sourceFilename: string;
  status: string;
  failureReason: string | null;
  chunksCreated: number;
  tokensEmbedded: number;
  ingestionTimeMs: number | null;
  triggeredByEmail: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface IngestionResult {
  documentId: number;
  versionId: number;
  jobUuid: string;
  documentCode: string;
  title: string;
  chunksCreated: number;
  ingestionTimeMs: number;
  metadata: Record<string, unknown>;
}

export interface EscalationCase {
  caseUuid: string;
  reason: string;
  targetQueue: string;
  priority: string;
  status: string;
  raisedBySystem: boolean;
  failedGates: string | null;
  confidence: number | null;
  summaryRedacted: string;
  createdAt: string;
}

export interface SearchHit {
  documentCode: string;
  documentTitle: string;
  section: string;
  page: number;
  category: string;
  audience: string;
  vectorScore: number | null;
  lexicalScore: number | null;
  relevance: number;
  rank: number;
  excerpt: string;
}

// ------------------------------------------------------------------ audit ---

export interface AuditEvidence {
  handle: string;
  documentCode: string;
  documentTitle: string;
  section: string;
  page: number | null;
  vectorScore: number | null;
  lexicalScore: number | null;
  fusedScore: number | null;
  rank: number;
  usedInAnswer: boolean;
  excerpt: string;
}

export interface AuditToolCall {
  toolName: string;
  status: string;
  dispatchPattern: string | null;
  attemptNo: number;
  durationMs: number | null;
  invokedAt: string;
  errorMessage: string | null;
}

export interface AuditValidation {
  attemptNo: number;
  verdict: string;
  failedGates: string | null;
  citationCoverage: number | null;
  confidence: number | null;
  triggeredRepair: boolean;
}

export interface AuditTurn {
  traceId: string;
  at: string;
  queryRedacted: string | null;
  queryRewritten: string | null;
  intent: string | null;
  lane: string | null;
  attempt: number;
  status: string;
  escalated: boolean;
  confidence: number | null;
  citationCoverage: number | null;
  repairAttempts: number;
  answerRedacted: string;
  citations: Citation[];
  modelName: string | null;
  aiMode: string | null;
  durationMs: number | null;
  degradedReason?: ChatResponse["degradedReason"];
  commerce?: CommercePayload | null;
  evidence: AuditEvidence[];
  toolCalls: AuditToolCall[];
  validations: AuditValidation[];
  followups: string[];
}

export interface SessionTrail {
  sessionUuid: string;
  actorRole: string;
  createdAt: string;
  lastActivityAt: string;
  expired: boolean;
  turns: AuditTurn[];
  escalations: EscalationCase[];
}
