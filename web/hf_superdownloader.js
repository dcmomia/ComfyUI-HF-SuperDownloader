import { app } from "../../scripts/app.js";

app.registerExtension({
    name: "ComfyUI.HFSuperDownloader",
    async setup() {
        console.log("[HF SuperDownloader] Initializing Transparent Pepe Vector HUD Web Extension...");
        createFloatingButton();
    }
});

let modalContainer = null;
let pollInterval = null;
let allLoadedFolders = [];

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
        btnDownload: "⚡ DESCARGAR A MÁXIMA VELOCIDAD (HF_TRANSFER)",
        terminalLog: "💻 TERMINAL LOG EN TIEMPO REAL:",
        searching: "⏳ Buscando en Hugging Face...",
        found: "✔ Encontrado:",
        readyLog: "Ready. Ingresa un enlace o nombre de archivo para comenzar.",
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
        alertNotFound: "No se pudo resolver el repositorio de Hugging Face. Verifica el nombre."
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
        btnDownload: "⚡ DOWNLOAD AT MAX SPEED (HF_TRANSFER)",
        terminalLog: "💻 REAL-TIME TERMINAL LOG:",
        searching: "⏳ Searching Hugging Face...",
        found: "✔ Found:",
        readyLog: "Ready. Enter a link or filename to start.",
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
        alertNotFound: "Could not resolve Hugging Face repository. Check the filename or URL."
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

    // Pure Transparent Background - No green border, no circle background
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
    iconImg.style.cssText = "width: 100%; height: 100%; object-fit: contain; pointer-events: none; display: block; filter: drop-shadow(0 4px 10px rgba(0,0,0,0.8));";
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
            background: #00a832;
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
    let initialLeft = 0, initialTop = 0;
    let initialSize = savedSize;

    btn.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;

        const handle = e.target.closest(".hf-resize-handle");
        startX = e.clientX;
        startY = e.clientY;
        const rect = btn.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
        initialSize = rect.width;
        hasMoved = false;

        if (handle) {
            isDraggingResize = true;
            activeHandle = handle;
            e.stopPropagation();
        } else {
            isDraggingMove = true;
        }

        btn.style.transition = "none";
        e.preventDefault();
    });

    window.addEventListener("mousemove", (e) => {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            hasMoved = true;
        }

        if (isDraggingMove) {
            let newLeft = initialLeft + dx;
            let newTop = initialTop + dy;

            newLeft = Math.max(10, Math.min(window.innerWidth - initialSize - 10, newLeft));
            newTop = Math.max(10, Math.min(window.innerHeight - initialSize - 10, newTop));

            btn.style.left = newLeft + "px";
            btn.style.top = newTop + "px";
            btn.style.bottom = "auto";
            btn.style.right = "auto";
        } else if (isDraggingResize) {
            let delta = dx;
            if (activeHandle.className.includes("nw") || activeHandle.className.includes("sw")) {
                delta = -dx;
            }
            
            let newSize = initialSize + delta;
            newSize = Math.max(32, Math.min(160, newSize));

            btn.style.width = newSize + "px";
            btn.style.height = newSize + "px";
        }
    });

    window.addEventListener("mouseup", () => {
        if (isDraggingMove || isDraggingResize) {
            btn.style.transition = "transform 0.15s ease-out";

            const rect = btn.getBoundingClientRect();
            
            if (isDraggingMove) {
                localStorage.setItem("hf_fab_position", JSON.stringify({ left: rect.left, top: rect.top }));
            }
            if (isDraggingResize) {
                localStorage.setItem("hf_fab_size", rect.width);
            }

            isDraggingMove = false;
            isDraggingResize = false;
            activeHandle = null;
        }
    });

    btn.onclick = (e) => {
        if (!hasMoved) {
            openModal();
        }
    };

    document.body.appendChild(btn);
}

