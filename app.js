// ==========================================================================
// STATE MANAGEMENT
// ==========================================================================
const state = {
    rawData: [], // Array of all row objects
    colabLinks: {
        'Smart': '',
        'CAGE': '',
        'Arise': '',
        'Arise-Sill': '',
        'SpatialGlue': ''
    },
    activeTab: 'overview',
    selectedDataset: 'all',
    activeChartMetric: 'ARI',
    compareModelA: 'Smart',
    compareModelB: 'CAGE',
    compareH2HMetric: 'ARI',
    // Sliders default values (weights sum to 100)
    weights: {
        'ARI': 25,
        'NMI': 15,
        'AMI': 15,
        'Homogeneity': 10,
        'V-measure': 15,
        'Silhouette': 20
    },
    // Search & Sort state for raw table inspector
    inspector: {
        searchQuery: '',
        modelFilter: 'all',
        sortCol: 'model',
        sortAsc: true
    },
    // Chart instances
    charts: {
        radarOverview: null,
        boxplotDistribution: null,
        lineSeedComparison: null,
        barComparison: null,
        h2hDeltaBar: null
    }
};

const METRIC_NAMES = ['ARI', 'NMI', 'AMI', 'Homogeneity', 'V-measure', 'Silhouette'];
const MODELS = ['Smart', 'CAGE', 'Arise', 'Arise-Sill', 'SpatialGlue'];

// Theme Colors matching CSS variables
const MODEL_COLORS = {
    'Smart': '#8b5cf6',            // Purple/Indigo
    'CAGE': '#10b981',             // Green/Teal
    'Arise': '#f43f5e',            // Rose/Pink
    'Arise-Sill': '#ec4899',       // Fuchsia/Magenta
    'SpatialGlue': '#f59e0b'       // Amber/Orange
};

function getModelPrefix(modelName) {
    if (modelName === 'Arise-Sill') return 'arisesill';
    return modelName.toLowerCase();
}

// ==========================================================================
// INITIALIZATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    registerUIEventListeners();
    attemptDataLoad();
}

// Register all DOM element click/change listeners
function registerUIEventListeners() {
    // Sidebar Tabs
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const navItem = e.currentTarget;
            const tabId = navItem.dataset.tab;
            switchTab(tabId);
        });
    });

    // Dataset Select
    document.getElementById('datasetSelect').addEventListener('change', (e) => {
        state.selectedDataset = e.target.value;
        showToast(`Dataset switched to: ${state.selectedDataset === 'all' ? 'All Datasets' : state.selectedDataset}`);
        renderActiveTab();
    });

    // Theme Toggle
    document.getElementById('themeToggleBtn').addEventListener('click', toggleTheme);

    // Modal Events
    document.getElementById('uploadTriggerBtn').addEventListener('click', openModal);
    document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target === document.getElementById('fileModal')) {
            closeModal();
        }
    });

    // Fallback Data Button
    document.getElementById('loadFallbackDataBtn').addEventListener('click', loadWorkspaceFallback);

    // Chart Metric Selector (Detailed Tab)
    document.querySelectorAll('#chartMetricSelector button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('#chartMetricSelector button').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            state.activeChartMetric = e.currentTarget.dataset.metric;
            renderChartsTab();
        });
    });

    // Head-to-Head Selectors
    document.getElementById('compareModelA').addEventListener('change', (e) => {
        state.compareModelA = e.target.value;
        renderH2HTab();
    });
    document.getElementById('compareModelB').addEventListener('change', (e) => {
        state.compareModelB = e.target.value;
        renderH2HTab();
    });

    // Ablation weights
    document.getElementById('equalWeightsBtn').addEventListener('click', equalizeAblationWeights);
    document.getElementById('resetWeightsBtn').addEventListener('click', resetAblationWeights);

    // Raw Inspector Search & Filter
    document.getElementById('inspectorSearch').addEventListener('input', (e) => {
        state.inspector.searchQuery = e.target.value.toLowerCase();
        renderInspectorTab();
    });
    document.getElementById('inspectorModelSelect').addEventListener('change', (e) => {
        state.inspector.modelFilter = e.target.value;
        renderInspectorTab();
    });

    // Raw Inspector Table Sort
    document.querySelectorAll('#inspectorTable th.sortable').forEach(th => {
        th.addEventListener('click', (e) => {
            const col = e.currentTarget.dataset.col;
            if (state.inspector.sortCol === col) {
                state.inspector.sortAsc = !state.inspector.sortAsc;
            } else {
                state.inspector.sortCol = col;
                state.inspector.sortAsc = true;
            }
            renderInspectorTab();
        });
    });

    // Downloads
    document.getElementById('exportStatsBtn').addEventListener('click', downloadStatsCSV);
    document.getElementById('exportRawBtn').addEventListener('click', downloadRawCSV);

    // Drag and Drop files
    const dropZone = document.getElementById('dropZone');
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        handleManualFiles(e.dataTransfer.files);
    });
    document.getElementById('hiddenFileInput').addEventListener('change', (e) => {
        handleManualFiles(e.target.files);
    });
}

// ==========================================================================
// DATA LOADING
// ==========================================================================
async function attemptDataLoad() {
    updateStatus('pending', 'Checking workspace files...');
    
    try {
        // Attempt to load CSV files dynamically from local folders
        const [smartCsv, cageCsv, ariseCsv, ariseNewCsv, spatialglueCsv, smartLink, cageLink, ariseLink, ariseNewLink, spatialglueLink] = await Promise.all([
            fetch('./Smart/metrics_all_datasets.csv').then(res => res.ok ? res.text() : null),
            fetch('./CAGE/CAGE_all_results.csv').then(res => res.ok ? res.text() : null),
            fetch('./Arise-Sill/metrics_all_datasets.csv').then(res => res.ok ? res.text() : null),
            fetch('./Arise/metrics_all_datasets.csv').then(res => res.ok ? res.text() : null),
            fetch('./SpatialGlue/SpatialGlue_all_results.csv').then(res => res.ok ? res.text() : null),
            fetch('./Smart/link.txt').then(res => res.ok ? res.text() : null),
            fetch('./CAGE/link.txt').then(res => res.ok ? res.text() : null),
            fetch('./Arise-Sill/link.txt').then(res => res.ok ? res.text() : null),
            fetch('./Arise/link.txt').then(res => res.ok ? res.text() : null),
            fetch('./SpatialGlue/link.txt').then(res => res.ok ? res.text() : null)
        ]);

        if (smartCsv && cageCsv && ariseCsv && ariseNewCsv && spatialglueCsv) {
            // Success! Parse loaded strings
            const parsedData = [
                ...parseCSVText(smartCsv, 'Smart'),
                ...parseCSVText(cageCsv, 'CAGE'),
                ...parseCSVText(ariseCsv, 'Arise-Sill'),
                ...parseCSVText(ariseNewCsv, 'Arise'),
                ...parseCSVText(spatialglueCsv, 'SpatialGlue')
            ];
            
            state.rawData = parsedData;
            state.colabLinks['Smart'] = smartLink ? smartLink.trim() : '';
            state.colabLinks['CAGE'] = cageLink ? cageLink.trim() : '';
            state.colabLinks['Arise-Sill'] = ariseLink ? ariseLink.trim() : '';
            state.colabLinks['Arise'] = ariseNewLink ? ariseNewLink.trim() : '';
            state.colabLinks['SpatialGlue'] = spatialglueLink ? spatialglueLink.trim() : '';
            
            updateStatus('loaded', 'Disk Files Connected');
            populateDatasetSelector();
            renderActiveTab();
            updateColabUI();
            showToast('Successfully fetched all CSV files dynamically!', 'success');
        } else {
            throw new Error('Local files missing or CORS blocked.');
        }
    } catch (err) {
        console.warn('Dynamic fetch failed:', err);
        // Attempt fallback to loaded window variables (from data.js)
        if (window.fallbackData && window.fallbackData.length > 0) {
            state.rawData = window.fallbackData;
            state.colabLinks = window.fallbackLinks || state.colabLinks;
            updateStatus('loaded', 'Workspace Fallback Active');
            populateDatasetSelector();
            renderActiveTab();
            updateColabUI();
            showToast('CORS restricts dynamic fetch. Workspace fallback loaded successfully!', 'warning');
        } else {
            // Complete failure: need user upload
            updateStatus('missing', 'Data Files Missing');
            openModal();
        }
    }
}

