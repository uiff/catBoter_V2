/** Kalorienbedarf der Katze - eine Formel für Profilkarte und Plan-Editor. */
import type { CatProfile } from '@/types/api'

const ACTIVITY_FACTORS: Record<CatProfile['activity'], number> = {
  ruhig: 1.0,
  normal: 1.2,
  aktiv: 1.4,
}

/**
 * Empfohlene Futtermenge in g/Tag aus dem Katzenprofil.
 * RER = 70 * kg^0.75, MER = RER * Aktivitätsfaktor (Senioren ab 10 Jahren: *0.9).
 * Liefert null, solange Gewicht oder Futter-Energie fehlen.
 */
export function recommendedGramsPerDay(profile: CatProfile | null | undefined): number | null {
  if (!profile) return null
  const { weight_kg, age_years, activity, kcal_per_100g } = profile
  if (weight_kg === null || weight_kg <= 0) return null
  if (kcal_per_100g === null || kcal_per_100g <= 0) return null

  const rer = 70 * Math.pow(weight_kg, 0.75)
  let factor = ACTIVITY_FACTORS[activity] ?? 1.2
  if (age_years !== null && age_years >= 10) factor *= 0.9
  const mer = rer * factor
  return Math.round((mer / kcal_per_100g) * 100)
}
