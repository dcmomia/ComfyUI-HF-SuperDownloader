import { app } from "../../scripts/app.js";

app.registerExtension({
    name: "ComfyUI.HFSuperDownloader",
    async setup() {
        console.log("[HF SuperDownloader] Initializing Web Extension...");
        createFloatingButton();
    }
});

let modalContainer = null;
let pollInterval = null;

function createFloatingButton() {
    if (document.getElementById("hf-superdownloader-fab")) {
        return;
    }

    const btn = document.createElement("div");
    btn.id = "hf-superdownloader-fab";
    btn.title = "Hugging Face Downloader (Mover: arrastrar centro | Escalar: arrastrar bordes/esquinas)";
    
    // Restore saved size or default
    let savedSize = 54;
    try {
        const s = parseInt(localStorage.getItem("hf_fab_size"));
        if (s && s >= 30 && s <= 160) savedSize = s;
    } catch(e) {}

    // Restore saved position or default to bottom-right
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
        background: transparent;
        border: none;
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.7);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        user-select: none;
        padding: 0;
        overflow: visible;
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
            background: rgba(255, 189, 46, 0.85);
            border: 1px solid #000;
            cursor: ${cursorType};
            z-index: 10001;
            opacity: 0;
            transition: opacity 0.2s;
        `;
        btn.appendChild(handle);
    });

    // Show handles on hover
    btn.onmouseenter = () => {
        btn.querySelectorAll(".hf-resize-handle").forEach(h => h.style.opacity = "1");
        btn.style.transform = "scale(1.05)";
        btn.style.boxShadow = "0 6px 24px rgba(0, 0, 0, 0.85)";
    };
    btn.onmouseleave = () => {
        btn.querySelectorAll(".hf-resize-handle").forEach(h => h.style.opacity = "0");
        btn.style.transform = "scale(1)";
        btn.style.boxShadow = "0 4px 18px rgba(0, 0, 0, 0.7)";
    };

    // Interactivity: Move & Resize Logic
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
            // Proportional 1:1 resize
            let delta = dx;
            if (activeHandle.className.includes("nw") || activeHandle.className.includes("sw")) {
                delta = -dx;
            }
            
            let newSize = initialSize + delta;
            newSize = Math.max(32, Math.min(160, newSize)); // Clamped between 32px and 160px

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
        background: rgba(0, 0, 0, 0.75);
        backdrop-filter: blur(8px);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: system-ui, -apple-system, sans-serif;
    `;

    const modal = document.createElement("div");
    modal.style.cssText = `
        width: 720px;
        max-width: 92vw;
        background: #14141f;
        border: 1px solid #2a2a3d;
        border-radius: 16px;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.9), 0 0 30px rgba(255, 189, 46, 0.15);
        padding: 24px;
        color: #e0e0e0;
        display: flex;
        flex-direction: column;
        gap: 16px;
        position: relative;
    `;

    modal.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #2a2a3d; padding-bottom: 14px;">
            <div style="display: flex; align-items: center; gap: 12px;">
                <img src="/extensions/ComfyUI-HF-SuperDownloader/hf_icon.png?v=${Date.now()}" style="width: 32px; height: 32px; border-radius: 50%;" />
                <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #fff;">Hugging Face SuperDownloader</h2>
            </div>
            <button id="hf-close-btn" style="background: none; border: none; color: #888; font-size: 24px; cursor: pointer; transition: color 0.2s;">✕</button>
        </div>

        <!-- Navigation Tabs -->
        <div style="display: flex; gap: 10px; border-bottom: 1px solid #2a2a3d; padding-bottom: 10px;">
            <button id="tab-download-btn" style="padding: 8px 16px; background: #2a2a40; border: 1px solid #444466; border-radius: 8px; color: #ffbd2e; font-size: 14px; font-weight: 600; cursor: pointer;">⚡ Descargar Modelo</button>
            <button id="tab-config-btn" style="padding: 8px 16px; background: #1a1a28; border: 1px solid #33334d; border-radius: 8px; color: #aaa; font-size: 14px; font-weight: 600; cursor: pointer;">⚙️ Gestionar Directorios</button>
        </div>

        <!-- TAB 1: DOWNLOAD -->
        <div id="tab-download-content" style="display: flex; flex-direction: column; gap: 14px;">
            <div>
                <label style="display: block; font-size: 13px; font-weight: 600; color: #aaa; margin-bottom: 6px;">📁 Carpeta de Destino en ComfyUI:</label>
                <select id="hf-folder-select" style="width: 100%; padding: 10px 14px; background: #0d0d15; border: 1px solid #33334d; border-radius: 8px; color: #fff; font-size: 14px; outline: none; cursor: pointer;"></select>
            </div>

            <div>
                <label style="display: block; font-size: 13px; font-weight: 600; color: #aaa; margin-bottom: 6px;">🔗 URL de Hugging Face o Nombre del Archivo:</label>
                <div style="display: flex; gap: 8px;">
                    <input id="hf-url-input" type="text" placeholder="Ej: ltx_2.3_22b_distilled_1.1_lora_dynamic_fro09_avg_rank_111_bf16.safetensors" 
                           style="flex: 1; padding: 10px 14px; background: #0d0d15; border: 1px solid #33334d; border-radius: 8px; color: #fff; font-size: 14px; outline: none;" />
                    <button id="hf-search-btn" style="padding: 10px 18px; background: #2a2a40; border: 1px solid #444466; border-radius: 8px; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer;">🔍 Buscar</button>
                </div>
            </div>

            <div id="hf-search-result" style="display: none; padding: 10px 14px; background: #1a1a2e; border: 1px solid #ffbd2e44; border-radius: 8px; font-size: 13px; color: #ffbd2e;"></div>

            <button id="hf-download-btn" style="width: 100%; padding: 12px; background: linear-gradient(135deg, #ffbd2e 0%, #e6a100 100%); border: none; border-radius: 10px; color: #000; font-size: 15px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 15px rgba(255, 189, 46, 0.3);">
                ⚡ Descargar a Máxima Velocidad (hf_transfer)
            </button>

            <div>
                <label style="display: block; font-size: 13px; font-weight: 600; color: #aaa; margin-bottom: 6px;">💻 Terminal Log en Tiempo Real:</label>
                <div id="hf-log-box" style="height: 160px; background: #08080c; border: 1px solid #222233; border-radius: 8px; padding: 12px; font-family: 'Consolas', 'Courier New', monospace; font-size: 12px; color: #00ff66; overflow-y: auto; white-space: pre-wrap; word-break: break-all;">