function loadWorkspaceFallback() {
    if (window.fallbackData && window.fallbackData.length > 0) {
        state.rawData = window.fallbackData;
        state.colabLinks = window.fallbackLinks || state.colabLinks;
        updateStatus('loaded', 'Workspace Fallback Active');
        populateDatasetSelector();
        renderActiveTab();
        updateColabUI();
        closeModal();
        showToast('Successfully loaded Workspace Fallback Data!', 'success');
    } else {
        showToast('Error: Static data.js is not loaded. Try manually uploading CSV files.', 'danger');
    }
}

// Parse CSV text block and append model label
function parseCSVText(text, modelName) {
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) return [];
    
    // Header parsing
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const results = [];
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const row = { model: modelName };
        
        headers.forEach((header, index) => {
            const val = values[index];
            if (header === 'dataset') {
                row[header] = val;
            } else if (header === 'seed') {
                row[header] = parseInt(val, 10);
            } else {
                row[header] = parseFloat(val);
            }
        });
        results.push(row);
    }
    return results;
}

// Handle browser drag & drop file imports
async function handleManualFiles(fileList) {
    let loadedCount = 0;
    const fileLoaders = [];
    
    for (let file of fileList) {
        const name = file.name.toLowerCase();
        
        if (name.endsWith('.csv') || name.endsWith('.txt')) {
            const promise = new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const text = e.target.result;
                    
                    if (name.includes('smart') && name.endsWith('.csv')) {
                        state.rawData = state.rawData.filter(r => r.model !== 'Smart');
                        state.rawData.push(...parseCSVText(text, 'Smart'));
                        loadedCount++;
                    } else if (name.includes('cage') && name.endsWith('.csv')) {
                        state.rawData = state.rawData.filter(r => r.model !== 'CAGE');
                        state.rawData.push(...parseCSVText(text, 'CAGE'));
                        loadedCount++;
                    } else if (name.toLowerCase().includes('arise') && name.toLowerCase().includes('sill') && name.endsWith('.csv')) {
                        state.rawData = state.rawData.filter(r => r.model !== 'Arise-Sill');
                        state.rawData.push(...parseCSVText(text, 'Arise-Sill'));
                        loadedCount++;
                    } else if (name.toLowerCase().includes('arise') && name.endsWith('.csv')) {
                        state.rawData = state.rawData.filter(r => r.model !== 'Arise');
                        state.rawData.push(...parseCSVText(text, 'Arise'));
                        loadedCount++;
                    } else if (name.includes('spatialglue') && name.endsWith('.csv')) {
                        state.rawData = state.rawData.filter(r => r.model !== 'SpatialGlue');
                        state.rawData.push(...parseCSVText(text, 'SpatialGlue'));
                        loadedCount++;
                    } else if (name.includes('metrics_all_datasets') && !name.includes('arise') && !name.includes('smart')) {
                        // Ambiguous metrics filename: prompt or try to detect structure
                        // Let's assume user uploaded multiple. Let's look for indicator paths
                        state.rawData.push(...parseCSVText(text, 'Smart')); // default fallback
                        loadedCount++;
                    } else if (name.includes('link') && name.endsWith('.txt')) {
                        // Detect folder source if possible, or update all
                        // For simplicity, we search for keyword
                        if (name.includes('smart')) state.colabLinks['Smart'] = text.trim();
                        else if (name.includes('cage')) state.colabLinks['CAGE'] = text.trim();
                        else if (name.toLowerCase().includes('arise') && name.toLowerCase().includes('sill')) state.colabLinks['Arise-Sill'] = text.trim();
                        else if (name.toLowerCase().includes('arise')) state.colabLinks['Arise'] = text.trim();
                        else if (name.includes('spatialglue')) state.colabLinks['SpatialGlue'] = text.trim();
                        else {
                            // Apply to first available
                            state.colabLinks['Smart'] = text.trim();
                        }
                        loadedCount++;
                    }
                    resolve();
                };
                reader.readAsText(file);
            });
            fileLoaders.push(promise);
        }
    }
    
    if (fileLoaders.length > 0) {
        await Promise.all(fileLoaders);
        if (loadedCount > 0) {
            updateStatus('loaded', 'Manual Upload Connected');
            populateDatasetSelector();
            renderActiveTab();
            updateColabUI();
            closeModal();
            showToast(`Successfully processed ${loadedCount} uploaded file(s).`, 'success');
        } else {
            showToast('Files uploaded, but columns could not be verified. Ensure file names contain "smart", "cage", "arise", or "spatialglue".', 'warning');
        }
    } else {
        showToast('No valid .csv or .txt files selected.', 'danger');
    }
}

// Populate the top dataset dropdown filter
function populateDatasetSelector() {
    const selector = document.getElementById('datasetSelect');
    // Save current selection if valid
    const currentSel = selector.value;
    
    // Get unique dataset names
    const datasets = [...new Set(state.rawData.map(row => row.dataset))].sort();
    
    // Clear dynamic options (keep first "all" option)
    selector.innerHTML = '<option value="all">All Datasets (Combined)</option>';
    
    datasets.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d.replace(/_/g, ' ');
        selector.appendChild(opt);
    });
    
    if (datasets.includes(currentSel)) {
        selector.value = currentSel;
        state.selectedDataset = currentSel;
    } else {
        selector.value = 'all';
        state.selectedDataset = 'all';
    }
}

