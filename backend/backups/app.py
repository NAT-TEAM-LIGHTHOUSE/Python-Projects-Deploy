import uvicorn
from src.main import app
from src.configure import main_logger, debug_logger
from fastapi import Response
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST, Counter, CollectorRegistry, Histogram, Gauge

# Prometheus metrics setup
registry = CollectorRegistry()
REQUEST_COUNT = Counter(
    "app_request_count",
    "Total number of HTTP requests",
    ["method", "endpoint", "http_status"],
    registry=registry
)
REQUEST_LATENCY = Histogram(
    "app_request_latency_seconds",
    "Request latency",
    ["endpoint"],
    registry=registry
)
IN_PROGRESS = Gauge(
    "app_inprogress_requests",
    "Number of in-progress requests",
    registry=registry
)

# Prometheus metrics middleware
@app.middleware("http")
async def prometheus_metrics_middleware(request, call_next):
    IN_PROGRESS.inc()
    endpoint = request.url.path
    method = request.method
    with REQUEST_LATENCY.labels(endpoint=endpoint).time():
        response = await call_next(request)
    status_code = response.status_code
    REQUEST_COUNT.labels(method=method, endpoint=endpoint, http_status=status_code).inc()
    IN_PROGRESS.dec()
    return response

# /metrics endpoint for Prometheus
@app.get("/table_gpt/metrics")
def metrics():
    data = generate_latest(registry)
    return Response(data, media_type=CONTENT_TYPE_LATEST)

if __name__ == "__main__":
    main_logger.info("Starting FastAPI app")
    if debug_logger:
        debug_logger.debug("Starting FastAPI app")
    uvicorn.run(app, host='0.0.0.0', port=5010, log_level="debug")