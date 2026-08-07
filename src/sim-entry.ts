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
