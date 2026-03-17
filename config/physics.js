window.PHYSICS_CONFIG = {
    // Simulation Grid
    grid_scale: 6, // 1 cell in density grid = 6px on image

    // Wave Physics
    waves: {
        diffusion: 0.8,
        decay: 0.95,
        default_power: 50,
        turbulence_frequency: 0.15,
        turbulence_speed: 0.3
    },

    // Pollution Physics
    pollution: {
        speed_scale: 20.0,      // Velocity field scaling
        diffusion_mix: 0.18,   // Base diffusion rate
        decay_rate: 0.999,     // Percentage of pollution remaining per frame
        min_threshold: 0.0001, // Pollution below this is cleared
        impact_threshold: 0.015,
        check_radius_cells: 2  // For coastal detection
    },

    // Cell Effectiveness
    cells: {
        base_efficiency: 0.20,
        radius_multiplier: 3.5,
        dynamic_strength_multiplier: 1.5,
        source_resistance_penalty: 0.95,
        protection_radius_cells: 3.5
    },

    // Boats Path
    boats: {
        pull_factor: 20.0,
        outward_push: 0.5,
        trail_length: 120,    // Path segments length
        default_speed: 3
    }
};
