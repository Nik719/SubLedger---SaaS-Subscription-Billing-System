"""Plan API tests — BR-1 (price > 0) and happy paths."""

from fastapi.testclient import TestClient

VALID_PLAN = {
    "name": "Pro Monthly",
    "description": "Pro tier",
    "billing_cycle": "monthly",
    "price": "29.99",
    "currency": "USD",
}


def test_create_plan_success(client: TestClient) -> None:
    response = client.post("/api/v1/plans", json=VALID_PLAN)

    assert response.status_code == 201
    body = response.json()
    assert body["id"] == 1
    assert body["name"] == "Pro Monthly"
    assert body["status"] == "active"
    assert body["price"] == "29.99"


def test_create_plan_rejects_zero_price_br1(client: TestClient) -> None:
    response = client.post("/api/v1/plans", json={**VALID_PLAN, "price": "0"})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_create_plan_rejects_negative_price_br1(client: TestClient) -> None:
    response = client.post("/api/v1/plans", json={**VALID_PLAN, "price": "-10"})

    assert response.status_code == 422


def test_list_plans(client: TestClient) -> None:
    client.post("/api/v1/plans", json=VALID_PLAN)
    client.post("/api/v1/plans", json={**VALID_PLAN, "name": "Team Yearly", "billing_cycle": "yearly"})

    response = client.get("/api/v1/plans")

    assert response.status_code == 200
    assert [p["name"] for p in response.json()] == ["Pro Monthly", "Team Yearly"]


def test_deactivate_plan(client: TestClient) -> None:
    plan_id = client.post("/api/v1/plans", json=VALID_PLAN).json()["id"]

    response = client.patch(f"/api/v1/plans/{plan_id}", json={"status": "inactive"})

    assert response.status_code == 200
    assert response.json()["status"] == "inactive"


def test_update_plan_rejects_bad_price_br1(client: TestClient) -> None:
    plan_id = client.post("/api/v1/plans", json=VALID_PLAN).json()["id"]

    response = client.patch(f"/api/v1/plans/{plan_id}", json={"price": "-1"})

    assert response.status_code == 422


def test_update_missing_plan_returns_404(client: TestClient) -> None:
    response = client.patch("/api/v1/plans/999", json={"name": "X"})

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"
