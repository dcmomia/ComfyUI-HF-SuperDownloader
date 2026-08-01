# ComfyUI HF SuperDownloader

A lightweight native custom node for ComfyUI that integrates a draggable/resizable UI canvas overlay and speeds up downloading models directly from HuggingFace using Rust-based multithreaded downloads (`hf_transfer`).

## Key Features

- **Fast Downloads:** Powered by HuggingFace's Rust-based `hf_transfer` backend to maximize your network bandwidth.
- **Smart Auto-Search:** Simply type or paste any filename (e.g., `ltx_2.3_22b_distilled_1.1_lora_dynamic_fro09_avg_rank_111_bf16.safetensors`), and it automatically finds the exact HuggingFace repository and internal path.
- **Automatic Folder & Root Discovery:** Upon installation, it automatically detects your ComfyUI root installation and auto-discovers all model directories (`checkpoints`, `loras`, `diffusion_models`, `text_encoders`, `vae`, `controlnet`, `clip`, `unet`, `upscale_models`, `embeddings`, etc.).
- **In-UI Root & Folder Manager:** Easily change your ComfyUI Base Root directory or add custom model target paths right from the tool interface.
- **Canvas Overlay Button:** A floating circular action button on your ComfyUI canvas that you can drag anywhere and resize in a fixed 1:1 ratio. Remembers position and size across page reloads.
- **Live Terminal Console:** Real-time terminal output streaming inside the modal UI showing download progress and speed (MB/s).

## Installation

### Method 1: Git Clone (Recommended)

1. Open your terminal and navigate to your `ComfyUI/custom_nodes/` directory:
   ```bash
   cd ComfyUI/custom_nodes
   ```
2. Clone this repository:
   ```bash
   git clone https://github.com/dcmomia/ComfyUI-HF-SuperDownloader.git
   ```
3. Install the required Python dependencies:
   ```bash
   pip install huggingface_hub hf_transfer aiohttp
   ```
4. Restart ComfyUI and refresh your browser tab (`Ctrl + Shift + R`).

---

## Usage

1. Click the floating Hugging Face icon on your ComfyUI canvas (drag to move, drag corners to resize).
2. Select your target destination folder (e.g., `LoRAs`, `Diffusion Models`, `Checkpoints`).
3. Paste a HuggingFace URL or simply type a model filename.
4. Click **Search** to resolve the repository, then click **Download**.
5. Go to **Gestionar Directorios** to auto-detect subfolders or set a custom ComfyUI root path.

---

## License

This project is licensed under the [MIT License](LICENSE).