// Update status panel visual details
function updateStatus(status, text) {
    const dot = document.getElementById('statusDot');
    const textEl = document.getElementById('statusText');
    const container = document.getElementById('fileStatusContainer');
    
    // Reset classes
    dot.className = 'status-dot ' + (status === 'loaded' ? 'green' : status === 'pending' ? 'orange' : 'red');
    textEl.textContent = text;
    
    // Build Modal Status HTML
    let filesState = {
        'Smart (CSV)': hasDataForModel('Smart'),
        'CAGE (CSV)': hasDataForModel('CAGE'),
        'Arise (CSV)': hasDataForModel('Arise'),
        'Arise-Sill (CSV)': hasDataForModel('Arise-Sill'),
        'SpatialGlue (CSV)': hasDataForModel('SpatialGlue'),
    };
    
    let html = '';
    for (let f in filesState) {
        const isLoaded = filesState[f];
        html += `
            <div class="status-row">
                <span class="status-row-label">${f}</span>
                <span class="status-indicator-badge ${isLoaded ? 'loaded' : 'missing'}">
                    <i data-lucide="${isLoaded ? 'check' : 'alert-circle'}"></i>
                    ${isLoaded ? 'Loaded' : 'Missing'}
                </span>
            </div>
        `;
    }
    container.innerHTML = html;
    lucide.createIcons();
}

function hasDataForModel(modelName) {
    return state.rawData.some(r => r.model === modelName);
}

function updateColabUI() {
    const smartA = document.getElementById('smartColab');
    const cageA = document.getElementById('cageColab');
    const ariseNewA = document.getElementById('ariseColab');
    const ariseA = document.getElementById('arisesillColab');
    const spatialglueA = document.getElementById('spatialglueColab');
    
    if (state.colabLinks['Smart']) {
        smartA.href = state.colabLinks['Smart'];
        smartA.style.pointerEvents = 'auto';
        smartA.style.opacity = '1';
    } else {
        smartA.style.pointerEvents = 'none';
        smartA.style.opacity = '0.4';
    }

    if (state.colabLinks['CAGE']) {
        cageA.href = state.colabLinks['CAGE'];
        cageA.style.pointerEvents = 'auto';
        cageA.style.opacity = '1';
    } else {
        cageA.style.pointerEvents = 'none';
        cageA.style.opacity = '0.4';
    }

    if (state.colabLinks['Arise']) {
        ariseNewA.href = state.colabLinks['Arise'];
        ariseNewA.style.pointerEvents = 'auto';
        ariseNewA.style.opacity = '1';
    } else {
        ariseNewA.style.pointerEvents = 'none';
        ariseNewA.style.opacity = '0.4';
    }

    if (state.colabLinks['Arise-Sill']) {
        ariseA.href = state.colabLinks['Arise-Sill'];
        ariseA.style.pointerEvents = 'auto';
        ariseA.style.opacity = '1';
    } else {
        ariseA.style.pointerEvents = 'none';
        ariseA.style.opacity = '0.4';
    }

    if (state.colabLinks['SpatialGlue']) {
        spatialglueA.href = state.colabLinks['SpatialGlue'];
        spatialglueA.style.pointerEvents = 'auto';
        spatialglueA.style.opacity = '1';
    } else {
        spatialglueA.style.pointerEvents = 'none';
        spatialglueA.style.opacity = '0.4';
    }
}

// ==========================================================================
// CORE COMPUTATION ENGINE (MATHS & STATISTICS)
// ==========================================================================
const stats = {
    mean: (arr) => arr.reduce((a, b) => a + b, 0) / arr.length,
    median: (arr) => {
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    },
    stdDev: (arr, meanVal) => {
        const m = meanVal !== undefined ? meanVal : stats.mean(arr);
        const variance = arr.reduce((sum, val) => sum + Math.pow(val - m, 2), 0) / arr.length;
        return Math.sqrt(variance);
    },
    pearsonsCorrelation: (x, y) => {
        const n = x.length;
        if (n === 0 || n !== y.length) return 0;
        
        const meanX = stats.mean(x);
        const meanY = stats.mean(y);
        
        let num = 0;
        let denX = 0;
        let denY = 0;
        
        for (let i = 0; i < n; i++) {
            const diffX = x[i] - meanX;
            const diffY = y[i] - meanY;
            num += diffX * diffY;
            denX += diffX * diffX;
            denY += diffY * diffY;
        }
        
        if (denX === 0 || denY === 0) return 0;
        return num / Math.sqrt(denX * denY);
    },
    // Paired T-Test
    pairedTTest: (arrA, arrB) => {
        const n = arrA.length;
        if (n <= 1 || n !== arrB.length) return { tStat: 0, pVal: 1, df: 0 };
        
        const diffs = arrA.map((val, idx) => val - arrB[idx]);
        const meanDiff = stats.mean(diffs);
        const stdDevDiff = stats.stdDev(diffs, meanDiff);
        
        // Avoid division by zero
        if (stdDevDiff === 0) return { tStat: 0, pVal: 1, df: n - 1 };
        
        const standardError = stdDevDiff / Math.sqrt(n);
        const tStat = meanDiff / standardError;
        const df = n - 1;
        
        // p-value calculation (two-tailed student-t approximation)
        const pVal = pairedPValue(tStat, df);
        return { tStat, pVal, df };
    }
};

// Numerical student-t distribution functions
function studentTPercent(t, df) {
    const z = t * (1 - 1 / (4 * df)) / Math.sqrt(1 + t * t / (2 * df));
    return normalCDF(z);
}

function normalCDF(z) {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989423 * Math.exp(-z * z / 2);
    let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    if (z > 0) p = 1 - p;
    return p;
}

function pairedPValue(tStat, df) {
    const pOneTail = studentTPercent(-Math.abs(tStat), df);
    return Math.min(1, Math.max(0, pOneTail * 2)); // Two-tailed bounds
}

// Filters rawData array based on dataset filter state
function getFilteredData() {
    if (state.selectedDataset === 'all') {
        return state.rawData;
    }
    return state.rawData.filter(row => row.dataset === state.selectedDataset);
}

// Group array rows by model type
function groupDataByModel(data) {
    const grouped = {};
    MODELS.forEach(m => grouped[m] = []);
    data.forEach(row => {
        if (grouped[row.model]) {
            grouped[row.model].push(row);
        }
    });
    return grouped;
}

