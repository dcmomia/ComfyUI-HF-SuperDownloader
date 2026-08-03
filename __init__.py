import os, sys, re, json, subprocess, urllib.request, threading, time, uuid
from aiohttp import web
from server import PromptServer

NODE_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_DIRECTORY = "./web"
CONFIG_FILE = os.path.join(NODE_DIR, "hf_folders.json")

import folder_paths

# Determine default ComfyUI Base Root Directory
DEFAULT_COMFY_ROOT = getattr(folder_paths, 'base_path', os.path.abspath(os.path.join(NODE_DIR, "..", "..")))

CATEGORIES_FRIENDLY_NAMES = {
    'loras': 'LoRAs',
    'diffusion_models': 'Diffusion Models (UNET)',
    'checkpoints': 'Checkpoints',
    'text_encoders': 'Text Encoders',
    'vae': 'VAEs',
    'controlnet': 'ControlNet',
    'clip': 'CLIP Models',
    'unet': 'UNET Models',
    'upscale_models': 'Upscale Models',
    'embeddings': 'Embeddings',
    'hypernetworks': 'Hypernetworks',
    'clip_vision': 'CLIP Vision',
    'style_models': 'Style Models',
    'photomaker': 'PhotoMaker'
}

PRIORITY_ORDER = [
    'loras', 'diffusion_models', 'checkpoints', 'text_encoders',
    'vae', 'controlnet', 'clip', 'unet', 'upscale_models', 'embeddings'
]

def auto_discover_folders(base_root=None):
    if not base_root or not os.path.exists(base_root):
        base_root = DEFAULT_COMFY_ROOT
        
    found_dirs = {}
    
    # 1. Use folder_paths from ComfyUI
    try:
        if hasattr(folder_paths, 'folder_names_and_paths'):
            for cat, val in folder_paths.folder_names_and_paths.items():
                paths = val[0] if isinstance(val, tuple) or isinstance(val, list) else []
                if paths:
                    first_path = paths[0]
                    clean_id = cat.lower().replace(' ', '_')
                    friendly_name = CATEGORIES_FRIENDLY_NAMES.get(clean_id, cat.capitalize())
                    found_dirs[clean_id] = [friendly_name, os.path.abspath(first_path)]
    except Exception:
        pass
        
    # 2. Scan <base_root>/models/ directory for all subdirectories
    models_dir = os.path.join(base_root, "models")
    if os.path.exists(models_dir):
        try:
            for entry in sorted(os.listdir(models_dir)):
                full_p = os.path.join(models_dir, entry)
                if os.path.isdir(full_p):
                    clean_id = entry.lower().replace(' ', '_')
                    if clean_id not in found_dirs:
                        friendly_name = CATEGORIES_FRIENDLY_NAMES.get(clean_id, entry.replace('_', ' ').title())
                        found_dirs[clean_id] = [friendly_name, os.path.abspath(full_p)]
        except Exception:
            pass

    return found_dirs

def load_config():
    comfy_root = DEFAULT_COMFY_ROOT
    custom_dirs = {}
    
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                saved = json.load(f)
                if isinstance(saved, dict):
                    comfy_root = saved.get("comfy_root", DEFAULT_COMFY_ROOT)
                    raw_dirs = saved.get("custom_folders", {})
                    # Handle backward compatibility
                    if not raw_dirs and any(isinstance(v, list) for v in saved.values()):
                        raw_dirs = {k: v for k, v in saved.items() if k != "comfy_root" and isinstance(v, list)}
                    
                    for k, v in raw_dirs.items():
                        key_clean = k.lower().replace(' ', '_')
                        custom_dirs[key_clean] = v
        except Exception:
            pass
            
    # Auto-discover based on active comfy_root
    discovered = auto_discover_folders(comfy_root)
    # Merge custom user overrides on top of discovered folders
    for k, v in custom_dirs.items():
        discovered[k] = v

    # Sort dictionary: priority categories first
    sorted_dirs = {}
    for p in PRIORITY_ORDER:
        if p in discovered:
            sorted_dirs[p] = discovered[p]
    for k, v in discovered.items():
        if k not in sorted_dirs:
            sorted_dirs[k] = v

    return comfy_root, sorted_dirs

def save_config(comfy_root, custom_folders):
    data = {
        "comfy_root": comfy_root,
        "custom_folders": custom_folders
    }
    with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)

POPULAR_REPOS = [
    'Kijai/LTX2.3_comfy',
    'Alissonerdx/BFS-Best-Face-Swap',
    'Comfy-Org/Qwen-Image-Edit_ComfyUI',
    'Comfy-Org/Wan_2.1_ComfyUI_repackaged',
    'city96/ComfyUI-GGUF',
    'Comfy-Org/Flux.1-Dev-GGUF',
    'stabilityai/stable-diffusion-xl-base-1.0',
    'black-forest-labs/FLUX.1-dev'
]

