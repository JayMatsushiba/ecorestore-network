"""HTTP surface of the analysis service.

    GET  /health   → {"status": "ok", "engine": {...}, "numericStack": {...}}
    POST /analyse  → AnalysisOutput

The request carries the plan and the Tier 0 snapshot as canonical strings with
hash receipts. Each receipt is checked by hashing the raw string; the string is
then parsed and never re-encoded. A failed receipt is a 422 — the run fails
loudly rather than producing numbers bound to evidence that was not analysed.

The body of a `200` is exactly the `AnalysisOutput` of the boundary contract
(``verification/analysis-contract.ts``) and nothing else: two identical requests
get byte-identical bodies. Timing is a wall-clock measurement, not a result, so
it goes in the `x-analysis-elapsed-seconds` header where it cannot reach a
caller assembling a document to be hashed.
"""

from __future__ import annotations

import json
import os
import time

from fastapi import FastAPI, HTTPException, Response
from pydantic import BaseModel, Field

from . import ENGINE, numeric_stack
from .hashing import ReceiptMismatch, check_receipt
from .pipeline import analyse

app = FastAPI(title="Ecorestore analysis", version=ENGINE["version"], docs_url=None, redoc_url=None)


class AnalysisRequest(BaseModel):
    planCanonical: str = Field(min_length=2)
    planHash: str = Field(pattern=r"^0x[0-9a-fA-F]{64}$")
    tier0Canonical: str = Field(min_length=2)
    snapshotHash: str = Field(pattern=r"^0x[0-9a-fA-F]{64}$")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "engine": ENGINE, "numericStack": numeric_stack()}


@app.post("/analyse")
def analyse_endpoint(req: AnalysisRequest, response: Response) -> dict:
    try:
        check_receipt("plan", req.planCanonical, req.planHash)
        check_receipt("tier0 snapshot", req.tier0Canonical, req.snapshotHash)
    except ReceiptMismatch as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    try:
        plan = json.loads(req.planCanonical)
        t0 = json.loads(req.tier0Canonical)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=422, detail=f"canonical document is not JSON: {e}") from e
    started = time.perf_counter()
    try:
        out = analyse(plan, t0, plan_hash=req.planHash.lower(), snapshot_hash=req.snapshotHash.lower())
    except (KeyError, IndexError, AttributeError, TypeError, ValueError, ArithmeticError) as e:
        # A document that passed its receipt but cannot be analysed is the
        # caller's problem, not a crash: say what is wrong and answer 422.
        raise HTTPException(status_code=422, detail=f"analysis failed: {e}") from e
    response.headers["x-analysis-elapsed-seconds"] = f"{time.perf_counter() - started:.3f}"
    return out


def main() -> None:
    import uvicorn

    uvicorn.run(app, host=os.environ.get("ANALYSIS_HOST", "0.0.0.0"), port=int(os.environ.get("ANALYSIS_PORT", "8000")), log_level="info")


if __name__ == "__main__":
    main()
