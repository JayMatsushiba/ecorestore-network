"""Ecorestore Network — spatial analysis service.

Implements the analysis side of the verify ⇄ analysis boundary
(``verification/analysis-contract.ts``): everything upstream of
canonicalisation. It returns numbers. It never hashes a document it produced,
never signs, and has no chain or Guardian access.

``ENGINE`` identifies this implementation in every result it contributes to.
"""

#: The engine identity carried in every result hash. Bump the version whenever
#: the numbers this package can return change — that includes a pin moving in
#: ``constraints.txt``, because a NumPy or SciPy build is part of what produces
#: a float and the acceptance test for this engine is equality, not closeness.
ENGINE = {"name": "ecorestore-analysis-py", "version": "1.0.0"}


def numeric_stack() -> dict[str, str]:
    """Resolved versions of the libraries the results actually depend on.

    Reported by ``GET /health`` so a stack that has drifted from
    ``constraints.txt`` is visible from outside the container rather than only
    when the parity suite is next run.
    """
    import numpy
    import scipy

    return {"numpy": numpy.__version__, "scipy": scipy.__version__}


#: Processing-graph version of the Python acquisition pipeline (``acquire.py``).
#: The TypeScript acquisition graph is ``1.0.0``; this one reads the same COGs
#: through rasterio and builds the sampling frame with h3 + shapely + pyproj.
PROCESSING_GRAPH_VERSION = "2.0.0"
