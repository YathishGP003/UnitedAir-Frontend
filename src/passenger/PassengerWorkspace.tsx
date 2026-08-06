import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "../components/AppShell";
import type { ShellTab } from "../components/AppShell";
import ChatWorkspace from "../chat/ChatWorkspace";
import type { Starter } from "../chat/ChatWorkspace";
import { ActivityIcon, BookIcon, SearchIcon, SparkIcon, ToolIcon } from "../components/Icons";
import BookingPanel from "./BookingPanel";
import FlightSearchPanel from "./FlightSearchPanel";
import FlightStatusPanel from "./FlightStatusPanel";
import BaggageCalculator from "./BaggageCalculator";

/**
 * Passenger self-service, FR-001 to FR-015.
 *
 * <p>The journey is split the way SRS 6 groups it — US-01 booking, US-02 check-in and
 * status, US-04 refunds — so the structured screens do what forms do well and the
 * assistant does what policy questions need.
 */
const TABS: ShellTab[] = [
  { to: "/passenger", label: "Assistant", icon: <SparkIcon size={14} /> },
  { to: "/passenger/search", label: "Find a flight", icon: <SearchIcon size={14} /> },
  { to: "/passenger/bookings", label: "My bookings", icon: <BookIcon size={14} /> },
  { to: "/passenger/status", label: "Flight status", icon: <ActivityIcon size={14} /> },
  { to: "/passenger/baggage", label: "Baggage", icon: <ToolIcon size={14} /> },
];

const STARTERS: Starter[] = [
  {
    title: "Baggage allowance",
    prompt: "What is the cabin and checked baggage allowance on a domestic Economy ticket?",
  },
  {
    title: "Cancellation and refund",
    prompt:
      "If I cancel a Value fare more than 7 days before departure, what fee applies and how much do I get back?",
  },
  {
    title: "Check-in and documents",
    prompt: "When does check-in open, and what identification do I need for a domestic flight?",
  },
  {
    title: "Special assistance",
    prompt: "How do I request wheelchair assistance, and how far in advance must I ask?",
  },
  {
    title: "Seat selection",
    prompt: "What seat types are available and what do they cost on a domestic flight?",
  },
  {
    title: "Frequent flyer",
    prompt: "How do I earn and redeem points, and how do the tiers work?",
  },
];

export default function PassengerWorkspace() {
  return (
    <AppShell tabs={TABS}>
      <Routes>
        <Route
          index
          element={
            <ChatWorkspace
              title="How can I help with your journey?"
              subtitle="Ask about baggage, refunds, check-in, seats or special assistance. Every answer cites the UnitedAir policy behind it."
              starters={STARTERS}
            />
          }
        />
        <Route path="search" element={<FlightSearchPanel />} />
        <Route path="bookings" element={<BookingPanel />} />
        <Route path="status" element={<FlightStatusPanel />} />
        <Route path="baggage" element={<BaggageCalculator />} />
        <Route path="*" element={<Navigate to="/passenger" replace />} />
      </Routes>
    </AppShell>
  );
}
