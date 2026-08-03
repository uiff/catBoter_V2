"""Diät-Modus: Tages-Budget mit sanfter Rampe für den Zwei-Katzen-Haushalt.

Budget-Rampe: ab start_date wird das Tagesbudget wöchentlich um
weekly_reduction_pct gesenkt (start_grams als Ausgangspunkt), nie unter
target_grams. Maximal 5 %/Woche - schnellere Reduktion ist bei Katzen
gefährlich (hepatische Lipidose bei Hungerphasen).

Ins Budget zählen ALLE Quellen: Plan-, App- und Hand-Fütterungen
(consumption_manager.get_today_total). Plan-Fütterungen werden auf das
Rest-Budget gekappt; manuelle Fütterungen warnt die App, blockiert sie
aber nicht (bewusste Nutzeraktion).
"""
import logging
from datetime import date


MAX_WEEKLY_PCT = 5.0  # harte Sicherheitsgrenze der Rampe


def _settings():
    from services import settings_service
    return settings_service.get_settings().get("diet") or {}


def budget_for(day, diet=None):
    """Tagesbudget für ein beliebiges Datum (die Rampe ist reine Mathematik -
    damit lässt sich auch rückwirkend sagen, was an Tag X galt)."""
    d = diet if diet is not None else _settings()
    if not d.get("enabled"):
        return None
    target = d.get("target_grams")
    start = d.get("start_grams")
    if not target or target <= 0:
        return None
    if not start or start <= target:
        return round(float(target), 1)

    pct = min(MAX_WEEKLY_PCT, max(0.0, float(d.get("weekly_reduction_pct") or 0)))
    if pct <= 0 or not d.get("start_date"):
        return round(float(target), 1)
    try:
        started = date.fromisoformat(str(d["start_date"]))
    except ValueError:
        return round(float(target), 1)

    weeks = max(0, (day - started).days // 7)
    budget = float(start) * ((1.0 - pct / 100.0) ** weeks)
    return round(max(float(target), budget), 1)


def budget_today(diet=None):
    """Aktuelles Tagesbudget in Gramm oder None (Diät aus/unkonfiguriert)."""
    return budget_for(date.today(), diet)


def get_status():
    """Budget-Status für Dashboard/Einstellungen (None-Felder = Diät aus)."""
    from services.consumption_manager import consumption_manager
    d = _settings()
    budget = budget_today(d)
    consumed = consumption_manager.get_today_total()
    status = {
        "enabled": bool(d.get("enabled")),
        "budget_today": budget,
        "consumed_today": round(consumed, 1),
        "remaining": None,
        "target_grams": d.get("target_grams"),
        "start_grams": d.get("start_grams"),
        "weekly_reduction_pct": d.get("weekly_reduction_pct"),
        "start_date": d.get("start_date"),
        "at_target": None,
    }
    if budget is not None:
        status["remaining"] = round(max(0.0, budget - consumed), 1)
        status["at_target"] = budget <= (d.get("target_grams") or 0)

        # Wochenstreifen: die letzten 7 Tage gegen ihr JEWEILIGES Budget
        # (die Rampe kann historisch höher gelegen haben)
        from datetime import timedelta
        daily = {e["date"]: e["total"] for e in consumption_manager.get_daily(8)}
        week = []
        for offset in range(6, -1, -1):
            day = date.today() - timedelta(days=offset)
            day_iso = day.isoformat()
            total = consumed if offset == 0 else daily.get(day_iso)
            day_budget = budget_for(day, d)
            week.append({
                "date": day_iso,
                "total": round(total, 1) if total is not None else None,
                "budget": day_budget,
                "ok": (total is not None and day_budget is not None
                       and total <= day_budget) if total is not None else None,
            })
        status["week"] = week
    return status


def clamp_plan_amount(amount):
    """Kappt eine Plan-Dosis auf das Rest-Budget.

    Rückgabe: (erlaubte_menge, budget) - budget None = Diät aus, keine Kappung.
    erlaubte_menge 0 bedeutet: Budget aufgebraucht, Fütterung überspringen.
    """
    budget = budget_today()
    if budget is None:
        return amount, None
    from services.consumption_manager import consumption_manager
    remaining = budget - consumption_manager.get_today_total()
    if remaining <= 0.5:
        return 0.0, budget
    if amount > remaining:
        logging.info(f"Diät-Budget: Dosis {amount} g auf {remaining:.1f} g gekappt "
                     f"(Budget {budget} g)")
        return round(remaining, 1), budget
    return amount, budget