class DownloadJob:
    def __init__(self, job_id, repo_id, filename, target_path):
        self.job_id = job_id
        self.repo_id = repo_id
        self.filename = filename
        self.target_path = target_path
        self.status = "starting"  # starting, downloading, completed, error, cancelled
        self.progress = 0.0
        self.speed = "-- B/s"
        self.eta = "--:--"
        self.downloaded_bytes = 0
        self.total_bytes = 0
        self.logs = []
        self.process = None
        self.start_time = time.time()

    def to_dict(self):
        return {
            "job_id": self.job_id,
            "repo_id": self.repo_id,
            "filename": self.filename,
            "target_path": self.target_path,
            "status": self.status,
            "progress": round(self.progress, 1),
            "speed": self.speed,
            "eta": self.eta,
            "downloaded_bytes": self.downloaded_bytes,
            "total_bytes": self.total_bytes,
            "logs": self.logs[-50:]
        }

active_downloads = {}  # job_id -> DownloadJob

def norm(s):
    if not s:
        return ""
    return re.sub(r'[\-_]', '', s.lower())

def parse_hf_url(url_input):
    url_input = url_input.strip()
    m = re.match(r'https?://huggingface\.co/([^/]+/[^/]+)/(?:blob|resolve|tree)/[^/]+/(.+)', url_input)
    if m:
        return m.group(1), m.group(2)
    return None, None

