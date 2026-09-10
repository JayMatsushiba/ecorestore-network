import json

from fastapi.testclient import TestClient

from ecorestore_analysis import ENGINE, numeric_stack
from ecorestore_analysis.hashing import keccak256_hex
from ecorestore_analysis.server import app

from conftest import diff_paths, load_case

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "engine": ENGINE, "numericStack": numeric_stack()}


def test_analyse_real_case_matches_reference():
    req, expected = load_case("real")
    r = client.post("/analyse", json=req)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["planHash"] == req["planHash"]
    assert out["snapshotHash"] == req["snapshotHash"]
    assert out["interval"] == expected["interval"]
    assert out["controlSets"] == expected["controlSets"]
    assert out["engine"] == ENGINE


def test_bad_plan_receipt_is_rejected():
    req, _ = load_case("real")
    req["planHash"] = "0x" + "0" * 64
    r = client.post("/analyse", json=req)
    assert r.status_code == 422
    assert "receipt" in r.json()["detail"]


def test_tampered_snapshot_is_rejected():
    req, _ = load_case("real")
    req["tier0Canonical"] = req["tier0Canonical"].replace('"provenance":"REAL"', '"provenance":"SIMULATED"', 1)
    r = client.post("/analyse", json=req)
    assert r.status_code == 422


def test_analyse_body_is_exactly_the_contract_output():
    """The HTTP body carries the AnalysisOutput and nothing else.

    `test_parity` calls `analyse()` directly, so it cannot see fields the
    endpoint adds. Anything extra here — a timing, a hostname, a request id —
    would be an undeclared field on a boundary whose whole purpose is that
    `verify` can assemble a hashed document from what it receives.
    """
    req, expected = load_case("real")
    r = client.post("/analyse", json=req)
    assert r.status_code == 200, r.text
    body = r.json()
    assert set(body) == set(expected), f"body keys differ from the reference output: {set(body) ^ set(expected)}"
    # The engine identity is the one field that legitimately differs from a
    # reference dumped by the TypeScript engine.
    assert list(diff_paths(body, {**expected, "engine": ENGINE})) == []


def test_identical_requests_get_identical_bodies():
    """No wall clock in the response: the service is a pure function of the request."""
    req, _ = load_case("real")
    first = client.post("/analyse", json=req)
    second = client.post("/analyse", json=req)
    assert first.status_code == second.status_code == 200
    assert first.content == second.content
    # Timing is reported, just not in the body.
    assert "x-analysis-elapsed-seconds" in first.headers


def _reissue(req: dict, key: str, edit) -> dict:
    """Edit one canonical document and re-sign its receipt, so the request
    reaches the analysis rather than failing on the hash."""
    doc = json.loads(req[key])
    edit(doc)
    body = json.dumps(doc)
    return {**req, key: body, ("planHash" if key == "planCanonical" else "snapshotHash"): keccak256_hex(body.encode())}


def test_duplicate_pre_windows_are_a_422_not_a_500():
    req, _ = load_case("real")

    def dup(plan):
        plan["windows"]["pre"] = [plan["windows"]["pre"][0], {**plan["windows"]["pre"][0], "label": "again"}]

    r = client.post("/analyse", json=_reissue(req, "planCanonical", dup))
    assert r.status_code == 422, r.text
    assert "same mid-date" in r.json()["detail"]


def test_short_observation_arrays_are_a_422_not_a_500():
    req, _ = load_case("real")

    def truncate(t0):
        sid = next(iter(t0["observations"]))
        t0["observations"][sid]["ndvi"] = t0["observations"][sid]["ndvi"][:3]

    r = client.post("/analyse", json=_reissue(req, "tier0Canonical", truncate))
    assert r.status_code == 422, r.text
    assert "ndvi has 3 entries" in r.json()["detail"]
