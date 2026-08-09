# Fly.io runs containers, so this replaces the buildpack that Procfile and
# runtime.txt were written for. Python 3.11 to match runtime.txt and the CI job
# — the point of pinning the minor version is that a syntax or stdlib feature
# which works on the 3.13 installed locally cannot reach production untested.
FROM python:3.11-slim

# PYTHONUNBUFFERED matters more than it looks: without it the interpreter block-
# buffers stdout when it is a pipe rather than a terminal, so `fly logs` shows
# nothing until 8KB has accumulated. The failure that most needs a log line —
# a crash at startup — is exactly the one that never produces enough output.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Dependencies before source, so editing a Python file does not re-run pip.
# psycopg2-binary ships a manylinux wheel, so no build toolchain is needed here;
# switching to plain psycopg2 would mean adding gcc and libpq-dev.
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY alembic.ini .
COPY alembic/ alembic/
COPY app/ app/

# Nothing here needs root, and a container that never writes to its own
# filesystem should not be able to.
RUN useradd --create-home --uid 1000 api && chown -R api:api /app
USER api

EXPOSE 8080

# Migrations are NOT run here — see the header of Procfile for why. fly.toml
# runs them as a release_command, on a separate machine, before this starts.
#
# --proxy-headers so request.client.host is the visitor rather than Fly's edge.
# app/core/rate_limit.py reads X-Forwarded-For itself in production, but its
# fallback and every access log line go through request.client.
CMD ["uvicorn", "app.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8080", \
     "--proxy-headers", \
     "--forwarded-allow-ips", "*"]
