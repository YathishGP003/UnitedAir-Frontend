import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "./LoginPage";

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  demoUsers: vi.fn(),
}));

vi.mock("./AuthContext", () => ({
  useAuth: () => ({
    signIn: mocks.signIn,
    homeFor: () => "/passenger",
  }),
}));

vi.mock("../api/client", () => ({
  api: {
    demoUsers: mocks.demoUsers,
  },
}));

describe("LoginPage demo roles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.demoUsers.mockResolvedValue([
      {
        email: "passenger@unitedair.demo",
        password: "Demo!2026",
        role: "PASSENGER",
        displayName: "Ananya Rao",
        description: "Passenger self-service",
      },
    ]);
    mocks.signIn.mockResolvedValue({
      role: "PASSENGER",
    });
  });

  it("fills credentials from a role card and waits for the user to sign in", async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    const roleCard = await screen.findByRole("button", { name: /passenger demo/i });
    fireEvent.click(roleCard);

    expect(screen.getByLabelText("Email")).toHaveValue("passenger@unitedair.demo");
    expect(screen.getByLabelText("Password")).toHaveValue("Demo!2026");
    expect(mocks.signIn).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /continue to unitedair ai/i }));
    await waitFor(() =>
      expect(mocks.signIn).toHaveBeenCalledWith("passenger@unitedair.demo", "Demo!2026"),
    );
  });

  it("shows one demonstration card per role when multiple accounts share a role", async () => {
    mocks.demoUsers.mockResolvedValue([
      {
        email: "passenger@unitedair.demo",
        password: "Demo!2026",
        role: "PASSENGER",
        displayName: "Ananya Rao",
        description: "Passenger self-service",
      },
      {
        email: "arjun@unitedair.demo",
        password: "Demo!2026",
        role: "PASSENGER",
        displayName: "Arjun Mehta",
        description: "Passenger self-service",
      },
      {
        email: "staff@unitedair.demo",
        password: "Demo!2026",
        role: "AIRLINE_STAFF",
        displayName: "Vikram Menon",
        description: "Operations",
      },
    ]);

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(await screen.findAllByRole("button", { name: /passenger demo/i })).toHaveLength(1);
    expect(screen.getByRole("button", { name: /airline staff demo/i })).toBeInTheDocument();
  });

  it("lets the Passenger role choose either demo identity before sign-in", async () => {
    mocks.demoUsers.mockResolvedValue([
      {
        email: "passenger@unitedair.demo",
        password: "Demo!2026",
        role: "PASSENGER",
        displayName: "Ananya Rao",
        description: "Passenger self-service",
      },
      {
        email: "passenger2@unitedair.demo",
        password: "Demo!2026",
        role: "PASSENGER",
        displayName: "Arjun Mehta",
        description: "Passenger self-service",
      },
    ]);

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /passenger demo/i }));
    expect(screen.getByLabelText("Passenger demo accounts")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /arjun mehta/i }));

    expect(screen.getByLabelText("Email")).toHaveValue("passenger2@unitedair.demo");
    expect(screen.getByLabelText("Password")).toHaveValue("Demo!2026");
  });
});
