"""
IncidentIQ Sample Failure Generator
Transmits simulated Java Spring Boot application failures to the IncidentIQ backend.
"""
import sys
import time
import requests

BACKEND_URL = "http://localhost:8000/api/v1"

def run_simulation():
    print("=" * 60)
    print("IncidentIQ — Java Spring Boot Failure Simulation Suite")
    print("=" * 60)

    # 1. Login as Admin
    print("\n[1/4] Authenticating with IncidentIQ backend...")
    login_resp = requests.post(f"{BACKEND_URL}/auth/login", json={
        "email": "admin@incidentiq.io",
        "password": "IncidentIQ@2026!"
    })
    if login_resp.status_code != 200:
        print(f"Failed to authenticate: {login_resp.text}")
        return

    data = login_resp.json()
    token = data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print(f"Authenticated as {data['user']['full_name']} ({data['current_organization']['name']})")

    # 2. Get Application
    apps = requests.get(f"{BACKEND_URL}/applications", headers=headers).json()
    app = apps[0]
    print(f"\n[2/4] Selected target application: '{app['name']}' (id: {app['id']})")

    # Rotate / Get API key
    rotate_resp = requests.post(f"{BACKEND_URL}/applications/{app['id']}/api-key", headers=headers).json()
    raw_api_key = rotate_resp["api_key"]

    # 3. Simulate Failure Scenarios
    scenarios = [
        ("db_pool_timeout", "HikariCP Connection Pool Exhaustion on payment-gateway"),
        ("500_cascade", "HTTP 500 NullPointerException Cascade on order-api"),
        ("memory_leak", "JVM Heap Space Saturation (OutOfMemoryError) on inventory-service"),
    ]

    print("\n[3/4] Triggering deliberate failure scenarios via Telemetry Ingestion API...")
    for sc_id, sc_name in scenarios:
        print(f"\n---> Triggering: {sc_name}")
        sim_resp = requests.post(
            f"{BACKEND_URL}/simulator/trigger",
            json={"scenario_id": sc_id, "application_id": app["id"]},
            headers=headers
        )
        if sim_resp.status_code == 200:
            res_data = sim_resp.json()
            print(f"     Status: SUCCESS")
            print(f"     Injected: {res_data.get('logs_injected')} logs, {res_data.get('metrics_injected')} metrics, {res_data.get('spans_injected')} traces")
        else:
            print(f"     Failed to trigger: {sim_resp.text}")
        time.sleep(1)

    # 4. Check Generated Incidents
    print("\n[4/4] Querying newly triggered incidents from IncidentIQ Engine...")
    inc_resp = requests.get(f"{BACKEND_URL}/incidents?status=Triggered", headers=headers).json()
    print(f"Found {len(inc_resp)} active Triggered incidents:")
    for inc in inc_resp[:3]:
        print(f" - [{inc['severity']}] {inc['title']} (Service: {inc['service_name']})")

    print("\n" + "=" * 60)
    print("Simulation complete! Open the IncidentIQ Dashboard to investigate.")
    print("=" * 60)

if __name__ == "__main__":
    run_simulation()