async function openModal() {
    if (modalContainer) {
        modalContainer.style.display = "flex";
        loadFolders();
        return;
    }

    modalContainer = document.createElement("div");
    modalContainer.className = "hf-downloader-modal-overlay";
    modalContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(3, 7, 4, 0.85);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Share Tech Mono', 'Consolas', 'Courier New', monospace;
    `;

    const modal = document.createElement("div");
    modal.style.cssText = `
        width: 780px;
        max-width: 95vw;
        background: #040905;
        border: 2px solid #00a832;
        outline: 1.5px solid #004013;
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
            @keyframes hfBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
            .pepe-card-box {
                background: #08120a;
                border: 1.5px solid #00a832;
                border-radius: 6px;
                padding: 16px;
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            .pepe-input-field {
                width: 100%;
                padding: 11px 14px;
                background: #040805;
                border: 1.5px solid #00a832;
                border-radius: 4px;
                color: #00cc44;
                font-size: 13px;
                font-family: 'Consolas', monospace;
                outline: none;
                box-sizing: border-box;
            }
            .pepe-input-field::placeholder {
                color: #265431;
            }
            .hf-combobox-option {
                padding: 8px 12px;
                color: #00cc44;
                font-size: 12px;
                font-family: 'Consolas', monospace;
                cursor: pointer;
                border-bottom: 1px solid #102615;
            }
            .hf-combobox-option:hover {
                background: #0a1c0f;
                color: #ffffff;
            }
        </style>

        <!-- Proposal 1 Vector Banner Header -->
        <div style="background: #0a170d; border: 1.5px solid #00a832; border-radius: 6px; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 14px;">
                <div style="width: 48px; height: 48px; border-radius: 50%; overflow: hidden;">
                    <img src="/extensions/ComfyUI-HF-SuperDownloader/hf_icon.png?v=${Date.now()}" style="width: 100%; height: 100%; object-fit: contain;" />
                </div>
                <div>
                    <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: 1px; font-family: 'Consolas', monospace;">
                        ${t("titlePrefix")} <span style="color:#00cc44;">${t("titleHighlight")}</span> <span style="color:#00cc44; animation: hfBlink 1s infinite;">|</span>
                    </h2>
                    <div style="font-size: 10px; color: #00cc44; opacity: 0.85; letter-spacing: 1px; font-family: 'Consolas', monospace;">${t("subtitle")}</div>
                </div>
            </div>
            <button id="hf-close-btn" style="background: #040805; border: 1.5px solid #00a832; color: #00cc44; font-size: 16px; width: 32px; height: 32px; cursor: pointer; font-weight: bold; font-family: 'Consolas', monospace;">✕</button>
        </div>

        <!-- Proposal 1 Style Chips / Tabs -->
        <div style="display: flex; gap: 12px; border-bottom: 1.5px solid #142a17; padding-bottom: 12px;">
            <button id="tab-download-btn" style="padding: 8px 20px; background: #0a170d; border: 1.5px solid #00a832; border-radius: 6px; color: #00cc44; font-size: 13px; font-weight: 800; cursor: pointer; font-family: 'Consolas', monospace; display: flex; align-items: center; gap: 6px;">
                ${t("tabDownload")}
            </button>
            <button id="tab-config-btn" style="padding: 8px 20px; background: #050b06; border: 1px solid #142817; border-radius: 6px; color: #447755; font-size: 13px; font-weight: 700; cursor: pointer; font-family: 'Consolas', monospace; display: flex; align-items: center; gap: 6px;">
                ${t("tabConfig")}
            </button>
        </div>

        <!-- TAB 1: DOWNLOAD -->
        <div id="tab-download-content" class="pepe-card-box">
            <!-- Searchable Target Destination Folder Custom Combobox -->
            <div>
                <label style="display: block; font-size: 12px; font-weight: 800; color: #00cc44; margin-bottom: 6px; letter-spacing: 0.5px;">${t("targetFolder")}</label>
                <div style="position: relative; width: 100%;">
                    <input id="hf-folder-input" type="text" placeholder="${t("placeholderFolder")}" class="pepe-input-field" style="padding-right: 36px;" />
                    <button id="hf-folder-toggle-btn" style="position: absolute; right: 4px; top: 4px; bottom: 4px; width: 30px; background: transparent; border: none; color: #00cc44; font-size: 11px; cursor: pointer;">▼</button>
                    
                    <!-- Floating Dropdown Menu -->
                    <div id="hf-folder-dropdown-menu" style="display: none; position: absolute; top: calc(100% + 4px); left: 0; width: 100%; max-height: 220px; overflow-y: auto; background: #040805; border: 1.5px solid #00a832; border-radius: 4px; z-index: 10005; box-shadow: 0 8px 25px rgba(0,0,0,0.95);"></div>
                </div>
            </div>

            <div>
                <label style="display: block; font-size: 12px; font-weight: 800; color: #00cc44; margin-bottom: 6px; letter-spacing: 0.5px;">${t("urlOrFilename")}</label>
                <div style="display: flex; gap: 0; background: #040805; border: 1.5px solid #00a832; border-radius: 4px; padding: 3px; align-items: center;">
                    <input id="hf-url-input" type="text" placeholder="${t("placeholderInput")}" 
                           style="flex: 1; padding: 10px 14px; background: transparent; border: none; color: #00cc44; font-size: 13px; font-family: 'Consolas', monospace; outline: none;" />
                    <button id="hf-search-btn" style="padding: 10px 22px; background: linear-gradient(135deg, #00a832 0%, #00942b 100%); border: none; clip-path: polygon(10px 0, 100% 0, 100% 100%, 0 100%, 0 10px); color: #000000; font-size: 13px; font-weight: 900; cursor: pointer; font-family: 'Consolas', monospace;">
                        ${t("btnSearch")}
                    </button>
                </div>
            </div>

            <div id="hf-search-result" style="display: none; padding: 10px 14px; background: #0a170d; border: 1.5px solid #00a832; border-radius: 4px; font-size: 12px; color: #00cc44; font-family: 'Consolas', monospace;"></div>

            <!-- Main Angled Green Action Button -->
            <button id="hf-download-btn" style="width: 100%; padding: 14px; background: #00a832; border: none; clip-path: polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px); color: #000000; font-size: 15px; font-weight: 900; cursor: pointer; letter-spacing: 1px; text-transform: uppercase; font-family: 'Consolas', monospace;">
                ${t("btnDownload")}
            </button>

            <div>
                <label style="display: block; font-size: 12px; font-weight: 800; color: #00cc44; margin-bottom: 6px; letter-spacing: 0.5px;">${t("terminalLog")}</label>
                <div id="hf-log-box" style="height: 160px; background: #030604; border: 1.5px solid #142a17; border-radius: 4px; padding: 12px; font-family: 'Consolas', 'Courier New', monospace; font-size: 12px; color: #00cc44; overflow-y: auto; white-space: pre-wrap; word-break: break-all;">
${t("readyLog")}
                </div>
            </div>
        </div>

        <!-- TAB 2: CONFIGURATION -->
        <div id="tab-config-content" class="pepe-card-box" style="display: none;">
            
            <!-- ComfyUI Base Root Selector -->
            <div style="background: #040805; border: 1.5px solid #142a17; border-radius: 4px; padding: 14px; display: flex; flex-direction: column; gap: 10px;">
                <div style="font-size: 12px; font-weight: 800; color: #00cc44; display: flex; align-items: center; gap: 6px;">
                    <span>${t("rootTitle")}</span>
                </div>
                <div style="display: flex; gap: 8px;">
                    <input id="hf-comfy-root-input" type="text" placeholder="C:\\ComfyUI" class="pepe-input-field" style="flex: 1;" />
                    <button id="hf-save-root-btn" style="padding: 8px 16px; background: #0a170d; border: 1.5px solid #00a832; border-radius: 4px; color: #00cc44; font-size: 12px; font-weight: 800; cursor: pointer; font-family: 'Consolas', monospace;">${t("btnAutoDetect")}</button>
                </div>
            </div>

            <div style="font-size: 13px; font-weight: 800; color: #00cc44; letter-spacing: 0.5px;">${t("availableFolders")}</div>
            
            <div id="hf-folder-list" style="max-height: 180px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; background: #030604; padding: 10px; border-radius: 4px; border: 1.5px solid #142a17;"></div>

            <div style="border-top: 1.5px solid #142a17; padding-top: 12px; display: flex; flex-direction: column; gap: 10px;">
                <div style="font-size: 12px; font-weight: 800; color: #00cc44;" id="folder-form-title">${t("addEditFolder")}</div>
                <input id="hf-new-folder-id" type="hidden" />
                <input id="hf-new-folder-name" type="text" placeholder="${t("placeholderName")}" class="pepe-input-field" />
                <input id="hf-new-folder-path" type="text" placeholder="${t("placeholderPath")}" class="pepe-input-field" />
                
                <div style="display: flex; gap: 8px;">
                    <button id="hf-save-folder-btn" style="flex: 1; padding: 10px; background: #00a832; border: none; border-radius: 4px; color: #000000; font-weight: 900; cursor: pointer; font-family: 'Consolas', monospace;">${t("btnSave")}</button>
                    <button id="hf-cancel-folder-btn" style="display: none; padding: 10px; background: #1a1a1a; border: 1px solid #444; border-radius: 4px; color: #888; cursor: pointer; font-family: 'Consolas', monospace;">${t("btnCancel")}</button>
                </div>
            </div>
        </div>
    `;

    modalContainer.appendChild(modal);
    document.body.appendChild(modalContainer);

    // Setup Custom Combobox Behavior for Folder Input
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

    // Close dropdown on outside click
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
        tabDownloadBtn.style.background = "#0a170d";
        tabDownloadBtn.style.color = "#00cc44";
        tabDownloadBtn.style.borderColor = "#00a832";
        tabConfigBtn.style.background = "#050b06";
        tabConfigBtn.style.color = "#447755";
        tabConfigBtn.style.borderColor = "#142817";
        tabDownloadContent.style.display = "flex";
        tabConfigContent.style.display = "none";
    };

    tabConfigBtn.onclick = () => {
        tabConfigBtn.style.background = "#0a170d";
        tabConfigBtn.style.color = "#00cc44";
        tabConfigBtn.style.borderColor = "#00a832";
        tabDownloadBtn.style.background = "#050b06";
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
    const logBox = modal.querySelector("#hf-log-box");

    let currentResolved = null;

    searchBtn.onclick = async () => {
        const query = urlInput.value.trim();
        if (!query) return;
        
        resultBox.style.display = "block";
        resultBox.innerHTML = t("searching");
        resultBox.style.color = "#00cc44";

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
                resultBox.style.color = "#00cc44";
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

        logBox.innerHTML = `⚡ [START] Downloading ${currentResolved.filename} from ${currentResolved.repo_id}...\n[TARGET] ${targetPath}\n\n`;
        downloadBtn.disabled = true;
        downloadBtn.style.opacity = "0.5";

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
                startPollingStatus();
            } else {
                alert(`Error: ${res.error}`);
                downloadBtn.disabled = false;
                downloadBtn.style.opacity = "1";
            }
        } catch (e) {
            alert(`Error: ${e.message}`);
            downloadBtn.disabled = false;
            downloadBtn.style.opacity = "1";
        }
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
                item.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: #040805; border-radius: 4px; border: 1px solid #142a17;";
                item.innerHTML = `
                    <div style="flex: 1; overflow: hidden;">
                        <span style="font-weight: 700; color: #00cc44; font-size: 12px; font-family: 'Consolas', monospace;">${f.name}</span>
                        <div style="font-size: 10px; color: #447755; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; font-family: 'Consolas', monospace;">${f.path}</div>
                    </div>
                    <div style="display: flex; gap: 6px;">
                        <button class="edit-folder-btn" style="padding: 4px 10px; background: #0a170d; border: 1px solid #00a832; border-radius: 3px; color: #00cc44; font-size: 11px; cursor: pointer; font-family: 'Consolas', monospace;">${t("btnEdit")}</button>
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

function startPollingStatus() {
    if (pollInterval) clearInterval(pollInterval);
    
    const downloadBtn = document.querySelector("#hf-download-btn");
    const logBox = document.querySelector("#hf-log-box");

    pollInterval = setInterval(async () => {
        try {
            const resp = await fetch("/hf_superdownloader/status");
            const res = await resp.json();

            if (logBox && res.logs) {
                logBox.innerHTML = res.logs.join("\n");
                logBox.scrollTop = logBox.scrollHeight;
            }

            if (!res.is_running) {
                clearInterval(pollInterval);
                pollInterval = null;
                if (downloadBtn) {
                    downloadBtn.disabled = false;
                    downloadBtn.style.opacity = "1";
                }
            }
        } catch (e) {
            console.error("Error polling status:", e);
        }
    }, 1000);
}
