"""Phase 9 auth tests: 401 without credentials, role enforcement,
server-side customer scoping (exit criteria)."""

from fastapi.testclient import TestClient

PLAN = {
    "name": "Pro Monthly",
    "billing_cycle": "monthly",
    "price": "100.00",
    "currency": "USD",
}


def _seed_two_customers(client: TestClient) -> tuple[int, int]:
    plan_id = client.post("/api/v1/plans", json=PLAN).json()["id"]
    a = client.post(
        "/api/v1/customers", json={"name": "Acme", "email": "a@acme.com"}
    ).json()["id"]
    b = client.post(
        "/api/v1/customers", json={"name": "Bcorp", "email": "b@bcorp.com"}
    ).json()["id"]
    sub = client.post(
        "/api/v1/subscriptions", json={"customer_id": a, "plan_id": plan_id}
    ).json()["id"]
    client.post("/api/v1/invoices/generate", json={"subscription_id": sub})
    return a, b


def _customer_token(anon_client: TestClient, email: str) -> dict:
    response = anon_client.post("/api/v1/auth/login", json={"email": email})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_unauthenticated_request_rejected(client: TestClient, anon_client: TestClient) -> None:
    assert anon_client.get("/api/v1/customers").status_code == 401
    assert anon_client.post("/api/v1/plans", json=PLAN).status_code == 401
    assert anon_client.get("/api/v1/ledger").status_code == 401


def test_health_and_plan_catalog_stay_public(client: TestClient, anon_client: TestClient) -> None:
    assert anon_client.get("/health").status_code == 200
    assert anon_client.get("/api/v1/plans").status_code == 200


def test_wrong_api_key_rejected(client: TestClient, anon_client: TestClient) -> None:
    response = anon_client.get(
        "/api/v1/customers", headers={"X-API-Key": "wrong-key"}
    )
    assert response.status_code == 401


def test_admin_login_issues_working_token(client: TestClient, anon_client: TestClient) -> None:
    login = anon_client.post(
        "/api/v1/auth/login", json={"api_key": "test-admin-key"}
    )
    assert login.status_code == 200
    assert login.json()["role"] == "admin"

    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    assert anon_client.get("/api/v1/customers", headers=headers).status_code == 200


def test_customer_login_unknown_email_401(client: TestClient, anon_client: TestClient) -> None:
    response = anon_client.post(
        "/api/v1/auth/login", json={"email": "ghost@nowhere.com"}
    )
    assert response.status_code == 401


def test_customer_sees_own_data_only(client: TestClient, anon_client: TestClient) -> None:
    customer_a, customer_b = _seed_two_customers(client)
    headers = _customer_token(anon_client, "a@acme.com")

    own_ledger = anon_client.get(
        f"/api/v1/customers/{customer_a}/ledger", headers=headers
    )
    other_ledger = anon_client.get(
        f"/api/v1/customers/{customer_b}/ledger", headers=headers
    )

    assert own_ledger.status_code == 200
    assert len(own_ledger.json()) == 1
    assert other_ledger.status_code == 403
    assert other_ledger.json()["error"]["code"] == "FORBIDDEN"


def test_customer_list_endpoints_forced_to_own_scope(
    client: TestClient, anon_client: TestClient
) -> None:
    customer_a, customer_b = _seed_two_customers(client)
    headers = _customer_token(anon_client, "b@bcorp.com")

    # customer B asks for customer A's invoices — server forces own scope
    invoices = anon_client.get(
        "/api/v1/invoices", params={"customer_id": customer_a}, headers=headers
    )
    subs = anon_client.get(
        "/api/v1/subscriptions", params={"customer_id": customer_a}, headers=headers
    )

    assert invoices.status_code == 200
    assert invoices.json() == []  # B has none; A's are not leaked
    assert subs.status_code == 200
    assert subs.json() == []


def test_customer_cannot_perform_admin_actions(
    client: TestClient, anon_client: TestClient
) -> None:
    _seed_two_customers(client)
    headers = _customer_token(anon_client, "a@acme.com")

    create_plan = anon_client.post("/api/v1/plans", json=PLAN, headers=headers)
    record_payment = anon_client.post(
        "/api/v1/payments/record",
        json={
            "invoice_id": 1,
            "amount": "10.00",
            "currency": "USD",
            "status": "success",
            "provider_reference": "txn_x",
        },
        headers=headers,
    )

    assert create_plan.status_code == 403
    assert record_payment.status_code == 403
