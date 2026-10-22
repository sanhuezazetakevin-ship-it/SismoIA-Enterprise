from fastapi.testclient import TestClient
from app.main import app
client = TestClient(app)

def test_health():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_capabilities_safe_defaults():
    data = client.get("/api/v1/system/capabilities").json()
    assert data["live_data"] is False
    assert data["external_notifications"] is False
