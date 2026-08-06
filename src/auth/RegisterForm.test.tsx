import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RegisterForm from "./RegisterForm";

const register = vi.fn();

vi.mock("./AuthContext", () => ({
  useAuth: () => ({ register }),
}));

describe("RegisterForm", () => {
  it("validates confirmation and creates only a Passenger account", async () => {
    register.mockResolvedValue({
      id: 9,
      displayName: "Maya Singh",
      role: "PASSENGER",
    });
    const onSuccess = vi.fn();
    render(<RegisterForm onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "Maya Singh" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "maya@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Phone"), {
      target: { value: "+919000000000" },
    });
    fireEvent.change(screen.getByLabelText("Create password"), {
      target: { value: "SafeDemo!2026" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "SafeDemo!2026" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Passenger account" }));

    await waitFor(() =>
      expect(register).toHaveBeenCalledWith({
        displayName: "Maya Singh",
        email: "maya@example.com",
        phone: "+919000000000",
        password: "SafeDemo!2026",
        passwordConfirmation: "SafeDemo!2026",
      }),
    );
    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ role: "PASSENGER" }));
  });
});
