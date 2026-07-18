"""Customer API tests — BR-2 (unique email) and happy paths."""

from fastapi.testclient import TestClient

VALID_CUSTOMER = {
    "name": "Acme Inc",
    "email": "billing@acme.com",
    "company_name": "Acme",
}


def test_create_customer_success(client: TestClient) -> None:
    response = client.post("/api/v1/customers", json=VALID_CUSTOMER)

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "billing@acme.com"
    assert body["status"] == "active"


def test_duplicate_email_returns_409_br2(client: TestClient) -> None:
    client.post("/api/v1/customers", json=VALID_CUSTOMER)

    response = client.post("/api/v1/customers", json=VALID_CUSTOMER)

    assert response.status_code == 409
    error = response.json()["error"]
    assert error["code"] == "CONFLICT"
    assert error["details"]["rule"] == "BR-2"


def test_duplicate_email_case_insensitive_br2(client: TestClient) -> None:
    client.post("/api/v1/customers", json=VALID_CUSTOMER)

    response = client.post(
        "/api/v1/customers", json={**VALID_CUSTOMER, "email": "Billing@Acme.com"}
    )

    assert response.status_code == 409


def test_get_customer_by_id(client: TestClient) -> None:
    customer_id = client.post("/api/v1/customers", json=VALID_CUSTOMER).json()["id"]

    response = client.get(f"/api/v1/customers/{customer_id}")

    assert response.status_code == 200
    assert response.json()["id"] == customer_id


def test_get_missing_customer_returns_404(client: TestClient) -> None:
    response = client.get("/api/v1/customers/999")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


def test_invalid_email_rejected(client: TestClient) -> None:
    response = client.post(
        "/api/v1/customers", json={**VALID_CUSTOMER, "email": "not-an-email"}
    )

    assert response.status_code == 422