// ==========================================================================
// RENDERERS: TAB TRANSITIONS & ROUTER
// ==========================================================================
function switchTab(tabId) {
    // UI state switch
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.tab === tabId) item.classList.add('active');
    });

    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });

    const activePane = document.getElementById(`tab-${tabId}`);
    if (activePane) activePane.classList.add('active');

    state.activeTab = tabId;
    
    // Update headers
    const titles = {
        'overview': { title: 'Overview Dashboard', subtitle: 'Aggregate metrics overview and ranked model leaderboards' },
        'charts': { title: 'Detailed Analytics', subtitle: 'Interactive distributions and seed-by-seed score metrics' },
        'comparison': { title: 'Head-to-Head Comparison', subtitle: 'Direct delta comparisons and paired significance tests' },
        'ablation': { title: 'Ablation & Custom Weights', subtitle: 'Customize evaluation metric weights and examine correlation matrices' },
        'stability': { title: 'Statistical Stability', subtitle: 'Full statistics tables describing model dispersion across seed factors' },
        'inspector': { title: 'Dataset Inspector', subtitle: 'Filter and export raw CSV records for local investigations' }
    };
    
    document.getElementById('pageTitle').textContent = titles[tabId].title;
    document.getElementById('pageSubtitle').textContent = titles[tabId].subtitle;

    // Trigger tab-specific draw routines
    renderActiveTab();
}

function renderActiveTab() {
    if (state.rawData.length === 0) return;
    
    switch (state.activeTab) {
        case 'overview':
            renderOverviewTab();
            break;
        case 'charts':
            renderChartsTab();
            break;
        case 'comparison':
            renderH2HTab();
            break;
        case 'ablation':
            renderAblationTab();
            break;
        case 'stability':
            renderStabilityTab();
            break;
        case 'inspector':
            renderInspectorTab();
            break;
    }
}

// ==========================================================================
// TAB RENDERER: OVERVIEW
// ==========================================================================
function renderOverviewTab() {
    const data = getFilteredData();
    const grouped = groupDataByModel(data);
    
    // Compute cards averages
    MODELS.forEach(model => {
        const modelRows = grouped[model];
        const prefix = getModelPrefix(model);
        
        if (modelRows.length > 0) {
            const aris = modelRows.map(r => r.ARI);
            const silhouets = modelRows.map(r => r.Silhouette);
            const nmis = modelRows.map(r => r.NMI);
            
            const meanAri = stats.mean(aris);
            const meanSil = stats.mean(silhouets);
            const meanNmi = stats.mean(nmis);
            
            const stdAri = stats.stdDev(aris, meanAri);
            
            document.getElementById(`${prefix}MeanARI`).textContent = meanAri.toFixed(4);
            document.getElementById(`${prefix}MeanSilhouette`).textContent = meanSil.toFixed(4);
            document.getElementById(`${prefix}MeanNMI`).textContent = meanNmi.toFixed(4);
            
            document.getElementById(`${prefix}StabilityLabel`).innerHTML = 
                `<i data-lucide="activity"></i> Seed StdDev (ARI): ±${stdAri.toFixed(4)}`;
        } else {
            document.getElementById(`${prefix}MeanARI`).textContent = '-';
            document.getElementById(`${prefix}MeanSilhouette`).textContent = '-';
            document.getElementById(`${prefix}MeanNMI`).textContent = '-';
            document.getElementById(`${prefix}StabilityLabel`).textContent = 'Seed StdDev: -';
        }
    });
    
    lucide.createIcons();
    
    // Compute Rank Leaderboard
    computeLeaderboard(grouped);
    
    // Render Radar Chart
    drawRadarChart(grouped);
}

function computeLeaderboard(grouped) {
    const leaderboardEl = document.getElementById('leaderboardList');
    
    // Calculate model ranks for all 6 metrics
    const rankScores = {};
    MODELS.forEach(m => rankScores[m] = 0);
    
    METRIC_NAMES.forEach(metric => {
        const performances = MODELS.map(model => {
            const values = grouped[model].map(r => r[metric] || 0);
            return { model, meanVal: values.length > 0 ? stats.mean(values) : 0 };
        });
        
        // Sort descending (higher is better)
        performances.sort((a, b) => b.meanVal - a.meanVal);
        
        // Assign ranks (1st = 1 pt, 2nd = 2 pts, 3rd = 3 pts). Lower rank points = better
        performances.forEach((perf, idx) => {
            rankScores[perf.model] += (idx + 1);
        });
    });
    
    // Average rank score
    const rankList = MODELS.map(model => {
        return { model, avgRank: rankScores[model] / METRIC_NAMES.length };
    });
    
    // Sort ascending (lower average rank is better)
    rankList.sort((a, b) => a.avgRank - b.avgRank);
    
    let html = '';
    rankList.forEach((rankObj, idx) => {
        const clsPrefix = getModelPrefix(rankObj.model);
        html += `
            <div class="leaderboard-item ${clsPrefix}-rank-border">
                <div class="leaderboard-rank">${idx + 1}</div>
                <div class="leaderboard-name">${rankObj.model}</div>
                <div class="leaderboard-stats">
                    <span class="leaderboard-score-lbl">Avg. Rank Index</span>
                    <span class="leaderboard-score-val">${rankObj.avgRank.toFixed(2)}</span>
                </div>
            </div>
        `;
    });
    leaderboardEl.innerHTML = html;
}

function drawRadarChart(grouped) {
    // Get average for each metric per model
    const series = MODELS.map(model => {
        const dataPoints = METRIC_NAMES.map(metric => {
            const values = grouped[model].map(r => r[metric] || 0);
            return values.length > 0 ? parseFloat(stats.mean(values).toFixed(4)) : 0;
        });
        return { name: model, data: dataPoints };
    });

    const options = {
        chart: {
            height: 380,
            type: 'radar',
            toolbar: { show: false },
            dropShadow: { enabled: true, blur: 8, left: 1, top: 1, opacity: 0.2 }
        },
        series: series,
        colors: MODELS.map(model => MODEL_COLORS[model]),
        stroke: { width: 2 },
        fill: { opacity: 0.15 },
        markers: { size: 4, hover: { size: 6 } },
        xaxis: {
            categories: METRIC_NAMES,
            labels: {
                style: {
                    colors: Array(6).fill(!document.body.classList.contains('dark-theme') ? '#475569' : '#94a3b8'),
                    fontSize: '11px',
                    fontWeight: 600
                }
            }
        },
        yaxis: {
            show: false,
            min: 0,
            max: 0.7 // adjust max to highlight details
        },
        legend: {
            position: 'bottom',
            labels: { colors: !document.body.classList.contains('dark-theme') ? '#475569' : '#f1f5f9' }
        },
        theme: { mode: !document.body.classList.contains('dark-theme') ? 'light' : 'dark' }
    };

    if (state.charts.radarOverview) {
        state.charts.radarOverview.destroy();
    }
    
    state.charts.radarOverview = new ApexCharts(document.querySelector("#radarOverviewChart"), options);
    state.charts.radarOverview.render();
}

