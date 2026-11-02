import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AccessCodeDialog, apiFetch, getAccessCode } from "@/lib/access";

const ok = () => new Response("{}", { status: 200 });
const unauthorized = () =>
  new Response(JSON.stringify({ error: "Access code required" }), { status: 401 });

describe("access code flow", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("does not open the dialog on mount", () => {
    render(<AccessCodeDialog />);
    expect(screen.queryByText("Enter demo access code")).toBeNull();
  });

  it("passes a non-401 response straight through without a dialog", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok());
    render(<AccessCodeDialog />);
    const res = await apiFetch("/api/public/speak", { method: "POST", body: "{}" });
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Enter demo access code")).toBeNull();
  });

  it("asks for the code on 401, stores it and retries once with the header", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(ok());
    render(<AccessCodeDialog />);
    const pending = apiFetch("/api/public/transcribe", { method: "POST", body: new FormData() });
    await waitFor(() =>
      expect(screen.getByText("This action needs the demo access code.")).toBeTruthy(),
    );
    fireEvent.change(screen.getByLabelText("Access code"), { target: { value: "secret" } });
    fireEvent.click(screen.getByText("Continue"));
    const res = await pending;
    expect(res.status).toBe(200);
    expect(getAccessCode()).toBe("secret");
    const retryHeaders = new Headers((fetchMock.mock.calls[1]?.[1] as RequestInit).headers);
    expect(retryHeaders.get("x-demo-code")).toBe("secret");
    await waitFor(() => expect(screen.queryByText("Enter demo access code")).toBeNull());
  });

  it("clears a rejected stored code and returns the 401 when the user cancels", async () => {
    localStorage.setItem("shiftbrief.accessCode", "stale");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(unauthorized());
    render(<AccessCodeDialog />);
    const pending = apiFetch("/api/public/brief", { method: "POST", body: "{}" });
    await waitFor(() => expect(screen.getByText("Access code not valid")).toBeTruthy());
    fireEvent.click(screen.getByText("Cancel"));
    const res = await pending;
    expect(res.status).toBe(401);
    expect(getAccessCode()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