def search_hf_auto(target_input):
    target_file = target_input.strip(' "\'')
    repo_id, filename = parse_hf_url(target_file)
    if repo_id and filename:
        return repo_id, filename, [(repo_id, filename)]

    if '/' in target_file and not target_file.startswith('http'):
        parts = target_file.split('/')
        if len(parts) >= 2:
            r = parts[0] + '/' + parts[1]
            f = '/'.join(parts[2:]) if len(parts) > 2 else ""
            if f:
                return r, f, [(r, f)]

    filename_only = os.path.basename(target_file)
    u_norm = norm(filename_only)
    found_matches = []
    
    # 1. Check popular repos
    for repo in POPULAR_REPOS:
        try:
            tree_url = f'https://huggingface.co/api/models/{repo}/tree/main?recursive=true'
            req = urllib.request.Request(tree_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=3) as resp:
                files_tree = json.loads(resp.read().decode())
                for item in files_tree:
                    if item.get('type') == 'file':
                        path = item.get('path', '')
                        p_norm = norm(os.path.basename(path))
                        if u_norm == p_norm or u_norm in norm(path):
                            found_matches.append((repo, path))
        except Exception:
            pass
            
    if found_matches:
        unique = list(dict.fromkeys(found_matches))
        return unique[0][0], unique[0][1], unique

    # 2. General Hugging Face API search by tokens
    words = [w for w in re.sub(r'[\._\-]', ' ', filename_only).split() if len(w) > 2 and w.lower() not in ['safetensors', 'ckpt', 'pth', 'bin']]
    search_query = '+'.join(words[:3]) if words else filename_only
    
    search_url = f'https://huggingface.co/api/models?search={search_query}&limit=15'
    try:
        req = urllib.request.Request(search_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            for m in data:
                repo_id_api = m.get('id')
                try:
                    tree_url = f'https://huggingface.co/api/models/{repo_id_api}/tree/main?recursive=true'
                    with urllib.request.urlopen(urllib.request.Request(tree_url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=3) as t_resp:
                        files_tree = json.loads(t_resp.read().decode())
                        for item in files_tree:
                            if item.get('type') == 'file':
                                path = item.get('path', '')
                                p_norm = norm(os.path.basename(path))
                                if u_norm == p_norm or u_norm in norm(path):
                                    found_matches.append((repo_id_api, path))
                except Exception:
                    pass
    except Exception as e:
        print(f'[HF SuperDownloader] Error en API search: {e}')
        
    if found_matches:
        unique = list(dict.fromkeys(found_matches))
        return unique[0][0], unique[0][1], unique

    return None, None, []

def run_download_worker(job):
    job.status = "downloading"
    job.start_time = time.time()
    job.logs.append(f"[START] Descargando {job.filename} desde {job.repo_id}...")
    job.logs.append(f"[TARGET] {job.target_path}")

    os.makedirs(job.target_path, exist_ok=True)
    env = dict(os.environ)
    env['HF_HUB_ENABLE_HF_TRANSFER'] = '1'

    cmd = [sys.executable, '-m', 'huggingface_hub.cli.hf', 'download', job.repo_id, job.filename, '--local-dir', job.target_path]

    progress_pattern = re.compile(r'(\d+(?:\.\d+)?)%\s*\|?.*?[\s\:]+([\d\.]+\s*[KMGT]?B/s|[\d\.]+\s*B/s)?\s*\[?([\d:]+)<([\d:]+)', re.IGNORECASE)
    fallback_speed_pattern = re.compile(r'([\d\.]+\s*[KMGT]?B/s)', re.IGNORECASE)
    fallback_pct_pattern = re.compile(r'(\d+(?:\.\d+)?)%', re.IGNORECASE)

    try:
        process = subprocess.Popen(
            cmd,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )
        job.process = process

        for line in process.stdout:
            if job.status == "cancelled":
                try:
                    process.terminate()
                except Exception:
                    pass
                break

            line_str = line.strip()
            if not line_str:
                continue

            job.logs.append(line_str)
            if len(job.logs) > 200:
                job.logs = job.logs[-150:]

            # Try to match tqdm / hf progress pattern
            match = progress_pattern.search(line_str)
            if match:
                job.progress = float(match.group(1))
                if match.group(2):
                    job.speed = match.group(2).strip()
                if match.group(4):
                    job.eta = match.group(4).strip()
            else:
                pct_match = fallback_pct_pattern.search(line_str)
                if pct_match:
                    job.progress = float(pct_match.group(1))
                spd_match = fallback_speed_pattern.search(line_str)
                if spd_match:
                    job.speed = spd_match.group(1).strip()

        process.wait()
        if job.status == "cancelled":
            job.logs.append("[CANCELLED] Descarga cancelada por el usuario.")
        elif process.returncode == 0:
            job.status = "completed"
            job.progress = 100.0
            job.speed = "0 B/s"
            job.eta = "00:00"
            job.logs.append("[OK] DESCARGA COMPLETADA CON EXITO!")
        else:
            job.logs.append(f"[!] Falló la descarga con huggingface-cli (código {process.returncode}). Intentando fallback con urllib...")
            
            # Fallback direct download
            endpoint = os.environ.get("HF_ENDPOINT", "https://huggingface.co").rstrip("/")
            file_url = f"{endpoint}/{job.repo_id}/resolve/main/{job.filename}"
            dest_file = os.path.join(job.target_path, os.path.basename(job.filename))

            req = urllib.request.Request(file_url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req) as response, open(dest_file, 'wb') as out_file:
                total_size = int(response.info().get('Content-Length', 0))
                job.total_bytes = total_size
                downloaded = 0
                chunk_size = 128 * 1024
                start_t = time.time()
                last_t = start_t
                last_bytes = 0

                while job.status != "cancelled":
                    buffer = response.read(chunk_size)
                    if not buffer:
                        break
                    out_file.write(buffer)
                    downloaded += len(buffer)
                    job.downloaded_bytes = downloaded
                    now = time.time()

                    if total_size > 0:
                        job.progress = (downloaded / total_size) * 100

                    if now - last_t >= 0.5:
                        dt = now - last_t
                        db = downloaded - last_bytes
                        speed_bps = db / dt if dt > 0 else 0
                        if speed_bps > 1024 * 1024:
                            job.speed = f"{speed_bps / (1024*1024):.2f} MB/s"
                        elif speed_bps > 1024:
                            job.speed = f"{speed_bps / 1024:.1f} KB/s"
                        else:
                            job.speed = f"{speed_bps:.0f} B/s"

                        if total_size > 0 and speed_bps > 0:
                            rem_bytes = total_size - downloaded
                            rem_sec = int(rem_bytes / speed_bps)
                            mins, secs = divmod(rem_sec, 60)
                            hrs, mins = divmod(mins, 60)
                            if hrs > 0:
                                job.eta = f"{hrs:02d}:{mins:02d}:{secs:02d}"
                            else:
                                job.eta = f"{mins:02d}:{secs:02d}"

                        last_t = now
                        last_bytes = downloaded

                if job.status != "cancelled":
                    job.status = "completed"
                    job.progress = 100.0
                    job.speed = "0 B/s"
                    job.eta = "00:00"
                    job.logs.append(f"[OK] Fallback exitoso. Descargado en: {dest_file}")
                else:
                    job.logs.append("[CANCELLED] Descarga cancelada por el usuario.")
    except Exception as e:
        if job.status != "cancelled":
            job.status = "error"
            job.logs.append(f"[X] Error de ejecución: {str(e)}")
    finally:
        job.process = None

# Register Server API Routes
def init_routes():
    if not hasattr(PromptServer, 'instance') or PromptServer.instance is None:
        return
    
    routes = PromptServer.instance.routes

    @routes.get("/hf_superdownloader/folders")
    async def get_folders(request):
        comfy_root, dirs = load_config()
        folder_list = []
        for k, v in dirs.items():
            folder_list.append({"id": k, "name": v[0], "path": v[1]})
        return web.json_response({"comfy_root": comfy_root, "folders": folder_list})

    @routes.post("/hf_superdownloader/folders/save")
    async def save_folders_endpoint(request):
        data = await request.json()
        folder_id = data.get("id")
        name = data.get("name")
        path = data.get("path")
        
        if not name or not path:
            return web.json_response({"success": False, "error": "Nombre y ruta requeridos"})
            
        comfy_root, dirs = load_config()
        if not folder_id:
            folder_id = name.lower().replace(' ', '_')
            
        dirs[folder_id] = [name, path]
        save_config(comfy_root, dirs)
        return web.json_response({"success": True})

    @routes.post("/hf_superdownloader/folders/delete")
    async def delete_folder_endpoint(request):
        data = await request.json()
        folder_id = data.get("id")
        comfy_root, dirs = load_config()
        if folder_id in dirs:
            del dirs[folder_id]
            save_config(comfy_root, dirs)
            return web.json_response({"success": True})
        return web.json_response({"success": False, "error": "Carpeta no encontrada"})

    @routes.get("/hf_superdownloader/comfy_root")
    async def get_comfy_root_endpoint(request):
        comfy_root, _ = load_config()
        return web.json_response({"comfy_root": comfy_root})

    @routes.post("/hf_superdownloader/comfy_root")
    async def set_comfy_root_endpoint(request):
        data = await request.json()
        root_path = data.get("root_path", "").strip()
        if not root_path or not os.path.exists(root_path):
            return web.json_response({"success": False, "error": "El directorio especificado no existe"})
            
        abs_root = os.path.abspath(root_path)
        discovered = auto_discover_folders(abs_root)
        save_config(abs_root, discovered)
        
        folder_list = []
        for k, v in discovered.items():
            folder_list.append({"id": k, "name": v[0], "path": v[1]})
            
        return web.json_response({
            "success": True,
            "comfy_root": abs_root,
            "folders": folder_list
        })

    @routes.post("/hf_superdownloader/search")
    async def search_endpoint(request):
        data = await request.json()
        query = data.get("query", "").strip()
        if not query:
            return web.json_response({"success": False, "error": "Búsqueda vacía"})

        repo_id, filename, matches = search_hf_auto(query)
        if not repo_id or not filename:
            return web.json_response({"success": False, "error": f"No se encontró el archivo '{query}' en Hugging Face"})

        match_list = [{"repo_id": r, "filename": f} for r, f in matches]
        return web.json_response({
            "success": True,
            "repo_id": repo_id,
            "filename": filename,
            "matches": match_list
        })

    @routes.post("/hf_superdownloader/download")
    async def download_endpoint(request):
        data = await request.json()
        repo_id = data.get("repo_id")
        filename = data.get("filename")
        target_path = data.get("target_path")
        
        if not repo_id or not filename or not target_path:
            return web.json_response({"success": False, "error": "Parámetros incompletos"})
            
        job_id = str(uuid.uuid4())[:8]
        job = DownloadJob(job_id, repo_id, filename, target_path)
        active_downloads[job_id] = job

        t = threading.Thread(target=run_download_worker, args=(job,), daemon=True)
        t.start()
        
        return web.json_response({"success": True, "job_id": job_id, "message": "Descarga iniciada"})

    @routes.get("/hf_superdownloader/status")
    async def status_endpoint(request):
        jobs_dict = {jid: job.to_dict() for jid, job in active_downloads.items()}
        return web.json_response({"jobs": jobs_dict})

    @routes.post("/hf_superdownloader/cancel")
    async def cancel_endpoint(request):
        data = await request.json()
        job_id = data.get("job_id")
        if job_id in active_downloads:
            job = active_downloads[job_id]
            job.status = "cancelled"
            if job.process:
                try:
                    job.process.terminate()
                except Exception:
                    pass
            return web.json_response({"success": True})
        return web.json_response({"success": False, "error": "Trabajo no encontrado"})

    @routes.post("/hf_superdownloader/clear_completed")
    async def clear_completed_endpoint(request):
        to_delete = [jid for jid, job in active_downloads.items() if job.status in ["completed", "error", "cancelled"]]
        for jid in to_delete:
            del active_downloads[jid]
        return web.json_response({"success": True, "cleared": len(to_delete)})

init_routes()

NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

print("[HF SuperDownloader] Custom Node backend loaded successfully with Multi-Download & ETA support!")