// ==========================================================================
// TAB RENDERER: DETAILED ANALYTICS (CHARTS)
// ==========================================================================
function renderChartsTab() {
    const metric = state.activeChartMetric;
    const data = getFilteredData();
    const grouped = groupDataByModel(data);
    
    // Subtitles
    document.getElementById('boxChartSubtitle').textContent = `Spread of ${metric} scores across 20 random seeds`;
    document.getElementById('lineChartSubtitle').textContent = `Seed-by-seed consistency curve for ${metric}`;
    
    drawBoxplotChart(grouped, metric);
    drawLineChart(grouped, metric);
    drawBarChart(grouped, metric);
}

function drawBoxplotChart(grouped, metric) {
    const seriesData = MODELS.map(model => {
        const values = grouped[model].map(r => r[metric] || 0).sort((a,b)=>a-b);
        if (values.length === 0) return { x: model, y: [0, 0, 0, 0, 0] };
        
        const min = values[0];
        const max = values[values.length - 1];
        const q1 = stats.median(values.slice(0, Math.floor(values.length / 2)));
        const median = stats.median(values);
        const q3 = stats.median(values.slice(Math.ceil(values.length / 2)));
        
        return {
            x: model,
            y: [min, q1, median, q3, max].map(v => parseFloat(v.toFixed(4)))
        };
    });

    const options = {
        chart: {
            type: 'boxPlot',
            height: 350,
            toolbar: { show: false }
        },
        series: [{ type: 'boxPlot', data: seriesData }],
        colors: MODELS.map(model => MODEL_COLORS[model]),
        plotOptions: {
            boxPlot: {
                colors: {
                    upper: '#8b5cf6', // Violet
                    lower: '#10b981'  // Emerald
                }
            }
        },
        xaxis: {
            type: 'category',
            categories: MODELS,
            labels: {
                style: {
                    fontSize: '11px',
                    fontWeight: 600
                }
            }
        },
        // We override chart colors dynamically to match each model
        theme: { mode: !document.body.classList.contains('dark-theme') ? 'light' : 'dark' },
        yaxis: {
            title: { text: metric, style: { fontSize: '12px', fontWeight: 600 } },
            labels: { formatter: (val) => val.toFixed(3) }
        }
    };

    if (state.charts.boxplotDistribution) {
        state.charts.boxplotDistribution.destroy();
    }
    
    state.charts.boxplotDistribution = new ApexCharts(document.querySelector("#boxplotDistributionChart"), options);
    state.charts.boxplotDistribution.render();
}

function drawLineChart(grouped, metric) {
    // Get all unique seeds present in the grouped data
    const allSeeds = new Set();
    MODELS.forEach(model => {
        if (grouped[model]) {
            grouped[model].forEach(r => {
                if (r.seed !== undefined && r.seed !== null) {
                    allSeeds.add(Number(r.seed));
                }
            });
        }
    });

    // Sort seeds ascending to align X-axis properly
    const sortedSeeds = Array.from(allSeeds).sort((a, b) => a - b);
    const categories = sortedSeeds.map(s => `Seed ${s}`);

    // Build series data aligned to categories
    const series = MODELS.map(model => {
        const modelRows = grouped[model] || [];
        const seedToValue = {};
        modelRows.forEach(r => {
            seedToValue[Number(r.seed)] = parseFloat((r[metric] || 0).toFixed(4));
        });

        const data = sortedSeeds.map(seed => {
            return seedToValue[seed] !== undefined ? seedToValue[seed] : null;
        });

        return { name: model, data: data };
    });

    const options = {
        chart: {
            type: 'line',
            height: 350,
            toolbar: { show: false },
            zoom: { enabled: false }
        },
        series: series,
        colors: MODELS.map(model => MODEL_COLORS[model]),
        stroke: { width: 3, curve: 'smooth' },
        markers: { size: 4, hover: { size: 6 } },
        xaxis: {
            categories: categories,
            labels: { rotate: -45, style: { fontSize: '9px' } }
        },
        yaxis: {
            labels: { formatter: (val) => val.toFixed(3) }
        },
        legend: { position: 'top' },
        theme: { mode: !document.body.classList.contains('dark-theme') ? 'light' : 'dark' }
    };

    if (state.charts.lineSeedComparison) {
        state.charts.lineSeedComparison.destroy();
    }
    
    state.charts.lineSeedComparison = new ApexCharts(document.querySelector("#lineSeedComparisonChart"), options);
    state.charts.lineSeedComparison.render();
}

function drawBarChart(grouped, metric) {
    const chartData = MODELS.map(model => {
        const values = grouped[model].map(r => r[metric] || 0);
        const mean = values.length > 0 ? stats.mean(values) : 0;
        const std = values.length > 0 ? stats.stdDev(values, mean) : 0;
        
        return {
            x: model,
            y: parseFloat(mean.toFixed(4)),
            // Custom stats stored in data object to fetch in tooltip
            std: parseFloat(std.toFixed(4))
        };
    });

    const options = {
        chart: {
            type: 'bar',
            height: 320,
            toolbar: { show: false }
        },
        series: [{ name: 'Mean Score', data: chartData }],
        colors: [
            function({ value, seriesIndex, dataPointIndex }) {
                const modelName = chartData[dataPointIndex].x;
                return MODEL_COLORS[modelName];
            }
        ],
        plotOptions: {
            bar: {
                columnWidth: '45%',
                distributed: true,
                borderRadius: 4,
                dataLabels: { position: 'top' }
            }
        },
        dataLabels: {
            enabled: true,
            formatter: (val) => val.toFixed(4),
            offsetY: -20,
            style: {
                fontSize: '11px',
                colors: [!document.body.classList.contains('dark-theme') ? '#0f172a' : '#f1f5f9']
            }
        },
        yaxis: {
            labels: { formatter: (val) => val.toFixed(3) }
        },
        tooltip: {
            custom: function({ series, seriesIndex, dataPointIndex, w }) {
                const d = chartData[dataPointIndex];
                return `<div class="stats-tooltip" style="padding:10px; background-color: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 6px;">
                    <strong>${d.x}</strong><br/>
                    Mean: ${d.y.toFixed(4)}<br/>
                    StdDev (σ): ±${d.std.toFixed(4)}
                </div>`;
            }
        },
        theme: { mode: !document.body.classList.contains('dark-theme') ? 'light' : 'dark' }
    };

    if (state.charts.barComparison) {
        state.charts.barComparison.destroy();
    }
    
    state.charts.barComparison = new ApexCharts(document.querySelector("#barComparisonChart"), options);
    state.charts.barComparison.render();
}

