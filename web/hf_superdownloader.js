import { app } from "/scripts/app.js";

app.registerExtension({
    name: "ComfyUI.HFSuperDownloader",
    async setup() {
        console.log("[HF SuperDownloader] Initializing Muted Tactical Emerald Vector HUD Web Extension...");
        createFloatingButton();
    }
});

let modalContainer = null;
let pollInterval = null;
let allLoadedFolders = [];
let openLogs = {};

// i18n Translations Dictionary (English Default)
const i18n = {
    es: {
        titlePrefix: "HUGGING FACE",
        titleHighlight: "SUPERDOWNLOADER",
        subtitle: "HIGH-SPEED HF DATA TRANSFER ENGINE",
        tooltip: "HF SuperDownloader (Mover: arrastrar centro | Escalar: esquinas)",
        tabDownload: "⚡ Descargar Modelo",
        tabConfig: "⚙️ Gestionar Directorios",
        targetFolder: "📁 CARPETA DE DESTINO EN COMFYUI (BUSCAR O SELECCIONAR):",
        urlOrFilename: "🔗 URL DE HUGGING FACE O NOMBRE DE ARCHIVO:",
        placeholderInput: "Ej: ltx_2.3_22b_distilled_1.1_lora_dynamic_fro09_avg_rank_111_bf16.safetensors",
        placeholderFolder: "Escribe para buscar o haz clic para ver carpetas...",
        btnSearch: "🔍 Buscar",
        btnDownload: "⚡ AÑADIR A COLA DE DESCARGA (HF_TRANSFER)",
        terminalLog: "💻 TAREAS Y DESCARGAS ACTIVAS:",
        searching: "⏳ Buscando en Hugging Face...",
        found: "✔ Encontrado:",
        readyLog: "Ingresa un enlace o nombre de archivo para comenzar.",
        rootTitle: "🏠 DIRECTORIO RAÍZ DE COMFYUI (AUTO-DETECTAR):",
        btnAutoDetect: "Auto-Detectar Subcarpetas",
        availableFolders: "CARPETAS DE DESTINO DISPONIBLES:",
        addEditFolder: "➕ AÑADIR / EDITAR CARPETA PERSONALIZADA:",
        placeholderName: "Nombre descriptivo (ej: Text Encoders)",
        placeholderPath: "Ruta absoluta (ej: C:\\ComfyUI\\models\\text_encoders)",
        btnSave: "GUARDAR CARPETA",
        btnCancel: "CANCELAR",
        btnEdit: "Editar",
        btnDelete: "Borrar",
        confirmDelete: '¿Eliminar la carpeta "{name}" de la lista?',
        alertFillFields: "Completa el nombre y la ruta de la carpeta.",
        alertValidRoot: "Ingresa un directorio de ComfyUI válido.",
        alertRootSuccess: "✔ Directorio de ComfyUI actualizado y subcarpetas auto-detectadas con éxito!",
        alertNotFound: "No se pudo resolver el repositorio de Hugging Face. Verifica el nombre.",
        btnClearCompleted: "Limpiar Completadas",
        btnCancelJob: "Cancelar",
        btnToggleLogs: "Ver Logs",
        speedLabel: "Velocidad:",
        etaLabel: "Tiempo Restante:",
        statusDownloading: "DESCARGANDO",
        statusCompleted: "COMPLETADO",
        statusError: "ERROR",
        statusCancelled: "CANCELADO",
        statusStarting: "INICIANDO"
    },
    en: {
        titlePrefix: "HUGGING FACE",
        titleHighlight: "SUPERDOWNLOADER",
        subtitle: "HIGH-SPEED HF DATA TRANSFER ENGINE",
        tooltip: "HF SuperDownloader (Move: drag center | Scale: drag corners)",
        tabDownload: "⚡ Download Model",
        tabConfig: "⚙️ Manage Directories",
        targetFolder: "📁 TARGET COMFYUI FOLDER (SEARCH OR SELECT):",
        urlOrFilename: "🔗 HUGGING FACE URL OR FILENAME:",
        placeholderInput: "E.g. ltx_2.3_22b_distilled_1.1_lora_dynamic_fro09_avg_rank_111_bf16.safetensors",
        placeholderFolder: "Type to search or click to view folders...",
        btnSearch: "🔍 Search",
        btnDownload: "⚡ ADD TO DOWNLOAD QUEUE (HF_TRANSFER)",
        terminalLog: "💻 ACTIVE DOWNLOAD QUEUE & TASKS:",
        searching: "⏳ Searching Hugging Face...",
        found: "✔ Found:",
        readyLog: "Enter a link or filename to start.",
        rootTitle: "🏠 COMFYUI BASE ROOT DIRECTORY (AUTO-DETECT):",
        btnAutoDetect: "Auto-Detect Subfolders",
        availableFolders: "AVAILABLE DESTINATION FOLDERS:",
        addEditFolder: "➕ ADD / EDIT CUSTOM FOLDER:",
        placeholderName: "Descriptive name (e.g. Text Encoders)",
        placeholderPath: "Absolute path (e.g. C:\\ComfyUI\\models\\text_encoders)",
        btnSave: "SAVE FOLDER",
        btnCancel: "CANCEL",
        btnEdit: "Edit",
        btnDelete: "Delete",
        confirmDelete: 'Delete folder "{name}" from the list?',
        alertFillFields: "Please fill out both the name and folder path.",
        alertValidRoot: "Please enter a valid ComfyUI root directory.",
        alertRootSuccess: "✔ ComfyUI root directory updated and subfolders auto-detected successfully!",
        alertNotFound: "Could not resolve Hugging Face repository. Check the filename or URL.",
        btnClearCompleted: "Clear Completed",
        btnCancelJob: "Cancel",
        btnToggleLogs: "View Logs",
        speedLabel: "Speed:",
        etaLabel: "Time Left:",
        statusDownloading: "DOWNLOADING",
        statusCompleted: "COMPLETADO",
        statusError: "ERROR",
        statusCancelled: "CANCELLED",
        statusStarting: "STARTING"
    }
};

