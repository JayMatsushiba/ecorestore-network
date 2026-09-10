import numpy as np

from ecorestore_analysis.jsnum import js_number_to_string, js_round, round4
from ecorestore_analysis.rng import Mulberry32, fnv1a32, stream

# Golden values from the TypeScript reference (`makeRng`, `hashId`, `Math.round`).
GOLDEN_SEED = 20260910
GOLDEN_FIRST = [0.30505175748839974, 0.5162448221817613, 0.6634593671187758]
GOLDEN_FNV = {"parcel": 329362192, "8a2b0c4e4d5ffff": 3605669047}


def test_scalar_matches_reference():
    rng = Mulberry32(GOLDEN_SEED)
    assert [rng() for _ in range(3)] == GOLDEN_FIRST


def test_stream_equals_scalar():
    rng = Mulberry32(GOLDEN_SEED)
    scalar = np.array([rng() for _ in range(5000)])
    assert np.array_equal(stream(GOLDEN_SEED, 5000), scalar)


def test_stream_xor_seed_paths():
    for seed in [GOLDEN_SEED ^ 0x5EED, (GOLDEN_SEED ^ fnv1a32("parcel")) & 0xFFFFFFFF, 0, 0xFFFFFFFF]:
        rng = Mulberry32(seed)
        assert np.array_equal(stream(seed, 100), np.array([rng() for _ in range(100)]))


def test_fnv1a32_golden():
    for k, v in GOLDEN_FNV.items():
        assert fnv1a32(k) == v


def test_js_round_ties_toward_positive_infinity():
    assert js_round(2.5) == 3
    assert js_round(-2.5) == -2
    assert js_round(0.49999999999999994) == 0
    assert round4(-0.02671234) == -0.0267
    assert round4(1.23445) == 1.2345 or round4(1.23445) == 1.2344  # binary representation decides, as in JS


def test_js_number_to_string():
    assert js_number_to_string(0.1) == "0.1"
    assert js_number_to_string(0.03) == "0.03"
    assert js_number_to_string(0.999) == "0.999"
    assert js_number_to_string(0.000001) == "0.000001"
    assert js_number_to_string(1e-7) == "1e-7"
    assert js_number_to_string(1500) == "1500"
    assert js_number_to_string(123.456) == "123.456"
    assert js_number_to_string(1.5e21) == "1.5e+21"