// ==========================================================================
// TAB RENDERER: HEAD-TO-HEAD COMPARISON
// ==========================================================================
function renderH2HTab() {
    const modelA = state.compareModelA;
    const modelB = state.compareModelB;
    
    // Safety check
    if (modelA === modelB) {
        document.getElementById('h2hWinnerMetric').textContent = 'Equal models';
        document.getElementById('h2hWinnerMargin').textContent = 'Select distinct models to compare';
        document.getElementById('h2hAvgDelta').textContent = '-';
        document.getElementById('h2hDeltaDir').textContent = 'No delta';
        document.getElementById('h2hSigLevel').textContent = '-';
        document.getElementById('h2hPValue').textContent = '-';
        document.getElementById('h2hComparisonTable').querySelector('tbody').innerHTML = 
            '<tr><td colspan="7" class="text-muted text-center">Please select two different models to execute head-to-head comparison.</td></tr>';
        if (state.charts.h2hDeltaBar) state.charts.h2hDeltaBar.destroy();
        return;
    }

    const data = getFilteredData();
    const grouped = groupDataByModel(data);
    
    const rowsA = grouped[modelA];
    const rowsB = grouped[modelB];
    
    // Sort both datasets by dataset name AND seed to ensure correct element alignment
    const sortKey = (r) => `${r.dataset}_${r.seed}`;
    const sortedA = [...rowsA].sort((x, y) => sortKey(x).localeCompare(sortKey(y)));
    const sortedB = [...rowsB].sort((x, y) => sortKey(x).localeCompare(sortKey(y)));
    
    // Extract overlapping keys
    const matchMapA = new Map(sortedA.map(r => [sortKey(r), r]));
    const matchedB = sortedB.filter(r => matchMapA.has(sortKey(r)));
    const matchedA = matchedB.map(r => matchMapA.get(sortKey(r)));

    // Create table & stats
    const tableBody = document.getElementById('h2hComparisonTable').querySelector('tbody');
    let tableHtml = '';
    
    let biggestWinnerMetric = '';
    let biggestWinnerDiff = -Infinity;
    let absoluteSumDelta = 0;
    
    const metricAnalysis = {};

    METRIC_NAMES.forEach(metric => {
        const valsA = matchedA.map(r => r[metric] || 0);
        const valsB = matchedB.map(r => r[metric] || 0);
        
        const meanA = stats.mean(valsA);
        const meanB = stats.mean(valsB);
        const diff = meanB - meanA;
        const pctDiff = meanA !== 0 ? (diff / meanA) * 100 : 0;
        
        // Paired T-Test
        const tResult = stats.pairedTTest(valsA, valsB);
        const isSig = tResult.pVal < 0.05;
        
        absoluteSumDelta += diff;
        metricAnalysis[metric] = { diff, pctDiff, pVal: tResult.pVal, isSig, meanA, meanB };
        
        // Track biggest improvement relative to scale
        if (diff > biggestWinnerDiff) {
            biggestWinnerDiff = diff;
            biggestWinnerMetric = metric;
        }

        // Color coding absolute diffs
        const diffClass = diff > 0 ? 'positive' : diff < 0 ? 'negative' : 'neutral';
        const diffPrefix = diff > 0 ? '+' : '';
        const pctPrefix = pctDiff > 0 ? '+' : '';
        
        tableHtml += `
            <tr>
                <td><strong>${metric}</strong></td>
                <td>${meanA.toFixed(4)}</td>
                <td>${meanB.toFixed(4)}</td>
                <td class="delta-val ${diffClass}">${diffPrefix}${diff.toFixed(4)}</td>
                <td class="delta-val ${diffClass}">${pctPrefix}${pctDiff.toFixed(2)}%</td>
                <td>${tResult.pVal.toFixed(6)}</td>
                <td>
                    <span class="significance-badge ${isSig ? 'yes' : 'no'}">
                        ${isSig ? 'Significant' : 'Not Sig.'}
                    </span>
                </td>
            </tr>
        `;
    });
    tableBody.innerHTML = tableHtml;
    
    // Core delta cards update
    const avgDelta = absoluteSumDelta / METRIC_NAMES.length;
    
    document.getElementById('h2hWinnerMetric').textContent = biggestWinnerMetric;
    document.getElementById('h2hWinnerMargin').textContent = `Model B improved by +${biggestWinnerDiff.toFixed(4)}`;
    
    document.getElementById('h2hAvgDelta').textContent = (avgDelta >= 0 ? '+' : '') + avgDelta.toFixed(4);
    document.getElementById('h2hDeltaDir').textContent = avgDelta >= 0 ? 'Model B outperforms A' : 'Model A outperforms B';
    
    // Calculate global significance level
    // If most metrics are significant
    const sigMetrics = METRIC_NAMES.filter(m => metricAnalysis[m].isSig);
    const avgPVal = stats.mean(METRIC_NAMES.map(m => metricAnalysis[m].pVal));
    
    document.getElementById('h2hSigLevel').textContent = sigMetrics.length >= 3 ? 'Highly Significant' : sigMetrics.length > 0 ? 'Partially Significant' : 'Not Significant';
    document.getElementById('h2hPValue').textContent = `Avg P-Value: ${avgPVal.toFixed(5)} (${sigMetrics.length}/6 metrics)`;

    // Redraw delta seed selector buttons
    renderH2HMetricSelectorButtons();
    
    // Draw delta chart
    drawH2HDeltaChart(matchedA, matchedB, state.compareH2HMetric);
}

function renderH2HMetricSelectorButtons() {
    const container = document.getElementById('h2hMetricSelect');
    let html = '';
    
    METRIC_NAMES.forEach(m => {
        const activeCls = m === state.compareH2HMetric ? 'active' : '';
        html += `<button class="mini-btn ${activeCls}" onclick="setH2HMetric('${m}')">${m}</button>`;
    });
    container.innerHTML = html;
}

// Global scope setter invoked by mini buttons
window.setH2HMetric = function(metric) {
    state.compareH2HMetric = metric;
    renderH2HTab();
};

function drawH2HDeltaChart(matchedA, matchedB, metric) {
    // Diff array: Model B - Model A for each paired seed
    const diffData = matchedA.map((rowA, idx) => {
        const rowB = matchedB[idx];
        const valA = rowA[metric] || 0;
        const valB = rowB[metric] || 0;
        return {
            x: `${rowA.dataset.replace(/_S\d|lymph_node_/g, '')} (S:${rowA.seed})`,
            y: parseFloat((valB - valA).toFixed(5))
        };
    });

    const options = {
        chart: {
            type: 'bar',
            height: 350,
            toolbar: { show: false }
        },
        series: [{ name: `Delta Score (${state.compareModelB} - ${state.compareModelA})`, data: diffData }],
        colors: [
            function({ value }) {
                return value >= 0 ? MODEL_COLORS['CAGE'] : MODEL_COLORS['Arise']; // positive = green, negative = red
            }
        ],
        plotOptions: {
            bar: {
                borderRadius: 2,
                colors: { ranges: [{ from: -10, to: 0, color: MODEL_COLORS['Arise'] }, { from: 0, to: 10, color: MODEL_COLORS['CAGE'] }] }
            }
        },
        xaxis: {
            labels: { show: false } // Hide labels to prevent clutter with 120 points
        },
        yaxis: {
            title: { text: `Delta ${metric}` },
            labels: { formatter: (val) => (val >= 0 ? '+' : '') + val.toFixed(4) }
        },
        tooltip: {
            x: { show: true }
        },
        theme: { mode: !document.body.classList.contains('dark-theme') ? 'light' : 'dark' }
    };

    if (state.charts.h2hDeltaBar) {
        state.charts.h2hDeltaBar.destroy();
    }
    
    state.charts.h2hDeltaBar = new ApexCharts(document.querySelector("#h2hDeltaBarChart"), options);
    state.charts.h2hDeltaBar.render();
}