function getLang() {
    try {
        const comfyLang = app?.ui?.settings?.getSettingValue?.("Comfy.Lang");
        if (comfyLang && comfyLang.toLowerCase().startsWith("es")) return "es";
    } catch(e) {}
    return "en";
}

function t(key, params = {}) {
    const lang = getLang();
    let text = (i18n[lang] && i18n[lang][key]) || i18n["en"][key] || key;
    for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, v);
    }
    return text;
}

function createFloatingButton() {
    if (document.getElementById("hf-superdownloader-fab")) {
        return;
    }

    const btn = document.createElement("div");
    btn.id = "hf-superdownloader-fab";
    btn.title = t("tooltip");
    
    let savedSize = 64;
    try {
        const s = parseInt(localStorage.getItem("hf_fab_size"));
        if (s && s >= 30 && s <= 160) savedSize = s;
    } catch(e) {}

    let savedPos = null;
    try {
        const raw = localStorage.getItem("hf_fab_position");
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed.left === 'number' && typeof parsed.top === 'number') {
                if (parsed.left >= 10 && parsed.left <= window.innerWidth - 40 &&
                    parsed.top >= 10 && parsed.top <= window.innerHeight - 40) {
                    savedPos = parsed;
                }
            }
        }
    } catch(e) {}

    btn.style.cssText = `
        position: fixed;
        ${savedPos ? `left: ${savedPos.left}px; top: ${savedPos.top}px; bottom: auto; right: auto;` : 'bottom: 28px; right: 28px;'}
        width: ${savedSize}px;
        height: ${savedSize}px;
        background: transparent;
        border: none;
        box-shadow: none;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        user-select: none;
        padding: 0;
        overflow: visible;
        cursor: move;
        transition: transform 0.15s ease-out;
    `;

    const iconImg = document.createElement("img");
    iconImg.src = "/extensions/ComfyUI-HF-SuperDownloader/hf_icon.png?v=" + Date.now();
    iconImg.style.cssText = "width: 100%; height: 100%; object-fit: contain; pointer-events: none; display: block; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.7));";
    btn.appendChild(iconImg);

    // 4 Corner Resize Handles
    const handlePositions = ["se", "sw", "ne", "nw"];
    handlePositions.forEach(pos => {
        const handle = document.createElement("div");
        handle.className = `hf-resize-handle hf-handle-${pos}`;
        
        let cursorType = "nwse-resize";
        if (pos === "sw" || pos === "ne") cursorType = "nesw-resize";

        let topStyle = pos.includes("n") ? "-4px" : "auto";
        let bottomStyle = pos.includes("s") ? "-4px" : "auto";
        let leftStyle = pos.includes("w") ? "-4px" : "auto";
        let rightStyle = pos.includes("e") ? "-4px" : "auto";

        handle.style.cssText = `
            position: absolute;
            top: ${topStyle};
            bottom: ${bottomStyle};
            left: ${leftStyle};
            right: ${rightStyle};
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: #2ecc71;
            border: 1px solid #000;
            cursor: ${cursorType};
            z-index: 10001;
            opacity: 0;
            transition: opacity 0.15s;
        `;
        btn.appendChild(handle);
    });

    btn.onmouseenter = () => {
        btn.querySelectorAll(".hf-resize-handle").forEach(h => h.style.opacity = "1");
        btn.style.transform = "scale(1.08)";
    };
    btn.onmouseleave = () => {
        btn.querySelectorAll(".hf-resize-handle").forEach(h => h.style.opacity = "0");
        btn.style.transform = "scale(1)";
    };

    let isDraggingMove = false;
    let isDraggingResize = false;
    let activeHandle = null;
    let hasMoved = false;
    let startX = 0, startY = 0;
    let startLeft = 0, startTop = 0;
    let startW = 0, startH = 0;

    btn.onmousedown = (e) => {
        if (e.target.classList.contains("hf-resize-handle")) {
            isDraggingResize = true;
            activeHandle = e.target;
        } else {
            isDraggingMove = true;
        }
        hasMoved = false;
        startX = e.clientX;
        startY = e.clientY;

        const rect = btn.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;
        startW = rect.width;
        startH = rect.height;

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
        e.preventDefault();
    };

    function onMouseMove(e) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            hasMoved = true;
        }

        if (isDraggingMove) {
            let newLeft = startLeft + dx;
            let newTop = startTop + dy;

            newLeft = Math.max(10, Math.min(window.innerWidth - startW - 10, newLeft));
            newTop = Math.max(10, Math.min(window.innerHeight - startH - 10, newTop));

            btn.style.left = `${newLeft}px`;
            btn.style.top = `${newTop}px`;
            btn.style.bottom = "auto";
            btn.style.right = "auto";
        } else if (isDraggingResize) {
            let delta = dx;
            if (activeHandle.classList.contains("hf-handle-sw") || activeHandle.classList.contains("hf-handle-nw")) {
                delta = -dx;
            }
            let newSize = Math.max(30, Math.min(160, startW + delta));
            btn.style.width = `${newSize}px`;
            btn.style.height = `${newSize}px`;

            if (activeHandle.classList.contains("hf-handle-nw") || activeHandle.classList.contains("hf-handle-sw")) {
                let newLeft = startLeft - (newSize - startW);
                btn.style.left = `${newLeft}px`;
            }
            if (activeHandle.classList.contains("hf-handle-nw") || activeHandle.classList.contains("hf-handle-ne")) {
                let newTop = startTop - (newSize - startH);
                btn.style.top = `${newTop}px`;
            }
        }
    }

    function onMouseUp() {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);

        if (isDraggingMove || isDraggingResize) {
            const rect = btn.getBoundingClientRect();
            localStorage.setItem("hf_fab_position", JSON.stringify({ left: rect.left, top: rect.top }));
            localStorage.setItem("hf_fab_size", rect.width.toString());
        }

        isDraggingMove = false;
        isDraggingResize = false;
        activeHandle = null;
    }

    btn.onclick = (e) => {
        if (hasMoved) return;
        toggleModal();
    };

    document.body.appendChild(btn);
}

