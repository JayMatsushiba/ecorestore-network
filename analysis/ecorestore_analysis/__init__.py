"""Ecorestore Network — spatial analysis service.

Implements the analysis side of the verify ⇄ analysis boundary
(``verification/analysis-contract.ts``): everything upstream of
canonicalisation. It returns numbers. It never hashes a document it produced,
never signs, and has no chain or Guardian access.

``ENGINE`` identifies this implementation in every result it contributes to.
"""

ENGINE = {"name": "ecorestore-analysis-py", "version": "1.0.0"}

#: Processing-graph version of the Python acquisition pipeline (``acquire.py``).
#: The TypeScript acquisition graph is ``1.0.0``; this one reads the same COGs
#: through rasterio and builds the sampling frame with h3 + shapely + pyproj.
PROCESSING_GRAPH_VERSION = "2.0.0"
