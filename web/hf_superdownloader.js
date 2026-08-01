import { app } from "../../scripts/app.js";

app.registerExtension({
    name: "ComfyUI.HFSuperDownloader",
    async setup() {
        console.log("[HF SuperDownloader] Initializing Cyber-Pepe HUD Web Extension...");
        createFloatingButton();
    }
});

let modalContainer = null;
let pollInterval = null;

// i18n Translations Dictionary
const i18n = {
    es: {
        title: "HF SUPERDOWNLOADER // PEPE-GPT EDITION",
        tooltip: "HF SuperDownloader (Mover: arrastrar centro | Escalar: esquinas)",
        tabDownload: "⚡ Descargar Modelo",
        tabConfig: "⚙️ Gestionar Directorios",
        targetFolder: "📁 CARPETA DE DESTINO (COMFYUI):",
        urlOrFilename: "🔗 URL DE HUGGING FACE O NOMBRE DE ARCHIVO:",
        placeholderInput: "Ej: ltx_2.3_22b_distilled_1.1_lora_dynamic_fro09_avg_rank_111_bf16.safetensors",
        btnSearch: "🔍 BUSCAR",
        btnDownload: "⚡ DESCARGAR A MÁXIMA VELOCIDAD (HF_TRANSFER)",
        terminalLog: "💻 LOG TERMINAL EN TIEMPO REAL:",
        searching: "⏳ Buscando en Hugging Face...",
        found: "✔ Encontrado:",
        readyLog: "Ready. Ingresa un enlace o nombre de archivo para comenzar.",
        rootTitle: "🏠 DIRECTORIO RAÍZ DE COMFYUI (AUTO-DETECTAR):",
        btnAutoDetect: "🔍 Auto-Detectar Subcarpetas",
        availableFolders: "CARPETAS DE DESTINO DISPONIBLES:",
        addEditFolder: "➕ AÑADIR / EDITAR CARPETA PERSONALIZADA:",
        placeholderName: "Nombre descriptivo (ej: Text Encoders)",
        placeholderPath: "Ruta absoluta (ej: C:\\ComfyUI\\models\\text_encoders)",
        btnSave: "GUARDAR CARPETA",
        btnCancel: "CANCELAR",
        btnEdit: "✏️ Editar",
        btnDelete: "🗑️ Borrar",
        confirmDelete: '¿Eliminar la carpeta "{name}" de la lista?',
        alertFillFields: "Completa el nombre y la ruta de la carpeta.",
        alertValidRoot: "Ingresa un directorio de ComfyUI válido.",
        alertRootSuccess: "✔ Directorio de ComfyUI actualizado y subcarpetas auto-detectadas con éxito!",
        alertNotFound: "No se pudo resolver el repositorio de Hugging Face. Verifica el nombre."
    },
    en: {
        title: "HF SUPERDOWNLOADER // PEPE-GPT EDITION",
        tooltip: "HF SuperDownloader (Move: drag center | Scale: drag corners)",
        tabDownload: "⚡ Download Model",
        tabConfig: "⚙️ Manage Directories",
        targetFolder: "📁 TARGET DESTINATION FOLDER:",
        urlOrFilename: "🔗 HUGGING FACE URL OR FILENAME:",
        placeholderInput: "E.g. ltx_2.3_22b_distilled_1.1_lora_dynamic_fro09_avg_rank_111_bf16.safetensors",
        btnSearch: "🔍 SEARCH",
        btnDownload: "⚡ DOWNLOAD AT MAX SPEED (HF_TRANSFER)",
        terminalLog: "💻 REAL-TIME TERMINAL LOG:",
        searching: "⏳ Searching Hugging Face...",
        found: "✔ Found:",
        readyLog: "Ready. Enter a link or filename to start.",
        rootTitle: "🏠 COMFYUI BASE ROOT DIRECTORY (AUTO-DETECT):",
        btnAutoDetect: "🔍 Auto-Detect Subfolders",
        availableFolders: "AVAILABLE DESTINATION FOLDERS:",
        addEditFolder: "➕ ADD / EDIT CUSTOM FOLDER:",
        placeholderName: "Descriptive name (e.g. Text Encoders)",
        placeholderPath: "Absolute path (e.g. C:\\ComfyUI\\models\\text_encoders)",
        btnSave: "SAVE FOLDER",
        btnCancel: "CANCEL",
        btnEdit: "✏️ Edit",
        btnDelete: "🗑️ Delete",
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
    // Default strictly to English unless ComfyUI settings explicitly set Spanish
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
        border-radius: 50%;
        background: #06090e;
        border: 2px solid #00ff66;
        box-shadow: 0 0 15px rgba(0, 255, 102, 0.4), 0 4px 18px rgba(0, 0, 0, 0.9);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        user-select: none;
        padding: 0;
        overflow: visible;
        cursor: move;
        transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.2s;
    `;

    const iconImg = document.createElement("img");
    iconImg.src = "/extensions/ComfyUI-HF-SuperDownloader/hf_icon.png?v=" + Date.now();
    iconImg.style.cssText = "width: 100%; height: 100%; border-radius: 50%; object-fit: cover; pointer-events: none; display: block;";
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
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #00ff66;
            border: 1px solid #000;
            cursor: ${cursorType};
            z-index: 10001;
            opacity: 0;
            transition: opacity 0.2s;
            box-shadow: 0 0 8px #00ff66;
        `;
        btn.appendChild(handle);
    });

    btn.onmouseenter = () => {
        btn.querySelectorAll(".hf-resize-handle").forEach(h => h.style.opacity = "1");
        btn.style.transform = "scale(1.08)";
        btn.style.boxShadow = "0 0 25px rgba(0, 255, 102, 0.7), 0 6px 24px rgba(0, 0, 0, 0.9)";
    };
    btn.onmouseleave = () => {
        btn.querySelectorAll(".hf-resize-handle").forEach(h => h.style.opacity = "0");
        btn.style.transform = "scale(1)";
        btn.style.boxShadow = "0 0 15px rgba(0, 255, 102, 0.4), 0 4px 18px rgba(0, 0, 0, 0.9)";
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
            btn.style.transition = "transform 0.2s, box-shadow 0.2s";

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
        background: rgba(4, 8, 12, 0.88);
        backdrop-filter: blur(10px);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Consolas', 'Courier New', monospace, system-ui;
    `;

    const modal = document.createElement("div");
    modal.style.cssText = `
        width: 760px;
        max-width: 94vw;
        background: #080c14;
        border: 2px solid #00ff66;
        border-radius: 12px;
        box-shadow: 0 0 35px rgba(0, 255, 102, 0.25), 0 20px 60px rgba(0, 0, 0, 0.95);
        padding: 24px;
        color: #00ff66;
        display: flex;
        flex-direction: column;
        gap: 16px;
        position: relative;
    `;

    modal.innerHTML = `
        <!-- Cyber-Pepe Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #00ff6633; padding-bottom: 14px;">
            <div style="display: flex; align-items: center; gap: 14px;">
                <div style="width: 48px; height: 48px; border-radius: 50%; border: 2px solid #00ff66; overflow: hidden; box-shadow: 0 0 12px rgba(0,255,102,0.5);">
                    <img src="/extensions/ComfyUI-HF-SuperDownloader/hf_icon.png?v=${Date.now()}" style="width: 100%; height: 100%; object-fit: cover;" />
                </div>
                <div>
                    <h2 style="margin: 0; font-size: 18px; font-weight: 800; color: #00ff66; letter-spacing: 1px; text-shadow: 0 0 8px rgba(0,255,102,0.6);">${t("title")}</h2>
                    <div style="font-size: 11px; color: #00cc55; opacity: 0.8; letter-spacing: 0.5px;">CYBERNETIC HIGH-SPEED HF DATA TRANSFER</div>
                </div>
            </div>
            <button id="hf-close-btn" style="background: none; border: 1px solid #00ff6666; border-radius: 6px; color: #00ff66; font-size: 18px; width: 32px; height: 32px; cursor: pointer; transition: all 0.2s;">✕</button>
        </div>

        <!-- Cyber Navigation Tabs -->
        <div style="display: flex; gap: 10px; border-bottom: 1px solid #00ff6633; padding-bottom: 10px;">
            <button id="tab-download-btn" style="padding: 8px 16px; background: #00ff6622; border: 1px solid #00ff66; border-radius: 6px; color: #00ff66; font-size: 13px; font-weight: 700; cursor: pointer; letter-spacing: 0.5px;">${t("tabDownload")}</button>
            <button id="tab-config-btn" style="padding: 8px 16px; background: #0c141f; border: 1px solid #00ff6644; border-radius: 6px; color: #00bb44; font-size: 13px; font-weight: 700; cursor: pointer; letter-spacing: 0.5px;">${t("tabConfig")}</button>
        </div>

        <!-- TAB 1: DOWNLOAD -->
        <div id="tab-download-content" style="display: flex; flex-direction: column; gap: 14px;">
            <div>
                <label style="display: block; font-size: 12px; font-weight: 700; color: #00ff66; margin-bottom: 6px; letter-spacing: 0.5px;">${t("targetFolder")}</label>
                <select id="hf-folder-select" style="width: 100%; padding: 10px 14px; background: #04070d; border: 1px solid #00ff6655; border-radius: 6px; color: #00ff66; font-size: 13px; font-family: 'Consolas', monospace; outline: none; cursor: pointer;"></select>
            </div>

            <div>
                <label style="display: block; font-size: 12px; font-weight: 700; color: #00ff66; margin-bottom: 6px; letter-spacing: 0.5px;">${t("urlOrFilename")}</label>
                <div style="display: flex; gap: 8px;">
                    <input id="hf-url-input" type="text" placeholder="${t("placeholderInput")}" 
                           style="flex: 1; padding: 10px 14px; background: #04070d; border: 1px solid #00ff6655; border-radius: 6px; color: #00ff66; font-size: 13px; font-family: 'Consolas', monospace; outline: none;" />
                    <button id="hf-search-btn" style="padding: 10px 18px; background: #00ff6622; border: 1px solid #00ff66; border-radius: 6px; color: #00ff66; font-size: 13px; font-weight: 700; cursor: pointer; letter-spacing: 0.5px; box-shadow: 0 0 10px rgba(0,255,102,0.2);">${t("btnSearch")}</button>
                </div>
            </div>

            <div id="hf-search-result" style="display: none; padding: 10px 14px; background: #00ff6611; border: 1px solid #00ff66; border-radius: 6px; font-size: 12px; color: #00ff66; font-family: 'Consolas', monospace;"></div>

            <button id="hf-download-btn" style="width: 100%; padding: 13px; background: #00ff66; border: none; border-radius: 6px; color: #04070d; font-size: 15px; font-weight: 800; cursor: pointer; letter-spacing: 1px; box-shadow: 0 0 20px rgba(0, 255, 102, 0.5); text-transform: uppercase;">
                ${t("btnDownload")}
            </button>

            <div>
                <label style="display: block; font-size: 12px; font-weight: 700; color: #00ff66; margin-bottom: 6px; letter-spacing: 0.5px;">${t("terminalLog")}</label>
                <div id="hf-log-box" style="height: 160px; background: #020408; border: 1px solid #00ff6644; border-radius: 6px; padding: 12px; font-family: 'Consolas', 'Courier New', monospace; font-size: 12px; color: #00ff66; overflow-y: auto; white-space: pre-wrap; word-break: break-all;">
${t("readyLog")}
                </div>
            </div>
        </div>

        <!-- TAB 2: CONFIGURATION -->
        <div id="tab-config-content" style="display: none; flex-direction: column; gap: 14px;">
            
            <!-- ComfyUI Base Root Selector -->
            <div style="background: #04070d; border: 1px solid #00ff6644; border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 10px;">
                <div style="font-size: 12px; font-weight: 700; color: #00ff66; display: flex; align-items: center; gap: 6px; letter-spacing: 0.5px;">
                    <span>${t("rootTitle")}</span>
                </div>
                <div style="display: flex; gap: 8px;">
                    <input id="hf-comfy-root-input" type="text" placeholder="C:\\ComfyUI" style="flex: 1; padding: 8px 12px; background: #080c14; border: 1px solid #00ff6644; border-radius: 6px; color: #00ff66; font-size: 12px; font-family: 'Consolas', monospace;" />
                    <button id="hf-save-root-btn" style="padding: 8px 14px; background: #00ff6622; border: 1px solid #00ff66; border-radius: 6px; color: #00ff66; font-size: 12px; font-weight: 700; cursor: pointer;">${t("btnAutoDetect")}</button>
                </div>
            </div>

            <div style="font-size: 13px; font-weight: 700; color: #00ff66; letter-spacing: 0.5px;">${t("availableFolders")}</div>
            
            <div id="hf-folder-list" style="max-height: 180px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; background: #020408; padding: 10px; border-radius: 6px; border: 1px solid #00ff6633;"></div>

            <div style="border-top: 1px solid #00ff6633; padding-top: 12px; display: flex; flex-direction: column; gap: 10px;">
                <div style="font-size: 12px; font-weight: 700; color: #00ff66;" id="folder-form-title">${t("addEditFolder")}</div>
                <input id="hf-new-folder-id" type="hidden" />
                <input id="hf-new-folder-name" type="text" placeholder="${t("placeholderName")}" style="padding: 8px 12px; background: #04070d; border: 1px solid #00ff6644; border-radius: 6px; color: #00ff66; font-size: 12px; font-family: 'Consolas', monospace;" />
                <input id="hf-new-folder-path" type="text" placeholder="${t("placeholderPath")}" style="padding: 8px 12px; background: #04070d; border: 1px solid #00ff6644; border-radius: 6px; color: #00ff66; font-size: 12px; font-family: 'Consolas', monospace;" />
                
                <div style="display: flex; gap: 8px;">
                    <button id="hf-save-folder-btn" style="flex: 1; padding: 10px; background: #00ff66; border: none; border-radius: 6px; color: #04070d; font-weight: 800; cursor: pointer;">${t("btnSave")}</button>
                    <button id="hf-cancel-folder-btn" style="display: none; padding: 10px; background: #222; border: 1px solid #444; border-radius: 6px; color: #888; cursor: pointer;">${t("btnCancel")}</button>
                </div>
            </div>
        </div>
    `;

    modalContainer.appendChild(modal);
    document.body.appendChild(modalContainer);

    const tabDownloadBtn = modal.querySelector("#tab-download-btn");
    const tabConfigBtn = modal.querySelector("#tab-config-btn");
    const tabDownloadContent = modal.querySelector("#tab-download-content");
    const tabConfigContent = modal.querySelector("#tab-config-content");

    tabDownloadBtn.onclick = () => {
        tabDownloadBtn.style.background = "#00ff6622";
        tabDownloadBtn.style.color = "#00ff66";
        tabDownloadBtn.style.borderColor = "#00ff66";
        tabConfigBtn.style.background = "#0c141f";
        tabConfigBtn.style.color = "#00bb44";
        tabConfigBtn.style.borderColor = "#00ff6644";
        tabDownloadContent.style.display = "flex";
        tabConfigContent.style.display = "none";
    };

    tabConfigBtn.onclick = () => {
        tabConfigBtn.style.background = "#00ff6622";
        tabConfigBtn.style.color = "#00ff66";
        tabConfigBtn.style.borderColor = "#00ff66";
        tabDownloadBtn.style.background = "#0c141f";
        tabDownloadBtn.style.color = "#00bb44";
        tabDownloadBtn.style.borderColor = "#00ff6644";
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
        resultBox.style.color = "#00ff66";

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
                resultBox.style.color = "#00ff66";
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

        const folderSelect = modal.querySelector("#hf-folder-select");
        const targetPath = folderSelect.value;

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
        const select = document.querySelector("#hf-folder-select");
        if (select && res.folders) {
            select.innerHTML = "";
            res.folders.forEach(f => {
                const opt = document.createElement("option");
                opt.value = f.path;
                opt.textContent = `${f.name} (${f.path})`;
                select.appendChild(opt);
            });
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
            listContainer.innerHTML = "";
            res.folders.forEach(f => {
                const item = document.createElement("div");
                item.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: #080c14; border-radius: 6px; border: 1px solid #00ff6633;";
                item.innerHTML = `
                    <div style="flex: 1; overflow: hidden;">
                        <span style="font-weight: 700; color: #00ff66; font-size: 12px; font-family: 'Consolas', monospace;">${f.name}</span>
                        <div style="font-size: 10px; color: #00bb44; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; font-family: 'Consolas', monospace;">${f.path}</div>
                    </div>
                    <div style="display: flex; gap: 6px;">
                        <button class="edit-folder-btn" style="padding: 4px 8px; background: #00ff6622; border: 1px solid #00ff66; border-radius: 4px; color: #00ff66; font-size: 11px; cursor: pointer;">${t("btnEdit")}</button>
                        <button class="delete-folder-btn" style="padding: 4px 8px; background: #aa2222; border: none; border-radius: 4px; color: #fff; font-size: 11px; cursor: pointer;">${t("btnDelete")}</button>
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