function toggleModal() {
    if (!modalContainer) {
        createModal();
    }
    if (modalContainer.style.display === "none" || !modalContainer.style.display) {
        modalContainer.style.display = "flex";
        loadFolders();
        startPollingStatus();
    } else {
        modalContainer.style.display = "none";
    }
}

function createModal() {
    modalContainer = document.createElement("div");
    modalContainer.id = "hf-modal-overlay";
    modalContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(4, 8, 5, 0.85);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Share Tech Mono', 'Consolas', 'Courier New', monospace;
    `;

    const modal = document.createElement("div");
    modal.style.cssText = `
        width: 820px;
        max-width: 95vw;
        max-height: 92vh;
        overflow-y: auto;
        background: #070d08;
        border: 2px solid #1e7e40;
        outline: 1.5px solid #104221;
        outline-offset: 3px;
        clip-path: polygon(18px 0, calc(100% - 18px) 0, 100% 18px, 100% calc(100% - 18px), calc(100% - 18px) 100%, 18px 100%, 0 calc(100% - 18px), 0 18px);
        padding: 24px;
        color: #e0e0e0;
        display: flex;
        flex-direction: column;
        gap: 18px;
        position: relative;
        box-shadow: none;
    `;

    modal.innerHTML = `
        <style>
            @keyframes hfPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
            .pepe-card-box {
                background: #0c180e;
                border: 1.5px solid #1e7e40;
                border-radius: 6px;
                padding: 16px;
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            .pepe-input-field {
                width: 100%;
                padding: 11px 14px;
                background: #060b07;
                border: 1.5px solid #1e7e40;
                border-radius: 4px;
                color: #2ecc71;
                font-size: 13px;
                font-family: 'Consolas', monospace;
                outline: none;
                box-sizing: border-box;
            }
            .pepe-input-field::placeholder {
                color: #225a33;
            }
            .hf-combobox-option {
                padding: 8px 12px;
                color: #2ecc71;
                font-size: 12px;
                font-family: 'Consolas', monospace;
                cursor: pointer;
                border-bottom: 1px solid #102615;
            }
            .hf-combobox-option:hover {
                background: #112616;
                color: #ffffff;
            }
            .hf-job-card {
                background: #040805;
                border: 1.5px solid #142a17;
                border-radius: 6px;
                padding: 12px;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .hf-job-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .hf-job-title {
                font-weight: 700;
                color: #ffffff;
                font-size: 13px;
                font-family: 'Consolas', monospace;
            }
            .hf-badge {
                font-size: 10px;
                padding: 3px 8px;
                border-radius: 3px;
                font-weight: 800;
                letter-spacing: 0.5px;
            }
            .hf-badge-downloading { background: #0e381b; color: #2ecc71; border: 1px solid #1e7e40; animation: hfPulse 1.5s infinite; }
            .hf-badge-completed { background: #143d22; color: #2ecc71; border: 1px solid #2ecc71; }
            .hf-badge-error { background: #3d1414; color: #ff5555; border: 1px solid #ff5555; }
            .hf-badge-cancelled { background: #262626; color: #888888; border: 1px solid #555555; }
            .hf-badge-starting { background: #1f3322; color: #a3e0b8; border: 1px solid #2ecc71; }
            .hf-progress-bar-bg {
                width: 100%;
                height: 10px;
                background: #09120a;
                border: 1px solid #142a17;
                border-radius: 4px;
                overflow: hidden;
            }
            .hf-progress-bar-fill {
                height: 100%;
                background: linear-gradient(90deg, #165b2e 0%, #2ecc71 100%);
                width: 0%;
                transition: width 0.3s ease;
            }
        </style>

        <!-- Header Banner -->
        <div style="background: #0e1e12; border: 1.5px solid #1e7e40; border-radius: 6px; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 14px;">
                <div style="width: 48px; height: 48px; border-radius: 50%; overflow: hidden;">
                    <img src="/extensions/ComfyUI-HF-SuperDownloader/hf_icon.png?v=${Date.now()}" style="width: 100%; height: 100%; object-fit: contain;" />
                </div>
                <div>
                    <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: 1px; font-family: 'Consolas', monospace;">
                        ${t("titlePrefix")} <span style="color:#2ecc71;">${t("titleHighlight")}</span>
                    </h2>
                    <div style="font-size: 10px; color: #2ecc71; opacity: 0.85; letter-spacing: 1px; font-family: 'Consolas', monospace;">${t("subtitle")}</div>
                </div>
            </div>
            <button id="hf-close-btn" style="background: #060b07; border: 1.5px solid #1e7e40; color: #2ecc71; font-size: 16px; width: 32px; height: 32px; cursor: pointer; font-weight: bold; font-family: 'Consolas', monospace;">✕</button>
        </div>

        <!-- Style Pills / Tabs -->
        <div style="display: flex; gap: 12px; border-bottom: 1.5px solid #142a17; padding-bottom: 12px;">
            <button id="tab-download-btn" style="padding: 8px 20px; background: #0e1e12; border: 1.5px solid #1e7e40; border-radius: 6px; color: #2ecc71; font-size: 13px; font-weight: 800; cursor: pointer; font-family: 'Consolas', monospace; display: flex; align-items: center; gap: 6px;">
                ${t("tabDownload")}
            </button>
            <button id="tab-config-btn" style="padding: 8px 20px; background: #070d08; border: 1px solid #142817; border-radius: 6px; color: #447755; font-size: 13px; font-weight: 700; cursor: pointer; font-family: 'Consolas', monospace; display: flex; align-items: center; gap: 6px;">
                ${t("tabConfig")}
            </button>
        </div>

        <!-- TAB 1: DOWNLOAD -->
        <div id="tab-download-content" class="pepe-card-box">
            <!-- Searchable Target Destination Folder Custom Combobox -->
            <div>
                <label style="display: block; font-size: 12px; font-weight: 800; color: #2ecc71; margin-bottom: 6px; letter-spacing: 0.5px;">${t("targetFolder")}</label>
                <div style="position: relative; width: 100%;">
                    <input id="hf-folder-input" type="text" placeholder="${t("placeholderFolder")}" class="pepe-input-field" style="padding-right: 36px;" />
                    <button id="hf-folder-toggle-btn" style="position: absolute; right: 4px; top: 4px; bottom: 4px; width: 30px; background: transparent; border: none; color: #2ecc71; font-size: 11px; cursor: pointer;">▼</button>
                    <div id="hf-folder-dropdown-menu" style="display: none; position: absolute; top: calc(100% + 4px); left: 0; width: 100%; max-height: 220px; overflow-y: auto; background: #060b07; border: 1.5px solid #1e7e40; border-radius: 4px; z-index: 10005; box-shadow: 0 8px 25px rgba(0,0,0,0.95);"></div>
                </div>
            </div>

            <div>
                <label style="display: block; font-size: 12px; font-weight: 800; color: #2ecc71; margin-bottom: 6px; letter-spacing: 0.5px;">${t("urlOrFilename")}</label>
                <div style="display: flex; gap: 0; background: #060b07; border: 1.5px solid #1e7e40; border-radius: 4px; padding: 3px; align-items: center;">
                    <input id="hf-url-input" type="text" placeholder="${t("placeholderInput")}" 
                           style="flex: 1; padding: 10px 14px; background: transparent; border: none; color: #2ecc71; font-size: 13px; font-family: 'Consolas', monospace; outline: none;" />
                    <button id="hf-search-btn" style="padding: 10px 22px; background: linear-gradient(135deg, #1e7e40 0%, #176633 100%); border: none; clip-path: polygon(10px 0, 100% 0, 100% 100%, 0 100%, 0 10px); color: #ffffff; font-size: 13px; font-weight: 900; cursor: pointer; font-family: 'Consolas', monospace;">
                        ${t("btnSearch")}
                    </button>
                </div>
            </div>

            <div id="hf-search-result" style="display: none; padding: 10px 14px; background: #0e1e12; border: 1.5px solid #1e7e40; border-radius: 4px; font-size: 12px; color: #2ecc71; font-family: 'Consolas', monospace;"></div>

            <!-- Main Angled Green Action Button -->
            <button id="hf-download-btn" style="width: 100%; padding: 14px; background: #1e7e40; border: none; clip-path: polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px); color: #ffffff; font-size: 15px; font-weight: 900; cursor: pointer; letter-spacing: 1px; text-transform: uppercase; font-family: 'Consolas', monospace;">
                ${t("btnDownload")}
            </button>

            <!-- Multi-Download Queue Section -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px;">
                <label style="font-size: 12px; font-weight: 800; color: #2ecc71; letter-spacing: 0.5px;">${t("terminalLog")}</label>
                <button id="hf-clear-completed-btn" style="padding: 4px 10px; background: #0e1e12; border: 1px solid #1e7e40; border-radius: 3px; color: #2ecc71; font-size: 11px; cursor: pointer; font-family: 'Consolas', monospace;">
                    ${t("btnClearCompleted")}
                </button>
            </div>

            <div id="hf-jobs-container" style="max-height: 280px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; background: #040805; padding: 10px; border-radius: 4px; border: 1.5px solid #142a17;">
                <div style="color: #447755; font-size: 12px; font-family: 'Consolas', monospace; text-align: center; padding: 16px;">
                    ${t("readyLog")}
                </div>
            </div>
        </div>

        <!-- TAB 2: CONFIGURATION -->
        <div id="tab-config-content" class="pepe-card-box" style="display: none;">
            <div style="background: #060b07; border: 1.5px solid #142a17; border-radius: 4px; padding: 14px; display: flex; flex-direction: column; gap: 10px;">
                <div style="font-size: 12px; font-weight: 800; color: #2ecc71; display: flex; align-items: center; gap: 6px;">
                    <span>${t("rootTitle")}</span>
                </div>
                <div style="display: flex; gap: 8px;">
                    <input id="hf-comfy-root-input" type="text" placeholder="C:\\ComfyUI" class="pepe-input-field" style="flex: 1;" />
                    <button id="hf-save-root-btn" style="padding: 8px 16px; background: #0e1e12; border: 1.5px solid #1e7e40; border-radius: 4px; color: #2ecc71; font-size: 12px; font-weight: 800; cursor: pointer; font-family: 'Consolas', monospace;">${t("btnAutoDetect")}</button>
                </div>
            </div>

            <div style="font-size: 13px; font-weight: 800; color: #2ecc71; letter-spacing: 0.5px;">${t("availableFolders")}</div>
            <div id="hf-folder-list" style="max-height: 180px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; background: #040805; padding: 10px; border-radius: 4px; border: 1.5px solid #142a17;"></div>

            <div style="border-top: 1.5px solid #142a17; padding-top: 12px; display: flex; flex-direction: column; gap: 10px;">
                <div style="font-size: 12px; font-weight: 800; color: #2ecc71;" id="folder-form-title">${t("addEditFolder")}</div>
                <input id="hf-new-folder-id" type="hidden" />
                <input id="hf-new-folder-name" type="text" placeholder="${t("placeholderName")}" class="pepe-input-field" />
                <input id="hf-new-folder-path" type="text" placeholder="${t("placeholderPath")}" class="pepe-input-field" />
                
                <div style="display: flex; gap: 8px;">
                    <button id="hf-save-folder-btn" style="flex: 1; padding: 10px; background: #1e7e40; border: none; border-radius: 4px; color: #ffffff; font-weight: 900; cursor: pointer; font-family: 'Consolas', monospace;">${t("btnSave")}</button>
                    <button id="hf-cancel-folder-btn" style="display: none; padding: 10px; background: #1a1a1a; border: 1px solid #444; border-radius: 4px; color: #888; cursor: pointer; font-family: 'Consolas', monospace;">${t("btnCancel")}</button>
                </div>
            </div>
        </div>
    `;

    modalContainer.appendChild(modal);
    document.body.appendChild(modalContainer);

    // Setup Combobox Behavior
    const folderInput = modal.querySelector("#hf-folder-input");
    const folderToggleBtn = modal.querySelector("#hf-folder-toggle-btn");
    const dropdownMenu = modal.querySelector("#hf-folder-dropdown-menu");

    function renderDropdownOptions(filterText = "") {
        dropdownMenu.innerHTML = "";
        const cleanFilter = filterText.toLowerCase();
        
        const filtered = allLoadedFolders.filter(f => {
            const str = `${f.name} ${f.path}`.toLowerCase();
            return !cleanFilter || str.includes(cleanFilter);
        });

        if (filtered.length === 0) {
            dropdownMenu.innerHTML = `<div style="padding: 10px; color: #888; font-size: 11px;">No folder matches. Will use typed path.</div>`;
        } else {
            filtered.forEach(f => {
                const opt = document.createElement("div");
                opt.className = "hf-combobox-option";
                opt.innerHTML = `<b>${f.name}</b> <span style="color:#447755; font-size:11px;">(${f.path})</span>`;
                opt.onclick = () => {
                    folderInput.value = `${f.name} (${f.path})`;
                    dropdownMenu.style.display = "none";
                };
                dropdownMenu.appendChild(opt);
            });
        }
    }

    folderInput.onclick = () => {
        renderDropdownOptions(folderInput.value);
        dropdownMenu.style.display = "block";
    };

    folderToggleBtn.onclick = (e) => {
        e.stopPropagation();
        if (dropdownMenu.style.display === "block") {
            dropdownMenu.style.display = "none";
        } else {
            renderDropdownOptions("");
            dropdownMenu.style.display = "block";
        }
    };

    folderInput.oninput = () => {
        renderDropdownOptions(folderInput.value);
        dropdownMenu.style.display = "block";
    };

    modalContainer.addEventListener("click", (e) => {
        if (!e.target.closest("#hf-folder-input") && !e.target.closest("#hf-folder-toggle-btn") && !e.target.closest("#hf-folder-dropdown-menu")) {
            if (dropdownMenu) dropdownMenu.style.display = "none";
        }
    });

    const tabDownloadBtn = modal.querySelector("#tab-download-btn");
    const tabConfigBtn = modal.querySelector("#tab-config-btn");
    const tabDownloadContent = modal.querySelector("#tab-download-content");
    const tabConfigContent = modal.querySelector("#tab-config-content");

    tabDownloadBtn.onclick = () => {
        tabDownloadBtn.style.background = "#0e1e12";
        tabDownloadBtn.style.color = "#2ecc71";
        tabDownloadBtn.style.borderColor = "#1e7e40";
        tabConfigBtn.style.background = "#070d08";
        tabConfigBtn.style.color = "#447755";
        tabConfigBtn.style.borderColor = "#142817";
        tabDownloadContent.style.display = "flex";
        tabConfigContent.style.display = "none";
    };

    tabConfigBtn.onclick = () => {
        tabConfigBtn.style.background = "#0e1e12";
        tabConfigBtn.style.color = "#2ecc71";
        tabConfigBtn.style.borderColor = "#1e7e40";
        tabDownloadBtn.style.background = "#070d08";
        tabDownloadBtn.style.color = "#447755";
        tabDownloadBtn.style.borderColor = "#142817";
        tabConfigContent.style.display = "flex";
        tabDownloadContent.style.display = "none";
        renderConfigFolderList();
    };

    modal.querySelector("#hf-close-btn").onclick = () => { modalContainer.style.display = "none"; };

    const saveRootBtn = modal.querySelector("#hf-save-root-btn");
    const comfyRootInput = modal.querySelector("#hf-comfy-root-input");

    saveRootBtn.onclick = async () => {
        const rootPath = comfyRootInput.value.trim();
        if (!rootPath) {
            alert(t("alertValidRoot"));
            return;
        }

        try {
            const resp = await fetch("/hf_superdownloader/comfy_root", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ root_path: rootPath })
            });
            const res = await resp.json();
            if (res.success) {
                alert(t("alertRootSuccess"));
                renderConfigFolderList();
                loadFolders();
            } else {
                alert(`Error: ${res.error}`);
            }
        } catch (e) {
            alert(`Error: ${e.message}`);
        }
    };

    const searchBtn = modal.querySelector("#hf-search-btn");
    const urlInput = modal.querySelector("#hf-url-input");
    const resultBox = modal.querySelector("#hf-search-result");
    const downloadBtn = modal.querySelector("#hf-download-btn");
    const clearCompletedBtn = modal.querySelector("#hf-clear-completed-btn");

    let currentResolved = null;

    searchBtn.onclick = async () => {
        const query = urlInput.value.trim();
        if (!query) return;
        
        resultBox.style.display = "block";
        resultBox.innerHTML = t("searching");
        resultBox.style.color = "#2ecc71";

        try {
            const resp = await fetch("/hf_superdownloader/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query })
            });
            const res = await resp.json();
            if (res.success) {
                currentResolved = res;
                resultBox.style.display = "block";
                resultBox.style.color = "#2ecc71";
                resultBox.innerHTML = `${t("found")} <b>${res.repo_id}</b> &rarr; <code>${res.filename}</code>`;
            } else {
                currentResolved = null;
                resultBox.style.display = "block";
                resultBox.style.color = "#ff4444";
                resultBox.innerHTML = `✖ ${res.error}`;
            }
        } catch (e) {
            resultBox.style.display = "block";
            resultBox.style.color = "#ff4444";
            resultBox.innerHTML = `✖ Error: ${e.message}`;
        }
    };

    urlInput.onchange = () => searchBtn.click();

    downloadBtn.onclick = async () => {
        const query = urlInput.value.trim();
        if (!query) return;

        if (!currentResolved) {
            await searchBtn.onclick();
        }

        if (!currentResolved) {
            alert(t("alertNotFound"));
            return;
        }

        const folderInput = modal.querySelector("#hf-folder-input");
        let targetPath = folderInput.value.trim();
        
        const matchPath = targetPath.match(/\(([^)]+)\)$/);
        if (matchPath) {
            targetPath = matchPath[1];
        }

        if (!targetPath) {
            alert(t("alertFillFields"));
            return;
        }

        try {
            const resp = await fetch("/hf_superdownloader/download", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    repo_id: currentResolved.repo_id,
                    filename: currentResolved.filename,
                    target_path: targetPath
                })
            });
            const res = await resp.json();
            if (res.success) {
                // Clear input URL so user can enter another one right away!
                urlInput.value = "";
                currentResolved = null;
                resultBox.style.display = "none";
                startPollingStatus();
            } else {
                alert(`Error: ${res.error}`);
            }
        } catch (e) {
            alert(`Error: ${e.message}`);
        }
    };

    clearCompletedBtn.onclick = async () => {
        try {
            await fetch("/hf_superdownloader/clear_completed", { method: "POST" });
            pollStatusOnce();
        } catch(e) {}
    };

    const saveFolderBtn = modal.querySelector("#hf-save-folder-btn");
    const cancelFolderBtn = modal.querySelector("#hf-cancel-folder-btn");
    const folderIdInput = modal.querySelector("#hf-new-folder-id");
    const folderNameInput = modal.querySelector("#hf-new-folder-name");
    const folderPathInput = modal.querySelector("#hf-new-folder-path");

    saveFolderBtn.onclick = async () => {
        const name = folderNameInput.value.trim();
        const path = folderPathInput.value.trim();
        const id = folderIdInput.value.trim();

        if (!name || !path) {
            alert(t("alertFillFields"));
            return;
        }

        try {
            const resp = await fetch("/hf_superdownloader/folders/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, name, path })
            });
            const res = await resp.json();
            if (res.success) {
                folderIdInput.value = "";
                folderNameInput.value = "";
                folderPathInput.value = "";
                cancelFolderBtn.style.display = "none";
                modal.querySelector("#folder-form-title").textContent = t("addEditFolder");
                renderConfigFolderList();
                loadFolders();
            } else {
                alert(`Error: ${res.error}`);
            }
        } catch (e) {
            alert(`Error: ${e.message}`);
        }
    };

    cancelFolderBtn.onclick = () => {
        folderIdInput.value = "";
        folderNameInput.value = "";
        folderPathInput.value = "";
        cancelFolderBtn.style.display = "none";
        modal.querySelector("#folder-form-title").textContent = t("addEditFolder");
    };

    loadFolders();
}

async function loadFolders() {
    try {
        const resp = await fetch("/hf_superdownloader/folders");
        const res = await resp.json();
        const folderInput = document.querySelector("#hf-folder-input");
        
        if (res.folders) {
            allLoadedFolders = res.folders;

            if (folderInput && !folderInput.value && res.folders.length > 0) {
                const first = res.folders[0];
                folderInput.value = `${first.name} (${first.path})`;
            }
        }
    } catch (e) {
        console.error("Error loading folders:", e);
    }
}

async function renderConfigFolderList() {
    const listContainer = document.querySelector("#hf-folder-list");
    const comfyRootInput = document.querySelector("#hf-comfy-root-input");
    if (!listContainer) return;

    listContainer.innerHTML = "...";

    try {
        const resp = await fetch("/hf_superdownloader/folders");
        const res = await resp.json();
        if (res.comfy_root && comfyRootInput) {
            comfyRootInput.value = res.comfy_root;
        }

        if (res.folders) {
            allLoadedFolders = res.folders;
            listContainer.innerHTML = "";
            res.folders.forEach(f => {
                const item = document.createElement("div");
                item.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: #060b07; border-radius: 4px; border: 1px solid #142a17;";
                item.innerHTML = `
                    <div style="flex: 1; overflow: hidden;">
                        <span style="font-weight: 700; color: #2ecc71; font-size: 12px; font-family: 'Consolas', monospace;">${f.name}</span>
                        <div style="font-size: 10px; color: #447755; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; font-family: 'Consolas', monospace;">${f.path}</div>
                    </div>
                    <div style="display: flex; gap: 6px;">
                        <button class="edit-folder-btn" style="padding: 4px 10px; background: #0e1e12; border: 1px solid #1e7e40; border-radius: 3px; color: #2ecc71; font-size: 11px; cursor: pointer; font-family: 'Consolas', monospace;">${t("btnEdit")}</button>
                        <button class="delete-folder-btn" style="padding: 4px 10px; background: #991111; border: none; border-radius: 3px; color: #ffffff; font-size: 11px; cursor: pointer; font-family: 'Consolas', monospace;">${t("btnDelete")}</button>
                    </div>
                `;

                item.querySelector(".edit-folder-btn").onclick = () => {
                    document.querySelector("#hf-new-folder-id").value = f.id;
                    document.querySelector("#hf-new-folder-name").value = f.name;
                    document.querySelector("#hf-new-folder-path").value = f.path;
                    document.querySelector("#hf-cancel-folder-btn").style.display = "inline-block";
                    document.querySelector("#folder-form-title").textContent = `${t("btnEdit")}: ${f.name}`;
                };

                item.querySelector(".delete-folder-btn").onclick = async () => {
                    if (confirm(t("confirmDelete", { name: f.name }))) {
                        await fetch("/hf_superdownloader/folders/delete", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: f.id })
                        });
                        renderConfigFolderList();
                        loadFolders();
                    }
                };

                listContainer.appendChild(item);
            });
        }
    } catch (e) {
        listContainer.innerHTML = "Error.";
    }
}

async function pollStatusOnce() {
    const jobsContainer = document.querySelector("#hf-jobs-container");
    if (!jobsContainer) return;

    try {
        const resp = await fetch("/hf_superdownloader/status");
        const res = await resp.json();
        const jobs = res.jobs || {};
        const jobKeys = Object.keys(jobs);

        if (jobKeys.length === 0) {
            jobsContainer.innerHTML = `<div style="color: #447755; font-size: 12px; font-family: 'Consolas', monospace; text-align: center; padding: 16px;">${t("readyLog")}</div>`;
            return;
        }

        // Render each job card
        jobsContainer.innerHTML = "";
        jobKeys.reverse().forEach(jid => {
            const job = jobs[jid];
            const card = document.createElement("div");
            card.className = "hf-job-card";

            let badgeClass = `hf-badge-${job.status}`;
            let statusText = t(`status${job.status.charAt(0).toUpperCase() + job.status.slice(1)}`) || job.status.toUpperCase();

            const isLogsOpen = !!openLogs[jid];

            card.innerHTML = `
                <div class="hf-job-header">
                    <div style="flex: 1; overflow: hidden; margin-right: 10px;">
                        <div class="hf-job-title">${job.filename}</div>
                        <div style="font-size: 10px; color: #447755; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                            ${job.repo_id} &rarr; ${job.target_path}
                        </div>
                    </div>
                    <span class="hf-badge ${badgeClass}">${statusText}</span>
                </div>

                <div class="hf-progress-bar-bg">
                    <div class="hf-progress-bar-fill" style="width: ${job.progress}%;"></div>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #2ecc71; font-family: 'Consolas', monospace;">
                    <div>
                        <b>${job.progress}%</b> 
                        <span style="color:#68d89b; margin-left: 10px;">${t("speedLabel")} ${job.speed}</span>
                        <span style="color:#68d89b; margin-left: 10px;">${t("etaLabel")} ${job.eta}</span>
                    </div>
                    <div style="display: flex; gap: 6px;">
                        <button class="toggle-log-btn" style="padding: 3px 8px; background: #0e1e12; border: 1px solid #1e7e40; border-radius: 3px; color: #2ecc71; font-size: 10px; cursor: pointer;">
                            ${t("btnToggleLogs")}
                        </button>
                        ${job.status === "downloading" || job.status === "starting" ? `
                            <button class="cancel-job-btn" style="padding: 3px 8px; background: #3d1414; border: 1px solid #ff5555; border-radius: 3px; color: #ff5555; font-size: 10px; cursor: pointer;">
                                ${t("btnCancelJob")}
                            </button>
                        ` : ''}
                    </div>
                </div>

                <div class="job-log-box" style="display: ${isLogsOpen ? 'block' : 'none'}; height: 90px; background: #020402; border: 1px solid #142a17; border-radius: 3px; padding: 6px; font-size: 10px; color: #2ecc71; overflow-y: auto; white-space: pre-wrap; word-break: break-all; margin-top: 4px;">
                    ${(job.logs || []).join("\n")}
                </div>
            `;

            card.querySelector(".toggle-log-btn").onclick = () => {
                openLogs[jid] = !openLogs[jid];
                const logBox = card.querySelector(".job-log-box");
                logBox.style.display = openLogs[jid] ? "block" : "none";
            };

            const cancelBtn = card.querySelector(".cancel-job-btn");
            if (cancelBtn) {
                cancelBtn.onclick = async () => {
                    await fetch("/hf_superdownloader/cancel", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ job_id: jid })
                    });
                    pollStatusOnce();
                };
            }

            jobsContainer.appendChild(card);
        });

    } catch (e) {
        console.error("Error polling status:", e);
    }
}

function startPollingStatus() {
    if (pollInterval) clearInterval(pollInterval);
    pollStatusOnce();
    pollInterval = setInterval(pollStatusOnce, 1000);
}
