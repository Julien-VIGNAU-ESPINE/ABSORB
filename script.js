document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const uploadZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('file-input');
    const canvasContainer = document.getElementById('canvas-container');
    const canvas = document.getElementById('port-canvas');
    const ctx = canvas.getContext('2d');
    const btnReset = document.getElementById('btn-reset');

    const brightnessInput = document.getElementById('img-brightness');
    const waveIntensityInput = document.getElementById('wave-intensity');
    const pollutionIntensityInput = document.getElementById('pollution-intensity');
    const wakePowerInput = document.getElementById('wake-power');

    // UI Controls for drawing
    const instructionText = document.getElementById('instruction-text');
    const btnFinishZone = document.getElementById('btn-finish-zone');
    const btnCancelZone = document.getElementById('btn-cancel-zone');
    const btnClearWaves = document.getElementById('btn-clear-waves');
    const toolBtns = document.querySelectorAll('.tool-btn');
    const sidebarPanel = document.getElementById('sidebar-panel');
    const cellsSidebarPanel = document.getElementById('cells-sidebar-panel');
    const toolsPanel = document.getElementById('tools-panel');
    const btnAddFolder = document.getElementById('btn-add-folder');
    const zoneListContainer = document.getElementById('zone-list-container');
    const btnPlaySim = document.getElementById('btn-play-sim');
    const btnCalcRisk = document.getElementById('btn-calc-risk');
    const cbShowImpact = document.getElementById('cb-show-impact');
    const cbPersistImpact = document.getElementById('cb-persist-impact');
    const cbCoastHeatmap = document.getElementById('cb-coast-heatmap');
    const cbShowHeatmap = document.getElementById('cb-show-heatmap');
    const cbCumulativeHeatmap = document.getElementById('cb-cumulative-heatmap');
    const simSpeedInput = document.getElementById('sim-speed');
    const simSpeedNum = document.getElementById('sim-speed-num');

    // UI Tabs
    const tabZones = document.getElementById('tab-zones');
    const tabBoats = document.getElementById('tab-boats');
    const zonesSection = document.getElementById('zones-section');
    const boatsSection = document.getElementById('boats-section');
    const boatListContainer = document.getElementById('boat-list-container');
    const cellsListContainer = document.getElementById('cells-list-container');
    const btnAutoPlace = document.getElementById('btn-auto-place');
    const btnClearCells = document.getElementById('btn-clear-cells');

    // Save & Load
    const btnSaveProject = document.getElementById('btn-save-project');
    const btnLoadProject = document.getElementById('btn-load-project');
    const loadFileInput = document.getElementById('load-file-input');

    // Types definition
    const zoneTypes = {
        'default': { label: 'Non défini', color: 'rgba(0, 102, 204, 0.3)', border: 'rgba(0, 102, 204, 0.8)' },
        'bateaux': { label: 'Bateaux', color: 'rgba(231, 76, 60, 0.3)', border: 'rgba(231, 76, 60, 0.8)' },
        'ponton': { label: 'Ponton', color: 'rgba(149, 165, 166, 0.3)', border: 'rgba(149, 165, 166, 0.8)' },
        'terre': { label: 'Terre', color: 'rgba(46, 204, 113, 0.3)', border: 'rgba(46, 204, 113, 0.8)' },
        'eau': { label: 'Eau', color: 'rgba(52, 152, 219, 0.3)', border: 'rgba(52, 152, 219, 0.8)' },
        'polluante': { label: 'Polluante', color: 'rgba(155, 89, 182, 0.3)', border: 'rgba(155, 89, 182, 0.8)' }
    };

    // State Variables
    let currentImage = null;
    let zones = [];
    let folders = [];
    let currentPolygon = [];
    let isDrawing = false;
    let selectedZoneId = null;
    let selectedFolderId = null;
    let zoneCounter = 1;
    let folderCounter = 1;
    let currentTool = 'draw'; // 'draw', 'merge', 'wave', 'erase'
    let mergeState = { active: false, zone1Id: null };
    let waveState = { active: false, isDrawingSource: false, sourceLine: [], heatmapCanvas: null };
    let pollutionState = { heatmapCanvas: null, cumulativeHeatmapCanvas: null, impactCanvas: null, impactMask: null, cumulativeImpactMask: null, cumulativeDensity: null };
    let placedCells = [];
    let cellCounter = 1;

    // Boats State
    let boatPaths = [];
    let boatPathCounter = 1;
    let selectedBoatId = null;
    let activeTab = 'zones';

    // Simulation Animation State
    let simulationTime = 0.0;
    let simulationInterval = null;

    // Scale / Ruler State
    let rulerState = { active: false, p1: null, p2: null, pixelsPerMeter: null };
    const scaleSection = document.getElementById('scale-section');
    const scaleMetersInput = document.getElementById('scale-meters');
    const scaleResult = document.getElementById('scale-result');
    const estScaleStatus = document.getElementById('est-scale-status');

    function updateScaleResult() {
        if (rulerState.p1 && rulerState.p2 && scaleMetersInput.value > 0) {
            const dx = rulerState.p2.x - rulerState.p1.x;
            const dy = rulerState.p2.y - rulerState.p1.y;
            const pixelDist = Math.hypot(dx, dy);
            const meters = parseFloat(scaleMetersInput.value);
            rulerState.pixelsPerMeter = pixelDist / meters;
            scaleResult.textContent = `✅ Échelle: 1m = ${rulerState.pixelsPerMeter.toFixed(2)} px`;
            if (estScaleStatus) estScaleStatus.textContent = `✅ Échelle calibrée : 1m = ${rulerState.pixelsPerMeter.toFixed(2)} pixels`;
        }
    }

    if (scaleMetersInput) scaleMetersInput.addEventListener('input', updateScaleResult);

    // Zoom State
    let currentZoom = 1;
    const canvasWrapper = document.querySelector('.canvas-wrapper');

    // --- Toolbar Setup ---
    toolBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tool = btn.getAttribute('data-tool');
            if (!tool) return; // Skip for action buttons like play/calc
            toolBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            setTool(tool);
        });
    });

    function setTool(tool) {
        currentTool = tool;

        // Reset intermediate states
        isDrawing = false;
        currentPolygon = [];

        mergeState.active = (tool === 'merge');
        mergeState.zone1Id = null;

        waveState.active = (tool === 'wave');
        waveState.isDrawingSource = false;

        if (scaleSection) {
            if (tool === 'ruler') {
                scaleSection.classList.remove('hidden');
                rulerState.active = true;
                rulerState.p1 = null;
                rulerState.p2 = null;
            } else {
                scaleSection.classList.add('hidden');
                rulerState.active = false;
            }
        }

        updateControlsUI();
        updateZoneListUI();
        updateBoatListUI();
        updateCellsListUI();
        renderCanvas();
    }

    // Tabs functionality
    tabZones.addEventListener('click', () => {
        activeTab = 'zones';
        tabZones.classList.add('active');
        tabBoats.classList.remove('active');
        zonesSection.classList.remove('hidden');
        boatsSection.classList.add('hidden');
    });

    tabBoats.addEventListener('click', () => {
        activeTab = 'boats';
        tabBoats.classList.add('active');
        tabZones.classList.remove('active');
        boatsSection.classList.remove('hidden');
        zonesSection.classList.add('hidden');
    });

    // --- Page Navigation (Simulation / Cells / Estimation / Business) ---
    const navSimulation = document.getElementById('nav-simulation');
    const navCells = document.getElementById('nav-cells');
    const navEstimation = document.getElementById('nav-estimation');
    const navBusiness = document.getElementById('nav-business');

    const businessView = document.getElementById('business-view');
    const estimationPage = document.getElementById('estimation-page');
    const plansPage = document.getElementById('plans-page');
    const costsPage = document.getElementById('costs-page');
    const quotePage = document.getElementById('quote-page');
    const workspaceWrapper = document.querySelector('.workspace-wrapper');

    // Sub-nav buttons inside Business
    const subnavPlans = document.getElementById('subnav-plans');
    const subnavCosts = document.getElementById('subnav-costs');
    const subnavQuote = document.getElementById('subnav-quote');

    if (navSimulation) navSimulation.addEventListener('click', () => setActivePage('sim'));
    if (navCells) navCells.addEventListener('click', () => setActivePage('cells'));
    if (navEstimation) navEstimation.addEventListener('click', () => setActivePage('est'));
    if (navBusiness) navBusiness.addEventListener('click', () => setActivePage('plans')); // Default to plans

    if (subnavPlans) subnavPlans.addEventListener('click', () => setActivePage('plans'));
    if (subnavCosts) subnavCosts.addEventListener('click', () => setActivePage('costs'));
    if (subnavQuote) subnavQuote.addEventListener('click', () => setActivePage('quote'));

    function setActivePage(page) {
        // Main Nav Buttons
        [navSimulation, navCells, navEstimation, navBusiness].forEach(b => b && b.classList.remove('active'));
        // Sub-nav Buttons
        [subnavPlans, subnavCosts, subnavQuote].forEach(b => b && b.classList.remove('active'));

        // Layout show/hide
        if (workspaceWrapper) workspaceWrapper.classList.add('hidden');
        if (estimationPage) estimationPage.classList.add('hidden');
        if (businessView) businessView.classList.add('hidden');
        if (plansPage) plansPage.classList.add('hidden');
        if (costsPage) costsPage.classList.add('hidden');
        if (quotePage) quotePage.classList.add('hidden');
        if (sidebarPanel) sidebarPanel.classList.add('hidden');
        if (cellsSidebarPanel) cellsSidebarPanel.classList.add('hidden');

        if (page === 'sim') {
            navSimulation.classList.add('active');
            if (workspaceWrapper) workspaceWrapper.classList.remove('hidden');
            if (sidebarPanel) sidebarPanel.classList.remove('hidden');
        } else if (page === 'cells') {
            navCells.classList.add('active');
            if (workspaceWrapper) workspaceWrapper.classList.remove('hidden');
            if (cellsSidebarPanel) cellsSidebarPanel.classList.remove('hidden');
            setTool('cell');
            updateCellToolBtn();
            runEstimation();
            renderCanvas();
        } else if (page === 'est') {
            navEstimation.classList.add('active');
            if (estimationPage) estimationPage.classList.remove('hidden');
            setTimeout(() => runEstimation(), 50);
        } else {
            // Business sections
            if (navBusiness) navBusiness.classList.add('active');
            if (businessView) businessView.classList.remove('hidden');

            if (page === 'plans') {
                if (subnavPlans) subnavPlans.classList.add('active');
                if (plansPage) plansPage.classList.remove('hidden');
                setTimeout(() => renderPlansPage(), 50);
            } else if (page === 'costs') {
                if (subnavCosts) subnavCosts.classList.add('active');
                if (costsPage) costsPage.classList.remove('hidden');
                setTimeout(() => runCosts(), 50);
            } else if (page === 'quote') {
                if (subnavQuote) subnavQuote.classList.add('active');
                if (quotePage) quotePage.classList.remove('hidden');
                setTimeout(() => renderQuote(), 50);
            }
        }
    }

    // --- Drag and Drop Handling ---

    // Prevent default browser behavior for drag events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadZone.addEventListener(eventName, preventDefaults, false);
        // Also prevent defaults on the body to avoid accidental browser navigation if missed
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Highlight upload zone on drag
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadZone.addEventListener(eventName, () => {
            uploadZone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        uploadZone.addEventListener(eventName, () => {
            uploadZone.classList.remove('dragover');
        }, false);
    });

    // Handle dropped files
    uploadZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }, false);

    // Handle file input selection (click)
    fileInput.addEventListener('change', function () {
        handleFiles(this.files);
    });

    brightnessInput.addEventListener('input', renderCanvas);
    waveIntensityInput.addEventListener('input', renderCanvas);
    if (wakePowerInput) wakePowerInput.addEventListener('input', updateSimulationAndRender);
    if (cbPersistImpact) cbPersistImpact.addEventListener('change', () => {
        if (!simulationInterval && pollutionState.density) {
            runPollutionSimulation();
        }
        renderCanvas();
    });
    if (cbShowImpact) cbShowImpact.addEventListener('change', renderCanvas);
    if (cbCumulativeHeatmap) cbCumulativeHeatmap.addEventListener('change', () => {
        runEstimation();
        if (!simulationInterval && pollutionState.density) {
            runPollutionSimulation();
            renderCanvas();
        }
    });
    if (cbCoastHeatmap) cbCoastHeatmap.addEventListener('change', () => {
        if (!simulationInterval && pollutionState.density) {
            runPollutionSimulation();
        }
        renderCanvas();
    });

    // Sub-tabs Simulation
    const btnSubTabWater = document.getElementById('btn-sub-tab-water');
    const btnSubTabCoast = document.getElementById('btn-sub-tab-coast');
    const simPanelWater = document.getElementById('sim-panel-water');
    const simPanelCoast = document.getElementById('sim-panel-coast');

    if (btnSubTabWater && btnSubTabCoast) {
        btnSubTabWater.onclick = () => {
            btnSubTabWater.classList.add('active');
            btnSubTabCoast.classList.remove('active');
            btnSubTabWater.style.background = 'var(--clr-surface)';
            btnSubTabWater.style.color = 'var(--clr-text-main)';
            btnSubTabCoast.style.background = 'transparent';
            btnSubTabCoast.style.color = 'var(--clr-text-muted)';
            simPanelWater.classList.remove('hidden');
            simPanelCoast.classList.add('hidden');
        };
        btnSubTabCoast.onclick = () => {
            btnSubTabCoast.classList.add('active');
            btnSubTabWater.classList.remove('active');
            btnSubTabCoast.style.background = 'var(--clr-surface)';
            btnSubTabCoast.style.color = 'var(--clr-text-main)';
            btnSubTabWater.style.background = 'transparent';
            btnSubTabWater.style.color = 'var(--clr-text-muted)';
            simPanelCoast.classList.remove('hidden');
            simPanelWater.classList.add('hidden');
        };
    }

    if (cbShowHeatmap) cbShowHeatmap.addEventListener('change', () => {
        if (!simulationInterval && pollutionState.density) {
            runPollutionSimulation();
            renderCanvas();
        }
    });
    // --- Cell Mode Management (3-state: off, blue, clean) ---
    window._cellMode = 'blue';
    const btnCellOff = document.getElementById('btn-cell-off');
    const btnCellBlue = document.getElementById('btn-cell-blue');
    const btnCellClean = document.getElementById('btn-cell-clean');

    function setCellMode(mode) {
        window._cellMode = mode;

        [btnCellOff, btnCellBlue, btnCellClean].forEach(btn => {
            if (!btn) return;
            const isActive = btn.id === `btn-cell-${mode}`;
            btn.classList.toggle('active', isActive);
            btn.style.background = isActive ? 'var(--clr-primary)' : 'transparent';
            btn.style.color = isActive ? 'white' : 'var(--clr-text-muted)';
        });

        if (pollutionState.density) {
            runPollutionSimulation();
            renderCanvas();
        }
    }

    if (btnCellOff) btnCellOff.onclick = () => setCellMode('off');
    if (btnCellBlue) btnCellBlue.onclick = () => setCellMode('blue');
    if (btnCellClean) btnCellClean.onclick = () => setCellMode('clean');


    function initProjectData(data) {
        if (data.imageSrc) {
            const img = new Image();
            img.onload = () => {
                currentImage = img;
                zones = data.zones || [];
                folders = data.folders || [];
                zoneCounter = data.zoneCounter || 1;
                folderCounter = data.folderCounter || 1;

                boatPaths = data.boatPaths || [];
                boatPathCounter = data.boatPathCounter || 1;
                placedCells = data.cells || [];
                cellCounter = data.cellCounter || (placedCells.length > 0 ? Math.max(...placedCells.map(c => c.id)) + 1 : 1);

                waveState.sourceLine = (data.waveState && data.waveState.sourceLine) ? data.waveState.sourceLine : [];

                if (data.adjustments) {
                    brightnessInput.value = data.adjustments.brightness || "100";
                    waveIntensityInput.value = data.adjustments.waveIntensity || "65";
                    if (pollutionIntensityInput) pollutionIntensityInput.value = data.adjustments.pollutionIntensity || "70";
                    if (wakePowerInput) wakePowerInput.value = data.adjustments.wakePower || "50";
                    if (cbShowImpact && data.adjustments.showImpact !== undefined) cbShowImpact.checked = data.adjustments.showImpact;
                    if (cbPersistImpact && data.adjustments.persistImpact !== undefined) cbPersistImpact.checked = data.adjustments.persistImpact;
                    if (cbCoastHeatmap && data.adjustments.coastHeatmap !== undefined) cbCoastHeatmap.checked = data.adjustments.coastHeatmap;
                    if (cbShowHeatmap && data.adjustments.showHeatmap !== undefined) cbShowHeatmap.checked = data.adjustments.showHeatmap;
                    if (cbCumulativeHeatmap && data.adjustments.cumulativeHeatmap !== undefined) cbCumulativeHeatmap.checked = data.adjustments.cumulativeHeatmap;
                    if (simSpeedInput && data.adjustments.simSpeed !== undefined) {
                        simSpeedInput.value = data.adjustments.simSpeed;
                        if (simSpeedNum) simSpeedNum.value = data.adjustments.simSpeed;
                    }
                }

                if (data.pixelsPerMeter) {
                    rulerState.pixelsPerMeter = data.pixelsPerMeter;
                    if (scaleResult) scaleResult.textContent = `✅ Échelle: 1m = ${rulerState.pixelsPerMeter.toFixed(2)} px`;
                    if (estScaleStatus) estScaleStatus.textContent = `✅ Échelle calibrée : 1m = ${rulerState.pixelsPerMeter.toFixed(2)} pixels`;
                }

                isDrawing = false;
                currentPolygon = [];
                selectedZoneId = null;
                mergeState.active = false;
                mergeState.zone1Id = null;

                if (simulationInterval) stopSim();

                setTool('draw');
                toolBtns.forEach(b => {
                    b.classList.remove('active');
                    if (b.getAttribute('data-tool') === 'draw') b.classList.add('active');
                });

                fitCanvasToScreen();
                updateSimulationAndRender();
                showCanvas();
                updateControlsUI();
                loadFileInput.value = '';
            };
            img.src = data.imageSrc;
        }
    }

    // Save & Load Event Listeners
    if (btnSaveProject) {
        btnSaveProject.addEventListener('click', () => {
            if (!currentImage) return alert("Rien à sauvegarder.");

            const zip = new JSZip();

            // Extract base64 data from currentImage.src
            const imageSrc = currentImage.src;
            const base64Data = imageSrc.split(',')[1];
            // Get mime type
            const mimeTypeMatch = imageSrc.match(/data:(.*?);/);
            const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/png';
            const ext = mimeType === 'image/jpeg' ? 'jpg' : 'png';
            const imageFilename = `image.${ext}`;

            zip.file(imageFilename, base64Data, { base64: true });

            const data = {
                imageFilename: imageFilename,
                zones: zones,
                folders: folders,
                zoneCounter: zoneCounter,
                folderCounter: folderCounter,
                boatPaths: boatPaths,
                boatPathCounter: boatPathCounter,
                waveState: {
                    sourceLine: waveState.sourceLine
                },
                adjustments: {
                    brightness: brightnessInput.value,
                    waveIntensity: waveIntensityInput.value,
                    pollutionIntensity: pollutionIntensityInput ? pollutionIntensityInput.value : "70",
                    wakePower: wakePowerInput ? wakePowerInput.value : "50",
                    showImpact: cbShowImpact ? cbShowImpact.checked : true,
                    persistImpact: cbPersistImpact ? cbPersistImpact.checked : false,
                    coastHeatmap: cbCoastHeatmap ? cbCoastHeatmap.checked : false,
                    showHeatmap: cbShowHeatmap ? cbShowHeatmap.checked : true,
                    cumulativeHeatmap: cbCumulativeHeatmap ? cbCumulativeHeatmap.checked : false,
                    simSpeed: simSpeedInput ? simSpeedInput.value : "1"
                },
                pixelsPerMeter: rulerState.pixelsPerMeter,
                cells: placedCells,
                cellCounter: cellCounter
            };

            zip.file("project.json", JSON.stringify(data));

            zip.generateAsync({ type: "blob" }).then(function (content) {
                const url = URL.createObjectURL(content);
                const downloadNode = document.createElement('a');
                downloadNode.setAttribute("href", url);
                downloadNode.setAttribute("download", "projet_port.zip");
                document.body.appendChild(downloadNode);
                downloadNode.click();
                downloadNode.remove();
                URL.revokeObjectURL(url);
            });
        });
    }

    function loadProjectFromFile(file) {
        if (file.name.toLowerCase().endsWith('.zip')) {
            // Load zip
            JSZip.loadAsync(file).then(function (zip) {
                return zip.file("project.json").async("string").then(function (jsonContent) {
                    const data = JSON.parse(jsonContent);
                    const imageFilename = data.imageFilename;
                    if (imageFilename && zip.file(imageFilename)) {
                        return zip.file(imageFilename).async("base64").then(function (base64Data) {
                            const ext = imageFilename.split('.').pop().toLowerCase();
                            const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
                            data.imageSrc = `data:${mimeType};base64,${base64Data}`;
                            initProjectData(data);
                        });
                    } else {
                        initProjectData(data);
                    }
                });
            }).catch(function (err) {
                console.error("Erreur zip:", err);
                alert("Erreur lors de la lecture du fichier ZIP: " + err);
            });
        } else {
            // assume json (backward compatible)
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    initProjectData(data);
                } catch (err) {
                    alert("Fichier de projet invalide.");
                }
            };
            reader.readAsText(file);
        }
    }

    if (btnLoadProject) {
        btnLoadProject.addEventListener('click', () => loadFileInput.click());
        loadFileInput.addEventListener('change', function () {
            if (this.files.length === 0) return;
            const file = this.files[0];
            loadProjectFromFile(file);
        });
    }


    // --- Helper Functions ---
    function updateSimulationAndRender() {
        const visibleBoats = boatPaths.filter(b => b.visible);
        if ((waveState.sourceLine && waveState.sourceLine.length > 2) || visibleBoats.length > 0) {
            runWaveSimulation();
        } else {
            waveState.heatmapCanvas = null;
            waveState.grid = null;
        }

        const hasPollution = zones.some(z => z.type === 'polluante');
        if (hasPollution) {
            runPollutionSimulation();
        } else {
            pollutionState.heatmapCanvas = null;
            pollutionState.impactCanvas = null;
            pollutionState.impactMask = null;
        }

        renderCanvas();
    }

    // --- File Processing ---

    function handleFiles(files) {
        if (files.length === 0) return;

        const file = files[0];

        // Check if it's a project file
        if (file.name.toLowerCase().endsWith('.zip') || file.name.toLowerCase().endsWith('.json')) {
            loadProjectFromFile(file);
            return;
        }

        // Ensure it's an image
        if (!file.type.match('image.*')) {
            alert('Veuillez sélectionner une image valide (PNG, JPG) ou un fichier de projet (ZIP, JSON).');
            return;
        }

        const reader = new FileReader();

        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                currentImage = img;
                zones = [];
                folders = [];
                currentPolygon = [];
                isDrawing = false;
                selectedZoneId = null;
                selectedFolderId = null;
                zoneCounter = 1;
                folderCounter = 1;
                brightnessInput.value = "100";
                waveIntensityInput.value = "65";
                if (pollutionIntensityInput) pollutionIntensityInput.value = "70";
                setTool('draw'); // Reset to draw tool
                toolBtns.forEach(b => {
                    b.classList.remove('active');
                    if (b.getAttribute('data-tool') === 'draw') b.classList.add('active');
                });

                // Set native dimensions and reset zoom
                canvas.width = currentImage.width;
                canvas.height = currentImage.height;
                fitCanvasToScreen();

                if (simulationInterval) stopSim();
                renderCanvas();
                showCanvas();
                updateControlsUI();
                runEstimation();
            };
            img.src = e.target.result;
        };

        reader.readAsDataURL(file);
    }

    // --- Canvas Rendering ---

    function renderCanvas() {
        if (!currentImage) return;

        // Ensure canvas intrinsic dimensions match the image
        if (canvas.width !== currentImage.width) canvas.width = currentImage.width;
        if (canvas.height !== currentImage.height) canvas.height = currentImage.height;

        // Clear canvas and draw image
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const brightness = brightnessInput.value;
        ctx.filter = `brightness(${brightness}%)`;

        ctx.drawImage(currentImage, 0, 0);

        ctx.filter = 'none';

        if (waveState.heatmapCanvas) {
            ctx.globalAlpha = waveIntensityInput.value / 100;
            ctx.drawImage(waveState.heatmapCanvas, 0, 0, canvas.width, canvas.height);
            ctx.globalAlpha = 1.0;
        }

        if (pollutionState.heatmapCanvas) {
            // Only draw heatmap if checkbox is checked (or checkbox not present)
            const showHeatmap = cbShowHeatmap ? cbShowHeatmap.checked : true;
            if (showHeatmap) {
                ctx.globalAlpha = pollutionIntensityInput ? (pollutionIntensityInput.value / 100) : 0.7;
                ctx.drawImage(pollutionState.heatmapCanvas, 0, 0, canvas.width, canvas.height);
                ctx.globalAlpha = 1.0;
            }
        }

        // Draw saved zones
        zones.forEach(zone => {
            const zType = zoneTypes[zone.type] || zoneTypes['default'];
            const fillColor = zType.color;
            let strokeColor = zType.border;
            let lineWidth = 2;

            if (zone.id === selectedZoneId || (selectedFolderId && zone.folderId === selectedFolderId)) {
                lineWidth = 4;
            }
            if (mergeState.active && zone.id === mergeState.zone1Id) {
                lineWidth = 4;
                strokeColor = '#f39c12';
            }

            drawPolygon(zone.points, fillColor, strokeColor, true, lineWidth);
        });

        // Draw placed cells (only if active toggle is on AND not in "clean" hidden mode)
        const cellsDrawActive = window._cellMode !== 'off';
        const cleanModeHides = window._cellMode === 'clean';

        if (!cleanModeHides) {
            placedCells.forEach(cell => {
                ctx.save();
                ctx.globalAlpha = cellsDrawActive ? 1.0 : 0.35; // dim when disabled
                ctx.beginPath();
                ctx.arc(cell.x, cell.y, cell.radius, 0, Math.PI * 2);
                ctx.strokeStyle = cellsDrawActive ? '#3498db' : '#888';
                ctx.lineWidth = 2;
                ctx.stroke();

                // Cleaner water glow
                const clrGrad = ctx.createRadialGradient(cell.x, cell.y, 0, cell.x, cell.y, cell.radius);
                clrGrad.addColorStop(0, cellsDrawActive ? 'rgba(52, 152, 219, 0.4)' : 'rgba(150,150,150,0.2)');
                clrGrad.addColorStop(1, 'rgba(52, 152, 219, 0)');
                ctx.fillStyle = clrGrad;
                ctx.beginPath();
                ctx.arc(cell.x, cell.y, cell.radius, 0, Math.PI * 2);
                ctx.fill();

                ctx.beginPath();
                ctx.arc(cell.x, cell.y, 8, 0, Math.PI * 2);
                ctx.fillStyle = cellsDrawActive ? '#3498db' : '#888';
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.stroke();

                ctx.font = 'bold 10px Inter, sans-serif';
                ctx.fillStyle = '#fff';
                ctx.textAlign = 'center';
                ctx.fillText(cellsDrawActive ? '🔲' : '⊘', cell.x, cell.y + 4);
                ctx.globalAlpha = 1.0;
                ctx.restore();
            });
        } // end if (!cleanModeHides)

        // Draw saved boats
        boatPaths.forEach(boat => {
            if (!boat.visible) return;

            // Only draw the dashed path if showPath is not explicitly false
            if (boat.showPath !== false) {
                ctx.beginPath();
                ctx.moveTo(boat.points[0].x, boat.points[0].y);
                for (let i = 1; i < boat.points.length; i++) {
                    ctx.lineTo(boat.points[i].x, boat.points[i].y);
                }

                ctx.strokeStyle = (boat.id === selectedBoatId) ? '#ffcc00' : '#00ffff';
                ctx.lineWidth = (boat.id === selectedBoatId) ? 8 : 6;
                ctx.setLineDash([10, 10]);
                ctx.stroke();
                ctx.setLineDash([]);

                if (boat.points.length > 1) {
                    const len = boat.points.length;
                    const p1 = boat.points[len - 2];
                    const p2 = boat.points[len - 1];
                    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                    ctx.beginPath();
                    ctx.moveTo(p2.x, p2.y);
                    ctx.lineTo(p2.x - 20 * Math.cos(angle - Math.PI / 6), p2.y - 20 * Math.sin(angle - Math.PI / 6));
                    ctx.lineTo(p2.x - 20 * Math.cos(angle + Math.PI / 6), p2.y - 20 * Math.sin(angle + Math.PI / 6));
                    ctx.closePath();
                    ctx.fillStyle = (boat.id === selectedBoatId) ? '#ffcc00' : '#00ffff';
                    ctx.fill();
                }
            }

            // Draw moving boat if running and has current head position
            if (boat.currentHead) {
                const { x, y, dx, dy } = boat.currentHead;
                const angle = Math.atan2(dy, dx);
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(angle);

                // Draw a distinct boat shape (triangle pointing right since we rotated)
                ctx.beginPath();
                ctx.moveTo(18, 0); // Nose
                ctx.lineTo(-8, 10); // Back Right
                ctx.lineTo(-3, 0); // Back Center
                ctx.lineTo(-8, -10); // Back Left
                ctx.closePath();

                ctx.fillStyle = (boat.id === selectedBoatId) ? '#ffcc00' : '#ffffff';
                ctx.fill();
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 2;
                ctx.stroke();

                ctx.restore();
            }
        });

        if (pollutionState.impactCanvas && (!cbShowImpact || cbShowImpact.checked)) {
            // Draw red warnings
            ctx.drawImage(pollutionState.impactCanvas, 0, 0, canvas.width, canvas.height);
        }

        if (waveState.sourceLine && waveState.sourceLine.length > 0) {
            ctx.beginPath();
            ctx.moveTo(waveState.sourceLine[0].x, waveState.sourceLine[0].y);
            for (let i = 1; i < waveState.sourceLine.length; i++) {
                ctx.lineTo(waveState.sourceLine[i].x, waveState.sourceLine[i].y);
            }
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 6;
            ctx.setLineDash([10, 10]);
            ctx.stroke();
            ctx.setLineDash([]);
        }


        // Draw current polygon
        if (currentPolygon.length > 0) {
            drawPolygon(currentPolygon, 'rgba(255, 165, 0, 0.3)', 'rgba(255, 165, 0, 0.8)', false, 2);

            // Draw points
            currentPolygon.forEach(point => {
                ctx.beginPath();
                ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI);
                ctx.fillStyle = 'rgba(255, 165, 0, 1)';
                ctx.fill();
            });
        }

        // Draw ruler line if tool is active
        if (rulerState.active && rulerState.p1) {
            ctx.save();
            ctx.strokeStyle = '#f1c40f';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.moveTo(rulerState.p1.x, rulerState.p1.y);
            if (rulerState.p2) ctx.lineTo(rulerState.p2.x, rulerState.p2.y);
            ctx.stroke();
            ctx.setLineDash([]);

            [rulerState.p1, rulerState.p2].forEach(p => {
                if (!p) return;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
                ctx.fillStyle = '#f1c40f';
                ctx.fill();
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            });

            if (rulerState.p2) {
                const mx = (rulerState.p1.x + rulerState.p2.x) / 2;
                const my = (rulerState.p1.y + rulerState.p2.y) / 2 - 14;
                const label = scaleMetersInput ? `${scaleMetersInput.value}m` : '';
                ctx.font = 'bold 14px Inter, sans-serif';
                ctx.fillStyle = '#f1c40f';
                ctx.textAlign = 'center';
                ctx.strokeStyle = 'rgba(0,0,0,0.7)';
                ctx.lineWidth = 3;
                ctx.strokeText(label, mx, my);
                ctx.fillText(label, mx, my);
                ctx.textAlign = 'left';
            }
            ctx.restore();
        }
    }


    function drawPolygon(points, fillColor, strokeColor, closePath = true, lineWidth = 2) {
        if (points.length === 0) return;

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }

        if (closePath && points.length > 2) {
            ctx.closePath();
            ctx.fillStyle = fillColor;
            ctx.fill();
        }

        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = strokeColor;
        ctx.stroke();
    }

    // --- UI State Switching ---

    function showCanvas() {
        uploadZone.style.opacity = '0';
        uploadZone.style.pointerEvents = 'none';

        canvasContainer.classList.remove('hidden');
        sidebarPanel.classList.remove('hidden');
        if (toolsPanel) toolsPanel.classList.remove('hidden');
        updateZoneListUI();
    }

    function showUpload() {
        currentImage = null;
        zones = [];
        folders = [];
        currentPolygon = [];
        isDrawing = false;
        selectedZoneId = null;
        selectedFolderId = null;
        zoneCounter = 1;
        folderCounter = 1;
        setTool('draw'); // Reset to default tool
        toolBtns.forEach(b => {
            b.classList.remove('active');
            if (b.getAttribute('data-tool') === 'draw') b.classList.add('active');
        });

        fileInput.value = ''; // Reset file input
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // filterCells = []; // Removed as per instruction
        renderCanvas();
        canvasContainer.classList.add('hidden');
        sidebarPanel.classList.add('hidden');
        if (toolsPanel) toolsPanel.classList.add('hidden');

        uploadZone.style.opacity = '1';
        uploadZone.style.pointerEvents = 'auto';
    }

    // --- Zoom and Theme Controls ---
    const btnZoomIn = document.getElementById('btn-zoom-in');
    const btnZoomOut = document.getElementById('btn-zoom-out');
    const btnZoomFit = document.getElementById('btn-zoom-fit');
    const btnThemeToggle = document.getElementById('btn-theme-toggle');

    if (btnThemeToggle) {
        btnThemeToggle.addEventListener('click', () => {
            const isDark = document.body.getAttribute('data-theme') === 'dark';
            if (isDark) {
                document.body.removeAttribute('data-theme');
                btnThemeToggle.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
            } else {
                document.body.setAttribute('data-theme', 'dark');
                btnThemeToggle.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
            }
        });
    }

    function fitCanvasToScreen() {
        if (!currentImage) return;
        const padding = 48;
        // Check ratio to decide if we scale to width or height so it "takes up all the size"
        const canvasRatio = currentImage.width / currentImage.height;
        const wrapperRatio = (canvasWrapper.clientWidth - padding) / (canvasWrapper.clientHeight - padding);

        // Target covering maximum possible space while maintaining aspect ratio and not necessarily scaling down if small
        let newZoom;
        if (canvasRatio > wrapperRatio) {
            // Image is wider than container, scale to width
            newZoom = (canvasWrapper.clientWidth - padding) / currentImage.width;
        } else {
            // Image is taller than container, scale to height
            newZoom = (canvasWrapper.clientHeight - padding) / currentImage.height;
        }

        currentZoom = Math.max(0.1, newZoom);
        applyZoom();
    }

    function applyZoom() {
        if (!currentImage) return;
        canvas.style.width = `${currentImage.width * currentZoom}px`;
        canvas.style.height = `${currentImage.height * currentZoom}px`;
    }

    function changeZoom(factor, centerX, centerY) {
        if (!currentImage) return;

        const newZoom = Math.max(0.05, Math.min(currentZoom * factor, 15));
        if (newZoom === currentZoom) return;

        // If no center provided, zoom towards center of visible area
        if (centerX === undefined || centerY === undefined) {
            const rect = canvas.getBoundingClientRect();
            centerX = (canvasWrapper.clientWidth / 2 - rect.left);
            centerY = (canvasWrapper.clientHeight / 2 - rect.top);
        }

        const ratioX = centerX / (currentImage.width * currentZoom);
        const ratioY = centerY / (currentImage.height * currentZoom);

        currentZoom = newZoom;
        applyZoom();

        // Adjust scroll position
        const newRect = canvas.getBoundingClientRect();
        const newCursorX = newRect.width * ratioX;
        const newCursorY = newRect.height * ratioY;

        canvasWrapper.scrollBy(newCursorX - centerX, newCursorY - centerY);
    }

    if (btnZoomIn) btnZoomIn.addEventListener('click', () => changeZoom(1.2));
    if (btnZoomOut) btnZoomOut.addEventListener('click', () => changeZoom(0.8));
    if (btnZoomFit) btnZoomFit.addEventListener('click', fitCanvasToScreen);

    canvasWrapper.addEventListener('wheel', (e) => {
        if (!currentImage) return;
        // Allows zoom with Ctrl/Cmd key like classic web apps, or universally since it's an editor
        if (e.ctrlKey || e.metaKey || document.activeElement === canvasWrapper || e.shiftKey) {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const cursorX = e.clientX - rect.left;
            const cursorY = e.clientY - rect.top;

            const zoomChange = e.deltaY < 0 ? 1.1 : 0.9;
            changeZoom(zoomChange, cursorX, cursorY);
        }
    }, { passive: false });

    // --- Canvas Events for Drawing ---

    canvas.addEventListener('mousedown', (e) => {
        if (!currentImage) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        if (currentTool === 'ruler') {
            if (!rulerState.p1) {
                rulerState.p1 = { x, y };
                rulerState.p2 = null;
            } else {
                rulerState.p2 = { x, y };
                updateScaleResult();
            }
            renderCanvas();
            return;
        }

        if (currentTool === 'wave') {
            waveState.isDrawingSource = true;
            waveState.sourceLine = [{ x, y }];
            waveState.heatmapCanvas = null; // reset visual
            renderCanvas();
            return;
        }

        if (currentTool === 'erase') {
            const clickedZoneId = getZoneAt(x, y);
            if (clickedZoneId) {
                zones = zones.filter(z => z.id !== clickedZoneId);
                if (selectedZoneId === clickedZoneId) selectedZoneId = null;
                updateZoneListUI();
                updateSimulationAndRender();
            }
            return;
        }

        if (currentTool === 'merge') {
            const clickedZoneId = getZoneAt(x, y);
            if (clickedZoneId) {
                handleZoneSelectionForMerge(clickedZoneId);
            }
            return;
        }

        if (currentTool === 'draw') {
            if (!isDrawing) {
                isDrawing = true;
                currentPolygon = [];
                updateControlsUI();
            }
            currentPolygon.push({ x, y });
            renderCanvas();
        }

        if (currentTool === 'cell') {
            const newCell = {
                id: Date.now(),
                x: x,
                y: y,
                title: `Cellule ${cellCounter++}`,
                radius: 25 // standard radius in pixels
            };
            placedCells.push(newCell);
            updateCellsListUI();
            runEstimation(); // To show impact in results

            // Trigger a single simulation step to update the red/blue coast highlights immediately
            if (!simulationInterval && pollutionState.density) {
                runPollutionSimulation();
            }

            renderCanvas();
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        if (currentTool === 'wave' && waveState.isDrawingSource) {
            waveState.sourceLine.push({ x, y });
            renderCanvas();
            return;
        }

        if (currentTool === 'draw' && isDrawing && currentPolygon.length > 0) {
            // Redraw canvas and line to cursor
            renderCanvas();
            ctx.beginPath();
            const lastPoint = currentPolygon[currentPolygon.length - 1];
            ctx.moveTo(lastPoint.x, lastPoint.y);
            ctx.lineTo(x, y);
            ctx.strokeStyle = 'rgba(255, 165, 0, 0.5)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    });

    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);

    function handleMouseUp(e) {
        handleWaveMouseUp(e);
    }

    function handleWaveMouseUp(e) {
        if (currentTool === 'wave' && waveState.isDrawingSource) {
            waveState.isDrawingSource = false;
            if (waveState.sourceLine.length > 2) {
                let bDX = 0, bDY = 0;
                const p1 = waveState.sourceLine[0];
                const p2 = waveState.sourceLine[waveState.sourceLine.length - 1];
                let dx = p2.x - p1.x;
                let dy = p2.y - p1.y;
                let dist = Math.hypot(dx, dy);
                if (dist > 0) { bDX = dx / dist; bDY = dy / dist; }

                boatPaths.push({
                    id: Date.now(),
                    title: `Trajet ${boatPathCounter++}`,
                    points: [...waveState.sourceLine],
                    dx: bDX,
                    dy: bDY,
                    visible: true,
                    isRunning: false,
                    time: 0
                });

                waveState.sourceLine = [];
                updateBoatListUI();
                runWaveSimulation();
            } else {
                waveState.sourceLine = [];
            }
            renderCanvas();
            updateControlsUI();
        }
    }

    function updateControlsUI() {
        if (currentTool === 'draw') {
            if (isDrawing) {
                instructionText.innerText = "Tracez les contours. Cliquez sur 'Terminer' pour fermer.";
                btnFinishZone.classList.remove('hidden');
                btnCancelZone.classList.remove('hidden');
            } else {
                instructionText.innerText = "Mode Dessin: Cliquez pour tracer une zone.";
                btnFinishZone.classList.add('hidden');
                btnCancelZone.classList.add('hidden');
            }
        } else if (currentTool === 'merge') {
            if (mergeState.zone1Id) {
                instructionText.innerText = "Mode Fusion: Sélectionnez la deuxième zone.";
            } else {
                instructionText.innerText = "Mode Fusion: Sélectionnez la première zone.";
            }
            btnFinishZone.classList.add('hidden');
            btnCancelZone.classList.remove('hidden');
        } else if (currentTool === 'wave') {
            instructionText.innerText = "Mode Vagues: Dessinez l'entrée d'eau (glissez-déposez).";
            btnFinishZone.classList.add('hidden');
            btnCancelZone.classList.add('hidden');
        } else if (currentTool === 'erase') {
            instructionText.innerText = "Mode Effaceur: Cliquez sur une zone pour la supprimer.";
            btnFinishZone.classList.add('hidden');
            btnCancelZone.classList.add('hidden');
        } else if (currentTool === 'ruler') {
            instructionText.innerText = "Mode Règle: Cliquez deux points pour définir une distance.";
            btnFinishZone.classList.add('hidden');
            btnCancelZone.classList.remove('hidden');
        }

        // Only show Clear Waves if we have heatmap
        if (waveState.heatmapCanvas) {
            btnClearWaves.classList.remove('hidden');
        } else {
            btnClearWaves.classList.add('hidden');
        }
    }

    function stopSim() {
        if (simulationInterval) clearInterval(simulationInterval);
        simulationInterval = null;
        if (btnPlaySim) btnPlaySim.classList.remove('active');
        boatPaths.forEach(b => b.isRunning = false);
        updateBoatListUI();
        updateSimulationAndRender();

        runEstimation();
    }

    if (btnPlaySim) {
        btnPlaySim.addEventListener('click', () => {
            if (simulationInterval) {
                stopSim(); // Pauses the simulation rendering in its current state
            } else {
                simulationTime = 0.0; // Restarts the visual flow
                boatPaths.forEach((b, idx) => {
                    b.isRunning = true;
                    b.time = -idx * 150.0; // Staggered start time
                });
                updateBoatListUI();
                btnPlaySim.classList.add('active');
                simulationInterval = setInterval(() => {
                    const speed = simSpeedInput ? parseInt(simSpeedInput.value) : 1;

                    for (let i = 0; i < speed; i++) {
                        simulationTime += 1.5; // Continue expanding infinitely
                        boatPaths.forEach(b => { if (b.isRunning) b.time = (b.time || 0) + 1.5; });

                        const visibleBoats = boatPaths.filter(b => b.visible);
                        if ((waveState.sourceLine && waveState.sourceLine.length > 2) || visibleBoats.length > 0) {
                            runWaveSimulation();
                        } else {
                            waveState.heatmapCanvas = null;
                            waveState.grid = null;
                        }

                        const hasPollution = zones.some(z => z.type === 'polluante');
                        if (hasPollution) {
                            runPollutionSimulation();
                        } else {
                            pollutionState.heatmapCanvas = null;
                            pollutionState.impactCanvas = null;
                        }
                    }

                    renderCanvas();
                    updateCellStats();

                }, 40); // 25fps for fluid continuous motion
            }
        });
    }

    if (btnCalcRisk) {
        btnCalcRisk.addEventListener('click', () => {
            if (!currentImage) return alert("Veuillez d'abord importer une image.");
            const hasPollution = zones.some(z => z.type === 'polluante');
            if (!hasPollution) return alert("Aucune zone polluante détectée. Veuillez d'abord tracer une zone et la définir comme 'Polluante' dans l'onglet Calques.");

            if (btnCalcRisk.classList.contains('active')) return;
            if (simulationInterval) stopSim();
            btnCalcRisk.classList.add('active');

            if (cbPersistImpact && !cbPersistImpact.checked) {
                cbPersistImpact.checked = true;
            }
            if (cbShowImpact && !cbShowImpact.checked) {
                cbShowImpact.checked = true;
            }

            // Reset simulation data for a clean 24h run
            simulationTime = 0.0;
            if (pollutionState.density) {
                pollutionState.density.fill(0);
                pollutionState.cumulativeDensity?.fill(0);
                pollutionState.cumulativeImpactMask?.fill(0);
                pollutionState.impactMask?.fill(0);
            }

            // Artificial start for boats explicitly
            boatPaths.forEach((b, idx) => {
                b.isRunning = true;
                b.time = -idx * 150.0;
            });
            updateBoatListUI();

            const fastForwardSteps = 2000;
            let progress = 0;

            function runChunk() {
                const stepsPerFrame = 50;
                for (let i = 0; i < stepsPerFrame; i++) {
                    simulationTime += 1.5;
                    boatPaths.forEach(b => { if (b.isRunning) b.time = (b.time || 0) + 1.5; });

                    const visibleBoats = boatPaths.filter(b => b.visible);
                    if ((waveState.sourceLine && waveState.sourceLine.length > 2) || visibleBoats.length > 0) {
                        runWaveSimulation();
                    }
                    const hasPollution = zones.some(z => z.type === 'polluante');
                    if (hasPollution) {
                        runPollutionSimulation();
                    }
                    progress++;
                }

                renderCanvas();
                updateCellStats();


                if (progress < fastForwardSteps) {
                    requestAnimationFrame(runChunk);
                } else {
                    btnCalcRisk.classList.remove('active');
                    boatPaths.forEach(b => b.isRunning = false);
                    updateBoatListUI();

                    // Trigger auto-placement if enabled
                    runEstimation();
                }
            }
            setTimeout(() => { requestAnimationFrame(runChunk); }, 10);
        });
    }

    if (btnAddFolder) {
        btnAddFolder.addEventListener('click', () => {
            folders.push({
                id: Date.now(),
                title: `Dossier ${folderCounter++}`,
                isOpen: true
            });
            updateZoneListUI();
        });
    }

    zoneListContainer.addEventListener('dragover', (e) => {
        e.preventDefault(); // allow drop
    });

    zoneListContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        const folderTarget = e.target.closest('.folder-item');
        if (!folderTarget) {
            const draggedZoneId = parseInt(e.dataTransfer.getData('text/plain'));
            if (!isNaN(draggedZoneId)) {
                const zone = zones.find(z => z.id === draggedZoneId);
                if (zone && zone.folderId !== null && zone.folderId !== undefined) {
                    zone.folderId = null;
                    updateZoneListUI();
                    renderCanvas();
                }
            }
        }
    });

    function createZoneDOM(zone) {
        const el = document.createElement('div');
        const isSelected = zone.id === selectedZoneId;
        const isMergeTarget = mergeState.active && zone.id === mergeState.zone1Id;
        el.className = `zone-item ${isSelected ? 'selected' : ''} ${isMergeTarget ? 'merge-target' : ''}`;

        // Drag and drop setup for zones
        el.draggable = true;
        el.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', zone.id);
            setTimeout(() => el.classList.add('dragging'), 0);
        });
        el.addEventListener('dragend', (e) => {
            el.classList.remove('dragging');
        });

        el.onclick = (e) => {
            if (e.target.tagName !== 'SELECT' && e.target.tagName !== 'BUTTON' && !e.target.closest('button')) {
                if (mergeState.active) {
                    handleZoneSelectionForMerge(zone.id);
                } else {
                    selectedZoneId = zone.id;
                    selectedFolderId = null;
                    updateZoneListUI();
                    renderCanvas();
                }
            }
        };

        const header = document.createElement('div');
        header.className = 'zone-item-header';

        const title = document.createElement('span');
        title.textContent = zone.title;

        const btnDel = document.createElement('button');
        btnDel.className = 'btn-delete';
        btnDel.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
        btnDel.onclick = () => {
            zones = zones.filter(z => z.id !== zone.id);
            if (selectedZoneId === zone.id) selectedZoneId = null;
            if (mergeState.zone1Id === zone.id) {
                mergeState.active = false;
                mergeState.zone1Id = null;
                updateControlsUI();
            }
            updateZoneListUI();
            updateSimulationAndRender();
        };

        header.appendChild(title);
        header.appendChild(btnDel);

        const select = document.createElement('select');
        select.className = 'zone-select';
        Object.keys(zoneTypes).forEach(key => {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = zoneTypes[key].label;
            if (zone.type === key) opt.selected = true;
            select.appendChild(opt);
        });

        select.onchange = (e) => {
            zone.type = e.target.value;
            updateZoneListUI(); // re-render to show/hide intensity slider
            updateSimulationAndRender();
        };

        el.appendChild(header);
        el.appendChild(select);




        return el;
    }

    function createFolderDOM(folder) {
        const wrap = document.createElement('div');
        wrap.className = 'folder-wrapper';

        const header = document.createElement('div');
        header.className = `folder-item ${folder.id === selectedFolderId ? 'selected' : ''}`;

        // drag and drop for folders to receive zones
        header.addEventListener('dragover', (e) => {
            e.preventDefault();
            header.classList.add('drag-over');
        });
        header.addEventListener('dragleave', (e) => {
            header.classList.remove('drag-over');
        });
        header.addEventListener('drop', (e) => {
            e.preventDefault();
            header.classList.remove('drag-over');
            const draggedZoneId = parseInt(e.dataTransfer.getData('text/plain'));
            if (!isNaN(draggedZoneId)) {
                const zone = zones.find(z => z.id === draggedZoneId);
                if (zone) {
                    zone.folderId = folder.id;
                    updateZoneListUI();
                    renderCanvas();
                }
            }
        });

        if (folder.isOpen === undefined) folder.isOpen = true;

        header.onclick = (e) => {
            if (e.target.closest('button') || e.target.tagName === 'INPUT') return;
            if (selectedFolderId === folder.id) {
                selectedFolderId = null;
            } else {
                selectedFolderId = folder.id;
                selectedZoneId = null;
            }
            updateZoneListUI();
            renderCanvas();
        };

        const leftGroup = document.createElement('div');
        leftGroup.style.display = 'flex';
        leftGroup.style.alignItems = 'center';
        leftGroup.style.gap = '4px';

        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'btn-toggle-folder';
        toggleBtn.style.background = 'none';
        toggleBtn.style.border = 'none';
        toggleBtn.style.color = 'inherit';
        toggleBtn.style.cursor = 'pointer';
        // Simple SVG Chevron
        toggleBtn.innerHTML = folder.isOpen
            ? `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`
            : `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`;

        toggleBtn.onclick = (e) => {
            e.stopPropagation();
            folder.isOpen = !folder.isOpen;
            updateZoneListUI();
        };

        const folderIcon = document.createElement('span');
        folderIcon.textContent = "📁";
        folderIcon.style.fontSize = "0.9rem";

        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.className = 'folder-title-input';
        titleInput.value = folder.title;
        titleInput.onclick = (e) => e.stopPropagation();
        titleInput.onblur = (e) => {
            folder.title = e.target.value;
        };
        titleInput.onchange = (e) => {
            folder.title = e.target.value;
        };

        leftGroup.appendChild(toggleBtn);
        leftGroup.appendChild(folderIcon);
        leftGroup.appendChild(titleInput);

        const btnDel = document.createElement('button');
        btnDel.className = 'btn-delete';
        btnDel.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
        btnDel.onclick = (e) => {
            e.stopPropagation();
            folders = folders.filter(f => f.id !== folder.id);
            zones.forEach(z => { if (z.folderId === folder.id) z.folderId = null; });
            if (selectedFolderId === folder.id) selectedFolderId = null;
            updateZoneListUI();
            renderCanvas();
        };

        header.appendChild(leftGroup);
        header.appendChild(btnDel);
        wrap.appendChild(header);

        // Content area
        const content = document.createElement('div');
        content.className = 'folder-content';
        if (!folder.isOpen) {
            content.style.display = 'none';
        }

        const folderZones = zones.filter(z => z.folderId === folder.id);
        folderZones.forEach(z => {
            content.appendChild(createZoneDOM(z));
        });

        wrap.appendChild(content);
        return wrap;
    }

    function updateZoneListUI() {
        zoneListContainer.innerHTML = '';
        if (zones.length === 0 && folders.length === 0) {
            zoneListContainer.innerHTML = '<p style="color: var(--clr-text-muted); font-size: 0.9rem; text-align: center; margin-top: 20px;">Aucune zone définie.</p>';
            return;
        }

        // Render Folders first
        folders.forEach(folder => {
            zoneListContainer.appendChild(createFolderDOM(folder));
        });

        // Render root zones
        const rootZones = zones.filter(z => !z.folderId);
        rootZones.forEach(zone => {
            zoneListContainer.appendChild(createZoneDOM(zone));
        });
    }

    function createBoatPathDOM(boat, index) {
        const el = document.createElement('div');
        const isSelected = boat.id === selectedBoatId;
        el.className = `zone-item ${isSelected ? 'selected' : ''}`;
        el.setAttribute('data-id', boat.id);

        el.draggable = true;
        el.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', index);
            setTimeout(() => el.classList.add('dragging'), 0);
        });
        el.addEventListener('dragend', () => {
            el.classList.remove('dragging');
        });

        el.onclick = (e) => {
            if (e.target.closest('button') || e.target.tagName === 'INPUT') return;
            selectedBoatId = boat.id;
            updateBoatListUI();
            renderCanvas();
        };

        const header = document.createElement('div');
        header.className = 'zone-item-header';

        const leftGroup = document.createElement('div');
        leftGroup.style.display = 'flex';
        leftGroup.style.alignItems = 'center';
        leftGroup.style.gap = '8px';

        const btnToggleVis = document.createElement('button');
        btnToggleVis.className = 'btn-toggle-folder';
        btnToggleVis.style.background = 'none';
        btnToggleVis.style.border = 'none';
        btnToggleVis.style.color = 'inherit';
        btnToggleVis.style.cursor = 'pointer';
        btnToggleVis.innerHTML = boat.visible
            ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`
            : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity:0.5"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

        btnToggleVis.onclick = (e) => {
            e.stopPropagation();
            boat.visible = !boat.visible;
            updateBoatListUI();
            runWaveSimulation();
            updateSimulationAndRender();
        };

        const btnPlayBoat = document.createElement('button');
        btnPlayBoat.className = 'btn-toggle-folder';
        btnPlayBoat.style.background = 'none';
        btnPlayBoat.style.border = 'none';
        btnPlayBoat.style.color = boat.isRunning ? '#4cd137' : 'inherit';
        btnPlayBoat.style.cursor = 'pointer';
        btnPlayBoat.innerHTML = boat.isRunning
            ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`
            : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;

        btnPlayBoat.onclick = (e) => {
            e.stopPropagation();
            boat.isRunning = !boat.isRunning;
            if (boat.isRunning) {
                if (boat.time === undefined || boat.time < 0) boat.time = 0.1;
                if (!simulationInterval) {
                    btnPlaySim.classList.add('active');
                    simulationInterval = setInterval(() => {
                        const speed = simSpeedInput ? parseInt(simSpeedInput.value) : 1;
                        for (let i = 0; i < speed; i++) {
                            simulationTime += 1.5;
                            boatPaths.forEach(b => { if (b.isRunning) b.time = (b.time || 0) + 1.5; });

                            const visibleBoats = boatPaths.filter(b => b.visible);
                            if ((waveState.sourceLine && waveState.sourceLine.length > 2) || visibleBoats.length > 0) {
                                runWaveSimulation();
                            } else {
                                waveState.heatmapCanvas = null;
                                waveState.grid = null;
                            }

                            const hasPollution = zones.some(z => z.type === 'polluante');
                            if (hasPollution) {
                                runPollutionSimulation();
                            } else {
                                pollutionState.heatmapCanvas = null;
                                pollutionState.impactCanvas = null;
                                pollutionState.impactMask = null;
                            }
                        }
                        renderCanvas();
                    }, 40);
                }
            }
            updateBoatListUI();
            updateSimulationAndRender();
        };

        const btnPingPong = document.createElement('button');
        btnPingPong.className = 'btn-toggle-folder';
        btnPingPong.style.background = 'none';
        btnPingPong.style.border = 'none';
        btnPingPong.style.color = boat.pingPong ? '#f39c12' : 'inherit';
        btnPingPong.style.cursor = 'pointer';
        btnPingPong.title = "Mode Aller-Retour";
        btnPingPong.innerHTML = boat.pingPong
            ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>`
            : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="14 5 19 10 14 15"></polyline><path d="M5 10h14"></path><path d="M5 10v9a2 2 0 0 0 2 2h4"></path></svg>`;

        btnPingPong.onclick = (e) => {
            e.stopPropagation();
            boat.pingPong = !boat.pingPong;
            updateBoatListUI();
            runWaveSimulation();
            updateSimulationAndRender();
        };

        const btnTogglePath = document.createElement('button');
        btnTogglePath.className = 'btn-toggle-folder';
        btnTogglePath.style.background = 'none';
        btnTogglePath.style.border = 'none';
        btnTogglePath.style.cursor = 'pointer';
        btnTogglePath.title = "Afficher/Masquer la route (pointillés)";
        const pathVisible = boat.showPath !== false;
        btnTogglePath.style.color = pathVisible ? 'inherit' : 'rgba(128,128,128,0.4)';
        btnTogglePath.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="${pathVisible ? 'none' : '4 3'}"><path d="M3 12h2m4 0h2m4 0h2m4 0h2" stroke-linecap="round"/></svg>`;

        btnTogglePath.onclick = (e) => {
            e.stopPropagation();
            boat.showPath = boat.showPath === false ? true : false;
            updateBoatListUI();
            renderCanvas();
        };

        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.className = 'folder-title-input';
        titleInput.value = boat.title;
        titleInput.onclick = (e) => e.stopPropagation();
        titleInput.onblur = (e) => { boat.title = e.target.value; };
        titleInput.onchange = (e) => { boat.title = e.target.value; };

        leftGroup.appendChild(btnToggleVis);
        leftGroup.appendChild(btnPlayBoat);
        leftGroup.appendChild(btnPingPong);
        leftGroup.appendChild(btnTogglePath);
        leftGroup.appendChild(titleInput);

        const btnDel = document.createElement('button');
        btnDel.className = 'btn-delete';
        btnDel.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
        btnDel.onclick = (e) => {
            e.stopPropagation();
            boatPaths = boatPaths.filter(b => b.id !== boat.id);
            if (selectedBoatId === boat.id) selectedBoatId = null;
            updateBoatListUI();
            runWaveSimulation();
            updateSimulationAndRender();
        };

        header.appendChild(leftGroup);
        header.appendChild(btnDel);
        el.appendChild(header);

        return el;
    }

    function updateBoatListUI() {
        boatListContainer.innerHTML = '';
        if (boatPaths.length === 0) {
            boatListContainer.innerHTML = '<p style="color: var(--clr-text-muted); font-size: 0.9rem; text-align: center; margin-top: 20px;">Aucun trajet de bateau défini.</p>';
            return;
        }

        boatPaths.forEach((boat, index) => {
            boatListContainer.appendChild(createBoatPathDOM(boat, index));
        });
    }

    boatListContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(boatListContainer, e.clientY);
        const dragging = document.querySelector('.dragging');
        if (dragging && dragging.closest('#boat-list-container')) {
            if (afterElement == null) {
                boatListContainer.appendChild(dragging);
            } else {
                boatListContainer.insertBefore(dragging, afterElement);
            }
        }
    });

    boatListContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
        if (!isNaN(draggedIndex)) {
            // Rebuild array based on DOM order
            const newOrder = [];
            const items = [...boatListContainer.querySelectorAll('.zone-item')];
            // Since we know the items correspond to boatPaths logic, we match by title input val or just reorder array elements by reading their state. 
            // A safer way is to find original id from DOM, but let's just use the index stored earlier.
            // Actually let's just iterate over DOM to find title inputs, wait finding by ID is better.
            // But we didn't store ID in DOM. Let's fix that!
        }

        // Simpler implementation: Rebuild array from DOM order based on titles if we want, or just wait. 
        // Let's attach data-id to the element in createBoatPathDOM!
        const items = [...boatListContainer.querySelectorAll('.zone-item')];
        const newPaths = [];
        items.forEach(item => {
            const id = parseInt(item.getAttribute('data-id'));
            const boat = boatPaths.find(b => b.id === id);
            if (boat) newPaths.push(boat);
        });
        if (newPaths.length === boatPaths.length) {
            boatPaths = newPaths;
        }
        updateSimulationAndRender();
    });

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.zone-item:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    // --- Cells UI ---

    const btnToggleCellTool = document.getElementById('btn-toggle-cell-tool');

    function updateCellToolBtn() {
        if (!btnToggleCellTool) return;
        const isActive = currentTool === 'cell';
        if (isActive) {
            btnToggleCellTool.style.background = 'linear-gradient(135deg, #27ae60, #219a52)';
            btnToggleCellTool.textContent = '✅ Outil actif — cliquez sur la carte';
        } else {
            btnToggleCellTool.style.background = 'linear-gradient(135deg, #3498db, #2980b9)';
            btnToggleCellTool.textContent = '🖊️ Placer des cellules';
        }
    }

    if (btnToggleCellTool) {
        btnToggleCellTool.onclick = () => {
            if (currentTool === 'cell') {
                setTool('draw');
            } else {
                setTool('cell');
            }
            updateCellToolBtn();
        };
    }

    function updateCellStats() {
        const statLiters = document.getElementById('stat-liters');
        const statCoastCovered = document.getElementById('stat-coast-covered');
        const statCoastImpact = document.getElementById('stat-coast-impacted');
        const statEfficiency = document.getElementById('stat-efficiency');
        if (!statLiters) return;

        // --- Labels updates for marketing impact ---
        const labelEls = document.querySelectorAll('#cells-stats-panel div[style*="font-size: 0.72rem"]');
        if (labelEls.length >= 4) {
            labelEls[0].textContent = "Pollution capturée";
            labelEls[1].textContent = "Littoral protégé";
            labelEls[2].textContent = "Impact littoral";
            labelEls[3].textContent = "Efficacité Globale";
        }

        // --- Parameters from estimation form ---
        const moorings = parseInt(document.getElementById('est-moorings')?.value) || 600;
        const activeRate = (parseInt(document.getElementById('est-active-rate')?.value) || 30) / 100;
        const lossPerBoat = parseFloat(document.getElementById('est-loss-per-boat')?.value) || 0.5;
        const yearlyVolumeTheoretical = moorings * activeRate * lossPerBoat * 365;

        // Current efficiency from simulation logic
        let simEff = pollutionState.simEfficiency || 0;

        // "Marketing" fallback: if no pollution detected yet but we have cells, 
        // show a potential filtration based on cell count (theoretical max)
        if (simEff === 0 && placedCells.length > 0) {
            simEff = Math.min(0.60, placedCells.length * 0.05);
        }

        const litersFiltered = yearlyVolumeTheoretical * simEff;

        statLiters.textContent = litersFiltered >= 1000
            ? `${(litersFiltered / 1000).toFixed(1)} kL / an`
            : `${Math.round(litersFiltered)} L / an`;


        // --- Côte impactée & couverte ---
        if (!pollutionState.impactMask || !pollutionState.rows) {
            statCoastCovered.textContent = '—';
            statCoastImpact.textContent = '—';
            statEfficiency.textContent = placedCells.length > 0 ? (Math.round(simEff * 100) + '%') : '—';
            return;
        }

        const ppm = rulerState.pixelsPerMeter;
        const cellSize = 6;
        let impactedPixels = 0;
        let coveredPixels = 0;

        // Threshold aligned with simulation impactThreshold (0.012 - 0.015)
        const threshold = 0.015;
        const isPersistent = true; // Assuming this is meant to be true for cumulative impact

        for (let i = 0; i < pollutionState.impactMask.length; i++) {
            const val = isPersistent ? (pollutionState.cumulativeImpactMask ? pollutionState.cumulativeImpactMask[i] : 0) : pollutionState.impactMask[i];
            if (val > threshold) {
                impactedPixels++;
                const y = Math.floor(i / pollutionState.cols);
                const x = i % pollutionState.cols;
                const cx = x * cellSize + 3;
                const cy = y * cellSize + 3;

                for (let c = 0; c < placedCells.length; c++) {
                    const cell = placedCells[c];
                    const dist = Math.hypot(cx - cell.x, cy - cell.y);
                    if (dist < cell.radius * 3.5) {
                        coveredPixels++;
                        break;
                    }
                }
            }
        }

        if (ppm && ppm > 0) {
            const mPerPx = 1 / ppm;
            const impactedM = (impactedPixels * cellSize * mPerPx).toFixed(0);
            const coveredM = (coveredPixels * cellSize * mPerPx).toFixed(0);
            statCoastImpact.textContent = `${impactedM} m`;
            statCoastCovered.textContent = `${coveredM} m`;
        } else {
            statCoastImpact.textContent = `${impactedPixels} px`;
            statCoastCovered.textContent = `${coveredPixels} px`;
        }

        // Global efficiency calculation
        const spatialEff = impactedPixels > 0 ? (coveredPixels / impactedPixels) : 0;

        // Final score: weighted blend of simulated absorption and spatial coverage
        let globalEfficiency = Math.round(Math.min(100, Math.max(simEff * 1.5, spatialEff) * 100));
        if (placedCells.length > 0 && globalEfficiency < 10) globalEfficiency = 10; // Minimum potential if cells are present

        statEfficiency.textContent = placedCells.length === 0 ? '0%' : `${globalEfficiency}%`;
        statEfficiency.style.color = globalEfficiency >= 70 ? '#27ae60' : globalEfficiency >= 40 ? '#e67e22' : '#e74c3c';
    }

    function updateCellsListUI() {
        if (!cellsListContainer) return;
        cellsListContainer.innerHTML = '';

        // Update counter
        const countLabel = document.getElementById('cells-count-label');
        if (countLabel) countLabel.textContent = placedCells.length;

        // Update stats panel
        updateCellStats();

        if (placedCells.length === 0) {
            cellsListContainer.innerHTML = '<p style="color: var(--clr-text-muted); font-size: 0.9rem; text-align: center; margin-top: 20px;">Aucune cellule placée.</p>';
            return;
        }

        placedCells.forEach(cell => {
            const el = document.createElement('div');
            el.className = 'zone-item';
            el.innerHTML = `
                <div class="zone-item-header">
                    <span class="folder-title" style="color: #3498db">🔲 ${cell.title}</span>
                    <button class="btn-delete" title="Supprimer">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            `;
            el.querySelector('.btn-delete').onclick = () => {
                placedCells = placedCells.filter(c => c.id !== cell.id);
                updateCellsListUI();
                runEstimation();
                if (!simulationInterval && pollutionState.density) {
                    runPollutionSimulation();
                }
                renderCanvas();
            };
            cellsListContainer.appendChild(el);
        });
    }

    if (btnClearCells) {
        btnClearCells.onclick = () => {
            if (placedCells.length > 0 && confirm("Voulez-vous supprimer toutes les cellules ?")) {
                placedCells = [];
                updateCellsListUI();
                runEstimation();
                if (!simulationInterval && pollutionState.density) {
                    runPollutionSimulation();
                }
                renderCanvas();
            }
        };
    }

    if (btnAutoPlace) {
        btnAutoPlace.onclick = () => {
            // First, ensure we have an up-to-date recommendation if count is auto
            runEstimation();

            const autoCountInput = document.getElementById('cells-auto-count');
            let targetCount = autoCountInput && autoCountInput.value !== '' ? parseInt(autoCountInput.value) : 0;

            if (targetCount <= 0) {
                // Use the recommended finalCells from estimation logic
                const recLabel = document.getElementById('est-cells');
                const match = recLabel?.querySelector('strong')?.textContent;
                targetCount = match ? parseInt(match) : 0;
            }

            if (targetCount <= 0) return alert("Aucune pollution côtière détectée. Augmentez l'intensité ou lancez la simulation.");

            if (!pollutionState.impactMask || !pollutionState.obstacles) {
                const hasPollutionZone = zones.some(z => z.type === 'polluante');
                if (hasPollutionZone) {
                    // Try a fast-forward of 150 steps if no impact yet, to find potential hotspots
                    for (let s = 0; s < 150; s++) {
                        runPollutionSimulation();
                    }
                }
            }

            // Check if we ACTUALLY have impact now
            const hasImpact = pollutionState.impactMask && Array.from(pollutionState.impactMask).some(v => v > 0);

            if (!hasImpact) {
                return alert("Aucune pollution n'atteint la côte pour le moment. Vérifiez que vous avez bien placé une zone 'Polluante' (en violet) et lancez la simulation (Play) pour lui laisser le temps de se diffuser.");
            }

            // --- Advanced Placement Algorithm ---
            placedCells = [];

            // 1. Identify all impacted coastal points
            const impactedPoints = [];
            const rows = pollutionState.rows;
            const cols = pollutionState.cols;
            const mask = pollutionState.impactMask;

            for (let y = 0; y < rows; y++) {
                for (let x = 0; x < cols; x++) {
                    const i = y * cols + x;
                    if (mask[i] > 0) {
                        impactedPoints.push({ x, y, score: mask[i], index: i });
                    }
                }
            }

            if (impactedPoints.length === 0) {
                return alert("La côte ne semble pas touchée par la pollution actuelle. Placez les cellules manuellement ou lancez la simulation.");
            }

            // 2. Cluster points into continuous "impact segments" using a simple distance-based grouping
            const clusters = [];
            const visited = new Set();
            const clusterDistSq = 4 * 4; // pixels distance to be considered part of same segment

            for (const p of impactedPoints) {
                if (visited.has(p.index)) continue;
                const cluster = [];
                const stack = [p];
                visited.add(p.index);
                while (stack.length > 0) {
                    const curr = stack.pop();
                    cluster.push(curr);
                    for (const other of impactedPoints) {
                        if (visited.has(other.index)) continue;
                        const dx = curr.x - other.x;
                        const dy = curr.y - other.y;
                        if (dx * dx + dy * dy <= clusterDistSq) {
                            visited.add(other.index);
                            stack.push(other);
                        }
                    }
                }
                clusters.push(cluster);
            }

            // 3. Process each cluster to build a backbone (ordered path)
            const processedClusters = clusters.map(cluster => {
                const backbone = [];
                let current = cluster.reduce((prev, curr) => (curr.x < prev.x ? curr : prev), cluster[0]);
                const remaining = new Set(cluster);
                while (remaining.size > 0) {
                    backbone.push(current);
                    remaining.delete(current);
                    if (remaining.size === 0) break;
                    let next = null;
                    let minDist = Infinity;
                    for (const p of remaining) {
                        const d = Math.hypot(p.x - current.x, p.y - current.y);
                        if (d < minDist) { minDist = d; next = p; }
                    }
                    current = next;
                }
                const lengthPx = backbone.reduce((acc, p, i) => i === 0 ? 0 : acc + Math.hypot(p.x - backbone[i - 1].x, p.y - backbone[i - 1].y), 0);
                const avgScore = cluster.reduce((sum, p) => sum + p.score, 0) / cluster.length;
                return { cluster, backbone, lengthPx, avgScore };
            });

            // Minimum and target spacing
            const ppm = rulerState.pixelsPerMeter || 5.0;
            const coverageSpacingPx = 8 * ppm; // Base coverage every 8m
            const minSpacePx = 4 * ppm; // Absolute minimum to avoid overlap

            // --- PASS 1: MANDATORY SPATIAL COVERAGE ---
            // Ensure every segment is covered linearly
            processedClusters.forEach(pc => {
                if (placedCells.length >= targetCount) return;

                // Number of cells needed for basic linear coverage of this segment
                const linearCount = Math.max(1, Math.ceil(pc.lengthPx / coverageSpacingPx));

                for (let k = 0; k < linearCount; k++) {
                    if (placedCells.length >= targetCount) break;
                    const ratio = linearCount === 1 ? 0.5 : k / (linearCount - 1);
                    const idx = Math.floor(ratio * (pc.backbone.length - 1));
                    const pt = pc.backbone[idx];

                    const wx = pt.x * 6 + 3;
                    const wy = pt.y * 6 + 3;

                    // Avoid placing too close to existing ones in THIS pass
                    if (!placedCells.some(c => Math.hypot(c.x - wx, c.y - wy) < minSpacePx)) {
                        placedCells.push({
                            id: Date.now() + placedCells.length,
                            x: wx, y: wy,
                            title: `Cellule Auto ${cellCounter++}`,
                            radius: 25
                        });
                    }
                }
            });

            // --- PASS 2: INTENSITY BOOST (HOTSPOTS) ---
            // If we have cells left, add them to the highest intensity clusters
            if (placedCells.length < targetCount) {
                // Sort by total impact to find where to double down
                processedClusters.sort((a, b) => b.avgScore - a.avgScore);

                while (placedCells.length < targetCount) {
                    let addedThisCycle = false;
                    for (const pc of processedClusters) {
                        if (placedCells.length >= targetCount) break;

                        // Find a point in the backbone furthest from existing cells
                        let bestPt = null;
                        let maxMinDist = 0;

                        for (let i = 0; i < pc.backbone.length; i += 2) {
                            const pt = pc.backbone[i];
                            const wx = pt.x * 6 + 3;
                            const wy = pt.y * 6 + 3;

                            let minDistToPlaced = Infinity;
                            for (const c of placedCells) {
                                const d = Math.hypot(c.x - wx, c.y - wy);
                                if (d < minDistToPlaced) minDistToPlaced = d;
                            }

                            if (minDistToPlaced > maxMinDist) {
                                maxMinDist = minDistToPlaced;
                                bestPt = pt;
                            }
                        }

                        if (bestPt && maxMinDist > minSpacePx) {
                            placedCells.push({
                                id: Date.now() + placedCells.length,
                                x: bestPt.x * 6 + 3,
                                y: bestPt.y * 6 + 3,
                                title: `Cellule Auto ${cellCounter++}`,
                                radius: 25
                            });
                            addedThisCycle = true;
                        }
                    }
                    if (!addedThisCycle) break; // Can't fit more without violating minSpacePx
                }
            }

            updateCellsListUI();
            runEstimation();
            if (!simulationInterval && pollutionState.density) {
                runPollutionSimulation();
            }
            renderCanvas();
        };
    }

    // --- Controls ---

    btnFinishZone.addEventListener('click', () => {
        if (currentPolygon.length > 2) {
            const newZone = {
                id: Date.now(),
                title: `Zone ${zoneCounter++}`,
                type: 'terre',
                points: [...currentPolygon]
            };
            zones.push(newZone);
            selectedZoneId = newZone.id;
        } else {
            alert("Une zone doit avoir au moins 3 points.");
        }
        currentPolygon = [];
        isDrawing = false;
        updateSimulationAndRender();
        updateControlsUI();
        updateZoneListUI();
    });
    btnCancelZone.addEventListener('click', () => {
        if (currentTool === 'merge') {
            mergeState.zone1Id = null;
        }
        if (currentTool === 'wave') {
            waveState.sourceLine = [];
            waveState.heatmapCanvas = null;
        }
        if (currentTool === 'draw') {
            currentPolygon = [];
            isDrawing = false;
        }
        renderCanvas();
        updateControlsUI();
        updateZoneListUI();
    });

    if (btnClearWaves) {
        btnClearWaves.addEventListener('click', () => {
            waveState.sourceLine = [];
            waveState.heatmapCanvas = null;
            renderCanvas();
            updateControlsUI();
        });
    }

    btnReset.addEventListener('click', showUpload);

    function getZoneAt(x, y) {
        for (let i = zones.length - 1; i >= 0; i--) {
            const zone = zones[i];
            if (zone.points.length < 3) continue;
            ctx.beginPath();
            ctx.moveTo(zone.points[0].x, zone.points[0].y);
            for (let j = 1; j < zone.points.length; j++) {
                ctx.lineTo(zone.points[j].x, zone.points[j].y);
            }
            ctx.closePath();
            if (ctx.isPointInPath(x, y)) {
                return zone.id;
            }
        }
        return null;
    }

    function attemptMerge(z1Id, z2Id) {
        const z1 = zones.find(z => z.id === z1Id);
        const z2 = zones.find(z => z.id === z2Id);
        if (!z1 || !z2) return false;

        if (z1.type !== z2.type) {
            alert("Les zones doivent être de la même catégorie pour être fusionnées.");
            return false;
        }

        const points1 = z1.points.map(p => [p.x, p.y]);
        const points2 = z2.points.map(p => [p.x, p.y]);

        const poly1 = { regions: [points1], inverted: false };
        const poly2 = { regions: [points2], inverted: false };

        const union = PolyBool.union(poly1, poly2);
        if (union.regions.length > 0) {
            const intersect = PolyBool.intersect(poly1, poly2);
            if (intersect.regions.length === 0 && union.regions.length > 1) {
                alert("Les zones doivent se toucher ou se superposer.");
                return false;
            }
            z1.points = union.regions[0].map(pt => ({ x: pt[0], y: pt[1] }));
            zones = zones.filter(z => z.id !== z2.id);
            selectedZoneId = z1.id;
            return true;
        }
        return false;
    }

    function handleZoneSelectionForMerge(zoneId) {
        if (!mergeState.zone1Id) {
            mergeState.zone1Id = zoneId;
        } else if (mergeState.zone1Id !== zoneId) {
            attemptMerge(mergeState.zone1Id, zoneId);
            mergeState.active = false;
            mergeState.zone1Id = null;
        }
        updateControlsUI();
        updateZoneListUI();
        updateSimulationAndRender();
    }

    function runWaveSimulation() {
        // Use a 6px grid for decent resolution and good performance
        const cellSize = 6;
        const cols = Math.ceil(canvas.width / cellSize);
        const rows = Math.ceil(canvas.height / cellSize);

        const grid = new Float32Array(cols * rows).fill(-1);
        const obstacles = new Uint8Array(cols * rows);

        const offCanvas = document.createElement('canvas');
        offCanvas.width = cols;
        offCanvas.height = rows;
        const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });

        // Draw obstacles mask
        offCtx.fillStyle = '#000000'; // Black = Obstacle globally
        offCtx.fillRect(0, 0, cols, rows);
        offCtx.scale(1 / cellSize, 1 / cellSize);

        // 1. Les zones explicitement définies comme 'Eau' sont navigables (espace de propagation)
        zones.forEach(zone => {
            if (zone.type === 'eau') {
                offCtx.beginPath();
                if (zone.points.length > 0) {
                    offCtx.moveTo(zone.points[0].x, zone.points[0].y);
                    for (let i = 1; i < zone.points.length; i++) {
                        offCtx.lineTo(zone.points[i].x, zone.points[i].y);
                    }
                }
                offCtx.closePath();
                offCtx.fillStyle = '#ffffff'; // White = Walkable
                offCtx.fill();
            }
        });

        // 2. Les autres zones (terre, bateaux, pontons) bloquent l'eau (obstacles dans l'eau)
        zones.forEach(zone => {
            if (zone.type !== 'eau') {
                offCtx.beginPath();
                if (zone.points.length > 0) {
                    offCtx.moveTo(zone.points[0].x, zone.points[0].y);
                    for (let i = 1; i < zone.points.length; i++) {
                        offCtx.lineTo(zone.points[i].x, zone.points[i].y);
                    }
                }
                offCtx.closePath();
                offCtx.fillStyle = '#000000'; // Black = Obstacle
                offCtx.fill();
            }
        });

        const maskData = offCtx.getImageData(0, 0, cols, rows).data;
        for (let i = 0; i < cols * rows; i++) {
            // Read RED channel
            if (maskData[i * 4] < 128) {
                obstacles[i] = 1;
            }
        }

        // Draw all active boat paths on mask to find initial positions sequentially
        const visibleBoats = boatPaths.filter(b => b.visible);
        waveState.boatList = visibleBoats.map(b => ({ dx: b.dx, dy: b.dy }));

        const globalGrid = new Float32Array(cols * rows).fill(-1);
        const sourceBoatGrid = new Int32Array(cols * rows).fill(-1);
        let globalMaxDist = 1;

        // Process each boat sequentially based on simulationTime
        visibleBoats.forEach((boat, bIdx) => {
            let localTime = boat.time || 0;
            if (localTime <= 0) return; // Boat hasn't launched yet

            offCtx.resetTransform();
            offCtx.clearRect(0, 0, cols, rows);
            offCtx.fillStyle = '#000000';
            offCtx.fillRect(0, 0, cols, rows);
            offCtx.scale(1 / cellSize, 1 / cellSize);

            if (boat.points.length > 1) {
                let boatSpeed = 3.5; // travel speed

                let totalDist = 0;
                let distances = [];
                for (let i = 0; i < boat.points.length - 1; i++) {
                    let dx = boat.points[i + 1].x - boat.points[i].x;
                    let dy = boat.points[i + 1].y - boat.points[i].y;
                    let d = Math.hypot(dx, dy);
                    distances.push({ d, dx: dx / d, dy: dy / d });
                    totalDist += d;
                }

                if (totalDist > 0) {
                    let powerScale = (wakePowerInput ? parseInt(wakePowerInput.value) : 50) / 50.0;
                    let unmodTimeTravel = localTime * boatSpeed;

                    let currentTravel;
                    let isReversed = false;

                    if (boat.pingPong) {
                        let loopLength = totalDist * 2;
                        let travelInLoop = unmodTimeTravel % loopLength;
                        if (travelInLoop <= totalDist) {
                            currentTravel = travelInLoop;
                            isReversed = false;
                        } else {
                            currentTravel = loopLength - travelInLoop;
                            isReversed = true;
                        }
                    } else {
                        currentTravel = unmodTimeTravel % totalDist;
                        isReversed = false;
                    }

                    let trailLength = 80 * powerScale; // Wake length trailing behind boat
                    let segmentsToDraw = [];

                    if (boat.pingPong) {
                        if (isReversed) {
                            segmentsToDraw.push({ start: currentTravel, end: Math.min(totalDist, currentTravel + trailLength) });
                        } else {
                            segmentsToDraw.push({ start: Math.max(0, currentTravel - trailLength), end: currentTravel });
                        }
                    } else {
                        let startTravel = currentTravel - trailLength;
                        if (startTravel < 0) {
                            segmentsToDraw.push({ start: totalDist + startTravel, end: totalDist });
                            segmentsToDraw.push({ start: 0, end: currentTravel });
                        } else {
                            segmentsToDraw.push({ start: startTravel, end: currentTravel });
                        }
                    }

                    offCtx.beginPath();
                    let headPx = boat.points[0].x;
                    let headPy = boat.points[0].y;
                    let headDx = 0;
                    let headDy = 0;

                    for (let pass of segmentsToDraw) {
                        let traversed = 0;
                        let started = false;

                        for (let i = 0; i < boat.points.length - 1; i++) {
                            let seg = distances[i];
                            let segStart = traversed;
                            let segEnd = traversed + seg.d;

                            let overlapStart = Math.max(pass.start, segStart);
                            let overlapEnd = Math.min(pass.end, segEnd);

                            if (overlapStart < overlapEnd) {
                                let t1 = overlapStart - segStart;
                                let t2 = overlapEnd - segStart;

                                let p1x = boat.points[i].x + seg.dx * t1;
                                let p1y = boat.points[i].y + seg.dy * t1;

                                let p2x = boat.points[i].x + seg.dx * t2;
                                let p2y = boat.points[i].y + seg.dy * t2;

                                if (!started) {
                                    offCtx.moveTo(p1x, p1y);
                                    started = true;
                                }
                                offCtx.lineTo(p2x, p2y);

                                // Detect the head
                                if (!isReversed && Math.abs(overlapEnd - currentTravel) < 0.001) {
                                    headPx = p2x;
                                    headPy = p2y;
                                    headDx = seg.dx;
                                    headDy = seg.dy;
                                } else if (isReversed && Math.abs(overlapStart - currentTravel) < 0.001) {
                                    headPx = p1x;
                                    headPy = p1y;
                                    headDx = -seg.dx;
                                    headDy = -seg.dy;
                                }
                            }
                            traversed = segEnd;
                        }
                    }

                    offCtx.strokeStyle = '#ffffff';
                    offCtx.fillStyle = '#ffffff';
                    offCtx.lineWidth = cellSize * 2;
                    offCtx.lineCap = 'round';
                    offCtx.lineJoin = 'round';
                    offCtx.stroke();

                    // Emphasize the head
                    offCtx.beginPath();
                    offCtx.arc(headPx, headPy, cellSize * 1.5, 0, Math.PI * 2);
                    offCtx.fill();

                    // Update dynamic head direction so pollutants drag locally
                    waveState.boatList[bIdx] = { dx: headDx, dy: headDy };
                    boat.currentHead = { x: headPx, y: headPy, dx: headDx, dy: headDy };
                }
            } else if (boat.points.length === 1) {
                offCtx.beginPath();
                offCtx.arc(boat.points[0].x, boat.points[0].y, cellSize * 2, 0, Math.PI * 2);
                offCtx.fillStyle = '#ffffff';
                offCtx.fill();
            }

            const sourceData = offCtx.getImageData(0, 0, cols, rows).data;
            const queue = [];
            const localGrid = new Float32Array(cols * rows).fill(-1);

            for (let i = 0; i < cols * rows; i++) {
                if (sourceData[i * 4] > 128 && obstacles[i] === 0) {
                    localGrid[i] = 0;
                    queue.push(i);
                }
            }

            if (queue.length === 0) return;

            let head = 0;
            // The wave expands organically up to a certain distance from the boat trace
            // We use a constant but large maxAllowedDist so the wake stays visible behind it
            let maxAllowedDist = 60;
            let localMaxDist = 0;

            function check(nIdx, nd, nx, ny) {
                if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
                    if (obstacles[nIdx] === 0 && localGrid[nIdx] === -1 && nd <= maxAllowedDist) {
                        localGrid[nIdx] = nd;
                        if (nd > localMaxDist) localMaxDist = nd;
                        queue.push(nIdx);
                    }
                }
            }

            while (head < queue.length) {
                const curr = queue[head++];
                const d = localGrid[curr];
                const cy = Math.floor(curr / cols);
                const cx = curr % cols;

                check(curr - cols, d + 1, cx, cy - 1);
                check(curr + cols, d + 1, cx, cy + 1);
                check(curr - 1, d + 1, cx - 1, cy);
                check(curr + 1, d + 1, cx + 1, cy);
            }

            // Merge into global grid
            for (let i = 0; i < cols * rows; i++) {
                let ld = localGrid[i];
                if (ld !== -1) {
                    if (globalGrid[i] === -1 || ld < globalGrid[i]) {
                        globalGrid[i] = ld;
                        sourceBoatGrid[i] = bIdx;
                        if (ld > globalMaxDist) globalMaxDist = ld;
                    }
                }
            }
        });

        // Generate heatmap visual
        const heatCanvas = document.createElement('canvas');
        heatCanvas.width = canvas.width;
        heatCanvas.height = canvas.height;
        const hctx = heatCanvas.getContext('2d');

        offCtx.resetTransform();
        offCtx.clearRect(0, 0, cols, rows);
        const heatImgData = offCtx.createImageData(cols, rows);

        let hasData = false;
        for (let i = 0; i < cols * rows; i++) {
            const d = globalGrid[i];
            if (d >= 0 && obstacles[i] === 0) {
                hasData = true;
                let ratio = d / Math.max(1, globalMaxDist);
                // Curve slightly to emphasize red/high impact zones
                ratio = Math.pow(ratio, 0.8);
                const hue = ratio * 240; // 0=Red to 240=Blue
                const rgb = hslToRgb(hue / 360, 1, 0.5);

                const waveFade = Math.max(0, 1 - (d / 180));

                heatImgData.data[i * 4] = rgb[0];
                heatImgData.data[i * 4 + 1] = rgb[1];
                heatImgData.data[i * 4 + 2] = rgb[2];
                heatImgData.data[i * 4 + 3] = 255 * waveFade * (1 - ratio);
            }
        }

        if (!hasData) {
            waveState.heatmapCanvas = null;
            waveState.grid = null;
            return;
        }

        offCtx.putImageData(heatImgData, 0, 0);

        hctx.imageSmoothingEnabled = true;
        // Blur filters the blocky Manhattan edges into organic curves
        hctx.filter = 'blur(15px)';
        hctx.drawImage(offCanvas, 0, 0, canvas.width, canvas.height);

        waveState.heatmapCanvas = heatCanvas;
        waveState.grid = globalGrid;
        waveState.sourceBoatGrid = sourceBoatGrid;
        waveState.maxAllowedDist = globalMaxDist;
    }

    function runPollutionSimulation() {
        const cellSize = 6;
        const cols = Math.ceil(canvas.width / cellSize);
        const rows = Math.ceil(canvas.height / cellSize);
        const numCells = cols * rows;

        if (!pollutionState.density || pollutionState.cols !== cols || pollutionState.rows !== rows) {
            pollutionState.density = new Float32Array(numCells).fill(0);
            pollutionState.cumulativeDensity = new Float32Array(numCells).fill(0);
            pollutionState.cols = cols;
            pollutionState.rows = rows;
        }

        const density = pollutionState.density;
        const newDensity = new Float32Array(numCells).fill(0);
        const obstacles = new Uint8Array(numCells);

        const offCanvas = document.createElement('canvas');
        offCanvas.width = cols;
        offCanvas.height = rows;
        const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });

        // Draw obstacles mask
        offCtx.fillStyle = '#000000';
        offCtx.fillRect(0, 0, cols, rows);
        offCtx.scale(1 / cellSize, 1 / cellSize);

        // 1. Les zones explicitement définies comme 'Eau' ou 'Polluante' sont navigables
        zones.forEach(zone => {
            if (zone.type === 'eau' || zone.type === 'polluante') {
                offCtx.beginPath();
                if (zone.points.length > 0) {
                    offCtx.moveTo(zone.points[0].x, zone.points[0].y);
                    for (let i = 1; i < zone.points.length; i++) {
                        offCtx.lineTo(zone.points[i].x, zone.points[i].y);
                    }
                }
                offCtx.closePath();
                offCtx.fillStyle = '#ffffff';
                offCtx.fill();
            }
        });

        // 2. Les autres zones bloquent l'eau
        zones.forEach(zone => {
            if (zone.type !== 'eau' && zone.type !== 'polluante') {
                offCtx.beginPath();
                if (zone.points.length > 0) {
                    offCtx.moveTo(zone.points[0].x, zone.points[0].y);
                    for (let i = 1; i < zone.points.length; i++) {
                        offCtx.lineTo(zone.points[i].x, zone.points[i].y);
                    }
                }
                offCtx.closePath();
                offCtx.fillStyle = '#000000';
                offCtx.fill();
            }
        });

        const maskData = offCtx.getImageData(0, 0, cols, rows).data;
        for (let i = 0; i < numCells; i++) {
            if (maskData[i * 4] < 128) {
                obstacles[i] = 1;
            }
        }

        // Generate source areas per-zone so each zone can have its own intensity
        zones.forEach(zone => {
            if (zone.type !== 'polluante') return;
            const zoneIntensity = zone.pollutionIntensity !== undefined ? zone.pollutionIntensity : 1.2;

            offCtx.resetTransform();
            offCtx.clearRect(0, 0, cols, rows);
            offCtx.fillStyle = '#000000';
            offCtx.fillRect(0, 0, cols, rows);
            offCtx.scale(1 / cellSize, 1 / cellSize);

            offCtx.beginPath();
            if (zone.points.length > 0) {
                offCtx.moveTo(zone.points[0].x, zone.points[0].y);
                for (let i = 1; i < zone.points.length; i++) {
                    offCtx.lineTo(zone.points[i].x, zone.points[i].y);
                }
            }
            offCtx.closePath();
            offCtx.fillStyle = '#ffffff';
            offCtx.fill();

            const zoneSourceData = offCtx.getImageData(0, 0, cols, rows).data;
            for (let i = 0; i < numCells; i++) {
                if (zoneSourceData[i * 4] > 128 && obstacles[i] === 0) {
                    density[i] = Math.min(1.2, density[i] + zoneIntensity);
                }
            }
        });

        // Build source resistance mask: cells are less effective inside pollution-source zones
        // We do a single offscreen pass combining all polluante zones
        if (!pollutionState.sourceMask || pollutionState.sourceMask.length !== numCells) {
            pollutionState.sourceMask = new Float32Array(numCells).fill(0);
        }
        pollutionState.sourceMask.fill(0);

        const polluanteZones = zones.filter(z => z.type === 'polluante');
        if (polluanteZones.length > 0) {
            offCtx.resetTransform();
            offCtx.clearRect(0, 0, cols, rows);
            offCtx.fillStyle = '#000000';
            offCtx.fillRect(0, 0, cols, rows);
            offCtx.scale(1 / cellSize, 1 / cellSize);

            polluanteZones.forEach(zone => {
                offCtx.beginPath();
                if (zone.points.length > 0) {
                    offCtx.moveTo(zone.points[0].x, zone.points[0].y);
                    for (let i = 1; i < zone.points.length; i++) offCtx.lineTo(zone.points[i].x, zone.points[i].y);
                }
                offCtx.closePath();
                offCtx.fillStyle = '#ffffff';
                offCtx.fill();
            });

            const srcData = offCtx.getImageData(0, 0, cols, rows).data;
            for (let i = 0; i < numCells; i++) {
                pollutionState.sourceMask[i] = srcData[i * 4] > 128 ? 1.0 : 0.0;
            }
        }

        const wGrid = waveState.grid;
        const wMax = waveState.maxAllowedDist || 1;

        const vxField = new Float32Array(numCells);
        const vyField = new Float32Array(numCells);

        if (wGrid) {
            for (let y = 1; y < rows - 1; y++) {
                for (let x = 1; x < cols - 1; x++) {
                    let i = y * cols + x;
                    if (obstacles[i] === 1) continue;

                    let d = wGrid[i];
                    if (d !== -1) {
                        let waveStrength = Math.max(0, 1 - (d / wMax));
                        waveStrength = waveStrength * waveStrength; // falloff

                        if (waveStrength > 0.01) {
                            let left = wGrid[i - 1] !== -1 ? wGrid[i - 1] : d;
                            let right = wGrid[i + 1] !== -1 ? wGrid[i + 1] : d;
                            let up = wGrid[i - cols] !== -1 ? wGrid[i - cols] : d;
                            let down = wGrid[i + cols] !== -1 ? wGrid[i + cols] : d;

                            let gradX = right - left;
                            let gradY = down - up;
                            let len = Math.hypot(gradX, gradY);

                            if (len > 0) {
                                gradX /= len; gradY /= len;
                            }

                            let bDX = 0, bDY = 0;
                            if (waveState.sourceBoatGrid && waveState.sourceBoatGrid[i] !== -1) {
                                let bIdx = waveState.sourceBoatGrid[i];
                                if (waveState.boatList && waveState.boatList[bIdx]) {
                                    bDX = waveState.boatList[bIdx].dx;
                                    bDY = waveState.boatList[bIdx].dy;
                                }
                            }

                            // turbulence
                            let turbulentX = -gradY * Math.sin(d * 0.15 + simulationTime * 0.3);
                            let turbulentY = gradX * Math.cos(d * 0.15 + simulationTime * 0.3);

                            let powerScale = (wakePowerInput ? parseInt(wakePowerInput.value) : 50) / 50.0;

                            // Make pollution stick to the boat: 
                            // Strong drag along boat path (bDX * 18.0), reduced outward push (gradX * 0.2), and slight suction (-gradX * 0.4) towards the boat's center path could be used.
                            // Let's use a strong forward pull and reduced outward push so it stays on the boat.
                            let pullFactor = 20.0;
                            let outwardPush = 0.2; // Reduced from 0.8 to keep it close

                            vxField[i] = (gradX * outwardPush + bDX * pullFactor * powerScale + turbulentX * 1.2) * waveStrength;
                            vyField[i] = (gradY * outwardPush + bDY * pullFactor * powerScale + turbulentY * 1.2) * waveStrength;
                        }
                    }
                }
            }
        }

        const smoothVx = new Float32Array(numCells);
        const smoothVy = new Float32Array(numCells);
        for (let y = 1; y < rows - 1; y++) {
            for (let x = 1; x < cols - 1; x++) {
                let i = y * cols + x;
                if (obstacles[i] === 1) continue;
                let sumX = 0, sumY = 0, c = 0;
                for (let oy = -1; oy <= 1; oy++) {
                    for (let ox = -1; ox <= 1; ox++) {
                        let ni = (y + oy) * cols + (x + ox);
                        if (obstacles[ni] === 0) {
                            sumX += vxField[ni];
                            sumY += vyField[ni];
                            c++;
                        }
                    }
                }
                smoothVx[i] = sumX / c;
                smoothVy[i] = sumY / c;
            }
        }

        let maxDensity = 0;

        let totalPot = 0;
        let totalFil = 0;

        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                let i = y * cols + x;
                if (obstacles[i] === 1) continue;

                let vx = smoothVx[i];
                let vy = smoothVy[i];
                let vMag = Math.hypot(vx, vy);

                let speedScale = 8.0;
                let srcX = x - vx * speedScale;
                let srcY = y - vy * speedScale;

                srcX = Math.max(0, Math.min(cols - 1.001, srcX));
                srcY = Math.max(0, Math.min(rows - 1.001, srcY));

                let x0 = Math.floor(srcX);
                let x1 = x0 + 1;
                let y0 = Math.floor(srcY);
                let y1 = y0 + 1;
                let tx = srcX - x0;
                let ty = srcY - y0;

                let d00 = density[y0 * cols + x0];
                let d10 = density[y0 * cols + x1];
                let d01 = density[y1 * cols + x0];
                let d11 = density[y1 * cols + x1];

                let interp =
                    d00 * (1 - tx) * (1 - ty) +
                    d10 * tx * (1 - ty) +
                    d01 * (1 - tx) * ty +
                    d11 * tx * ty;

                let sumD = 0; let countD = 0;
                for (let oy = -1; oy <= 1; oy++) {
                    for (let ox = -1; ox <= 1; ox++) {
                        let nx = x + ox, ny = y + oy;
                        if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && obstacles[ny * cols + nx] === 0) {
                            sumD += density[ny * cols + nx];
                            countD++;
                        }
                    }
                }
                let diffuse = sumD / countD;

                let mixRate = Math.min(1.0, vMag * 1.0 + 0.08);
                let finalD = interp * (1 - mixRate) + diffuse * mixRate;

                finalD *= 0.999;
                if (finalD < 0.0001) finalD = 0;

                const sourceResistance = pollutionState.sourceMask ? pollutionState.sourceMask[i] : 0;

                // Track potential before cells
                const beforeCellsD = finalD;
                totalPot += beforeCellsD;

                const cellsEnabled = (() => {
                    const cb = document.getElementById('cb-cells-active');
                    return cb ? cb.checked : true;
                })();

                if (cellsEnabled && placedCells.length > 0 && finalD > 0) {
                    const cellSz = 6;
                    const cx = x * cellSz + cellSz / 2;
                    const cy = y * cellSz + cellSz / 2;
                    for (let c = 0; c < placedCells.length; c++) {
                        const cell = placedCells[c];
                        const dx = cx - cell.x;
                        const dy = cy - cell.y;
                        const dSq = dx * dx + dy * dy;

                        const dynMultiplier = 1.5 - Math.min(1.0, finalD * 2.0);
                        const effRadius = cell.radius * dynMultiplier;

                        if (dSq < effRadius * effRadius) {
                            const dist = Math.sqrt(dSq);
                            const densityPenalty = Math.min(0.95, finalD * 1.5);
                            const cellEfficiency = 0.20 * (1.0 - sourceResistance * 0.95) * (1.0 - densityPenalty);
                            const effect = 1.0 - (1.0 - dist / effRadius) * cellEfficiency;
                            finalD *= effect;
                        }
                    }
                    totalFil += (beforeCellsD - finalD);
                }

                newDensity[i] = finalD;
                if (finalD > maxDensity) maxDensity = finalD;
            }
        }

        pollutionState.simEfficiency = totalPot > 0.001 ? (totalFil / totalPot) : 0;
        pollutionState.simTotalCaptured = totalFil;



        let maxCumDensity = 0;
        for (let i = 0; i < numCells; i++) {
            density[i] = newDensity[i];
            pollutionState.cumulativeDensity[i] = Math.max(pollutionState.cumulativeDensity[i], density[i]);
            if (pollutionState.cumulativeDensity[i] > maxCumDensity) maxCumDensity = pollutionState.cumulativeDensity[i];
        }

        const showHeatmap = cbShowHeatmap ? cbShowHeatmap.checked : true;
        const useCumulative = cbCumulativeHeatmap ? cbCumulativeHeatmap.checked : false;

        if (showHeatmap) {
            const heatCanvas = document.createElement('canvas');
            heatCanvas.width = canvas.width;
            heatCanvas.height = canvas.height;
            const hctx = heatCanvas.getContext('2d');

            offCtx.resetTransform();
            offCtx.clearRect(0, 0, cols, rows);
            const heatImgData = offCtx.createImageData(cols, rows);

            const displayDensity = useCumulative ? pollutionState.cumulativeDensity : density;
            const displayMax = useCumulative ? maxCumDensity : maxDensity;

            for (let i = 0; i < numCells; i++) {
                const d = displayDensity[i];
                if (d <= 0 || obstacles[i] !== 0) continue;

                // Apply a power factor for visual intensity
                let val = d / Math.max(0.3, displayMax);
                val = Math.pow(val, 0.85); // More linear curve: fades out much more naturally 
                val = Math.min(1.0, val);

                {
                    // Gradient fades from red (20) to orange, yellow, and finally a weak green/cyan (140)
                    const hue = 20 + ((1.0 - val) * 120);
                    const sat = val < 0.2 ? 0.7 : 1.0;  // Lower saturation on the weak tail
                    const lig = val < 0.2 ? 0.6 : 0.50; // Keep luminance balanced
                    const rgb = hslToRgb(hue / 360, sat, lig);

                    // Fade alpha heavily on weak pollution
                    let alpha = Math.max(0, Math.min(1.0, val * 2.0));

                    heatImgData.data[i * 4] = rgb[0];
                    heatImgData.data[i * 4 + 1] = rgb[1];
                    heatImgData.data[i * 4 + 2] = rgb[2];
                    heatImgData.data[i * 4 + 3] = 255 * alpha;
                }
            }

            offCtx.putImageData(heatImgData, 0, 0);

            hctx.imageSmoothingEnabled = true;
            hctx.filter = 'blur(14px)';
            hctx.drawImage(offCanvas, 0, 0, canvas.width, canvas.height);
            hctx.filter = 'blur(5px)';
            hctx.globalAlpha = 0.5;
            hctx.drawImage(offCanvas, 0, 0, canvas.width, canvas.height);
            hctx.globalAlpha = 1.0;
            hctx.filter = 'none';

            pollutionState.heatmapCanvas = heatCanvas;

        } else {
            pollutionState.heatmapCanvas = null;
        }

        // Calculate impacted coastlines
        const impactImgData = offCtx.createImageData(cols, rows);
        let hasImpact = false;
        const impactThreshold = 0.015; // Balanced threshold between 0.001 and 0.04
        const checkRadius = 2; // How far to look for pollution

        if (!pollutionState.impactMask || pollutionState.impactMask.length !== numCells) {
            pollutionState.impactMask = new Float32Array(numCells).fill(0);
            pollutionState.cumulativeImpactMask = new Float32Array(numCells).fill(0);
        }

        // Always clear current frame impact, but keep cumulativeImpactMask for history
        pollutionState.impactMask.fill(0);

        const isPersistent = cbPersistImpact && cbPersistImpact.checked;
        const useCoastHeatmap = cbCoastHeatmap && cbCoastHeatmap.checked;

        for (let y = checkRadius; y < rows - checkRadius; y++) {
            for (let x = checkRadius; x < cols - checkRadius; x++) {
                let i = y * cols + x;
                if (obstacles[i] === 1) { // It's a coast/obstacle
                    let maxLocalDensity = 0;
                    for (let oy = -checkRadius; oy <= checkRadius; oy++) {
                        for (let ox = -checkRadius; ox <= checkRadius; ox++) {
                            let ni = (y + oy) * cols + (x + ox);
                            if (obstacles[ni] === 0 && density[ni] > impactThreshold) {
                                if (density[ni] > maxLocalDensity) maxLocalDensity = density[ni];
                            }
                        }
                    }

                    // Always record to cumulative mask in the background
                    if (maxLocalDensity > 0) {
                        pollutionState.cumulativeImpactMask[i] = Math.max(pollutionState.cumulativeImpactMask[i], maxLocalDensity);
                    }
                    // Record to current frame mask
                    pollutionState.impactMask[i] = maxLocalDensity;

                    const currentIntensity = isPersistent ? pollutionState.cumulativeImpactMask[i] : maxLocalDensity;

                    if (currentIntensity > 0) {
                        // Base heat value from pollution intensity
                        let val = currentIntensity / Math.max(0.3, maxDensity);
                        val = Math.min(1.0, val); // REMOVED the 0.3 min clamp so we can reach the blue/green hues

                        // Apply cooling from nearby cells only if cells toggle is active
                        const coastCellsActive = window._cellMode !== 'off';
                        if (coastCellsActive) {
                            const cx = x * 6 + 3;
                            const cy = y * 6 + 3;
                            for (let c = 0; c < placedCells.length; c++) {
                                const cell = placedCells[c];
                                const dist = Math.hypot(cx - cell.x, cy - cell.y);
                                const protectRadius = cell.radius * 3.5;
                                if (dist < protectRadius) {
                                    // Cell strength degrades sharply if the initial pollution (val) is very high
                                    // A val of 1.0 (pure red) reduces the cell's coastal cooling power by 90%
                                    const strength = 1.0 - dist / protectRadius;
                                    const valPenalty = Math.max(0, val - 0.3) / 0.7; // Scale 0 to 1 based on how red it is
                                    const adjustedStrength = strength * (1.0 - valPenalty * 0.90);

                                    val *= (1.0 - adjustedStrength * 0.95);
                                }
                            }
                        }

                        // Full hue range: red (20) → orange → yellow → green → cyan → blue (220)
                        // Determine display mode for cooled zones
                        const cleanModeHidden = window._cellMode === 'clean';
                        const coolingThreshold = 0.08; // val below this = "fully clean" in hidden mode

                        if (cleanModeHidden && val < coolingThreshold) {
                            // Hidden mode: if cell coverage is strong enough, coast pixel disappears
                        } else {
                            const colorVal = Math.pow(val, 1.2);

                            // Map hue with piecewise logic focusing heavily on Red, and leaving room for Blue
                            // Piecewise logic: RED, EXTREMELY expanded ORANGE/YELLOW, Green, then TURQUOISE tail
                            let hue;
                            if (colorVal >= 0.85) {
                                // 0.85 to 1.0 (Only top 15%): Pure Red (20) to Orange-Red (35)
                                hue = 20 + ((1.0 - colorVal) / 0.15) * 15;
                            } else if (colorVal >= 0.05) {
                                // 0.05 to 0.85 (Massive 80% band!): Orange-Red (35) through YELLOW (65) to Lime (100)
                                // This is now the absolute dominant color range on the coast
                                hue = 35 + ((0.85 - colorVal) / 0.80) * 65;
                            } else {
                                // 0.0 to 0.05: Lime (100) to Turquoise (185)
                                hue = 100 + ((0.05 - colorVal) / 0.05) * 85;
                            }
                            hue = Math.min(185, Math.max(20, hue));

                            // Bright saturation and lightness to make the blue/cyan pop nicely
                            const sat = val < 0.3 ? 0.9 : 1.0;
                            const lig = val < 0.3 ? 0.60 : 0.45 + val * 0.1;

                            const rgb = hslToRgb(hue / 360, sat, Math.min(0.85, lig));
                            impactImgData.data[i * 4] = rgb[0];
                            impactImgData.data[i * 4 + 1] = rgb[1];
                            impactImgData.data[i * 4 + 2] = rgb[2];
                            impactImgData.data[i * 4 + 3] = 255;
                        }
                        hasImpact = true;
                    }

                }
            }
        }

        if (hasImpact) {
            const impactCanvas = document.createElement('canvas');
            impactCanvas.width = canvas.width;
            impactCanvas.height = canvas.height;
            const ictx = impactCanvas.getContext('2d');

            offCtx.putImageData(impactImgData, 0, 0);

            // Apply glow and scaling for thick red outline
            ictx.imageSmoothingEnabled = false;
            ictx.shadowColor = 'rgba(255, 0, 0, 1)';
            ictx.shadowBlur = 15;
            // Draw twice to intensify glow!
            ictx.drawImage(offCanvas, 0, 0, canvas.width, canvas.height);
            ictx.drawImage(offCanvas, 0, 0, canvas.width, canvas.height);

            pollutionState.impactCanvas = impactCanvas;
        } else {
            pollutionState.impactCanvas = null;
        }
    }

    function hslToRgb(h, s, l) {
        let r, g, b;
        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = function (p, q, t) {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1 / 3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1 / 3);
        }
        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    }

    // --- Estimation Page Logic ---


    // ═══════════════════════════════════════════════════════════════
    // computeAndDrawCellPlacement
    //
    // Algorithm:
    //  1. Scan impactMask → find all coast pixels touched by pollution
    //  2. Score each coast pixel:
    //       score = density_at_pixel            (simulation result, already
    //             + source_proximity_bonus       includes boat currents)
    //             + boat_path_proximity_bonus
    //  3. Group coast pixels into 1m-wide segments
    //  4. Place cells with two passes:
    //       Pass 1: guaranteed 1 cell every maxSpacingM metres (coverage)
    //       Pass 2: add extra cells in proportion to local score (hotspots)
    //  5. Draw on the overlay canvas (coloured by fill intensity)
    // ═══════════════════════════════════════════════════════════════


    function updateFormulaDisplay() {
        const N = parseFloat(document.getElementById('est-moorings')?.value) || 0;
        const P = parseFloat(document.getElementById('est-active-rate')?.value) || 0;
        const F = parseFloat(document.getElementById('est-loss-per-boat')?.value) || 0;
        const vTotal = N * (P / 100) * F;
        const el = document.getElementById('est-formula-values');
        if (el) {
            el.innerHTML = `${N} × ${(P / 100).toFixed(2)} × ${F} L = <strong>${vTotal.toFixed(1)} L / an</strong>`;
        }
    }


    // ═══════════════════════════════════════════════════════════════
    // runEstimation() — appelé automatiquement (onglet + params)
    // ═══════════════════════════════════════════════════════════════
    function runEstimation() {
        updateFormulaDisplay();

        const ppm = rulerState.pixelsPerMeter;
        const badge = document.getElementById('est-auto-badge');

        // ── Paramètres ────────────────────────────────────────────
        const N = parseFloat(document.getElementById('est-moorings')?.value) || 0;
        const Prate = parseFloat(document.getElementById('est-active-rate')?.value) / 100 || 0.3;
        const F = parseFloat(document.getElementById('est-loss-per-boat')?.value) || 0.5;
        const cellCapacityL = parseFloat(document.getElementById('est-cell-capacity')?.value) || 10;
        const maxSpacingM = parseFloat(document.getElementById('est-max-spacing')?.value) || 10;

        // ═══════════════════════════════════════════════════════════
        // APPROCHE 1 — VOLUMÉTRIQUE  (N × P × F)
        // ═══════════════════════════════════════════════════════════
        const vTotalPerYear = N * Prate * F;         // litres / an
        const activeBoats = Math.round(N * Prate);
        const cellsFromVolume = vTotalPerYear > 0 ? Math.ceil(vTotalPerYear / cellCapacityL) : 0;

        // ═══════════════════════════════════════════════════════════
        // APPROCHE 2 — SPATIALE  (depuis la simulation)
        // ═══════════════════════════════════════════════════════════
        let pollutedAreaM2 = 0;
        let coastLengthM = 0;
        let cellsFromSpacing = 0;
        let cellsFromCoast = 0;
        let hasSimData = false;

        if (ppm && pollutionState.density && pollutionState.cols) {
            hasSimData = true;
            const cellSize = 6;
            const metersPerCell = cellSize / ppm;
            const m2PerCell = metersPerCell * metersPerCell;

            const useCumulative = cbCumulativeHeatmap ? cbCumulativeHeatmap.checked : false;
            const density = useCumulative ? (pollutionState.cumulativeDensity || pollutionState.density) : pollutionState.density;
            const totalSimCells = pollutionState.cols * pollutionState.rows;
            let pollutedCount = 0;
            for (let i = 0; i < totalSimCells; i++) {
                if (density[i] > 0.01) pollutedCount++;
            }
            pollutedAreaM2 = pollutedCount * m2PerCell;

            if (pollutionState.cumulativeImpactMask) {
                const usePersistentCoast = cbPersistImpact ? cbPersistImpact.checked : false;
                const maskToUse = usePersistentCoast ? pollutionState.cumulativeImpactMask : pollutionState.impactMask;
                let coastCount = 0;
                for (let i = 0; i < maskToUse.length; i++) {
                    if (maskToUse[i] > 0) coastCount++;
                }
                coastLengthM = coastCount / ppm;
                cellsFromCoast = Math.ceil(coastLengthM);   // 1 cellule/m = couverture totale
                cellsFromSpacing = Math.ceil(coastLengthM / maxSpacingM); // espacement raisonnable
            }
        }

        // ═══════════════════════════════════════════════════════════
        // FORMULE D'ÉQUILIBRE
        //
        // Problème : si C_vol=9 mais C_coast=200 → prendre max=200 serait
        // absurde (taux remplissage 4,5%). Prendre C_vol=9 sur 200m serait
        // dangereux (1 cellule tous les 22m, laisse passer la pollution).
        //
        // Solution : C = max(C_vol, C_spacing)
        //   - C_spacing = ⌈côte / espacement_max⌉
        //   - L'espacement max garantit qu'aucune zone n'est laissée sans
        //     couverture, sans pour autant doubler les cellules là où la
        //     densité de pollution est trop faible pour les remplir.
        //
        // Taux de remplissage résultant = V / (C × capacité)
        // Si taux < 20% : on affiche un avertissement de sous-dimensionnement
        // ═══════════════════════════════════════════════════════════
        const rawFinalCells = Math.max(cellsFromVolume, cellsFromSpacing || cellsFromVolume);
        const finalCells = Math.ceil(rawFinalCells / 1.5);
        // Min = purely volumetric (no spatial constraint)
        const minCells = cellsFromVolume > 0 ? cellsFromVolume : (cellsFromSpacing > 0 ? Math.ceil(cellsFromSpacing * 0.5) : 1);
        // Max = 2 fois la quantité recommandée ("ce qu'il faut pour la surface")
        const maxCells = finalCells * 2;
        const barrierLengthM = finalCells;
        const fillRate = finalCells > 0 && vTotalPerYear > 0
            ? Math.round((vTotalPerYear / (finalCells * cellCapacityL)) * 100)
            : 0;

        // Espace réel entre cellules
        const actualSpacing = coastLengthM > 0 && finalCells > 0
            ? (coastLengthM / finalCells).toFixed(1)
            : '—';

        // ── Affichage ─────────────────────────────────────────────

        // ── Affichage ─────────────────────────────────────────────
        const placeholder = document.getElementById('est-placeholder');
        if (placeholder) placeholder.classList.add('hidden');
        document.getElementById('est-results-data').classList.remove('hidden');

        // Badge
        if (badge) {
            if (!ppm) {
                badge.textContent = '⚠️ Pas d\'échelle — résultats partiels';
                badge.style.background = 'rgba(231,76,60,0.15)';
                badge.style.color = '#e74c3c';
            } else {
                badge.textContent = '✅ Calcul automatique';
                badge.style.background = 'rgba(39,174,96,0.15)';
                badge.style.color = '#27ae60';
            }
        }

        // Approche 1
        document.getElementById('est-volume').textContent = `${vTotalPerYear.toFixed(1)} L / an`;
        document.getElementById('est-cells-vol').textContent =
            `${cellsFromVolume.toLocaleString('fr-FR')} cellule${cellsFromVolume !== 1 ? 's' : ''}`;

        // Approche 2
        document.getElementById('est-coast-length').textContent = hasSimData
            ? (coastLengthM > 0 ? `${coastLengthM.toFixed(0)} m` : '— (activez "Alerte Côtes Rouges")')
            : '— (lancez d\'abord la simulation)';
        document.getElementById('est-polluted-area').textContent = hasSimData
            ? `${pollutedAreaM2.toFixed(0)} m²` : '—';
        document.getElementById('est-cells-spatial').textContent = hasSimData && cellsFromSpacing > 0
            ? `${cellsFromSpacing} cellule${cellsFromSpacing !== 1 ? 's' : ''} (1 / ${maxSpacingM}m)`
            : '— (pas de données côtières)';

        // Final — Min / Recommandé / Max
        const elCells = document.getElementById('est-cells');
        if (elCells) elCells.innerHTML =
            `<span style="color:#e67e22;font-size:0.9em;" title="Minimum volumétrique">min ${minCells}</span>` +
            ` &nbsp;·&nbsp; ` +
            `<strong style="font-size:1.15em;color:#27ae60;">${finalCells}</strong>` +
            ` &nbsp;·&nbsp; ` +
            `<span style="color:#e74c3c;font-size:0.9em;" title="Couverture maximale">max ${maxCells}</span>`;
        document.getElementById('est-barrier-length').textContent = `${barrierLengthM} m`;

        const recLabel = document.getElementById('cells-recommendation-label');
        if (recLabel) recLabel.textContent = `${finalCells} cellule${finalCells > 1 ? 's' : ''}`;

        // ── Détail du calcul ──────────────────────────────────────
        const breakdown = document.getElementById('est-breakdown');
        breakdown.innerHTML = '';

        const addTitle = (t) => {
            const el = document.createElement('div');
            el.className = 'est-approach-title';
            el.style.marginTop = '10px';
            el.textContent = t;
            breakdown.appendChild(el);
        };
        const addRow = (name, detail, style = {}) => {
            const row = document.createElement('div');
            row.className = 'est-breakdown-row';
            Object.assign(row.style, style);
            row.innerHTML = `<span class="est-breakdown-name">${name}</span><span class="est-breakdown-detail">${detail}</span>`;
            breakdown.appendChild(row);
        };

        // Volume
        addTitle('🧪 Approche Volumétrique');
        addRow('Formule V = N × P × F',
            `${N} × ${(Prate * 100).toFixed(0)}% × ${F} L = <strong>${vTotalPerYear.toFixed(1)} L / an</strong>`);
        addRow('Bateaux concernés',
            `${N} anneaux → <strong>${activeBoats} bateaux actifs</strong>`);
        addRow('Cellules requises',
            `${vTotalPerYear.toFixed(1)} L ÷ ${cellCapacityL} L = <strong>${cellsFromVolume} cellule${cellsFromVolume !== 1 ? 's' : ''}</strong>`);

        // Spatial
        addTitle('🗺️ Approche Spatiale (espacement max = ' + maxSpacingM + 'm)');
        if (hasSimData) {
            addRow('Surface polluée', `${pollutedAreaM2.toFixed(0)} m²`);
            if (coastLengthM > 0) {
                addRow('Côte impactée', `<strong>${coastLengthM.toFixed(0)} m</strong>`);
                addRow('Couverture totale', `${coastLengthM.toFixed(0)} m ÷ 1m/cellule = <strong>${cellsFromCoast} cellules</strong> (si 100% couvert)`);
                addRow(`Avec espacement max ${maxSpacingM}m`,
                    `${coastLengthM.toFixed(0)} m ÷ ${maxSpacingM}m = <strong>${cellsFromSpacing} cellule${cellsFromSpacing !== 1 ? 's' : ''}</strong>`);
            } else {
                addRow('Côtes', 'Non disponible — activez "Alerte Côtes Rouges"');
            }
        } else if (!ppm) {
            addRow('Échelle', 'Non calibrée — allez dans Simulation → Outil Règle');
        } else {
            addRow('Simulation', 'Aucune donnée — lancez la simulation');
        }

        // Équilibre
        addTitle('⚖️ Formule d\'équilibre');
        const limitingFactor = cellsFromSpacing >= cellsFromVolume
            ? `espacement max (${cellsFromSpacing} ≥ ${cellsFromVolume})`
            : `volume (${cellsFromVolume} ≥ ${cellsFromSpacing || '?'})`;
        addRow('C = max(C_vol, C_espacement)',
            `max(${cellsFromVolume}, ${cellsFromSpacing || '?'}) = <strong>${finalCells} cellule${finalCells !== 1 ? 's' : ''}</strong><br>Facteur limitant : ${limitingFactor}`);
        if (coastLengthM > 0) {
            addRow('Espacement réel', `${coastLengthM.toFixed(0)} m ÷ ${finalCells} = <strong>${actualSpacing} m entre cellules</strong>`);
        }

        // Fill rate
        const fillColor = fillRate >= 50 ? '#27ae60' : fillRate >= 20 ? '#e67e22' : '#e74c3c';
        const fillMsg = fillRate >= 50 ? '✅ Bon taux de remplissage'
            : fillRate >= 20 ? '⚠️ Taux acceptable (augmentez l\'espacement max si voulu)'
                : '🔴 Cellules sous-utilisées — augmentez l\'espacement max';
        addRow('Taux de remplissage estimé',
            `${vTotalPerYear.toFixed(1)} L ÷ (${finalCells} × ${cellCapacityL} L) = <strong style="color:${fillColor}">${fillRate}%</strong><br>${fillMsg}`,
            fillRate < 20 ? { borderColor: '#e74c3c', background: 'rgba(231,76,60,0.06)' } : {});

        addTitle('✅ Recommandation finale');
        addRow('🔲 Cellules filtrantes',
            `<strong style="color:#27ae60; font-size:1.1em">${finalCells} cellule${finalCells !== 1 ? 's' : ''}</strong> — ${barrierLengthM} m de barrière`,
            { borderColor: 'var(--clr-primary)', background: 'var(--clr-primary-light)' });


        // Zones polluantes
        const polluantZones = zones.filter(z => z.type === 'polluante');
        if (polluantZones.length > 0) {
            addTitle(`🟣 Répartition automatique (${polluantZones.length} zone${polluantZones.length > 1 ? 's' : ''})`);
            const shareV = vTotalPerYear / polluantZones.length;
            const shareC = finalCells / polluantZones.length;
            polluantZones.forEach(zone => {
                addRow(`🟣 ${zone.title}`,
                    `${shareV.toFixed(1)} L/an — <strong>${Math.ceil(shareC)} m de barrière</strong>`);
            });
        }
    }

    // Auto-recalc when any estimation parameter changes
    ['est-moorings', 'est-active-rate', 'est-loss-per-boat', 'est-cell-capacity', 'est-max-spacing'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', runEstimation);
    });

    // Removed listener for cbAutoPlace as it has been deleted.

    // Manual recalc button
    const btnRunEstimation = document.getElementById('btn-run-estimation');
    if (btnRunEstimation) btnRunEstimation.addEventListener('click', runEstimation);

    // Initial display
    updateFormulaDisplay();


    if (simSpeedInput && simSpeedNum) {
        simSpeedInput.addEventListener('input', () => {
            simSpeedNum.value = simSpeedInput.value;
        });
        simSpeedNum.addEventListener('input', () => {
            let val = parseInt(simSpeedNum.value);
            if (val < 1) val = 1;
            if (val > 100) val = 100; // Increase max for manual input
            simSpeedNum.value = val;
            simSpeedInput.value = val;
        });
    }

    // ═══════════════════════════════════════════════════════════════════
    // COSTS PAGE LOGIC
    // ═══════════════════════════════════════════════════════════════════

    function fmt(n) {
        return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
    }

    // Store last computed costs so the quote can read them
    let _lastCosts = {};

    let appConfig = null;
    let selectedPlanId = 'premium';
    let appConfigData = null;

    // Fetch configuration
    if (window.ABSORB_CONFIG) {
        appConfig = window.ABSORB_CONFIG;
        applyConfig(appConfig);
    } else {
        console.warn("No ABSORB_CONFIG found. Using default values.");
        // Default setup for select data attributes
        const subSelect = document.getElementById('cost-sub-plan');
        if (subSelect && subSelect.options.length > 0) {
            Array.from(subSelect.options).forEach(opt => {
                const priceMatch = opt.textContent.match(/(\d+)€/);
                if (priceMatch) opt.dataset.price = priceMatch[1];
                opt.dataset.name = opt.textContent.split('-')[1]?.trim() || opt.value;
                opt.dataset.desc = "Prestation de service sur les cellules filtrantes.";
            });
        }
    }

    function applyConfig(data) {
        if (!data) return;
        appConfigData = data;

        const c = data.costs;
        if (c) {
            const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
            setVal('cost-unit-buy', c.cell_unit_buy_ht);
            setVal('cost-shipping', c.shipping_fixed_ht);
            setVal('cost-install-unit', c.install_unit_ht);
            setVal('cost-travel', c.travel_fixed_ht);
            setVal('cost-collect-freq', c.collect_frequency_per_year);
            setVal('cost-waste-fixed', c.waste_fixed_cost_ht);
            setVal('cost-waste-unit', c.waste_unit_cost_ht);
            setVal('cost-tva', c.tva_pct);
        }

        runCosts();
    }

    function renderPlansPage() {
        if (!appConfigData || !appConfigData.subscriptions) return;

        // Populate recommendation
        const estCells = document.getElementById('est-cells');
        const planRecVal = document.getElementById('plans-rec-val');
        const planRecRange = document.getElementById('plans-rec-range');
        if (estCells) {
            const match = estCells.textContent.match(/(\d+)/);
            if (match && planRecVal) {
                const baseRec = parseInt(match[1]) || 1;
                planRecVal.textContent = baseRec;
                if (planRecRange) {
                    const min = Math.max(1, Math.floor(baseRec * 0.8));
                    const max = Math.ceil(baseRec * 1.25);
                    planRecRange.textContent = `(Marge selon courant : de ${min} à ${max} cellules)`;
                }
            }
        }

        const grid = document.getElementById('plans-grid');
        if (!grid) return;
        grid.innerHTML = '';

        appConfigData.subscriptions.forEach(sub => {
            const card = document.createElement('div');
            const isSelected = selectedPlanId === sub.id;
            const isPremium = sub.id === 'premium';

            card.className = `plan-card ${isPremium ? 'premium' : ''} ${isSelected ? 'selected' : ''}`;

            let featuresHTML = '';
            if (sub.id === 'basic') {
                featuresHTML = `
                    <li>✅ Fourniture de nouvelles cellules</li>
                    <li>✅ Frais de livraison inclus</li>
                    <li class="disabled">❌ Aucune pose / main d'œuvre</li>
                    <li class="disabled">❌ Vous gérez le traitement des déchets</li>
                `;
            } else if (sub.id === 'comfort') {
                featuresHTML = `
                    <li>✅ Fourniture de nouvelles cellules</li>
                    <li>✅ Frais de livraison inclus</li>
                    <li>✅ Déplacement et pose des cellules</li>
                    <li class="disabled">❌ Traitement des déchets à votre charge</li>
                `;
            } else {
                featuresHTML = `
                    <li>✅ Fourniture des cellules avec livraison</li>
                    <li>✅ Remplacement périodique complet</li>
                    <li>✅ Collecte sur site</li>
                    <li>✅ Recyclage / traitement des hydrocarbures</li>
                `;
            }

            let ribbon = isPremium ? `<div class="plan-ribbon">Recommandé</div>` : '';

            card.innerHTML = `
                ${ribbon}
                <h3 class="plan-title">${sub.name}</h3>
                <div class="plan-price">
                    <span class="currency">€</span><span class="amount">${sub.price_per_cell_per_month}</span><span class="period">/cellule/mois</span>
                </div>
                <p class="plan-desc">${sub.description}</p>
                <div class="plan-features">${featuresHTML}</div>
                <div style="flex-grow:1;"></div>
                <button class="btn-primary plan-select-btn" data-id="${sub.id}">
                    ${isSelected ? '✓ Formule Active' : 'Choisir cette formule'}
                </button>
            `;
            grid.appendChild(card);
        });

        document.querySelectorAll('.plan-select-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                selectedPlanId = e.target.dataset.id;
                setActivePage('costs');
            });
        });
    }

    // Connect button to change plan from costs page:
    const btnChangePlan = document.getElementById('btn-change-plan');
    if (btnChangePlan) {
        btnChangePlan.addEventListener('click', () => {
            setActivePage('plans');
        });
    }

    function runCosts() {
        // Auto-sync cell count from estimation if available
        const estCells = document.getElementById('est-cells');
        const costNumCells = document.getElementById('cost-num-cells');
        if (estCells && costNumCells && !costNumCells._manuallyEdited) {
            const match = estCells.textContent.match(/(\d+)/);
            if (match) costNumCells.value = match[1];
        }

        const n = parseInt(document.getElementById('cost-num-cells')?.value) || 0;
        const unitBuy = parseFloat(document.getElementById('cost-unit-buy')?.value) || 0;
        const shipping = parseFloat(document.getElementById('cost-shipping')?.value) || 0;
        const installU = parseFloat(document.getElementById('cost-install-unit')?.value) || 0;
        const travel = parseFloat(document.getElementById('cost-travel')?.value) || 0;
        const collectFreq = parseInt(document.getElementById('cost-collect-freq')?.value) || 1;

        const wasteFixed = parseFloat(document.getElementById('cost-waste-fixed')?.value) || 0;
        const wasteUnit = parseFloat(document.getElementById('cost-waste-unit')?.value) || 0;
        const tva = (parseFloat(document.getElementById('cost-tva')?.value) || 20) / 100;

        // One-time setup costs (Split Coût vs Vente)
        const expertBuy = parseFloat(document.getElementById('cost-expert-buy')?.value) || 0;
        const expertSell = parseFloat(document.getElementById('cost-expert-sell')?.value) || 0;
        const setupBuy = parseFloat(document.getElementById('cost-setup-buy')?.value) || 0;
        const setupSell = parseFloat(document.getElementById('cost-setup-sell')?.value) || 0;
        const trainingBuy = parseFloat(document.getElementById('cost-training-buy')?.value) || 0;
        const trainingSell = parseFloat(document.getElementById('cost-training-sell')?.value) || 0;

        const totalSetupInternal = expertBuy + setupBuy + trainingBuy;
        const totalOneTimeClient = expertSell + setupSell + trainingSell;

        let selectedOpt = appConfigData?.subscriptions?.find(s => s.id === selectedPlanId);
        // Fallback
        if (!selectedOpt) {
            selectedOpt = { id: 'premium', name: 'Clé en main (Tout inclus)', price_per_cell_per_month: 20, description: 'Service intégral' };
        }

        const monthlySubPrice = selectedOpt.price_per_cell_per_month;
        const subName = selectedOpt.name;
        const subDesc = selectedOpt.description;
        const isBasic = selectedPlanId === 'basic';
        const isComfort = selectedPlanId === 'comfort';
        const isPremium = selectedPlanId === 'premium';

        // Mettre à jour l'UI display du plan actif
        const disp = document.getElementById('active-plan-display');
        if (disp) disp.textContent = subName;
        const costSubDesc = document.getElementById('cost-sub-desc');
        if (costSubDesc) costSubDesc.textContent = subDesc;

        // ── Coûts de revient 1ère année ───────────────────────────────
        // Pour la première année, il faut:
        // - Initial: (n * unitBuy) + shipping. Si confort/premium: on ajoute l'installation et travel
        // - Replacements multiples dans l'année (collectFreq - 1x). On suppose que la pose initiale compte pour 1.
        // Wait, it's easier to say: Year 1 = 1x initial setup + collectFreq replacements?
        // Let's assume collectFreq is the total number of interventions needed throughout the year. So if freq=4, we do the initial + 3 replacements.

        const totalPassagesYear1 = Math.max(1, collectFreq);
        const cellPurchasesYear1 = n * unitBuy * totalPassagesYear1;
        const shippingYear1 = shipping * totalPassagesYear1;

        // Basic: pas de main d'oeuvre, pas de déplacement pour nous, pas de déchet
        let travelYear1 = 0;
        let installYear1 = 0;
        let wasteYear1 = 0;

        if (isComfort || isPremium) {
            travelYear1 = travel * totalPassagesYear1;
            installYear1 = (n * installU) * totalPassagesYear1;
        }

        if (isPremium) {
            // Waste is generated ONLY when cells are replaced.
            // Year 1, the first setup doesn't generate waste, only the subsequent (totalPassagesYear1 - 1) don't they? 
            // Or maybe the end of year 1 triggers the waste collection? Let's just say waste happens every replacement passage.
            const replacementPassages = Math.max(0, totalPassagesYear1 - 1);
            wasteYear1 = replacementPassages * (wasteFixed + (n * wasteUnit));
        }

        const cdrTotal = cellPurchasesYear1 + shippingYear1 + installYear1 + travelYear1 + wasteYear1 + totalSetupInternal;

        // ── Prix de vente (Facturation Client) ────────────────────────
        const sellMonth = n * monthlySubPrice;
        const sellYear = sellMonth * 12;

        // Client pays setup fees based on "Sell" prices
        const totalHT = sellYear + totalOneTimeClient;
        const totalTTC = totalHT * (1 + tva);

        // ── Marge & Rentabilité 1ère année ────────────────────────────
        const margin = totalHT - cdrTotal;
        const marginPct = totalHT > 0 ? (margin / totalHT * 100) : 0;

        // ── Années suivantes ──────────────────────────────────────────
        // Year 2+ : frequency of replacements
        const recPassages = collectFreq;
        const recCells = n * unitBuy * recPassages;
        const recShipping = shipping * recPassages;

        let recTravel = 0, recInstall = 0, recWaste = 0;
        if (isComfort || isPremium) {
            recTravel = travel * recPassages;
            recInstall = (n * installU) * recPassages;
        }
        if (isPremium) {
            recWaste = recPassages * (wasteFixed + (n * wasteUnit));
        }

        const recurringCost = recCells + recShipping + recTravel + recInstall + recWaste;
        const recurringRev = sellYear;
        const recurringMargin = recurringRev - recurringCost;

        // ── Affichage ─────────────────────────────────────────────────
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('cost-r-buy', fmt(cellPurchasesYear1));
        set('cost-r-shipping', fmt(shippingYear1));
        set('cost-r-install', fmt(installYear1));
        set('cost-r-travel', fmt(travelYear1));
        set('cost-r-setup', fmt(totalSetupInternal));
        set('cost-r-cdr', fmt(cdrTotal));

        set('cost-r-sell-month', fmt(sellMonth) + ' / mois');
        set('cost-r-sell-year', fmt(sellYear) + ' / an');
        set('cost-r-total-ht', fmt(totalHT));
        set('cost-r-total-ttc', fmt(totalTTC));
        set('cost-r-margin', fmt(margin));

        const margEl = document.getElementById('cost-r-margin-pct');
        if (margEl) {
            margEl.textContent = marginPct.toFixed(1) + ' %';
            margEl.style.color = marginPct >= 30 ? '#27ae60' : marginPct >= 15 ? '#e67e22' : '#e74c3c';
        }
        set('cost-r-recurring', fmt(recurringMargin) + ' / an');

        // Breakdown detail
        const bd = document.getElementById('cost-breakdown');
        if (bd) {
            bd.innerHTML = '';
            const addRow = (icon, name, detail, highlight = false) => {
                const row = document.createElement('div');
                row.className = 'est-breakdown-row' + (highlight ? ' cost-highlight-row' : '');
                row.innerHTML = `<span class="est-breakdown-name">${icon} ${name}</span><span class="est-breakdown-detail">${detail}</span>`;
                bd.appendChild(row);
            };
            const addSep = (t) => {
                const el = document.createElement('div');
                el.className = 'est-approach-title';
                el.style.marginTop = '10px';
                el.textContent = t;
                bd.appendChild(el);
            };

            addSep('📉 Coûts Internes 1ère Année');
            addRow('📦', 'Fourniture & Livraisons', `${totalPassagesYear1} livraisons = ${fmt(cellPurchasesYear1 + shippingYear1)}`);
            if (isComfort || isPremium) {
                addRow('🔧', 'Pose & Déplacements', `${totalPassagesYear1} passages = ${fmt(installYear1 + travelYear1)}`);
            }
            if (isPremium) {
                addRow('🗑️', 'Collecte & Traitement', `${Math.max(0, totalPassagesYear1 - 1)} enlèvements = ${fmt(wasteYear1)}`);
            }
            addRow('🚀', 'Frais Mise en service', `${fmt(totalSetupInternal)}`);
            addRow('🧾', 'Coût total estimé 1ère année', `${fmt(cdrTotal)}`, true);

            addSep('📈 Revenus Client');
            addRow('💎', 'Facturation Annuelle', `${n} cel. × ${fmt(monthlySubPrice)} × 12 mois = ${fmt(sellYear)}`);

            addSep('💡 Rentabilité 1ère Année');
            addRow('📊', 'Marge brute', `${fmt(sellYear)} - ${fmt(cdrTotal)} = ${fmt(margin)}`);
            addRow('%', 'Taux de marge brute', `${marginPct.toFixed(1)}%`, marginPct >= 30);

            addSep('🔄 Rentabilité Années Suivantes');
            addRow('💰', 'Revenu Annuel', `${fmt(recurringRev)}`);
            addRow('🛠️', 'Coûts Récurrents (Fournitures' + (isPremium ? ", Main d'œuvre, Déchets" : "") + ')', `${fmt(recurringCost)}`);
            addRow('🏆', 'Marge Brute Récurrente', `${fmt(recurringMargin)} par an`, true);
        }

        const projectName = document.getElementById('cost-project-name')?.value || '';
        // Save for quote use
        _lastCosts = {
            n, unitBuy, shipping, installU, travel,
            expertSell, setupSell, trainingSell, totalOneTimeClient,
            collectFreq, wasteFixed, wasteUnit, tva,
            monthlySubPrice, subName, subDesc,
            cdrTotal, sellMonth, sellYear,
            totalHT, totalTTC, margin, marginPct, recurringMargin,
            projectName
        };
    }

    // Wire up all cost inputs to auto-recalc
    ['cost-num-cells', 'cost-unit-buy', 'cost-shipping', 'cost-install-unit',
        'cost-travel', 'cost-collect-freq', 'cost-waste-fixed', 'cost-waste-unit',
        'cost-tva', 'cost-expert-buy', 'cost-expert-sell', 'cost-setup-buy',
        'cost-setup-sell', 'cost-training-buy', 'cost-training-sell'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', runCosts);
                if (id === 'cost-num-cells') {
                    el.addEventListener('input', () => { el._manuallyEdited = true; });
                }
            }
        });

    // "Générer le devis" button
    const btnCopyToQuote = document.getElementById('btn-copy-to-quote');
    if (btnCopyToQuote) btnCopyToQuote.addEventListener('click', () => setActivePage('quote'));

    // Print button
    const btnPrintQuote = document.getElementById('btn-print-quote');
    if (btnPrintQuote) btnPrintQuote.addEventListener('click', () => window.print());

    // ═══════════════════════════════════════════════════════════════════
    // QUOTE PAGE LOGIC
    // ═══════════════════════════════════════════════════════════════════

    function renderQuote() {
        // Ensure costs are computed first
        runCosts();
        const c = _lastCosts;

        // Date
        const now = new Date();
        const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
        const el = (id) => document.getElementById(id);

        const badge = el('quote-date-badge');
        if (badge) badge.textContent = dateStr;
        const legalDate = el('quote-legal-date');
        if (legalDate) legalDate.textContent = `Devis émis le ${dateStr}.`;

        // Hero header
        const projectName = c.projectName || 'Port';
        if (el('quote-client-project')) el('quote-client-project').textContent = `${projectName} — Cellules filtrantes`;
        if (el('quote-subtitle')) el('quote-subtitle').textContent = `Proposition commerciale — ${projectName}`;

        const fmtQ = (n) => Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

        if (el('quote-h-setup-total')) el('quote-h-setup-total').textContent = fmtQ(c.totalOneTimeClient * (1 + c.tva));
        if (el('quote-h-monthly')) el('quote-h-monthly').textContent = fmtQ((c.sellMonth) * (1 + c.tva)) + ' / mois';

        // Table body
        const tbody = el('quote-table-body');
        const tfoot = el('quote-table-foot');
        if (!tbody) return;

        const rows = [];

        // 1. Initial costs
        if (c.expertSell > 0) rows.push({ label: "Étude, Simulation & Expertise", desc: "Diagnostic hydrodynamique et plan d'implantation optimal", qty: 1, puHT: c.expertSell, totalHT: c.expertSell });
        if (c.setupSell > 0) rows.push({ label: "Forfait Installation Initiale", desc: "Pose des premiers ancrages et mise en place de la barrière", qty: 1, puHT: c.setupSell, totalHT: c.setupSell });

        // Formation condition: skip if Premium (~20€)
        const isPremium = c.monthlySubPrice >= 20;
        if (c.trainingSell > 0 && !isPremium) {
            rows.push({ label: "Formation technique", desc: "Formation des agents municipaux à la collecte et sécurité", qty: 1, puHT: c.trainingSell, totalHT: c.trainingSell });
        } else if (isPremium && c.trainingSell > 0) {
            rows.push({ label: "Formation technique", desc: "Inclus dans le forfait Premium (Clé en main)", qty: 1, puHT: 0, totalHT: 0, isIncluded: true });
        }

        // 2. Subscription
        rows.push({
            label: `Abonnement Annuel : ${c.subName}`,
            desc: c.subDesc,
            qty: c.n,
            puHT: c.monthlySubPrice * 12,
            totalHT: c.sellYear,
            isRecurring: true
        });

        tbody.innerHTML = rows.map(r => `
            <tr class="${r.isRecurring ? 'quote-row-recurring' : ''}">
                <td>
                    <div class="quote-row-label">${r.label}${r.isRecurring ? ' <span class="quote-recurring-badge">engagement 1 an</span>' : ''}</div>
                    <div class="quote-row-desc">${r.desc}</div>
                </td>
                <td class="quote-td-num">${r.qty}</td>
                <td class="quote-td-num">${r.qty > 0 && r.puHT > 0 ? fmtQ(r.puHT) + (r.isRecurring ? ' / an' : '') : '—'}</td>
                <td class="quote-td-num quote-td-total">${fmtQ(r.totalHT)}</td>
            </tr>
        `).join('');

        const tvaAmount = c.totalHT * c.tva;

        const totalSetupTTC = c.totalOneTimeClient * (1 + c.tva);
        const totalRecurringYearTTC = c.sellYear * (1 + c.tva);
        const totalMonthTTC = (c.sellMonth) * (1 + c.tva);

        tfoot.innerHTML = `
            <tr class="quote-foot-sub">
                <td colspan="3">Frais de mise en service (HT)</td>
                <td class="quote-td-num">${fmtQ(c.totalOneTimeClient)}</td>
            </tr>
            <tr class="quote-foot-sub">
                <td colspan="3">Abonnement Annuel (HT)</td>
                <td class="quote-td-num">${fmtQ(c.sellYear)}</td>
            </tr>
            <tr class="quote-foot-sub" style="border-top: 2px solid var(--clr-border);">
                <td colspan="3">Total HT cumulé (An 1)</td>
                <td class="quote-td-num">${fmtQ(c.totalHT)}</td>
            </tr>
            <tr class="quote-foot-sub">
                <td colspan="3">TVA (${(c.tva * 100).toFixed(0)}%)</td>
                <td class="quote-td-num">${fmtQ(tvaAmount)}</td>
            </tr>
            <tr class="quote-foot-total">
                <td colspan="3">TOTAL À RÉGLER (Année 1) TTC</td>
                <td class="quote-td-num">${fmtQ(c.totalTTC)}</td>
            </tr>
            <tr class="quote-foot-note">
                <td colspan="4" style="text-align:right; padding-top:15px; border:none;">
                    <div style="font-size:1.1rem; color:var(--clr-primary); font-weight:700;">
                        Soit ${fmtQ(totalMonthTTC)} TTC / mois
                    </div>
                    <div style="font-size:0.85rem; color:var(--clr-text-muted);">
                        + ${fmtQ(totalSetupTTC)} TTC d'investissement initial
                    </div>
                </td>
            </tr>
        `;
    }

});