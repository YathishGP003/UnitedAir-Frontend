import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "../components/AppShell";
import type { ShellTab } from "../components/AppShell";
import ChatWorkspace from "../chat/ChatWorkspace";
import type { Starter } from "../chat/ChatWorkspace";
import { ActivityIcon, BookIcon, LayersIcon, ShieldIcon, SparkIcon } from "../components/Icons";
import EscalationQueue from "./EscalationQueue";
import AuditExplorer from "./AuditExplorer";
import OperationsDashboard from "./OperationsDashboard";
import RefundQueue from "./RefundQueue";

/**
 * Airline Staff operations, FR-016 to FR-030.
 *
 * <p>FR-030 requires Staff to be able to query the audit trail for refund approvals,
 * upgrade authorisations, boarding overrides and special-service exceptions. That is a
 * screen, not just an API, so it is one here.
 */
const TABS: ShellTab[] = [
  { to: "/staff", label: "Assistant", icon: <SparkIcon size={14} /> },
  { to: "/staff/operations", label: "Operations", icon: <ActivityIcon size={14} /> },
  { to: "/staff/refunds", label: "Refunds", icon: <BookIcon size={14} /> },
  { to: "/staff/escalations", label: "Escalations", icon: <ShieldIcon size={14} /> },
  { to: "/staff/audit", label: "Audit trail", icon: <LayersIcon size={14} /> },
];

const STARTERS: Starter[] = [
  {
    title: "Fare classes and revenue bands",
    prompt:
      "Explain the booking class codes Y, B, M, K and Q, their cabins and revenue bands.",
  },
  {
    title: "Crew duty limits",
    prompt: "What are the DGCA CAR-7 flight and duty time limitations and mandatory rest periods?",
  },
  {
    title: "Denied boarding",
    prompt:
      "What are the overbooking thresholds, waitlist priority rules and denied boarding compensation standards?",
  },
  {
    title: "Boarding override",
    prompt:
      "What is the procedure and approval authority for boarding a late passenger after gate closure?",
  },
  {
    title: "Mishandled baggage",
    prompt:
      "What are the WorldTracer claim SLAs, PIR filing requirements and Montreal Convention liability limits?",
  },
  {
    title: "Refund override",
    prompt: "How do I interpret the partial-refund calculation for a Value fare after a disruption?",
  },
];

export default function StaffWorkspace() {
  return (
    <AppShell tabs={TABS}>
      <Routes>
        <Route
          index
          element={
            <ChatWorkspace
              title="Operations and compliance"
              subtitle="Fare rules, refund overrides, special services, DGCA and IATA compliance and crew scheduling — grounded in the currently published Knowledge Base."
              starters={STARTERS}
            />
          }
        />
        <Route path="operations" element={<OperationsDashboard />} />
        <Route path="refunds" element={<RefundQueue />} />
        <Route path="escalations" element={<EscalationQueue />} />
        <Route path="audit" element={<AuditExplorer />} />
        <Route path="*" element={<Navigate to="/staff" replace />} />
      </Routes>
    </AppShell>
  );
}
