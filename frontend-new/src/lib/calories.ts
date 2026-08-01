/** Kalorienbedarf der Katzen - eine Formel für Profilkarte und Plan-Editor. */
import type { CatProfile, CatProfiles } from '@/types/api'

const ACTIVITY_FACTORS: Record<CatProfile['activity'], number> = {
  ruhig: 1.0,
  normal: 1.2,
  aktiv: 1.4,
}

/**
 * Empfohlene Futtermenge in g/Tag für EINE Katze.
 * RER = 70 * kg^0.75, MER = RER * Aktivitätsfaktor (Senioren ab 10 Jahren: *0.9).
 * Liefert null, solange Gewicht oder Futter-Energie fehlen.
 */
export function gramsForCat(
  cat: CatProfile | null | undefined,
  kcalPer100g: number | null | undefined,
): number | null {
  if (!cat) return null
  if (cat.weight_kg === null || cat.weight_kg <= 0) return null
  if (kcalPer100g === null || kcalPer100g === undefined || kcalPer100g <= 0) return null

  const rer = 70 * Math.pow(cat.weight_kg, 0.75)
  let factor = ACTIVITY_FACTORS[cat.activity] ?? 1.2
  if (cat.age_years !== null && cat.age_years >= 10) factor *= 0.9
  const mer = rer * factor
  return Math.round((mer / kcalPer100g) * 100)
}

/**
 * Gesamt-Empfehlung für den Futterautomaten: SUMME aller Katzen mit
 * vollständigem Profil (beide fressen aus demselben Napf).
 * Liefert null, wenn keine Katze berechenbar ist.
 */
export function recommendedGramsPerDay(
  profiles: CatProfiles | null | undefined,
): number | null {
  if (!profiles) return null
  const amounts = (profiles.cats ?? [])
    .map((cat) => gramsForCat(cat, profiles.kcal_per_100g))
    .filter((grams): grams is number => grams !== null)
  if (amounts.length === 0) return null
  return amounts.reduce((sum, grams) => sum + grams, 0)
}
