import { BUSINESS_CONFIG } from '../../config/business.js';

/**
 * Calculates cell requirements based on inputs and optional simulation data
 */
export function estimateRequirements(params, simData = null) {
    const {
        moorings,
        activeRate,     // 0-100
        lossPerBoat,    // L/an
        cellCapacityL,
        maxSpacingM
    } = params;

    const prateDecimal = activeRate / 100;

    // 1. Volumetric Approach
    const activeBoats = Math.round(moorings * prateDecimal);
    const vTotalPerYear = moorings * prateDecimal * lossPerBoat;
    const cellsFromVolume = vTotalPerYear > 0 ? Math.ceil(vTotalPerYear / cellCapacityL) : 0;

    // 2. Spatial Approach (if simulation data is provided)
    let coastLengthM = 0;
    let pollutedAreaM2 = 0;
    let cellsFromSpacing = 0;

    if (simData && simData.ppm) {
        coastLengthM = simData.coastLengthPx / simData.ppm;
        pollutedAreaM2 = simData.pollutedCells * simData.m2PerCell;
        cellsFromSpacing = coastLengthM > 0 ? Math.ceil(coastLengthM / maxSpacingM) : 0;
    }

    // 3. Balancing Formula: C = max(C_vol, C_spacing)
    // We apply an arbitrary safety/distribution factor of / 1.5 as per previous requirements
    const rawFinalCells = Math.max(cellsFromVolume, cellsFromSpacing || cellsFromVolume);
    const finalCells = Math.ceil(rawFinalCells / 1.5);

    return {
        vTotalPerYear,
        activeBoats,
        cellsFromVolume,
        coastLengthM,
        pollutedAreaM2,
        cellsFromSpacing,
        finalCells,
        actualSpacing: coastLengthM > 0 ? (coastLengthM / finalCells) : 0,
        fillRate: finalCells > 0 ? (vTotalPerYear / (finalCells * cellCapacityL)) : 0
    };
}
