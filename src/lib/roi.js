/**
 * ROI Score — how much a player benefits from the Ministry buff.
 *
 * Higher TC level → more valuable upgrade available.
 * More speedups  → ready to use them immediately after the buff.
 * True Gold      → can fund TG upgrades (most valuable use of Ministry).
 *
 * Formula:
 *   speedup_hours = (construction + research) × 2  +  training
 *   roi = speedup_hours × tc_weight  +  floor(true_gold / 10 000)
 */

const TC_WEIGHTS = {
  '25': 1, '26': 2,  '27': 3,
  '28': 4, '29': 5,  '30': 6,
  'TG1': 8, 'TG2': 11, 'TG3': 14,
}

export const calculateRoiScore = ({
  tcLevel,
  constructionDays  = 0, constructionHours  = 0,
  researchDays      = 0, researchHours      = 0,
  trainingDays      = 0, trainingHours      = 0,
  trueGold          = 0,
}) => {
  const cH = constructionDays * 24 + constructionHours
  const rH = researchDays     * 24 + researchHours
  const tH = trainingDays     * 24 + trainingHours

  const speedupScore = (cH + rH) * 2 + tH
  const tcWeight     = TC_WEIGHTS[tcLevel] ?? 1
  const goldBonus    = Math.floor((parseInt(trueGold) || 0) / 10_000)

  return Math.round(speedupScore * tcWeight + goldBonus)
}
