"""Invoice + Ledger API tests — BR-5 (price snapshot), BR-9 foundation
(invoice_created entry, atomic with invoice), duplicates, error cases."""

from fastapi.testclient import TestClient

PLAN = {
    "name": "Pro Monthly",
    "billing_cycle": "monthly",
    "price": "29.99",
    "currency": "USD",
}
CUSTOMER = {"name": "Acme Inc", "email": "billing@acme.com"}


def _setup_subscription(client: TestClient) -> tuple[int, int, int]:
    plan_id = client.post("/api/v1/plans", json=PLAN).json()["id"]
    customer_id = client.post("/api/v1/customers", json=CUSTOMER).json()["id"]
    sub_id = client.post(
        "/api/v1/subscriptions", json={"customer_id": customer_id, "plan_id": plan_id}
    ).json()["id"]
    return customer_id, plan_id, sub_id


def test_generate_invoice_success(client: TestClient) -> None:
    customer_id, _, sub_id = _setup_subscription(client)

    response = client.post(
        "/api/v1/invoices/generate", json={"subscription_id": sub_id}
    )

    assert response.status_code == 201
    body = response.json()
    assert body["amount_due"] == "29.99"
    assert body["amount_paid"] == "0.00"
    assert body["currency"] == "USD"
    assert body["status"] == "issued"
    assert body["customer_id"] == customer_id


def test_amount_due_is_price_snapshot_br5(client: TestClient) -> None:
    _, plan_id, sub_id = _setup_subscription(client)
    invoice = client.post(
        "/api/v1/invoices/generate", json={"subscription_id": sub_id}
    ).json()

    # plan price changes AFTER the invoice was generated
    client.patch(f"/api/v1/plans/{plan_id}", json={"price": "99.99"})

    refetched = client.get(f"/api/v1/invoices/{invoice['id']}").json()
    assert refetched["amount_due"] == "29.99"  # unchanged (BR-5)


def test_invoice_creates_ledger_entry_br9(client: TestClient) -> None:
    customer_id, _, sub_id = _setup_subscription(client)
    invoice = client.post(
        "/api/v1/invoices/generate", json={"subscription_id": sub_id}
    ).json()

    ledger = client.get(f"/api/v1/customers/{customer_id}/ledger").json()

    assert len(ledger) == 1
    entry = ledger[0]
    assert entry["entry_type"] == "invoice_created"
    assert entry["amount"] == "29.99"
    assert entry["invoice_id"] == invoice["id"]
    assert entry["reference_id"] == f"invoice:{invoice['id']}"


def test_generate_for_cancelled_subscription_rejected(client: TestClient) -> None:
    customer_id, _, sub_id = _setup_subscription(client)
    client.patch(f"/api/v1/subscriptions/{sub_id}/cancel")

    response = client.post(
        "/api/v1/invoices/generate", json={"subscription_id": sub_id}
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "BUSINESS_RULE_VIOLATION"
    # failed generation must not leave a ledger entry (atomicity)
    assert client.get(f"/api/v1/customers/{customer_id}/ledger").json() == []


def test_duplicate_invoice_for_same_period_rejected(client: TestClient) -> None:
    _, _, sub_id = _setup_subscription(client)
    first = client.post(
        "/api/v1/invoices/generate", json={"subscription_id": sub_id}
    ).json()

    response = client.post(
        "/api/v1/invoices/generate", json={"subscription_id": sub_id}
    )

    assert response.status_code == 409
    assert response.json()["error"]["details"]["existing_invoice_id"] == first["id"]


def test_generate_with_explicit_period(client: TestClient) -> None:
    _, _, sub_id = _setup_subscription(client)

    response = client.post(
        "/api/v1/invoices/generate",
        json={
            "subscription_id": sub_id,
            "period_start": "2026-08-01T00:00:00Z",
            "period_end": "2026-09-01T00:00:00Z",
        },
    )

    assert response.status_code == 201
    assert response.json()["period_start"].startswith("2026-08-01")


def test_generate_rejects_inverted_period(client: TestClient) -> None:
    _, _, sub_id = _setup_subscription(client)

    response = client.post(
        "/api/v1/invoices/generate",
        json={
            "subscription_id": sub_id,
            "period_start": "2026-09-01T00:00:00Z",
            "period_end": "2026-08-01T00:00:00Z",
        },
    )

    assert response.status_code == 422


def test_generate_unknown_subscription_404(client: TestClient) -> None:
    response = client.post(
        "/api/v1/invoices/generate", json={"subscription_id": 999}
    )

    assert response.status_code == 404


def test_get_unknown_invoice_404(client: TestClient) -> None:
    response = client.get("/api/v1/invoices/999")

    assert response.status_code == 404


def test_ledger_unknown_customer_404(client: TestClient) -> None:
    response = client.get("/api/v1/customers/999/ledger")

    assert response.status_code == 404


def test_list_invoices_with_filters(client: TestClient) -> None:
    customer_id, _, sub_id = _setup_subscription(client)
    invoice = client.post(
        "/api/v1/invoices/generate", json={"subscription_id": sub_id}
    ).json()

    by_sub = client.get("/api/v1/invoices", params={"subscription_id": sub_id}).json()
    by_customer = client.get(
        "/api/v1/invoices", params={"customer_id": customer_id}
    ).json()
    issued = client.get("/api/v1/invoices", params={"status": "issued"}).json()
    paid = client.get("/api/v1/invoices", params={"status": "paid"}).json()

    assert [i["id"] for i in by_sub] == [invoice["id"]]
    assert [i["id"] for i in by_customer] == [invoice["id"]]
    assert len(issued) == 1
    assert paid == []


def test_recent_ledger_feed(client: TestClient) -> None:
    _, _, sub_id = _setup_subscription(client)
    client.post("/api/v1/invoices/generate", json={"subscription_id": sub_id})

    response = client.get("/api/v1/ledger", params={"limit": 5})

    assert response.status_code == 200
    entries = response.json()
    assert len(entries) == 1
    assert entries[0]["entry_type"] == "invoice_created"
