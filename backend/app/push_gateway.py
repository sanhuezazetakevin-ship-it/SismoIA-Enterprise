"""Adaptador ntfy para avisos *informativos* con revisión humana previa.
No constituye alerta temprana ni sistema de emergencias.
"""
import re
from urllib.parse import urlsplit
import httpx
from app.config import settings

TOPIC_PATTERN = re.compile(r"^[A-Za-z0-9_-]{8,64}$")


def validate_ntfy_configuration() -> None:
    if not settings.push_enabled:
        raise RuntimeError("Envío deshabilitado (PUSH_ENABLED=false)")
    if not TOPIC_PATTERN.fullmatch(settings.ntfy_topic):
        raise RuntimeError("NTFY_TOPIC debe tener entre 8 y 64 caracteres alfanuméricos, _ o -")
    url = urlsplit(settings.ntfy_base_url)
    if url.scheme != "https" or not url.netloc or url.username or url.password or url.query or url.fragment or url.path not in ("", "/"):
        raise RuntimeError("NTFY_BASE_URL debe ser la raíz HTTPS de un servidor ntfy confiable")
    if settings.ntfy_priority not in (1, 2, 3, 4, 5):
        raise RuntimeError("NTFY_PRIORITY debe estar entre 1 y 5")


def send_informational_push(topic: str, title: str, body: str) -> str:
    validate_ntfy_configuration()
    if topic != settings.ntfy_topic:
        raise ValueError("Tema no autorizado")
    headers = {
        "Title": title,
        "Priority": str(settings.ntfy_priority),
        "Tags": "information_source",
        "Cache": "no",  # evitar retención de mensajes en el servidor público
    }
    if settings.ntfy_access_token:
        headers["Authorization"] = f"Bearer {settings.ntfy_access_token}"
    with httpx.Client(timeout=12.0, follow_redirects=False) as client:
        response = client.post(f"{settings.ntfy_base_url.rstrip('/')}/{topic}", content=body.encode("utf-8"), headers=headers)
        response.raise_for_status()
        result = response.json()
    return str(result.get("id", "accepted"))
