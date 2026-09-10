import gzip
import json
from pathlib import Path

import pytest

REFERENCE = Path(__file__).parent / "reference"
CASES = ["real", "synthetic", "trend-failure", "few-scenes", "few-controls"]


def load_case(name: str) -> tuple[dict, dict]:
    """(request with tier0Canonical inlined, expected output) for a reference case."""
    req = json.loads((REFERENCE / f"{name}.request.json").read_text())
    tier0_file = req.pop("tier0CanonicalFile")
    with gzip.open(REFERENCE / tier0_file, "rb") as f:
        req["tier0Canonical"] = f.read().decode("utf-8")
    expected = json.loads((REFERENCE / f"{name}.output.json").read_text())
    return req, expected


@pytest.fixture(params=CASES)
def case(request):
    return request.param, *load_case(request.param)


def diff_paths(a, b, path="$"):
    """Yield (path, a, b) for every leaf where the two JSON-like values differ."""
    if isinstance(a, dict) and isinstance(b, dict):
        for k in sorted(set(a) | set(b)):
            if k not in a or k not in b:
                yield f"{path}.{k}", a.get(k, "<missing>"), b.get(k, "<missing>")
            else:
                yield from diff_paths(a[k], b[k], f"{path}.{k}")
    elif isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            yield f"{path}.length", len(a), len(b)
        for i, (x, y) in enumerate(zip(a, b)):
            yield from diff_paths(x, y, f"{path}[{i}]")
    else:
        if isinstance(a, bool) or isinstance(b, bool):
            if a != b:
                yield path, a, b
        elif isinstance(a, (int, float)) and isinstance(b, (int, float)):
            if not (a == b):
                yield path, a, b
        elif a != b:
            yield path, a, b
