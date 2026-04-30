"""
PDF rendering — Jinja2 → HTML → WeasyPrint → PDF bytes.

Templates live in app/templates/. Filters: fmt_money, fmt_date,
method_label.
"""

from __future__ import annotations

from datetime import date, datetime
from io import BytesIO
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, select_autoescape


_TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates"

_PAYMENT_METHOD_LABELS = {
    "cash": "Espèces",
    "card": "Carte",
    "transfer": "Virement",
    "cheque": "Chèque",
    "other": "Autre",
}


def _fmt_money(value: float | int | None) -> str:
    if value is None:
        return "—"
    # 2-decimal, French thousand separator (non-breaking space)
    return f"{float(value):,.2f}".replace(",", " ").replace(".", ",")


def _fmt_date(value: Any) -> str:
    if value is None:
        return "—"
    if isinstance(value, str):
        # ISO string from DB → parse
        try:
            value = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return value
    if isinstance(value, datetime):
        return value.strftime("%d/%m/%Y")
    if isinstance(value, date):
        return value.strftime("%d/%m/%Y")
    return str(value)


def _method_label(value: Any) -> str:
    if value is None:
        return ""
    s = value.value if hasattr(value, "value") else str(value)
    return _PAYMENT_METHOD_LABELS.get(s, s.title())


_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATE_DIR)),
    autoescape=select_autoescape(["html"]),
)
_env.filters["fmt_money"] = _fmt_money
_env.filters["fmt_date"] = _fmt_date
_env.filters["method_label"] = _method_label


def render_invoice_pdf(*, clinic: Any, patient: Any, invoice: Any) -> bytes:
    """Render an invoice to PDF bytes. Lazy-imports WeasyPrint so the
    rest of the API stays usable even if the system libs are absent."""
    from weasyprint import HTML  # noqa: WPS433 — runtime-only import

    html_str = _env.get_template("invoice.html").render(
        clinic=clinic, patient=patient, invoice=invoice
    )
    buf = BytesIO()
    HTML(string=html_str).write_pdf(target=buf)
    buf.seek(0)
    return buf.read()
