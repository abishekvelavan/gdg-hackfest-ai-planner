FROM python:3.12-slim

# Install Node.js for MCP servers
RUN apt-get update && apt-get install -y nodejs npm && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-install MCP servers globally
RUN npm install -g @modelcontextprotocol/server-google-maps @suekou/mcp-notion-server

# Copy application
COPY . .

# Koyeb uses PORT env variable (default 8000)
EXPOSE 8000

CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}"]
