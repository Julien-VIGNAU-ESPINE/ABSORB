/**
 * Centralized Application State
 */
export const AppState = {
    // Canvas & Image
    currentImage: null,
    cols: 0,
    rows: 0,

    // Tools
    activeTool: 'draw',
    isDrawing: false,

    // Geography
    zones: [],         // {id, title, color, points, type, folderId}
    folders: [],       // {id, title, isOpen}
    boatPaths: [],     // {id, title, points, color}
    placedCells: [],   // {id, x, y, radius, status}

    // Measurement
    pixelsPerMeter: 0,

    // Simulation Persistence
    simulationInterval: null,
    isSimRunning: false,

    // Shared Data
    lastCosts: {},
    selectedPlanId: 'premium'
};
