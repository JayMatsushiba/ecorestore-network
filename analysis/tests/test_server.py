from fastapi.testclient import TestClient

from ecorestore_analysis import ENGINE
from ecorestore_analysis.server import app

from conftest import load_case

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "engine": ENGINE}


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
