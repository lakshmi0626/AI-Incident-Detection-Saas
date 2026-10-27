import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from app.database import SessionLocal, Base, engine
from app.models import (
    User, Organization, OrganizationMember, Application, Service,
    DetectionRule, Incident, IncidentEvent, AIAnalysis, IncidentComment,
    Notification, NotificationChannel, SubscriptionPlan, OrganizationSubscription,
    UsageRecord, RetentionPolicy, AuditLog, LogEntry, MetricEntry, TraceSpan
)
from app.security import hash_password, generate_api_key

def seed_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Check if already seeded
    if db.query(User).filter(User.email == "admin@incidentiq.io").first():
        print("Database already contains seed data.")
        db.close()
        return

    print("Seeding IncidentIQ with realistic commercial SaaS datasets...")
    now = datetime.now(timezone.utc)

    # 1. Subscription Plans
    plans = [
        SubscriptionPlan(
            tier="free",
            name="Free Tier",
            max_apps=2,
            max_monthly_events=25000,
            max_ai_investigations_monthly=10,
            retention_days=7,
            price_usd_monthly=0.0,
            features=["2 Monitored Applications", "10 AI Investigations/mo", "7 Days Data Retention", "Email Alerts"]
        ),
        SubscriptionPlan(
            tier="starter",
            name="Starter Tier",
            max_apps=5,
            max_monthly_events=100000,
            max_ai_investigations_monthly=50,
            retention_days=30,
            price_usd_monthly=79.0,
            features=["5 Monitored Applications", "50 AI Investigations/mo", "30 Days Data Retention", "Slack & Teams Webhooks", "Automated Deduplication"]
        ),
        SubscriptionPlan(
            tier="team",
            name="Team Tier",
            max_apps=15,
            max_monthly_events=500000,
            max_ai_investigations_monthly=250,
            retention_days=90,
            price_usd_monthly=249.0,
            features=["15 Monitored Applications", "250 AI Investigations/mo", "90 Days Data Retention", "Custom Detection Rules", "SLA Incident Timelines", "Full RBAC"]
        ),
        SubscriptionPlan(
            tier="business",
            name="Enterprise Business",
            max_apps=100,
            max_monthly_events=5000000,
            max_ai_investigations_monthly=1500,
            retention_days=365,
            price_usd_monthly=899.0,
            features=["Unlimited Applications", "1500 AI Investigations/mo", "1 Year Data Retention", "OpenTelemetry Native Collector", "Dedicated SRE AI Agent"]
        )
    ]
    for p in plans:
        db.add(p)
    db.commit()

    # 2. Users
    pwd_hash = hash_password("IncidentIQ@2026!")

    admin_user = User(
        email="admin@incidentiq.io",
        full_name="Sarah Connor",
        hashed_password=pwd_hash,
        is_active=True,
        is_superuser=True
    )
    engineer_user = User(
        email="engineer@incidentiq.io",
        full_name="Alex Mercer",
        hashed_password=pwd_hash,
        is_active=True,
        is_superuser=False
    )
    viewer_user = User(
        email="viewer@incidentiq.io",
        full_name="Morgan Vance",
        hashed_password=pwd_hash,
        is_active=True,
        is_superuser=False
    )
    db.add_all([admin_user, engineer_user, viewer_user])
    db.commit()
    db.refresh(admin_user)
    db.refresh(engineer_user)
    db.refresh(viewer_user)

    # 3. Primary Organization: Acme Financial Cloud
    org_acme = Organization(
        name="Acme Financial Cloud",
        slug="acme-financial",
        plan_tier="team",
        settings_json={"timezone": "UTC", "slack_notifications": True, "alert_email": "alerts@acme.internal"}
    )
    # Secondary Organization: Apex Cloud Systems (Multi-tenant test)
    org_apex = Organization(
        name="Apex Cloud Systems",
        slug="apex-cloud",
        plan_tier="starter",
        settings_json={"timezone": "America/New_York"}
    )
    db.add_all([org_acme, org_apex])
    db.commit()
    db.refresh(org_acme)
    db.refresh(org_apex)

    # Memberships
    db.add_all([
        OrganizationMember(organization_id=org_acme.id, user_id=admin_user.id, role="owner"),
        OrganizationMember(organization_id=org_acme.id, user_id=engineer_user.id, role="engineer"),
        OrganizationMember(organization_id=org_acme.id, user_id=viewer_user.id, role="viewer"),
        OrganizationMember(organization_id=org_apex.id, user_id=admin_user.id, role="admin"),
    ])

    # Subscriptions & Policies
    db.add_all([
        OrganizationSubscription(organization_id=org_acme.id, plan_tier="team", status="active"),
        RetentionPolicy(organization_id=org_acme.id, logs_retention_days=90, metrics_retention_days=90, traces_retention_days=30, auto_clean_enabled=True),
        UsageRecord(organization_id=org_acme.id, period_ym=now.strftime("%Y-%m"), events_ingested=24800, ai_investigations_used=6, apps_count=2),

        OrganizationSubscription(organization_id=org_apex.id, plan_tier="starter", status="active"),
        RetentionPolicy(organization_id=org_apex.id, logs_retention_days=30, metrics_retention_days=60, traces_retention_days=14, auto_clean_enabled=True),
        UsageRecord(organization_id=org_apex.id, period_ym=now.strftime("%Y-%m"), events_ingested=4200, ai_investigations_used=1, apps_count=1),
    ])
    db.commit()

    # 4. Applications for Acme
    _, key_hash1, pfx1 = generate_api_key()
    app_payment = Application(
        organization_id=org_acme.id,
        name="Payment Processing Engine",
        slug="payment-processing-engine",
        description="Core multi-currency transaction and checkout settlement gateway",
        api_key_hash=key_hash1,
        api_key_prefix=pfx1,
        environments_json=["production", "staging", "qa"],
        status="critical"
    )

    _, key_hash2, pfx2 = generate_api_key()
    app_banking = Application(
        organization_id=org_acme.id,
        name="Core Banking API",
        slug="core-banking-api",
        description="Customer account ledger, balance sync, and OAuth microservices",
        api_key_hash=key_hash2,
        api_key_prefix=pfx2,
        environments_json=["production", "staging"],
        status="active"
    )
    db.add_all([app_payment, app_banking])
    db.commit()
    db.refresh(app_payment)
    db.refresh(app_banking)

    # Services
    svcs = [
        Service(application_id=app_payment.id, name="payment-gateway", language="java", tier="backend", health_status="failing"),
        Service(application_id=app_payment.id, name="order-api", language="java", tier="api-gateway", health_status="degraded"),
        Service(application_id=app_payment.id, name="inventory-service", language="python", tier="backend", health_status="healthy"),
        Service(application_id=app_payment.id, name="notification-worker", language="node", tier="queue", health_status="healthy"),
        Service(application_id=app_banking.id, name="auth-service", language="go", tier="backend", health_status="healthy"),
        Service(application_id=app_banking.id, name="ledger-sync", language="python", tier="backend", health_status="healthy"),
    ]
    db.add_all(svcs)

    # 5. Detection Rules for Acme
    rules = [
        DetectionRule(
            organization_id=org_acme.id,
            application_id=app_payment.id,
            name="High API Error Rate Alert",
            rule_type="error_rate",
            severity="High",
            metric_target="error_rate_pct",
            threshold_value=5.0,
            evaluation_window_seconds=60,
            cooldown_seconds=300
        ),
        DetectionRule(
            organization_id=org_acme.id,
            application_id=app_payment.id,
            name="Severe Latency Degradation (>1500ms)",
            rule_type="latency",
            severity="High",
            metric_target="response_time_ms",
            threshold_value=1500.0,
            evaluation_window_seconds=60,
            cooldown_seconds=300
        ),
        DetectionRule(
            organization_id=org_acme.id,
            application_id=app_payment.id,
            name="HikariCP Pool Starvation",
            rule_type="db_timeout",
            severity="Critical",
            metric_target="response_time_ms",
            threshold_value=25000.0,
            evaluation_window_seconds=30,
            cooldown_seconds=600
        ),
        DetectionRule(
            organization_id=org_acme.id,
            application_id=None,
            name="JVM OutOfMemory & Fatal Crashes",
            rule_type="crash",
            severity="Critical",
            metric_target="cpu_usage_pct",
            threshold_value=95.0,
            evaluation_window_seconds=60,
            cooldown_seconds=600
        )
    ]
    db.add_all(rules)
    db.commit()

    # 6. Notification Channels
    channels = [
        NotificationChannel(
            organization_id=org_acme.id,
            channel_type="slack",
            name="#incident-war-room",
            config={"webhook_url": "https://hooks.slack.com/services/T000/B000/SimulatedWarRoomWebhook"},
            is_active=True
        ),
        NotificationChannel(
            organization_id=org_acme.id,
            channel_type="teams",
            name="SRE Alerts Team",
            config={"webhook_url": "https://outlook.office.com/webhook/SimulatedTeamsWebhook"},
            is_active=True
        ),
        NotificationChannel(
            organization_id=org_acme.id,
            channel_type="email",
            name="Engineering On-Call",
            config={"recipients": "oncall-sre@acme.internal"},
            is_active=True
        )
    ]
    db.add_all(channels)
    db.commit()

    # 7. Seed Active & Historical Incidents
    # Incident 1: Critical Database Connection Pool Exhaustion (Active - Investigating)
    inc1_created = now - timedelta(minutes=48)
    inc1 = Incident(
        organization_id=org_acme.id,
        application_id=app_payment.id,
        title="HikariCP Database Connection Pool Exhaustion in payment-gateway",
        fingerprint="hikari_db_pool_timeout_payment_gateway",
        severity="Critical",
        status="Investigating",
        service_name="payment-gateway",
        environment="production",
        description="HikariPool-1 connections exhausted. Inbound transaction threads timed out after 30,000ms awaiting pool availability, triggering cascading HTTP 500 responses.",
        trigger_value="31,400ms (threshold: 25,000ms)",
        assigned_to_user_id=engineer_user.id,
        created_at=inc1_created,
        acknowledged_at=inc1_created + timedelta(minutes=3),
        mttd_seconds=32,
        updated_at=now
    )
    db.add(inc1)
    db.flush()

    # Timeline events for Incident 1
    events1 = [
        IncidentEvent(
            incident_id=inc1.id,
            event_type="detected",
            actor_type="system",
            actor_name="Detection Engine",
            message="Incident detected with severity Critical for service 'payment-gateway'. Condition: 31,400ms > threshold 25,000ms",
            data={"rule": "HikariCP Pool Starvation"},
            created_at=inc1_created
        ),
        IncidentEvent(
            incident_id=inc1.id,
            event_type="alert_sent",
            actor_type="system",
            actor_name="Notification Dispatcher",
            message="Dispatched alert to #incident-war-room (Slack) and SRE Alerts Team (Teams)",
            data={"channels": ["slack", "teams"]},
            created_at=inc1_created + timedelta(seconds=15)
        ),
        IncidentEvent(
            incident_id=inc1.id,
            event_type="acknowledged",
            actor_type="user",
            actor_id=engineer_user.id,
            actor_name="Alex Mercer",
            message="Alex Mercer acknowledged the incident and started investigation",
            data={},
            created_at=inc1_created + timedelta(minutes=3)
        ),
        IncidentEvent(
            incident_id=inc1.id,
            event_type="ai_analyzed",
            actor_type="ai",
            actor_name="IncidentIQ AI Agent",
            message="Root-cause diagnosis generated with 94% confidence: HikariCP connection pool exhaustion under concurrent request load",
            data={"confidence": 0.94},
            created_at=inc1_created + timedelta(minutes=4)
        )
    ]
    db.add_all(events1)

    # AI Analysis for Incident 1
    ai1 = AIAnalysis(
        incident_id=inc1.id,
        organization_id=org_acme.id,
        model_name="IncidentIQ SRE AI Engine",
        summary="HikariCP connection pool saturation in payment-gateway due to unindexed query locks",
        root_cause_hypothesis=(
            "The active HikariCP connection pool (maximumPoolSize=10) was completely exhausted by a wave of 120 concurrent "
            "checkout requests executing SELECT ... FOR UPDATE queries without an index on customer_id. "
            "Worker threads waited >30,000ms before throwing SQLTransientConnectionException, cascading into HTTP 500 errors."
        ),
        supporting_evidence=[
            {"type": "log", "title": "[ERROR] payment-gateway", "snippet": "HikariPool-1 - Connection is not available, request timed out after 30002ms.", "severity": "ERROR"},
            {"type": "metric", "title": "response_time_ms = 30140ms", "snippet": "p99 response time spiked from 45ms to 30,140ms", "severity": "Critical"},
            {"type": "trace", "title": "Span: POST /api/v1/payments/charge (30,150ms)", "snippet": "SQLTransientConnectionException awaiting Hikari connection", "severity": "Critical"}
        ],
        alternative_causes=[
            "Network disconnect between Kubernetes pod and RDS PostgreSQL",
            "PostgreSQL server reached max_connections (default 100)"
        ],
        confidence_score=0.94,
        recommended_steps=[
            "1. Inspect active connection count in PostgreSQL via pg_stat_activity.",
            "2. Increase HikariCP maximumPoolSize from 10 to 30 in application.yml.",
            "3. Add index on `orders(customer_id, status)` to prevent full-table lock contention.",
            "4. Configure leakDetectionThreshold to 2000ms for early leak diagnostics."
        ],
        code_fix_diff=(
            "--- a/src/main/resources/application.yml\n"
            "+++ b/src/main/resources/application.yml\n"
            "@@ -14,6 +14,8 @@ spring:\n"
            "     hikari:\n"
            "-      maximum-pool-size: 10\n"
            "+      maximum-pool-size: 30\n"
            "+      minimum-idle: 10\n"
            "+      connection-timeout: 10000\n"
            "+      leak-detection-threshold: 2000\n"
        ),
        verification_steps=[
            "Deploy configuration patch to staging environment.",
            "Run 150 RPS load test using k6 on checkout endpoint.",
            "Verify connection pool utilization stays below 70% with zero timeout exceptions."
        ],
        feedback_status="pending"
    )
    db.add(ai1)

    # Comment on Incident 1
    c1 = IncidentComment(
        incident_id=inc1.id,
        user_id=engineer_user.id,
        author_name="Alex Mercer",
        content="Inspected the database server. PostgreSQL active connections are at 100% due to table locks on orders table. Preparing patch with pool expansion and missing index.",
        created_at=inc1_created + timedelta(minutes=15)
    )
    db.add(c1)

    # Incident 2: NullPointerException 500 Cascade in order-api (Active - Triggered)
    inc2_created = now - timedelta(minutes=18)
    inc2 = Incident(
        organization_id=org_acme.id,
        application_id=app_payment.id,
        title="HTTP 500 Cascade: NullPointerException in order-api checkout pipeline",
        fingerprint="npe_order_api_checkout",
        severity="High",
        status="Triggered",
        service_name="order-api",
        environment="production",
        description="High API Error rate spike detected: 68.2% error rate in order-api following new canary deployment.",
        trigger_value="68.2% error rate (threshold: 5.0%)",
        created_at=inc2_created,
        mttd_seconds=28,
        updated_at=now
    )
    db.add(inc2)
    db.flush()

    db.add(IncidentEvent(
        incident_id=inc2.id,
        event_type="detected",
        actor_type="system",
        actor_name="Detection Engine",
        message="Incident detected: error rate reached 68.2% on order-api",
        data={"error_rate": 68.2},
        created_at=inc2_created
    ))

    # Incident 3: Resolved Incident: OutOfMemoryError in inventory-service
    inc3_created = now - timedelta(hours=5)
    inc3_resolved = now - timedelta(hours=4, minutes=42)
    inc3 = Incident(
        organization_id=org_acme.id,
        application_id=app_payment.id,
        title="JVM OutOfMemoryError: Java heap space in inventory-service",
        fingerprint="oom_inventory_service_heap",
        severity="Critical",
        status="Resolved",
        service_name="inventory-service",
        environment="production",
        description="Heap memory reached 99.2% capacity during batch inventory reconciliation. Liveness probe failed and pod was restarted by Kubernetes.",
        trigger_value="99.2% heap utilization",
        assigned_to_user_id=engineer_user.id,
        created_at=inc3_created,
        acknowledged_at=inc3_created + timedelta(minutes=2),
        resolved_at=inc3_resolved,
        mttd_seconds=40,
        mttr_seconds=1080,  # 18 minutes
        updated_at=inc3_resolved
    )
    db.add(inc3)
    db.flush()

    # AI Analysis for resolved Incident 3
    ai3 = AIAnalysis(
        incident_id=inc3.id,
        organization_id=org_acme.id,
        model_name="IncidentIQ SRE AI Engine",
        summary="JVM heap exhaustion due to unbounded query in batch reconciliation",
        root_cause_hypothesis="Batch reconciliation loaded 250,000 inventory items into memory at once without chunking or pagination.",
        supporting_evidence=[
            {"type": "log", "title": "[FATAL] inventory-service", "snippet": "java.lang.OutOfMemoryError: Java heap space", "severity": "FATAL"},
            {"type": "metric", "title": "memory_usage_pct = 99.2%", "snippet": "Heap exhausted; GC paused threads for 4250ms", "severity": "Critical"}
        ],
        alternative_causes=["Cgroup memory limit lower than -Xmx"],
        confidence_score=0.96,
        recommended_steps=[
            "Switch from itemRepository.findAll() to Spring Data Pageable chunks of 500 items.",
            "Enable streaming or cursor-based query processing."
        ],
        code_fix_diff=(
            "--- a/src/main/java/com/incidentiq/service/InventoryService.java\n"
            "+++ b/src/main/java/com/incidentiq/service/InventoryService.java\n"
            "@@ -25,2 +25,2 @@\n"
            "- List<Item> items = itemRepository.findAll();\n"
            "+ Page<Item> items = itemRepository.findAll(PageRequest.of(page, 500));\n"
        ),
        verification_steps=["Run batch inventory job on staging with 100k items."],
        feedback_status="correct",
        verified_root_cause="Confirmed: Unbounded findAll() query loaded 250k items simultaneously into heap without pagination.",
        feedback_notes="Fixed in PR #412 with chunked pagination."
    )
    db.add(ai3)

    # 8. Seed Sample Telemetry (Logs, Metrics, Traces)
    trace_id_sample = uuid.uuid4().hex
    root_span = uuid.uuid4().hex[:16]
    child_span = uuid.uuid4().hex[:16]

    db.add_all([
        LogEntry(
            organization_id=org_acme.id,
            application_id=app_payment.id,
            service_name="payment-gateway",
            level="ERROR",
            message="HikariPool-1 - Connection is not available, request timed out after 30002ms. SQLTransientConnectionException",
            trace_id=trace_id_sample,
            span_id=root_span,
            timestamp=inc1_created
        ),
        LogEntry(
            organization_id=org_acme.id,
            application_id=app_payment.id,
            service_name="payment-gateway",
            level="WARN",
            message="Slow query detected on table orders: 28400ms duration for query SELECT * FROM orders WHERE customer_id = ? FOR UPDATE",
            trace_id=trace_id_sample,
            span_id=child_span,
            timestamp=inc1_created - timedelta(seconds=20)
        ),
        LogEntry(
            organization_id=org_acme.id,
            application_id=app_payment.id,
            service_name="order-api",
            level="ERROR",
            message="NullPointerException at OrderServiceImpl.java:142 on customer object dereference",
            timestamp=inc2_created
        ),
        LogEntry(
            organization_id=org_acme.id,
            application_id=app_payment.id,
            service_name="inventory-service",
            level="INFO",
            message="Stock level verified for SKU-9042: quantity=420 (warehouse=US-EAST-1)",
            timestamp=now - timedelta(minutes=5)
        )
    ])

    # Sample Traces
    db.add_all([
        TraceSpan(
            organization_id=org_acme.id,
            application_id=app_payment.id,
            trace_id=trace_id_sample,
            span_id=root_span,
            parent_span_id=None,
            service_name="payment-gateway",
            name="POST /api/v1/payments/charge",
            start_time=inc1_created,
            duration_ms=30150.0,
            status_code="ERROR",
            status_message="SQLTransientConnectionException: HikariPool-1 connection timeout",
            attributes={"http.method": "POST", "http.status_code": 500, "user_id": "usr_99a8"}
        ),
        TraceSpan(
            organization_id=org_acme.id,
            application_id=app_payment.id,
            trace_id=trace_id_sample,
            span_id=child_span,
            parent_span_id=root_span,
            service_name="payment-gateway",
            name="DB: SELECT * FROM orders FOR UPDATE",
            start_time=inc1_created + timedelta(milliseconds=50),
            duration_ms=30002.0,
            status_code="ERROR",
            status_message="Connection pool timeout",
            attributes={"db.system": "postgresql", "db.name": "production_ledger"}
        )
    ])

    # Sample Metrics timeseries
    for i in range(15):
        m_time = now - timedelta(minutes=(15 - i) * 4)
        db.add_all([
            MetricEntry(
                organization_id=org_acme.id,
                application_id=app_payment.id,
                service_name="payment-gateway",
                metric_name="http_requests_total",
                value=120.0 + (i % 4) * 15,
                unit="req/s",
                timestamp=m_time
            ),
            MetricEntry(
                organization_id=org_acme.id,
                application_id=app_payment.id,
                service_name="payment-gateway",
                metric_name="response_time_ms",
                value=45.0 if i < 11 else 2850.0,
                unit="ms",
                timestamp=m_time
            ),
            MetricEntry(
                organization_id=org_acme.id,
                application_id=app_payment.id,
                service_name="payment-gateway",
                metric_name="error_rate_pct",
                value=0.2 if i < 11 else 14.8,
                unit="%",
                timestamp=m_time
            ),
            MetricEntry(
                organization_id=org_acme.id,
                application_id=app_payment.id,
                service_name="payment-gateway",
                metric_name="cpu_usage_pct",
                value=35.0 + (i % 5) * 6,
                unit="%",
                timestamp=m_time
            )
        ])

    # Sample Notifications
    db.add_all([
        Notification(
            organization_id=org_acme.id,
            incident_id=inc1.id,
            title="[CRITICAL] HikariCP Connection Pool Exhaustion",
            message="Service 'payment-gateway' in production triggered an incident: 31,400ms > threshold 25,000ms",
            channel_type="in_app",
            severity="Critical",
            status="unread",
            created_at=inc1_created
        ),
        Notification(
            organization_id=org_acme.id,
            incident_id=inc2.id,
            title="[HIGH] HTTP 500 Cascade in order-api",
            message="Service 'order-api' in production error rate reached 68.2%",
            channel_type="in_app",
            severity="High",
            status="unread",
            created_at=inc2_created
        )
    ])

    # Sample Audit Logs
    db.add_all([
        AuditLog(
            organization_id=org_acme.id,
            user_id=admin_user.id,
            user_email=admin_user.email,
            action="organization.initialized",
            resource_type="organization",
            resource_id=org_acme.id,
            details={"tier": "team"}
        ),
        AuditLog(
            organization_id=org_acme.id,
            user_id=engineer_user.id,
            user_email=engineer_user.email,
            action="incident.acknowledged",
            resource_type="incident",
            resource_id=inc1.id,
            details={"severity": "Critical"}
        )
    ])

    db.commit()
    db.close()
    print("Database seeding completed successfully!")

if __name__ == "__main__":
    seed_database()
