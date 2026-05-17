FROM python:3.14.0-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

#Install popular libraries into an isolated venv
RUN python -m venv /venv
ENV PATH="/venv/bin:$PATH"

RUN pip install --no-cache-dir \
    numpy \
    pandas \
    matplotlib \
    scipy \
    scikit-learn \
    requests \
    pillow \
    sympy \
    pytest \
    flask

#Strip pip, setuptools, and wheel out of the venv entirely, inherits them but cant pip install
RUN pip uninstall -y pip setuptools wheel && \
    find /venv -name "pip*"        -exec rm -rf {} + 2>/dev/null || true && \
    find /venv -name "setuptools*" -exec rm -rf {} + 2>/dev/null || true && \
    find /venv -name "wheel*"      -exec rm -rf {} + 2>/dev/null || true && \
    find /venv -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

#Runtime
FROM python:3.14.0-slim

RUN echo 'export PS1="\[\033[0;35m\]alexide\[\033[0m\]:\[\033[0;34m\]\w\[\033[0m\]\$ "' >> /etc/bash.bashrc

#Copy the pre-built, pip-free venv from the builder stage
COPY --from=builder /venv /venv
ENV PATH="/venv/bin:$PATH" \
    VIRTUAL_ENV=/venv \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN useradd -r -s /bin/false -M sandbox

RUN mkdir -p /sandbox && chown sandbox:sandbox /sandbox

USER sandbox

WORKDIR /sandbox

CMD ["/bin/bash", "--login", "-i"]