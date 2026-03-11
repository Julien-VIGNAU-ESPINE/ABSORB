import { AppState } from './appState.js';
import { NavigationManager } from './ui/navigation.js';
import { Renderer } from './ui/renderer.js';
import { SimulationEngine } from './core/simulation.js';
import { calculateProjectMetrics } from './business/costEngine.js';
import { estimateRequirements } from './business/estimator.js';
import { PHYSICS_CONFIG } from '../config/physics.js';
import { BUSINESS_CONFIG } from '../config/business.js';

class AbsorbApp {
    constructor() {
        this.nav = new NavigationManager();
        this.canvas = document.getElementById('port-canvas');
        this.offCanvas = document.createElement('canvas'); // For offscreen processing
        this.renderer = new Renderer(this.canvas, this.offCanvas);
        this.sim = null; // Initialized when image loads

        this.init();
    }

    init() {
        this.bindEvents();
        this.nav.setActivePage('sim');
        console.log("Absorb App initialized with modular architecture.");
    }

    bindEvents() {
        // Wire up main navigation
        document.getElementById('nav-simulation')?.addEventListener('click', () => this.nav.setActivePage('sim'));
        document.getElementById('nav-cells')?.addEventListener('click', () => {
            this.nav.setActivePage('cells');
            this.recalculateEstimation();
        });
        document.getElementById('nav-estimation')?.addEventListener('click', () => {
            this.nav.setActivePage('est');
            this.recalculateEstimation();
        });
        document.getElementById('nav-business')?.addEventListener('click', () => this.nav.setActivePage('plans'));

        // Logic for project loading
        document.getElementById('file-input')?.addEventListener('change', (e) => this.handleImageUpload(e));

        // ... (Other event listeners from script.js would be migrated here)
    }

    handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                AppState.currentImage = img;
                this.resizeCanvas(img.width, img.height);
                this.initSimulation(img.width, img.height);
                this.renderer.renderCanvas();

                // Hide upload zone
                document.getElementById('upload-zone')?.classList.add('hidden');
                document.getElementById('canvas-container')?.classList.remove('hidden');
                document.getElementById('sidebar-panel')?.classList.remove('hidden');
                document.getElementById('tools-panel')?.classList.remove('hidden');
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    resizeCanvas(w, h) {
        this.canvas.width = w;
        this.canvas.height = h;
        // Logic to fit canvas in workspace
    }

    initSimulation(w, h) {
        const cols = Math.ceil(w / PHYSICS_CONFIG.grid_scale);
        const rows = Math.ceil(h / PHYSICS_CONFIG.grid_scale);
        this.sim = new SimulationEngine(cols, rows);
        AppState.cols = cols;
        AppState.rows = rows;
    }

    recalculateEstimation() {
        // Call the estimator module
    }
}

// Start the app
window.addEventListener('DOMContentLoaded', () => {
    window.app = new AbsorbApp();
});
