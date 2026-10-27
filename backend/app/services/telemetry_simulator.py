import random
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.models import Application
from app.services.telemetry_service import TelemetryService

SERVICES = ["order-api", "payment-gateway", "auth-service", "inventory-service", "notification-worker"]

class TelemetrySimulator:
    def __init__(self, db: Session):
        self.db = db
        self.telemetry = TelemetryService(db)

    def generate_heartbeat(self, app: Application):
        """Generates realistic normal baseline telemetry for all services."""
        now = datetime.now(timezone.utc)
        logs = []
        metrics = []
        spans = []

        for svc in SERVICES:
            # Baseline metrics
            rps = random.randint(40, 180)
            latency = random.uniform(15.0, 75.0)
            err_pct = random.uniform(0.0, 0.4)
            cpu = random.uniform(20.0, 55.0)

            metrics.append({"metric_name": "http_requests_total", "service_name": svc, "value": rps, "unit": "req/s"})
            metrics.append({"metric_name": "response_time_ms", "service_name": svc, "value": latency, "unit": "ms"})
            metrics.append({"metric_name": "error_rate_pct", "service_name": svc, "value": err_pct, "unit": "%"})
            metrics.append({"metric_name": "cpu_usage_pct", "service_name": svc, "value": cpu, "unit": "%"})

            # Baseline log
            if random.random() > 0.4:
                logs.append({
                    "service_name": svc,
                    "level": "INFO",
                    "message": f"Processed batch execution in {latency:.1f}ms (queue_depth=0, active_workers=8)",
                    "context_data": {"service": svc, "worker_id": f"pod-{svc}-7f6d9"}
                })

            # Normal trace
            trace_id = uuid.uuid4().hex
            span_id = uuid.uuid4().hex[:16]
            spans.append({
                "trace_id": trace_id,
                "span_id": span_id,
                "service_name": svc,
                "name": f"GET /api/v1/{svc.replace('-service', '').replace('-api', '')}/health",
                "duration_ms": latency,
                "status_code": "OK",
                "attributes": {"http.status_code": 200, "net.peer.ip": "10.0.4.12"}
            })

        self.telemetry.ingest_metrics(app, metrics)
        self.telemetry.ingest_logs(app, logs)
        self.telemetry.ingest_traces(app, spans)

    def trigger_scenario(self, app: Application, scenario_key: str) -> Dict[str, Any]:
        now = datetime.now(timezone.utc)
        trace_id = uuid.uuid4().hex
        root_span_id = uuid.uuid4().hex[:16]

        if scenario_key == "db_pool_timeout":
            svc = "payment-gateway"
            logs = [
                {
                    "service_name": svc,
                    "level": "WARN",
                    "message": "HikariPool-1 - Connection pool acquisition took 14200ms (> leakDetectionThreshold 2000ms)",
                    "trace_id": trace_id,
                    "span_id": root_span_id
                },
                {
                    "service_name": svc,
                    "level": "ERROR",
                    "message": "HikariPool-1 - Connection is not available, request timed out after 30002ms. SQLTransientConnectionException",
                    "trace_id": trace_id,
                    "span_id": root_span_id,
                    "context_data": {"active_connections": 10, "idle_connections": 0, "threads_awaiting": 38}
                },
                {
                    "service_name": svc,
                    "level": "FATAL",
                    "message": "TransactionSystemException: Could not commit JPA transaction; nested exception is org.hibernate.exception.JDBCConnectionException",
                    "trace_id": trace_id,
                    "span_id": root_span_id
                }
            ]
            metrics = [
                {"metric_name": "response_time_ms", "service_name": svc, "value": 30140.0, "unit": "ms"},
                {"metric_name": "error_rate_pct", "service_name": svc, "value": 84.5, "unit": "%"},
                {"metric_name": "db_connections_active", "service_name": svc, "value": 10.0, "unit": "count"},
                {"metric_name": "db_connections_idle", "service_name": svc, "value": 0.0, "unit": "count"}
            ]
            spans = [
                {
                    "trace_id": trace_id,
                    "span_id": root_span_id,
                    "service_name": svc,
                    "name": "POST /api/v1/payments/charge",
                    "duration_ms": 30150.0,
                    "status_code": "ERROR",
                    "status_message": "SQLTransientConnectionException: HikariPool-1 Connection timed out",
                    "attributes": {"http.status_code": 500, "db.system": "postgresql"}
                }
            ]

        elif scenario_key == "500_cascade":
            svc = "order-api"
            logs = [
                {
                    "service_name": svc,
                    "level": "ERROR",
                    "message": "NullPointerException: Cannot invoke 'com.incidentiq.domain.Customer.getId()' because 'customer' is null at OrderServiceImpl.java:142",
                    "trace_id": trace_id,
                    "span_id": root_span_id
                },
                {
                    "service_name": svc,
                    "level": "FATAL",
                    "message": "500 Internal Server Error response returned for 64 concurrent requests in pipeline order-process-worker",
                    "trace_id": trace_id,
                    "span_id": root_span_id
                }
            ]
            metrics = [
                {"metric_name": "error_rate_pct", "service_name": svc, "value": 68.2, "unit": "%"},
                {"metric_name": "http_5xx_count", "service_name": svc, "value": 85.0, "unit": "count"},
                {"metric_name": "response_time_ms", "service_name": svc, "value": 420.0, "unit": "ms"}
            ]
            spans = [
                {
                    "trace_id": trace_id,
                    "span_id": root_span_id,
                    "service_name": svc,
                    "name": "POST /api/v1/orders/checkout",
                    "duration_ms": 420.0,
                    "status_code": "ERROR",
                    "status_message": "NullPointerException at OrderServiceImpl.java:142",
                    "attributes": {"http.status_code": 500}
                }
            ]

        elif scenario_key == "memory_leak":
            svc = "inventory-service"
            logs = [
                {
                    "service_name": svc,
                    "level": "WARN",
                    "message": "JVM Garbage Collection pause duration reached 4250ms (Stop-The-World)",
                    "trace_id": trace_id,
                    "span_id": root_span_id
                },
                {
                    "service_name": svc,
                    "level": "FATAL",
                    "message": "java.lang.OutOfMemoryError: Java heap space. Dumping heap to /tmp/dump_20261027.hprof",
                    "trace_id": trace_id,
                    "span_id": root_span_id
                }
            ]
            metrics = [
                {"metric_name": "cpu_usage_pct", "service_name": svc, "value": 98.4, "unit": "%"},
                {"metric_name": "memory_usage_pct", "service_name": svc, "value": 99.2, "unit": "%"},
                {"metric_name": "response_time_ms", "service_name": svc, "value": 5400.0, "unit": "ms"},
                {"metric_name": "error_rate_pct", "service_name": svc, "value": 92.0, "unit": "%"}
            ]
            spans = [
                {
                    "trace_id": trace_id,
                    "span_id": root_span_id,
                    "service_name": svc,
                    "name": "POST /api/v1/inventory/sync-batch",
                    "duration_ms": 5400.0,
                    "status_code": "ERROR",
                    "status_message": "OutOfMemoryError: Java heap space",
                    "attributes": {"http.status_code": 503}
                }
            ]

        elif scenario_key == "auth_latency":
            svc = "auth-service"
            logs = [
                {
                    "service_name": svc,
                    "level": "WARN",
                    "message": "Token verification JWKS downstream connection timeout: https://idp.internal/oauth/certs (socket timeout: 3000ms)",
                    "trace_id": trace_id,
                    "span_id": root_span_id
                },
                {
                    "service_name": svc,
                    "level": "ERROR",
                    "message": "Thread pool saturation: activeThreads=128 (max=128), queuedTasks=420. Latency spike above threshold.",
                    "trace_id": trace_id,
                    "span_id": root_span_id
                }
            ]
            metrics = [
                {"metric_name": "response_time_ms", "service_name": svc, "value": 4600.0, "unit": "ms"},
                {"metric_name": "error_rate_pct", "service_name": svc, "value": 24.5, "unit": "%"},
                {"metric_name": "cpu_usage_pct", "service_name": svc, "value": 88.0, "unit": "%"}
            ]
            spans = [
                {
                    "trace_id": trace_id,
                    "span_id": root_span_id,
                    "service_name": svc,
                    "name": "POST /api/v1/auth/introspect",
                    "duration_ms": 4600.0,
                    "status_code": "ERROR",
                    "status_message": "SocketTimeoutException reading from IDP JWKS endpoint",
                    "attributes": {"http.status_code": 504}
                }
            ]

        else:  # partner_503
            svc = "notification-worker"
            logs = [
                {
                    "service_name": svc,
                    "level": "ERROR",
                    "message": "Downstream SMS Gateway returned 503 Service Unavailable: Backoff retry exhausted after 5 attempts",
                    "trace_id": trace_id,
                    "span_id": root_span_id
                }
            ]
            metrics = [
                {"metric_name": "error_rate_pct", "service_name": svc, "value": 100.0, "unit": "%"},
                {"metric_name": "response_time_ms", "service_name": svc, "value": 2200.0, "unit": "ms"}
            ]
            spans = [
                {
                    "trace_id": trace_id,
                    "span_id": root_span_id,
                    "service_name": svc,
                    "name": "POST /queue/notifications/dispatch",
                    "duration_ms": 2200.0,
                    "status_code": "ERROR",
                    "status_message": "Downstream 503 Service Unavailable",
                    "attributes": {"http.status_code": 503}
                }
            ]

        self.telemetry.ingest_logs(app, logs)
        self.telemetry.ingest_metrics(app, metrics)
        self.telemetry.ingest_traces(app, spans)

        return {
            "scenario": scenario_key,
            "service": svc,
            "trace_id": trace_id,
            "logs_injected": len(logs),
            "metrics_injected": len(metrics),
            "spans_injected": len(spans),
            "message": f"Successfully simulated incident scenario '{scenario_key}' on {svc}. Detection engine evaluated in real time."
        }
