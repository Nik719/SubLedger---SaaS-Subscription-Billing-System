"""Subscription API tests — BR-3, BR-4, idempotent cancel, filters."""

from fastapi.testclient import TestClient

PLAN = {
    "name": "Pro Monthly",
    "billing_cycle": "monthly",
    "price": "29.99",
    "currency": "USD",
}
CUSTOMER = {"name": "Acme Inc", "email": "billing@acme.com"}


def _setup(client: TestClient) -> tuple[int, int]:
    plan_id = client.post("/api/v1/plans", json=PLAN).json()["id"]
    customer_id = client.post("/api/v1/customers", json=CUSTOMER).json()["id"]
    return customer_id, plan_id


def test_create_subscription_success(client: TestClient) -> None:
    customer_id, plan_id = _setup(client)

    response = client.post(
        "/api/v1/subscriptions",
        json={
            "customer_id": customer_id,
            "plan_id": plan_id,
            "start_date": "2026-01-31T00:00:00Z",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "active"
    assert body["current_period_start"].startswith("2026-01-31")
    # monthly cycle, day clamped: Jan 31 + 1 month -> Feb 28 (2026 not a leap year)
    assert body["current_period_end"].startswith("2026-02-28")


def test_subscription_to_inactive_plan_rejected_br3(client: TestClient) -> None:
    customer_id, plan_id = _setup(client)
    client.patch(f"/api/v1/plans/{plan_id}", json={"status": "inactive"})

    response = client.post(
        "/api/v1/subscriptions", json={"customer_id": customer_id, "plan_id": plan_id}
    )

    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "BUSINESS_RULE_VIOLATION"
    assert error["details"]["rule"] == "BR-3"


def test_duplicate_active_subscription_rejected_br4(client: TestClient) -> None:
    customer_id, plan_id = _setup(client)
    first = client.post(
        "/api/v1/subscriptions", json={"customer_id": customer_id, "plan_id": plan_id}
    ).json()

    response = client.post(
        "/api/v1/subscriptions", json={"customer_id": customer_id, "plan_id": plan_id}
    )

    assert response.status_code == 409
    error = response.json()["error"]
    assert error["details"]["rule"] == "BR-4"
    assert error["details"]["existing_subscription_id"] == first["id"]


def test_resubscribe_after_cancel_allowed_br4(client: TestClient) -> None:
    customer_id, plan_id = _setup(client)
    sub_id = client.post(
        "/api/v1/subscriptions", json={"customer_id": customer_id, "plan_id": plan_id}
    ).json()["id"]
    client.patch(f"/api/v1/subscriptions/{sub_id}/cancel")

    response = client.post(
        "/api/v1/subscriptions", json={"customer_id": customer_id, "plan_id": plan_id}
    )

    assert response.status_code == 201


def test_cancel_is_idempotent_safe(client: TestClient) -> None:
    customer_id, plan_id = _setup(client)
    sub_id = client.post(
        "/api/v1/subscriptions", json={"customer_id": customer_id, "plan_id": plan_id}
    ).json()["id"]

    first = client.patch(f"/api/v1/subscriptions/{sub_id}/cancel")
    second = client.patch(f"/api/v1/subscriptions/{sub_id}/cancel")

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["status"] == "cancelled"
    assert second.json()["cancelled_at"] == first.json()["cancelled_at"]


def test_list_subscriptions_with_filters(client: TestClient) -> None:
    customer_id, plan_id = _setup(client)
    sub_id = client.post(
        "/api/v1/subscriptions", json={"customer_id": customer_id, "plan_id": plan_id}
    ).json()["id"]
    client.patch(f"/api/v1/subscriptions/{sub_id}/cancel")
    client.post(
        "/api/v1/subscriptions", json={"customer_id": customer_id, "plan_id": plan_id}
    )

    active = client.get("/api/v1/subscriptions", params={"status": "active"}).json()
    cancelled = client.get(
        "/api/v1/subscriptions", params={"status": "cancelled"}
    ).json()
    by_customer = client.get(
        "/api/v1/subscriptions", params={"customer_id": customer_id}
    ).json()

    assert len(active) == 1
    assert len(cancelled) == 1
    assert len(by_customer) == 2


def test_subscription_unknown_customer_404(client: TestClient) -> None:
    _, plan_id = _setup(client)

    response = client.post(
        "/api/v1/subscriptions", json={"customer_id": 999, "plan_id": plan_id}
    )

    assert response.status_code == 404


def test_cancel_unknown_subscription_404(client: TestClient) -> None:
    response = client.patch("/api/v1/subscriptions/999/cancel")

    assert response.status_code == 404
