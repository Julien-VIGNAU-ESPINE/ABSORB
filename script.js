document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const uploadZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('file-input');
    const canvasContainer = document.getElementById('canvas-container');
    const canvas = document.getElementById('port-canvas');
    const ctx = canvas.getContext('2d');
    const btnReset = document.getElementById('btn-reset');

    // Image Adjustments
    const brightnessInput = document.getElementById('img-brightness');
    const waveIntensityInput = document.getElementById('wave-intensity');
    const pollutionIntensityInput = document.getElementById('pollution-intensity');

    // UI Controls for drawing
    const instructionText = document.getElementById('instruction-text');
    const btnFinishZone = document.getElementById('btn-finish-zone');
    const btnCancelZone = document.getElementById('btn-cancel-zone');
    const btnClearWaves = document.getElementById('btn-clear-waves');
    const toolBtns = document.querySelectorAll('.tool-btn');
    const sidebarPanel = document.getElementById('sidebar-panel');
    const toolsPanel = document.getElementById('tools-panel');
    const btnAddFolder = document.getElementById('btn-add-folder');
    const zoneListContainer = document.getElementById('zone-list-container');

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
    let pollutionState = { heatmapCanvas: null };

    // Zoom State
    let currentZoom = 1;
    const canvasWrapper = document.querySelector('.canvas-wrapper');

    // --- Toolbar Setup ---
    toolBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            toolBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            setTool(btn.getAttribute('data-tool'));
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

        updateControlsUI();
        updateZoneListUI();
        renderCanvas();
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

    // Handle Image Adjustments
    brightnessInput.addEventListener('input', renderCanvas);
    waveIntensityInput.addEventListener('input', renderCanvas);
    if (pollutionIntensityInput) pollutionIntensityInput.addEventListener('input', renderCanvas);

    function initProjectData(data) {
        if (data.imageSrc) {
            const img = new Image();
            img.onload = () => {
                currentImage = img;
                zones = data.zones || [];
                folders = data.folders || [];
                zoneCounter = data.zoneCounter || 1;
                folderCounter = data.folderCounter || 1;
                waveState.sourceLine = (data.waveState && data.waveState.sourceLine) ? data.waveState.sourceLine : [];

                if (data.adjustments) {
                    brightnessInput.value = data.adjustments.brightness || "100";
                    waveIntensityInput.value = data.adjustments.waveIntensity || "65";
                    if (pollutionIntensityInput) pollutionIntensityInput.value = data.adjustments.pollutionIntensity || "70";
                }

                isDrawing = false;
                currentPolygon = [];
                selectedZoneId = null;
                mergeState.active = false;
                mergeState.zone1Id = null;

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
                waveState: {
                    sourceLine: waveState.sourceLine
                },
                adjustments: {
                    brightness: brightnessInput.value,
                    waveIntensity: waveIntensityInput.value,
                    pollutionIntensity: pollutionIntensityInput ? pollutionIntensityInput.value : "70"
                }
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

    // --- Core Updates ---
    function updateSimulationAndRender() {
        if (waveState.sourceLine && waveState.sourceLine.length > 2) {
            runWaveSimulation();
        } else {
            waveState.heatmapCanvas = null;
        }

        const hasPollution = zones.some(z => z.type === 'polluante');
        if (hasPollution) {
            runPollutionSimulation();
        } else {
            pollutionState.heatmapCanvas = null;
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

                renderCanvas();
                showCanvas();
                updateControlsUI();
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
            ctx.globalAlpha = pollutionIntensityInput ? (pollutionIntensityInput.value / 100) : 0.7;
            ctx.drawImage(pollutionState.heatmapCanvas, 0, 0, canvas.width, canvas.height);
            ctx.globalAlpha = 1.0;
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

    canvas.addEventListener('mouseup', handleWaveMouseUp);
    canvas.addEventListener('mouseleave', handleWaveMouseUp);

    function handleWaveMouseUp(e) {
        if (currentTool === 'wave' && waveState.isDrawingSource) {
            waveState.isDrawingSource = false;
            if (waveState.sourceLine.length > 2) {
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
            btnCancelZone.classList.remove('hidden');
        } else if (currentTool === 'erase') {
            instructionText.innerText = "Mode Effaceur: Cliquez sur une zone pour la supprimer.";
            btnFinishZone.classList.add('hidden');
            btnCancelZone.classList.add('hidden');
        }

        // Only show Clear Waves if we have heatmap
        if (waveState.heatmapCanvas) {
            btnClearWaves.classList.remove('hidden');
        } else {
            btnClearWaves.classList.add('hidden');
        }
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

        // Draw source line on mask to find initial positions
        offCtx.resetTransform();
        offCtx.clearRect(0, 0, cols, rows); // all transparent
        offCtx.fillStyle = '#000000'; // black bg
        offCtx.fillRect(0, 0, cols, rows);
        offCtx.scale(1 / cellSize, 1 / cellSize);

        offCtx.beginPath();
        offCtx.moveTo(waveState.sourceLine[0].x, waveState.sourceLine[0].y);
        for (let i = 1; i < waveState.sourceLine.length; i++) {
            offCtx.lineTo(waveState.sourceLine[i].x, waveState.sourceLine[i].y);
        }
        offCtx.strokeStyle = '#ffffff';
        offCtx.lineWidth = cellSize * 2;
        offCtx.lineCap = 'round';
        offCtx.lineJoin = 'round';
        offCtx.stroke();

        const sourceData = offCtx.getImageData(0, 0, cols, rows).data;
        const queue = [];

        for (let i = 0; i < cols * rows; i++) {
            if (sourceData[i * 4] > 128 && obstacles[i] === 0) {
                grid[i] = 0;
                queue.push(i);
            }
        }

        if (queue.length === 0) return;

        let head = 0;
        let maxDist = 0;

        function check(nIdx, nd, nx, ny) {
            if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
                if (obstacles[nIdx] === 0 && grid[nIdx] === -1) {
                    grid[nIdx] = nd;
                    if (nd > maxDist) maxDist = nd;
                    queue.push(nIdx);
                }
            }
        }

        // BFS distance calculation
        while (head < queue.length) {
            const curr = queue[head++];
            const d = grid[curr];
            const cy = Math.floor(curr / cols);
            const cx = curr % cols;

            check(curr - cols, d + 1, cx, cy - 1);
            check(curr + cols, d + 1, cx, cy + 1);
            check(curr - 1, d + 1, cx - 1, cy);
            check(curr + 1, d + 1, cx + 1, cy);
        }

        // Generate heatmap visual
        const heatCanvas = document.createElement('canvas');
        heatCanvas.width = canvas.width;
        heatCanvas.height = canvas.height;
        const hctx = heatCanvas.getContext('2d');

        offCtx.resetTransform();
        offCtx.clearRect(0, 0, cols, rows);
        const heatImgData = offCtx.createImageData(cols, rows);

        for (let i = 0; i < cols * rows; i++) {
            const d = grid[i];
            if (d >= 0 && obstacles[i] === 0) {
                let ratio = d / Math.max(1, maxDist);
                // Curve slightly to emphasize red/high impact zones
                ratio = Math.pow(ratio, 0.8);
                const hue = ratio * 240; // 0=Red to 240=Blue
                const rgb = hslToRgb(hue / 360, 1, 0.5);

                heatImgData.data[i * 4] = rgb[0];
                heatImgData.data[i * 4 + 1] = rgb[1];
                heatImgData.data[i * 4 + 2] = rgb[2];
                // Max opacity handled by globalAlpha via slider now
                heatImgData.data[i * 4 + 3] = 255;
            }
        }

        offCtx.putImageData(heatImgData, 0, 0);

        hctx.imageSmoothingEnabled = true;
        // Blur filters the blocky Manhattan edges into organic curves
        hctx.filter = 'blur(15px)';
        hctx.drawImage(offCanvas, 0, 0, canvas.width, canvas.height);

        waveState.heatmapCanvas = heatCanvas;
    }

    function runPollutionSimulation() {
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

        // 1. Les zones explicitement définies comme 'Eau' ou 'Polluante' sont navigables (espace de propagation)
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
                offCtx.fillStyle = '#ffffff'; // White = Walkable
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

        // Draw source areas using polluante zones
        offCtx.resetTransform();
        offCtx.clearRect(0, 0, cols, rows);
        offCtx.fillStyle = '#000000'; // black bg
        offCtx.fillRect(0, 0, cols, rows);
        offCtx.scale(1 / cellSize, 1 / cellSize);

        zones.forEach(zone => {
            if (zone.type === 'polluante') {
                offCtx.beginPath();
                if (zone.points.length > 0) {
                    offCtx.moveTo(zone.points[0].x, zone.points[0].y);
                    for (let i = 1; i < zone.points.length; i++) {
                        offCtx.lineTo(zone.points[i].x, zone.points[i].y);
                    }
                }
                offCtx.closePath();
                offCtx.fillStyle = '#ffffff'; // White = Source
                offCtx.fill();
            }
        });

        const sourceData = offCtx.getImageData(0, 0, cols, rows).data;
        const queue = [];

        for (let i = 0; i < cols * rows; i++) {
            if (sourceData[i * 4] > 128 && obstacles[i] === 0) {
                grid[i] = 0;
                queue.push(i);
            }
        }

        if (queue.length === 0) return;

        let head = 0;
        let maxDist = 0;

        function check(nIdx, nd, nx, ny) {
            if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
                if (obstacles[nIdx] === 0 && grid[nIdx] === -1) {
                    grid[nIdx] = nd;
                    if (nd > maxDist) maxDist = nd;
                    queue.push(nIdx);
                }
            }
        }

        // BFS distance calculation
        while (head < queue.length) {
            const curr = queue[head++];
            const d = grid[curr];
            const cy = Math.floor(curr / cols);
            const cx = curr % cols;

            check(curr - cols, d + 1, cx, cy - 1);
            check(curr + cols, d + 1, cx, cy + 1);
            check(curr - 1, d + 1, cx - 1, cy);
            check(curr + 1, d + 1, cx + 1, cy);
        }

        // Generate heatmap visual
        const heatCanvas = document.createElement('canvas');
        heatCanvas.width = canvas.width;
        heatCanvas.height = canvas.height;
        const hctx = heatCanvas.getContext('2d');

        offCtx.resetTransform();
        offCtx.clearRect(0, 0, cols, rows);
        const heatImgData = offCtx.createImageData(cols, rows);

        for (let i = 0; i < cols * rows; i++) {
            const d = grid[i];
            if (d >= 0 && obstacles[i] === 0) {
                let ratio = d / Math.max(1, maxDist);
                // Curve slightly to emphasize source areas
                ratio = Math.pow(ratio, 0.8);
                // Toxic pollution colors: Source is yellow/orange (30-60 hue), spreading to green (120-150 hue)
                const hue = 60 + (ratio * 80); // 60 (Yellow) to 140 (Green)
                const rgb = hslToRgb(hue / 360, 0.9, 0.6);

                heatImgData.data[i * 4] = rgb[0];
                heatImgData.data[i * 4 + 1] = rgb[1];
                heatImgData.data[i * 4 + 2] = rgb[2];
                // Max opacity handled by globalAlpha via slider now
                heatImgData.data[i * 4 + 3] = 255;
            }
        }

        offCtx.putImageData(heatImgData, 0, 0);

        hctx.imageSmoothingEnabled = true;
        hctx.filter = 'blur(15px)';
        hctx.drawImage(offCanvas, 0, 0, canvas.width, canvas.height);

        pollutionState.heatmapCanvas = heatCanvas;
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
            }
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1 / 3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1 / 3);
        }
        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    }

});
