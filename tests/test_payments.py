"""Payment API tests — BR-6, BR-7, BR-8, ledger entries, e2e happy path."""

from fastapi.testclient import TestClient

PLAN = {
    "name": "Pro Monthly",
    "billing_cycle": "monthly",
    "price": "100.00",
    "currency": "USD",
}
CUSTOMER = {"name": "Acme Inc", "email": "billing@acme.com"}


def _setup_invoice(client: TestClient) -> tuple[int, int]:
    """Returns (customer_id, invoice_id) for a fresh 100.00 USD invoice."""
    plan_id = client.post("/api/v1/plans", json=PLAN).json()["id"]
    customer_id = client.post("/api/v1/customers", json=CUSTOMER).json()["id"]
    sub_id = client.post(
        "/api/v1/subscriptions", json={"customer_id": customer_id, "plan_id": plan_id}
    ).json()["id"]
    invoice_id = client.post(
        "/api/v1/invoices/generate", json={"subscription_id": sub_id}
    ).json()["id"]
    return customer_id, invoice_id


def _payment(invoice_id: int, amount: str, status: str = "success", **kwargs) -> dict:
    payload = {
        "invoice_id": invoice_id,
        "amount": amount,
        "currency": "USD",
        "status": status,
        "provider_reference": kwargs.pop("provider_reference", "txn_123"),
    }
    payload.update(kwargs)
    return payload


def test_full_payment_marks_invoice_paid_br7(client: TestClient) -> None:
    _, invoice_id = _setup_invoice(client)

    response = client.post("/api/v1/payments/record", json=_payment(invoice_id, "100.00"))

    assert response.status_code == 201
    body = response.json()
    assert body["attempt"]["status"] == "success"
    assert body["invoice"]["status"] == "paid"
    assert body["invoice"]["amount_paid"] == "100.00"


def test_partial_payment_marks_partially_paid_br7(client: TestClient) -> None:
    _, invoice_id = _setup_invoice(client)

    response = client.post("/api/v1/payments/record", json=_payment(invoice_id, "40.00"))

    assert response.json()["invoice"]["status"] == "partially_paid"
    assert response.json()["invoice"]["amount_paid"] == "40.00"


def test_two_partials_complete_the_invoice_br7(client: TestClient) -> None:
    _, invoice_id = _setup_invoice(client)
    client.post("/api/v1/payments/record", json=_payment(invoice_id, "40.00"))

    response = client.post("/api/v1/payments/record", json=_payment(invoice_id, "60.00"))

    assert response.json()["invoice"]["status"] == "paid"


def test_overpayment_rejected_br6(client: TestClient) -> None:
    _, invoice_id = _setup_invoice(client)

    response = client.post("/api/v1/payments/record", json=_payment(invoice_id, "150.00"))

    assert response.status_code == 422
    assert response.json()["error"]["details"]["rule"] == "BR-6"


def test_payment_exceeding_remaining_rejected_br6(client: TestClient) -> None:
    _, invoice_id = _setup_invoice(client)
    client.post("/api/v1/payments/record", json=_payment(invoice_id, "80.00"))

    response = client.post("/api/v1/payments/record", json=_payment(invoice_id, "30.00"))

    assert response.status_code == 422
    assert response.json()["error"]["details"]["remaining"] == "20.00"


def test_failed_payment_does_not_change_invoice_br8(client: TestClient) -> None:
    _, invoice_id = _setup_invoice(client)

    response = client.post(
        "/api/v1/payments/record",
        json=_payment(invoice_id, "100.00", status="failed", failure_reason="card_declined"),
    )

    assert response.status_code == 201
    body = response.json()
    assert body["attempt"]["status"] == "failed"
    assert body["attempt"]["failure_reason"] == "card_declined"
    assert body["invoice"]["status"] == "issued"  # unchanged
    assert body["invoice"]["amount_paid"] == "0.00"  # unchanged (BR-8)


def test_failed_amount_may_exceed_remaining(client: TestClient) -> None:
    # BR-6 applies to successful payments only; a failed attempt is just a record
    _, invoice_id = _setup_invoice(client)

    response = client.post(
        "/api/v1/payments/record",
        json=_payment(invoice_id, "500.00", status="failed", failure_reason="card_declined"),
    )

    assert response.status_code == 201


def test_ledger_entries_for_success_and_failure_br9(client: TestClient) -> None:
    customer_id, invoice_id = _setup_invoice(client)
    client.post(
        "/api/v1/payments/record",
        json=_payment(invoice_id, "60.00", status="failed", failure_reason="timeout"),
    )
    client.post("/api/v1/payments/record", json=_payment(invoice_id, "60.00"))

    ledger = client.get(f"/api/v1/customers/{customer_id}/ledger").json()

    types = [e["entry_type"] for e in ledger]
    assert types == ["invoice_created", "payment_failure", "payment_success"]
    assert all(e["reference_id"] for e in ledger)


def test_failed_without_reason_rejected(client: TestClient) -> None:
    _, invoice_id = _setup_invoice(client)

    response = client.post(
        "/api/v1/payments/record", json=_payment(invoice_id, "50.00", status="failed")
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_currency_mismatch_rejected(client: TestClient) -> None:
    _, invoice_id = _setup_invoice(client)

    response = client.post(
        "/api/v1/payments/record", json={**_payment(invoice_id, "50.00"), "currency": "EUR"}
    )

    assert response.status_code == 422


def test_payment_on_paid_invoice_rejected(client: TestClient) -> None:
    _, invoice_id = _setup_invoice(client)
    client.post("/api/v1/payments/record", json=_payment(invoice_id, "100.00"))

    response = client.post("/api/v1/payments/record", json=_payment(invoice_id, "10.00"))

    assert response.status_code == 422


def test_payment_unknown_invoice_404(client: TestClient) -> None:
    response = client.post("/api/v1/payments/record", json=_payment(999, "10.00"))

    assert response.status_code == 404


def test_end_to_end_happy_path(client: TestClient) -> None:
    """PRD 7.3: plan -> customer -> subscription -> invoice -> payments -> paid."""
    plan_id = client.post("/api/v1/plans", json=PLAN).json()["id"]
    customer_id = client.post("/api/v1/customers", json=CUSTOMER).json()["id"]
    sub_id = client.post(
        "/api/v1/subscriptions", json={"customer_id": customer_id, "plan_id": plan_id}
    ).json()["id"]
    invoice_id = client.post(
        "/api/v1/invoices/generate", json={"subscription_id": sub_id}
    ).json()["id"]

    client.post("/api/v1/payments/record", json=_payment(invoice_id, "30.00"))
    final = client.post(
        "/api/v1/payments/record",
        json=_payment(invoice_id, "70.00", provider_reference="txn_456"),
    ).json()

    assert final["invoice"]["status"] == "paid"

    ledger = client.get(f"/api/v1/customers/{customer_id}/ledger").json()
    assert [e["entry_type"] for e in ledger] == [
        "invoice_created",
        "payment_success",
        "payment_success",
    ]

    attempts_invoice = client.get(f"/api/v1/invoices/{invoice_id}").json()
    assert attempts_invoice["amount_paid"] == "100.00"
