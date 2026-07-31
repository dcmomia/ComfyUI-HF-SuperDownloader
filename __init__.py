import os, sys, re, json, subprocess, urllib.request, threading
from aiohttp import web
from server import PromptServer

NODE_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_DIRECTORY = "./web"

CONFIG_FILE = os.path.join(os.path.expanduser('~'), '.hf_downloader_config.json')

DEFAULT_DIRS = {
    'loras': ['LoRAs', r'J:\Comfyui\AG COMFY\ComfyUI\models\loras'],
    'diffusion_models': ['Diffusion Models', r'J:\Comfyui\AG COMFY\ComfyUI\models\diffusion_models'],
    'checkpoints': ['Checkpoints', r'J:\Comfyui\AG COMFY\ComfyUI\models\checkpoints'],
    'vae': ['VAEs', r'J:\Comfyui\AG COMFY\ComfyUI\models\vae'],
    'controlnet': ['ControlNet', r'J:\Comfyui\AG COMFY\ComfyUI\models\controlnet']
}

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

# Global download state
active_download = {
    "is_running": False,
    "status": "idle",
    "logs": [],
    "process": None
}

def norm(s):
    if not s:
        return ""
    return re.sub(r'[\-_]', '', s.lower())

def load_dirs():
    dirs = dict(DEFAULT_DIRS)
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                saved = json.load(f)
                for k, v in saved.items():
                    key_clean = k.lower().replace(' ', '_')
                    dirs[key_clean] = v
        except Exception:
            pass
    return dirs

def save_all_dirs(dirs):
    with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump(dirs, f, indent=2)

def parse_hf_url(url_input):
    url_input = url_input.strip()
    m = re.match(r'https?://huggingface\.co/([^/]+/[^/]+)/(?:blob|resolve)/[^/]+/(.+)', url_input)
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
        if len(parts) >= 2 and not target_file.endswith('.safetensors') and not target_file.endswith('.ckpt'):
            r = parts[0] + '/' + parts[1]
            f = '/'.join(parts[2:]) if len(parts) > 2 else ""
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
        
    # 2. General Hugging Face API search
    words = [w for w in re.sub(r'[\._\-]', ' ', filename_only).split() if len(w) > 2 and w.lower() not in ['safetensors', 'ckpt', 'pth', 'bin']]
    search_query = '+'.join(words[:3]) if words else filename_only
    
    search_url = f'https://huggingface.co/api/models?search={search_query}&limit=15'
    try:
        req = urllib.request.Request(search_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            for m in data:
                r_id = m.get('id')
                try:
                    tree_url = f'https://huggingface.co/api/models/{r_id}/tree/main?recursive=true'
                    with urllib.request.urlopen(urllib.request.Request(tree_url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=3) as t_resp:
                        files_tree = json.loads(t_resp.read().decode())
                        for item in files_tree:
                            if item.get('type') == 'file':
                                path = item.get('path', '')
                                p_norm = norm(os.path.basename(path))
                                if u_norm == p_norm or u_norm in norm(path):
                                    found_matches.append((r_id, path))
                except Exception:
                    pass
    except Exception:
        pass
        
    if found_matches:
        unique = list(dict.fromkeys(found_matches))
        return unique[0][0], unique[0][1], unique

    return None, None, []

# Register Server API Routes
def init_routes():
    if not hasattr(PromptServer, 'instance') or PromptServer.instance is None:
        return
    
    routes = PromptServer.instance.routes

    @routes.get("/hf_superdownloader/folders")
    async def get_folders(request):
        dirs = load_dirs()
        folder_list = []
        for k, v in dirs.items():
            folder_list.append({"id": k, "name": v[0], "path": v[1]})
        return web.json_response({"folders": folder_list})

    @routes.post("/hf_superdownloader/folders/save")
    async def save_folders_endpoint(request):
        data = await request.json()
        folder_id = data.get("id")
        name = data.get("name")
        path = data.get("path")
        
        if not name or not path:
            return web.json_response({"success": False, "error": "Nombre y ruta requeridos"})
            
        dirs = load_dirs()
        if not folder_id:
            folder_id = name.lower().replace(' ', '_')
            
        dirs[folder_id] = [name, path]
        save_all_dirs(dirs)
        return web.json_response({"success": True})

    @routes.post("/hf_superdownloader/folders/delete")
    async def delete_folder_endpoint(request):
        data = await request.json()
        folder_id = data.get("id")
        dirs = load_dirs()
        if folder_id in dirs:
            del dirs[folder_id]
            save_all_dirs(dirs)
            return web.json_response({"success": True})
        return web.json_response({"success": False, "error": "Carpeta no encontrada"})

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

    def run_download_worker(repo_id, filename, target_path):
        global active_download
        active_download["is_running"] = True
        active_download["status"] = "downloading"
        active_download["logs"] = [f"[START] Descargando {filename} desde {repo_id}...", f"[TARGET] {target_path}"]
        
        os.makedirs(target_path, exist_ok=True)
        
        env = dict(os.environ)
        env['HF_HUB_ENABLE_HF_TRANSFER'] = '1'
        
        cmd = [sys.executable, '-m', 'huggingface_hub.cli.hf', 'download', repo_id, filename, '--local-dir', target_path]
        
        try:
            process = subprocess.Popen(
                cmd,
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1
            )
            active_download["process"] = process
            
            for line in process.stdout:
                line_str = line.strip()
                if line_str:
                    active_download["logs"].append(line_str)
                    if len(active_download["logs"]) > 200:
                        active_download["logs"] = active_download["logs"][-150:]
                        
            process.wait()
            if process.returncode == 0:
                active_download["status"] = "completed"
                active_download["logs"].append("[OK] DESCARGA COMPLETADA CON EXITO!")
            else:
                active_download["status"] = "error"
                active_download["logs"].append(f"[X] La descarga finalizó con código de error {process.returncode}")
        except Exception as e:
            active_download["status"] = "error"
            active_download["logs"].append(f"[X] Error de ejecución: {str(e)}")
        finally:
            active_download["is_running"] = False

    @routes.post("/hf_superdownloader/download")
    async def download_endpoint(request):
        global active_download
        if active_download["is_running"]:
            return web.json_response({"success": False, "error": "Ya hay una descarga en progreso"})
            
        data = await request.json()
        repo_id = data.get("repo_id")
        filename = data.get("filename")
        target_path = data.get("target_path")
        
        if not repo_id or not filename or not target_path:
            return web.json_response({"success": False, "error": "Parámetros incompletos"})
            
        t = threading.Thread(target=run_download_worker, args=(repo_id, filename, target_path), daemon=True)
        t.start()
        
        return web.json_response({"success": True, "message": "Descarga iniciada"})

    @routes.get("/hf_superdownloader/status")
    async def status_endpoint(request):
        return web.json_response({
            "is_running": active_download["is_running"],
            "status": active_download["status"],
            "logs": active_download["logs"]
        })

init_routes()

NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

print("[HF SuperDownloader] Custom Node backend loaded successfully!")
