# Ecorestore analysis — Python spatial analysis service and Tier 0 acquisition.
#
# One image, two entrypoints:
#   ecorestore-analysis-server   the per-request analysis service (default)
#   ecorestore-acquire           the batch job that regenerates the Tier 0 snapshot
#
# This container holds no keys and, in compose, sits on an internal-only
# network: it can reach neither Guardian nor any chain RPC. rasterio ships
# its own GDAL in the wheel, so the base image stays slim.
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl libexpat1 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first so source edits do not invalidate the wheel layer.
COPY pyproject.toml ./
RUN pip install $(python -c "import tomllib; print(' '.join(tomllib.load(open('pyproject.toml','rb'))['project']['dependencies']))")

COPY ecorestore_analysis ./ecorestore_analysis
RUN pip install --no-deps .

RUN useradd --create-home --uid 10001 analysis \
 && mkdir -p /out /cache && chmod 1777 /out /cache
USER analysis

EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD curl -fsS http://127.0.0.1:8000/health || exit 1

CMD ["ecorestore-analysis-server"]
