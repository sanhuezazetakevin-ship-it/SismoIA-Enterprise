"""Títulos con tildes: httpx rechaza cabeceras no ASCII, por eso Title debe ir codificado (RFC 2047).

Estas pruebas dejan que httpx construya la petición real (solo se simula el envío por red), de modo que
un título como 'Observación sísmica' falla si la cabecera no se codifica.
"""
from email.header import decode_header, make_header
import httpx
import pytest
from app.config import settings
from app.push_gateway import send_informational_push

TOPIC = 'sismoia_test_topic'


@pytest.fixture
def sent(monkeypatch):
    monkeypatch.setattr(settings, 'push_enabled', True)
    monkeypatch.setattr(settings, 'ntfy_topic', TOPIC)
    monkeypatch.setattr(settings, 'ntfy_base_url', 'https://ntfy.sh')
    monkeypatch.setattr(settings, 'ntfy_priority', 4)
    monkeypatch.setattr(settings, 'ntfy_access_token', '')
    requests = []

    def fake_send(self, request, **kwargs):
        requests.append(request)
        return httpx.Response(200, json={'id': 'msg-utf8'}, request=request)

    monkeypatch.setattr(httpx.Client, 'send', fake_send)
    return requests


def decoded(value):
    return str(make_header(decode_header(value)))


def test_title_with_accents_is_sent(sent):
    title = 'Observación sísmica USGS M4.5'
    body = 'CANDIDATO PARA REVISIÓN HUMANA. Evento en Ica; profundidad 35 km. Año nuevo ñandú.'
    assert send_informational_push(TOPIC, title, body) == 'msg-utf8'
    request = sent[0]
    assert request.headers['title'].isascii()
    assert decoded(request.headers['title']) == title
    assert request.content.decode('utf-8') == body
    assert request.headers['priority'] == '4' and request.headers['cache'] == 'no'


def test_ascii_title_is_not_modified(sent):
    send_informational_push(TOPIC, 'Aviso informativo registrado', 'Evento registrado para revisión')
    assert sent[0].headers['title'] == 'Aviso informativo registrado'


def test_longest_title_and_line_breaks_are_safe(sent):
    title = ('Observación sísmica ' * 10)[:140] + '\r\nX-Injected: 1'
    send_informational_push(TOPIC, title, 'Cuerpo de prueba largo para el aviso')
    request = sent[0]
    assert 'x-injected' not in request.headers
    assert '\n' not in request.headers['title'] and '\r' not in request.headers['title']
    assert decoded(request.headers['title']).startswith('Observación sísmica')
