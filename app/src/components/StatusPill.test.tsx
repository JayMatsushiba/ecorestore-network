import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusPill } from "./StatusPill";

describe("StatusPill", () => {
  it("renders PASS with the ok tone", () => {
    render(<StatusPill status="PASS" />);
    const el = screen.getByText("PASS");
    expect(el.className).toContain("status-pill--ok");
  });

  it("renders INSUFFICIENT_EVIDENCE with the warn tone and readable text", () => {
    render(<StatusPill status="INSUFFICIENT_EVIDENCE" />);
    const el = screen.getByText("INSUFFICIENT EVIDENCE");
    expect(el.className).toContain("status-pill--warn");
  });

  it("renders FAILED with the danger tone", () => {
    render(<StatusPill status="FAILED" />);
    expect(screen.getByText("FAILED").className).toContain("status-pill--danger");
  });

  it("falls back to neutral for an unrecognized status rather than fabricating one", () => {
    render(<StatusPill status="SOME_FUTURE_STATUS" />);
    expect(screen.getByText("SOME FUTURE STATUS").className).toContain("status-pill--neutral");
  });
});
