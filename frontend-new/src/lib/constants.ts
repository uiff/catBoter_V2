/** Schnellwahl-Mengen für die manuelle Fütterung (Gramm) */
export const QUICK_AMOUNTS = [10, 20, 30, 50] as const

/** Grenzen der manuellen Fütterung (muss zum Backend passen) */
export const MANUAL_FEED_MIN_G = 1
export const MANUAL_FEED_MAX_G = 100

/** Tank-Zustandsschwellen (Anzeige; das Backend liefert state autoritativ) */
export const TANK_LOW_PERCENT = 25
export const TANK_EMPTY_PERCENT = 10

/** Standard-Warnschwelle, bis /system/settings geladen ist */
export const DEFAULT_TANK_WARN_PERCENT = 20
