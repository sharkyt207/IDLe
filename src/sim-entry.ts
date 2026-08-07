/**
 * Headless entry point for `npm run simulate`.
 *
 * Exposes the DOM-free part of the game so the balancing harness in
 * `scripts/simulate.mjs` can fast-forward a session in Node.
 */
export { Game } from './game/game';
export { Content } from './data';
export { BALANCE } from './data/balance';
export { xpForLevel } from './game/state';
export { nextCost } from './game/stats';
export { acceptOffer, deliver, canAccept } from './economy/contracts';
export { companyValue } from './economy/manager';
export { vehicleValue } from './data/vehicles';
export { serviceAll, serviceCost, machineList } from './game/systems/maintenance';
export { MACHINES } from './data/machines';
export { COMPANY, staffLevel } from './data/company';
export { PROGRESS, difficultyFactor } from './data/progress';
export {
  canStart as canResearch,
  nextTechCost,
  researchSlots,
  slotsFree,
  startResearch,
  statusOf,
  techTier,
  visibleTechs,
} from './progress/research';
export { automationRate, canPrestige, doPrestige, gates, pointsGain, buyPerk, canBuyPerk } from './progress/prestige';
export { rows as achievementRows, titles, check as checkAchievements } from './progress/achievements';
export { researchShare, techLevel, techLevelsTotal, techsDone } from './progress/unlocks';
export { permanentBonuses } from './progress/bonuses';
export { simulateOffline } from './game/systems/offline';
export { createInitialState, SAVE_VERSION } from './game/state';
export { runningCosts, staffRows, upkeepBill, wageBill } from './company/payroll';
export { report } from './company/statistics';
export { ruleFor, setRule } from './company/warehouse';
export { RoadNetwork } from './world/roads';
export { MapSystem } from './world/map';
export { FLEET } from './data/fleet';
export {
  rows as missionRows,
  visibleRows,
  refreshMissions,
  targetFor,
  tutorialActive,
  VISIBLE_TASKS,
} from './missions/manager';
export { rows as milestoneRows, next as nextMilestone, prestigeVisible } from './missions/milestones';
export { describeAll, payout, REWARD_DELIVERIES } from './missions/rewards';
export { sections as helpSections, coverage as helpCoverage } from './missions/help';
export { TUTORIAL_MISSION_IDS } from './data/missions';
export { readMetric, snapshot } from './progress/tracker';