Ready. Ingresa un enlace o nombre de archivo para comenzar.
                </div>
            </div>
        </div>

        <!-- TAB 2: CONFIGURATION -->
        <div id="tab-config-content" style="display: none; flex-direction: column; gap: 14px;">
            <div style="font-size: 14px; font-weight: 600; color: #ffbd2e;">Configurar Carpetas de Destino Guardadas:</div>
            
            <div id="hf-folder-list" style="max-height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; background: #0d0d15; padding: 10px; border-radius: 8px; border: 1px solid #222233;"></div>

            <div style="border-top: 1px solid #2a2a3d; padding-top: 12px; display: flex; flex-direction: column; gap: 10px;">
                <div style="font-size: 13px; font-weight: 600; color: #fff;" id="folder-form-title">➕ Añadir / Editar Carpeta:</div>
                <input id="hf-new-folder-id" type="hidden" />
                <input id="hf-new-folder-name" type="text" placeholder="Nombre descriptivo (ej: Text Encoders)" style="padding: 8px 12px; background: #0d0d15; border: 1px solid #33334d; border-radius: 6px; color: #fff; font-size: 13px;" />
                <input id="hf-new-folder-path" type="text" placeholder="Ruta absoluta (ej: J:\\Comfyui\\...\\models\\text_encoders)" style="padding: 8px 12px; background: #0d0d15; border: 1px solid #33334d; border-radius: 6px; color: #fff; font-size: 13px;" />
                
                <div style="display: flex; gap: 8px;">
                    <button id="hf-save-folder-btn" style="flex: 1; padding: 10px; background: #00bb66; border: none; border-radius: 6px; color: #fff; font-weight: 700; cursor: pointer;">Guardar Carpeta</button>
                    <button id="hf-cancel-folder-btn" style="display: none; padding: 10px; background: #444; border: none; border-radius: 6px; color: #fff; cursor: pointer;">Cancelar</button>
                </div>
            </div>
        </div>
    `;

    modalContainer.appendChild(modal);
    document.body.appendChild(modalContainer);

    // Tab switching
    const tabDownloadBtn = modal.querySelector("#tab-download-btn");
    const tabConfigBtn = modal.querySelector("#tab-config-btn");
    const tabDownloadContent = modal.querySelector("#tab-download-content");
    const tabConfigContent = modal.querySelector("#tab-config-content");

    tabDownloadBtn.onclick = () => {
        tabDownloadBtn.style.background = "#2a2a40";
        tabDownloadBtn.style.color = "#ffbd2e";
        tabConfigBtn.style.background = "#1a1a28";
        tabConfigBtn.style.color = "#aaa";
        tabDownloadContent.style.display = "flex";
        tabConfigContent.style.display = "none";
    };

    tabConfigBtn.onclick = () => {
        tabConfigBtn.style.background = "#2a2a40";
        tabConfigBtn.style.color = "#ffbd2e";
        tabDownloadBtn.style.background = "#1a1a28";
        tabDownloadBtn.style.color = "#aaa";
        tabConfigContent.style.display = "flex";
        tabDownloadContent.style.display = "none";
        renderConfigFolderList();
    };

    // Close button
    modal.querySelector("#hf-close-btn").onclick = () => { modalContainer.style.display = "none"; };

    // Search logic
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
        resultBox.innerHTML = "⏳ Buscando en Hugging Face...";
        resultBox.style.color = "#aaa";

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
                resultBox.style.color = "#ffbd2e";
                resultBox.innerHTML = `✔ Encontrado: <b>${res.repo_id}</b> &rarr; <code>${res.filename}</code>`;
            } else {
                currentResolved = null;
                resultBox.style.display = "block";
                resultBox.style.color = "#ff4444";
                resultBox.innerHTML = `✖ ${res.error}`;
            }
        } catch (e) {
            resultBox.style.display = "block";
            resultBox.style.color = "#ff4444";
            resultBox.innerHTML = `✖ Error de búsqueda: ${e.message}`;
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
            alert("No se pudo resolver el repositorio de Hugging Face. Verifica el nombre.");
            return;
        }

        const folderSelect = modal.querySelector("#hf-folder-select");
        const targetPath = folderSelect.value;

        logBox.innerHTML = `⚡ Iniciando descarga multihilo...\nRepo: ${currentResolved.repo_id}\nArchivo: ${currentResolved.filename}\nDestino: ${targetPath}\n\n`;
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
            alert(`Error al iniciar descarga: ${e.message}`);
            downloadBtn.disabled = false;
            downloadBtn.style.opacity = "1";
        }
    };

    // Folder Config Handlers
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
            alert("Completa el nombre y la ruta de la carpeta.");
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
                modal.querySelector("#folder-form-title").textContent = "➕ Añadir / Editar Carpeta:";
                renderConfigFolderList();
                loadFolders();
            } else {
                alert(`Error: ${res.error}`);
            }
        } catch (e) {
            alert(`Error guardando carpeta: ${e.message}`);
        }
    };

    cancelFolderBtn.onclick = () => {
        folderIdInput.value = "";
        folderNameInput.value = "";
        folderPathInput.value = "";
        cancelFolderBtn.style.display = "none";
        modal.querySelector("#folder-form-title").textContent = "➕ Añadir / Editar Carpeta:";
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
    if (!listContainer) return;

    listContainer.innerHTML = "Cargando...";

    try {
        const resp = await fetch("/hf_superdownloader/folders");
        const res = await resp.json();
        if (res.folders) {
            listContainer.innerHTML = "";
            res.folders.forEach(f => {
                const item = document.createElement("div");
                item.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: #141422; border-radius: 6px; border: 1px solid #2a2a3d;";
                item.innerHTML = `
                    <div style="flex: 1; overflow: hidden;">
                        <span style="font-weight: 600; color: #ffbd2e; font-size: 13px;">${f.name}</span>
                        <div style="font-size: 11px; color: #888; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${f.path}</div>
                    </div>
                    <div style="display: flex; gap: 6px;">
                        <button class="edit-folder-btn" style="padding: 4px 8px; background: #2a2a40; border: 1px solid #444; border-radius: 4px; color: #fff; font-size: 11px; cursor: pointer;">✏️ Editar</button>
                        <button class="delete-folder-btn" style="padding: 4px 8px; background: #aa2222; border: none; border-radius: 4px; color: #fff; font-size: 11px; cursor: pointer;">🗑️ Borrar</button>
                    </div>
                `;

                item.querySelector(".edit-folder-btn").onclick = () => {
                    document.querySelector("#hf-new-folder-id").value = f.id;
                    document.querySelector("#hf-new-folder-name").value = f.name;
                    document.querySelector("#hf-new-folder-path").value = f.path;
                    document.querySelector("#hf-cancel-folder-btn").style.display = "inline-block";
                    document.querySelector("#folder-form-title").textContent = `✏️ Editando: ${f.name}`;
                };

                item.querySelector(".delete-folder-btn").onclick = async () => {
                    if (confirm(`¿Eliminar la carpeta "${f.name}" de la lista?`)) {
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
        listContainer.innerHTML = "Error cargando carpetas.";
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
