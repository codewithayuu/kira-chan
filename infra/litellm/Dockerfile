FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install LiteLLM
RUN pip install litellm[postgres]
RUN pip install redis

# Copy configuration
COPY litellm.config.yaml ./

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

# Start LiteLLM
CMD ["litellm", "--config", "litellm.config.yaml", "--port", "4000"]
