"""The Python analysis must reproduce the TypeScript reference exactly.

The reference dumps come from `npx tsx scripts/dump-analysis-reference.ts` at
the repository root. Every number is compared for equality, not closeness:
the two implementations are meant to be interchangeable behind the same
result hash.
"""

import json

from ecorestore_analysis import ENGINE
from ecorestore_analysis.hashing import check_receipt
from ecorestore_analysis.pipeline import analyse

from conftest import diff_paths


def test_receipts_verify(case):
    _, req, _ = case
    check_receipt("plan", req["planCanonical"], req["planHash"])
    check_receipt("tier0", req["tier0Canonical"], req["snapshotHash"])


def test_parity_with_typescript_reference(case):
    name, req, expected = case
    plan = json.loads(req["planCanonical"])
    t0 = json.loads(req["tier0Canonical"])
    out = analyse(plan, t0, plan_hash=req["planHash"], snapshot_hash=req["snapshotHash"])
    assert out["engine"] == ENGINE
    # The engine identity is the one field that legitimately differs.
    expected = {**expected, "engine": ENGINE}
    diffs = list(diff_paths(expected, out))
    assert not diffs, f"{name}: {len(diffs)} difference(s):\n" + "\n".join(f"  {p}: ts={a!r} py={b!r}" for p, a, b in diffs[:40])


def test_output_has_no_nan(case):
    name, req, _ = case
    out = analyse(json.loads(req["planCanonical"]), json.loads(req["tier0Canonical"]), plan_hash=req["planHash"], snapshot_hash=req["snapshotHash"])
    encoded = json.dumps(out, allow_nan=False)  # raises on NaN/Infinity
    assert "NaN" not in encoded
