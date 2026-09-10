"""`constraints.txt` is what the image installs; it must agree with `pyproject.toml`.

The pins themselves are validated by running the parity suite inside the image.
What is checked here is cheaper and catches an editing mistake: every dependency
the project declares is pinned, and no pin sits below the minimum the project
says it needs.
"""

import re
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _version_tuple(v: str) -> tuple[int, ...]:
    return tuple(int(p) for p in re.findall(r"\d+", v)[:3])


def _constraints() -> dict[str, str]:
    pins = {}
    for line in (ROOT / "constraints.txt").read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        name, _, version = line.partition("==")
        pins[name.strip().lower().replace("_", "-")] = version.strip()
    return pins


def _declared() -> dict[str, str]:
    project = tomllib.loads((ROOT / "pyproject.toml").read_text())["project"]
    out = {}
    for spec in project["dependencies"]:
        m = re.match(r"^([A-Za-z0-9_.\-]+)(?:\[[^\]]*\])?\s*>=\s*([0-9.]+)", spec)
        assert m, f"dependency {spec!r} is not a `name>=version` spec; update this test"
        out[m.group(1).lower().replace("_", "-")] = m.group(2)
    return out


def test_every_declared_dependency_is_pinned():
    missing = sorted(set(_declared()) - set(_constraints()))
    assert not missing, f"declared in pyproject.toml but unpinned in constraints.txt: {missing}"


def test_no_pin_is_below_the_declared_minimum():
    pins, declared = _constraints(), _declared()
    below = {
        name: (pins[name], minimum)
        for name, minimum in declared.items()
        if _version_tuple(pins[name]) < _version_tuple(minimum)
    }
    assert not below, f"pinned below the declared minimum: {below}"
