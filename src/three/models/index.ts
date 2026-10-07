/**
 * Barrel for procedural model builders.
 * Each builder returns a THREE.Group built around local origin
 * (pivot at resting contact point, Y-up, meters) per src/three/types.ts.
 */
export { buildRoom } from "./room";
export { buildTable } from "./table";
export { buildSpellbook } from "./spellbook";
export { buildSword } from "./sword";
export { buildShield, buildShieldFromModel } from "./shield";
export { buildPotions } from "./potion";
export { buildScroll } from "./scroll";
export { buildDice } from "./dice";
export { buildTankard } from "./tankard";
export { buildCandle, buildCandleFromModel } from "./candle";
export { buildTableProps } from "./tableProps";
export { buildRuneCircle } from "./runeCircle";
