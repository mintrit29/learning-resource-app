FROM docker.io/library/python:3.11-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV HF_HOME=/app/models-cache
ARG TORCH_INDEX_URL=https://download.pytorch.org/whl/cpu
ARG TORCH_VERSION=2.6.0

COPY requirements.txt .
RUN pip install --no-cache-dir --index-url "${TORCH_INDEX_URL}" "torch==${TORCH_VERSION}"
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
RUN mkdir -p /app/models-cache

EXPOSE 8001
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