// ==========================================================================
// TAB RENDERER: ABLATION STUDY & METRICS WEIGHTING
// ==========================================================================
function renderAblationTab() {
    renderWeightSliders();
    renderCustomLeaderboard();
    renderCorrelationHeatmap();
}

function renderWeightSliders() {
    const container = document.getElementById('weightSlidersList');
    container.innerHTML = '';
    
    METRIC_NAMES.forEach(m => {
        const item = document.createElement('div');
        item.className = 'weight-control-item';
        
        // Compute normalized percentage
        const sum = Object.values(state.weights).reduce((a,b)=>a+b, 0);
        const normPercent = sum > 0 ? (state.weights[m] / sum * 100) : 0;
        
        item.innerHTML = `
            <div class="weight-label-row">
                <span>${m}</span>
                <span class="weight-value">${state.weights[m]}% <small class="text-muted">(${normPercent.toFixed(1)}% norm)</small></span>
            </div>
            <input type="range" class="weight-slider" min="0" max="100" value="${state.weights[m]}" data-metric="${m}">
        `;
        
        // Slider drag input listener
        item.querySelector('input').addEventListener('input', (e) => {
            const metric = e.target.dataset.metric;
            state.weights[metric] = parseInt(e.target.value, 10);
            
            // Re-render sliders & leaderboard dynamically on fly
            renderWeightSliders();
            renderCustomLeaderboard();
        });
        
        container.appendChild(item);
    });
}

function equalizeAblationWeights() {
    METRIC_NAMES.forEach(m => state.weights[m] = 16); // ~ 16.6%
    renderAblationTab();
    showToast('Metric weights set equally.', 'success');
}

function resetAblationWeights() {
    state.weights = { ARI: 25, NMI: 15, AMI: 15, Homogeneity: 10, 'V-measure': 15, Silhouette: 20 };
    renderAblationTab();
    showToast('Metric weights reset to defaults.', 'success');
}

