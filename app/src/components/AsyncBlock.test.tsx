import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AsyncBlock } from "./AsyncBlock";

describe("AsyncBlock", () => {
  it("shows a subsystem-specific loading message", () => {
    render(
      <AsyncBlock state={{ status: "loading" }} subsystem="Verification">
        {() => <div>never rendered</div>}
      </AsyncBlock>,
    );
    expect(screen.getByText(/Loading Verification/)).toBeInTheDocument();
  });

  it("shows a subsystem-specific error message, not a generic one", () => {
    render(
      <AsyncBlock state={{ status: "error", error: "connection refused" }} subsystem="Local Graph endpoint">
        {() => <div>never rendered</div>}
      </AsyncBlock>,
    );
    expect(screen.getByText(/Local Graph endpoint unavailable/)).toBeInTheDocument();
    expect(screen.getByText(/connection refused/)).toBeInTheDocument();
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });

  it("renders the child function with the real data once loaded", () => {
    render(
      <AsyncBlock state={{ status: "ok", data: { value: 42 } }} subsystem="Verification">
        {(data) => <div>value is {data.value}</div>}
      </AsyncBlock>,
    );
    expect(screen.getByText("value is 42")).toBeInTheDocument();
  });
});