function renderCustomLeaderboard() {
    const data = getFilteredData();
    const grouped = groupDataByModel(data);
    
    // Normalize weights
    const sum = Object.values(state.weights).reduce((a,b)=>a+b,0);
    const normalizedWeights = {};
    METRIC_NAMES.forEach(m => {
        normalizedWeights[m] = sum > 0 ? (state.weights[m] / sum) : 0;
    });
    
    // Calculate model custom weighted scores
    const leaderboardData = MODELS.map(model => {
        const modelRows = grouped[model];
        if (modelRows.length === 0) return { model, score: 0 };
        
        // Calculate average metric values for this model
        const means = {};
        METRIC_NAMES.forEach(m => {
            const values = modelRows.map(r => r[m] || 0);
            means[m] = stats.mean(values);
        });
        
        // Compute custom weighted score
        let score = 0;
        METRIC_NAMES.forEach(m => {
            score += means[m] * normalizedWeights[m];
        });
        
        return { model, score: parseFloat(score.toFixed(4)) };
    });
    
    // Sort descending
    leaderboardData.sort((a, b) => b.score - a.score);
    
    const container = document.getElementById('customLeaderboardGrid');
    let html = '';
    
    leaderboardData.forEach((item, idx) => {
        html += `
            <div class="custom-leaderboard-item">
                <div class="custom-leaderboard-rank">${idx + 1}</div>
                <div class="custom-leaderboard-details">
                    <span class="custom-leaderboard-name">${item.model}</span>
                    <span class="custom-leaderboard-score">${item.score.toFixed(4)}</span>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

function renderCorrelationHeatmap() {
    const data = getFilteredData();
    const container = document.getElementById('correlationHeatmapGrid');
    
    // Calculate correlation matrix
    const matrix = [];
    METRIC_NAMES.forEach((m1, idx1) => {
        matrix[idx1] = [];
        METRIC_NAMES.forEach((m2, idx2) => {
            const list1 = data.map(r => r[m1] || 0);
            const list2 = data.map(r => r[m2] || 0);
            matrix[idx1][idx2] = stats.pearsonsCorrelation(list1, list2);
        });
    });
    
    // Render 7x7 grid (top corner is empty, header labels on top/left)
    let html = '';
    
    // Row 0: Top labels
    html += '<div class="heatmap-cell header"></div>';
    METRIC_NAMES.forEach(m => {
        html += `<div class="heatmap-cell header" title="${m}">${m}</div>`;
    });
    
    // Rows 1-6: Content
    METRIC_NAMES.forEach((m1, rIdx) => {
        // Left label
        html += `<div class="heatmap-cell header" title="${m1}">${m1}</div>`;
        
        METRIC_NAMES.forEach((m2, cIdx) => {
            const score = matrix[rIdx][cIdx];
            
            // Map score to color shading
            // positive = emerald/teal, negative = rose/red, neutral = gray
            let background = 'var(--bg-tertiary)';
            if (score > 0.05) {
                background = `rgba(16, 185, 129, ${score.toFixed(2)})`;
            } else if (score < -0.05) {
                background = `rgba(244, 63, 94, ${Math.abs(score).toFixed(2)})`;
            }
            
            html += `
                <div class="heatmap-cell" style="background-color: ${background}; border: 1px solid var(--border-color);" 
                     title="Correlation of ${m1} vs ${m2}: ${score.toFixed(4)}">
                    ${score.toFixed(2)}
                </div>
            `;
        });
    });
    
    container.innerHTML = html;
}

// ==========================================================================
// TAB RENDERER: STATISTICAL STABILITY TABLE
// ==========================================================================
function renderStabilityTab() {
    const data = getFilteredData();
    const grouped = groupDataByModel(data);
    const tbody = document.getElementById('stabilityTable').querySelector('tbody');
    
    let html = '';
    
    MODELS.forEach(model => {
        const rows = grouped[model];
        const clsPrefix = getModelPrefix(model);
        
        METRIC_NAMES.forEach((metric, mIdx) => {
            const vals = rows.map(r => r[metric] || 0);
            
            if (vals.length > 0) {
                const mean = stats.mean(vals);
                const median = stats.median(vals);
                const std = stats.stdDev(vals, mean);
                const cv = mean !== 0 ? (std / mean * 100) : 0;
                const min = Math.min(...vals);
                const max = Math.max(...vals);
                const range = max - min;
                
                // Group row styling (first row of group gets border-top / group label)
                const isGroupStart = mIdx === 0;
                const trStyle = isGroupStart ? 'style="border-top: 2px solid var(--border-color);"' : '';
                
                html += `
                    <tr ${trStyle}>
                        ${isGroupStart ? `<td rowspan="6" class="model-text-${clsPrefix}" style="vertical-align: middle;"><strong>${model}</strong></td>` : ''}
                        <td><strong>${metric}</strong></td>
                        <td>${mean.toFixed(4)}</td>
                        <td>${median.toFixed(4)}</td>
                        <td>±${std.toFixed(4)}</td>
                        <td>${cv.toFixed(2)}%</td>
                        <td>${min.toFixed(4)}</td>
                        <td>${max.toFixed(4)}</td>
                        <td>${range.toFixed(4)}</td>
                    </tr>
                `;
            } else {
                const isGroupStart = mIdx === 0;
                html += `
                    <tr>
                        ${isGroupStart ? `<td rowspan="6"><strong>${model}</strong></td>` : ''}
                        <td><strong>${metric}</strong></td>
                        <td colspan="7" class="text-center text-muted">No data loaded</td>
                    </tr>
                `;
            }
        });
    });
    
    tbody.innerHTML = html;
}

// ==========================================================================
// TAB RENDERER: RAW DATA EXPLORER & SEARCH
// ==========================================================================
function renderInspectorTab() {
    const tbody = document.getElementById('inspectorTableBody');
    let data = state.rawData;
    
    // Apply filters
    if (state.inspector.modelFilter !== 'all') {
        data = data.filter(r => r.model === state.inspector.modelFilter);
    }
    
    // Apply search query
    if (state.inspector.searchQuery) {
        const query = state.inspector.searchQuery;
        data = data.filter(r => {
            return r.dataset.toLowerCase().includes(query) || 
                   r.seed.toString().includes(query);
        });
    }
    
    // Apply sorting
    const col = state.inspector.sortCol;
    const asc = state.inspector.sortAsc;
    
    data.sort((a, b) => {
        let valA = a[col];
        let valB = b[col];
        
        // Handle string vs numeric sorting
        if (typeof valA === 'string') {
            return asc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else {
            return asc ? valA - valB : valB - valA;
        }
    });
    
    // Display paginated or scrollable rows
    // Since max rows is 360, we can render all of them safely with high performance!
    let html = '';
    
    data.forEach(r => {
        const clsPrefix = getModelPrefix(r.model);
        html += `
            <tr>
                <td class="model-text-${clsPrefix}">${r.model}</td>
                <td>${r.dataset.replace(/_/g, ' ')}</td>
                <td><code class="badge version-badge" style="letter-spacing: normal;">${r.seed}</code></td>
                <td>${(r.ARI || 0).toFixed(4)}</td>
                <td>${(r.NMI || 0).toFixed(4)}</td>
                <td>${(r.AMI || 0).toFixed(4)}</td>
                <td>${(r.Homogeneity || 0).toFixed(4)}</td>
                <td>${(r['V-measure'] || 0).toFixed(4)}</td>
                <td>${(r.Silhouette || 0).toFixed(4)}</td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

// ==========================================================================
// EXPORTS & DOWNLOAD ACTIONS
// ==========================================================================
function downloadStatsCSV() {
    const data = getFilteredData();
    const grouped = groupDataByModel(data);
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Model,Metric,Mean,Median,StdDev,CV_Percent,Min,Max,Range\n";
    
    MODELS.forEach(model => {
        const rows = grouped[model];
        METRIC_NAMES.forEach(metric => {
            const vals = rows.map(r => r[metric] || 0);
            if (vals.length > 0) {
                const mean = stats.mean(vals);
                const median = stats.median(vals);
                const std = stats.stdDev(vals, mean);
                const cv = mean !== 0 ? (std / mean * 100) : 0;
                const min = Math.min(...vals);
                const max = Math.max(...vals);
                const range = max - min;
                
                csvContent += `"${model}","${metric}",${mean},${median},${std},${cv},${min},${max},${range}\n`;
            }
        });
    });
    
    triggerCSVDownload(csvContent, `stability_statistics_${state.selectedDataset}.csv`);
}

function downloadRawCSV() {
    let data = state.rawData;
    
    if (state.inspector.modelFilter !== 'all') {
        data = data.filter(r => r.model === state.inspector.modelFilter);
    }
    if (state.inspector.searchQuery) {
        const query = state.inspector.searchQuery;
        data = data.filter(r => r.dataset.toLowerCase().includes(query) || r.seed.toString().includes(query));
    }
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Model,Dataset,Seed,ARI,NMI,AMI,Homogeneity,V-measure,Silhouette\n";
    
    data.forEach(r => {
        csvContent += `"${r.model}","${r.dataset}",${r.seed},${r.ARI},${r.NMI},${r.AMI},${r.Homogeneity},${r['V-measure'] || 0},${r.Silhouette}\n`;
    });
    
    triggerCSVDownload(csvContent, "raw_model_evaluations.csv");
}

function triggerCSVDownload(csvContent, filename) {
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Downloaded CSV export: ${filename}`, 'success');
}

// ==========================================================================
// UTILITY: UI EFFECTS & INTERACTION MODALS
// ==========================================================================
function toggleTheme() {
    const body = document.body;
    body.classList.toggle('dark-theme');
    
    const isDark = body.classList.contains('dark-theme');
    const themeBtn = document.getElementById('themeToggleBtn');
    
    if (isDark) {
        themeBtn.innerHTML = '<i data-lucide="sun"></i>';
    } else {
        themeBtn.innerHTML = '<i data-lucide="moon"></i>';
    }
    lucide.createIcons();
    
    // Refresh active charts to redraw scales with new themes
    renderActiveTab();
    showToast(`Switched to ${isDark ? 'Dark' : 'Light'} mode`, 'success');
}

function openModal() {
    document.getElementById('fileModal').classList.add('active');
}

function closeModal() {
    document.getElementById('fileModal').classList.remove('active');
}

// Toast alerts helper
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        'success': 'check-circle',
        'warning': 'alert-triangle',
        'danger': 'alert-circle',
        'info': 'info'
    };
    
    toast.innerHTML = `
        <i data-lucide="${icons[type]}"></i>
        <span>${message}</span>
    `;
    container.appendChild(toast);
    lucide.createIcons();
    
    // Slide out and remove toast
    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s reverse forwards';
        setTimeout(() => {
            container.removeChild(toast);
        }, 300);
    }, 4000);
}
