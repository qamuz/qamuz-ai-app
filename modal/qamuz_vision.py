"""
QAMUZ Vision on Modal: images (FLUX / SDXL / any diffusers text-to-image model) and
image-to-video clips (Stable Video Diffusion), on one A100.

Deploy:   modal deploy modal/qamuz_vision.py
Web API:  https://<workspace>--qamuz-vision-api.modal.run  (shown after deploy)

Qamuz talks to the API with "Authorization: Bearer <QAMUZ_SERVICE_TOKEN>":
  POST /submit            {"task": "image"|"video"|"lyrics", "job_id": "...", "input": {...}}  -> {"call_id": "...", "status": "QUEUED"}
  GET  /status/{call_id}  -> {"status": "PROCESSING"} | {"status": "SUCCESS", "output": "data:..."} | {"status": "FAILED", "error": "..."}
  GET  /health            -> {"ok": true}
  POST /infer             synchronous endpoint (capability qamuz-image / qamuz-video / qamuz-lyrics)

The token lives in the Modal secret "qamuz-service" (key QAMUZ_SERVICE_TOKEN).
"""

import base64
import io
import ipaddress
import os
import re
import secrets as pysecrets
import socket
import tempfile
import urllib.parse
from typing import Optional

import modal

app = modal.App("qamuz-vision")

# Models are cached on a Modal Volume so they download once.
model_cache = modal.Volume.from_name("qamuz-models-cache", create_if_missing=True)
CACHE_DIR = "/model-cache"

DEFAULT_IMAGE_MODEL = "black-forest-labs/FLUX.1-schnell"
DEFAULT_VIDEO_MODEL = "stabilityai/stable-video-diffusion-img2vid-xt"

ALIASES = {
    "qamuz-image-flux": "black-forest-labs/FLUX.1-schnell",
    "qamuz-image-flux-dev": "black-forest-labs/FLUX.1-dev",
    "qamuz-image-art": "stabilityai/stable-diffusion-xl-base-1.0",
    "qamuz-video-svd": "stabilityai/stable-video-diffusion-img2vid-xt",
}

# Output sizes per aspect ratio (multiples of 16, HD/2K quality optimized for A100).
IMAGE_SIZES = {
    "1:1": (1024, 1024),
    "16:9": (1792, 1024),
    "9:16": (1024, 1792),
    "4:3": (1152, 896),
    "3:4": (896, 1152),
    "3:2": (1536, 1024),
    "2:3": (1024, 1536),
    "5:4": (1280, 1024),
    "4:5": (1024, 1280),
    "21:9": (1792, 768),
    "9:21": (768, 1792),
}

# Stable Video Diffusion works best near 1024x576 or 768x768.
VIDEO_SIZES = {
    "16:9": (1024, 576),
    "9:16": (576, 1024),
    "1:1": (768, 768),
    "4:3": (896, 672),
    "3:4": (672, 896),
    "3:2": (1024, 688),
    "2:3": (688, 1024),
    "21:9": (1024, 448),
}

RATIO_TO_ASPECT = {
    "1280:720": "16:9",
    "720:1280": "9:16",
    "960:960": "1:1",
    "1104:832": "4:3",
    "832:1104": "3:4",
    "1584:672": "21:9",
}

vision_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "libsm6", "libxext6")
    .pip_install(
        "torch>=2.4.0",
        "diffusers>=0.30.0",
        "transformers>=4.44.0",
        "accelerate>=0.33.0",
        "sentencepiece>=0.2.0",
        "safetensors>=0.4.4",
        "Pillow",
        "opencv-python-headless",
        "imageio>=2.34",  # H.264 MP4 that browsers can play
        "imageio-ffmpeg>=0.5",
        "fastapi[standard]",
        "invisible_watermark>=0.2.0",
    )
)

# Separate worker keeps lyric writing independent of the image/video diffusion
# pipeline and loads only when a lyric request arrives.
lyrics_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "torch>=2.4.0",
        "transformers>=4.44.0",
        "accelerate>=0.33.0",
        "sentencepiece>=0.2.0",
        "safetensors>=0.4.4",
    )
)

# The web API only queues work, so it runs on a fast CPU container.
web_image = modal.Image.debian_slim(python_version="3.11").pip_install("fastapi[standard]")


ALLOWED_MODELS = set(ALIASES.values()) | {DEFAULT_IMAGE_MODEL, DEFAULT_VIDEO_MODEL}
MAX_REMOTE_IMAGE_BYTES = 15 * 1024 * 1024
SAFE_CALL_ID_RE = re.compile(r"^[a-zA-Z0-9._-]{4,128}$")


def resolve_model(model_id: Optional[str], default: str) -> str:
    model_id = (model_id or "").strip()
    if not model_id:
        return default
    resolved = ALIASES.get(model_id, model_id)
    if resolved not in ALLOWED_MODELS:
        raise ValueError(f"Model not allowed: {model_id}")
    return resolved


def pick_seed(seed) -> int:
    try:
        seed = int(seed)
    except (TypeError, ValueError):
        seed = -1
    return seed if seed >= 0 else pysecrets.randbelow(2**31 - 1)


def _validate_public_image_url(url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in ("https", "http"):
        raise ValueError("Unsupported image URL scheme")
    if parsed.username or parsed.password:
        raise ValueError("URL credentials are not allowed")
    host = (parsed.hostname or "").strip().lower()
    if (
        not host
        or host == "localhost"
        or host.endswith(".local")
        or host.endswith(".internal")
        or host == "metadata.google.internal"
    ):
        raise ValueError("Internal image host is not allowed")
    infos = socket.getaddrinfo(host, None)
    if not infos:
        raise ValueError("Could not resolve image host")
    for info in infos:
        ip_obj = ipaddress.ip_address(info[4][0])
        if (
            ip_obj.is_private
            or ip_obj.is_loopback
            or ip_obj.is_link_local
            or ip_obj.is_multicast
            or ip_obj.is_reserved
            or ip_obj.is_unspecified
        ):
            raise ValueError("Private or reserved IP address is not allowed")
    return url


def load_image_bytes(image: str) -> bytes:
    """Accept a data URI, raw base64 or a validated public http(s) URL."""
    image = (image or "").strip()
    if image.startswith("http://") or image.startswith("https://"):
        import urllib.request

        safe_url = _validate_public_image_url(image)
        req = urllib.request.Request(safe_url, headers={"User-Agent": "qamuz-vision/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            final_url = resp.geturl()
            if final_url and final_url != safe_url:
                _validate_public_image_url(final_url)
            raw = resp.read(MAX_REMOTE_IMAGE_BYTES + 1)
            if len(raw) > MAX_REMOTE_IMAGE_BYTES:
                raise ValueError("Image exceeds maximum allowed size (15 MB)")
            return raw
    if "," in image and image.startswith("data:"):
        image = image.split(",", 1)[1]
    raw = base64.b64decode(image)
    if len(raw) > MAX_REMOTE_IMAGE_BYTES:
        raise ValueError("Decoded image exceeds maximum allowed size (15 MB)")
    return raw


@app.cls(
    gpu="A100",
    image=vision_image,
    scaledown_window=300,
    timeout=900,
    volumes={CACHE_DIR: model_cache},
    secrets=[modal.Secret.from_name("huggingface-token")],
)
class QamuzVisionEngine:
    @modal.enter()
    def setup(self):
        self.current_pipeline_id = None
        self.pipe = None

    def _clear_vram(self):
        """Frees VRAM before switching models."""
        import gc
        import torch

        if self.pipe is not None:
            print(f"Offloading previous model: {self.current_pipeline_id}")
            del self.pipe
            self.pipe = None
            self.current_pipeline_id = None
            gc.collect()
            torch.cuda.empty_cache()

    def _load_model(self, model_id: str, is_video: bool = False):
        """Loads a model from the Hugging Face cache, swapping out the previous one."""
        import torch
        from diffusers import AutoPipelineForText2Image, StableVideoDiffusionPipeline

        if self.current_pipeline_id == model_id and self.pipe is not None:
            return self.pipe
        self._clear_vram()
        print(f"Loading model into VRAM: {model_id}")
        try:
            if is_video:
                if "svd" in model_id.lower() or "stable-video-diffusion" in model_id.lower():
                    self.pipe = StableVideoDiffusionPipeline.from_pretrained(
                        model_id, torch_dtype=torch.float16, variant="fp16", cache_dir=CACHE_DIR
                    )
                    self.pipe.enable_model_cpu_offload()  # SVD is memory-heavy
                else:
                    raise ValueError(f"Video model architecture not supported yet: {model_id}")
            else:
                dtype = torch.bfloat16 if "flux" in model_id.lower() or "sd3" in model_id.lower() else torch.float16
                self.pipe = AutoPipelineForText2Image.from_pretrained(
                    model_id, torch_dtype=dtype, cache_dir=CACHE_DIR
                ).to("cuda")
            self.current_pipeline_id = model_id
            model_cache.commit()
            return self.pipe
        except Exception:
            self._clear_vram()
            raise

    # ---------------- plain Python helpers (shared by the methods) ----------------

    def _image(self, prompt, width, height, model_id, seed, negative_prompt="", steps=None, guidance=None):
        import torch

        model_id = resolve_model(model_id, DEFAULT_IMAGE_MODEL)
        pipe = self._load_model(model_id, is_video=False)
        name = model_id.lower()

        # Calibrated parameters: Schnell runs at 6 steps for boosted clarity, Dev at 28 steps
        if steps is None:
            if "schnell" in name:
                steps = 6
            elif "turbo" in name:
                steps = 6
            elif "flux" in name:
                steps = 28
            else:
                steps = 30

        if guidance is None:
            if "schnell" in name:
                guidance = 0.0
            elif "turbo" in name:
                guidance = 1.0
            elif "flux" in name:
                guidance = 3.5
            else:
                guidance = 7.5

        width, height = int(width) // 16 * 16, int(height) // 16 * 16
        generator = torch.Generator("cpu" if "flux" in name else "cuda").manual_seed(pick_seed(seed))
        kwargs = dict(
            prompt=prompt,
            num_inference_steps=int(steps),
            guidance_scale=float(guidance),
            width=width,
            height=height,
            generator=generator,
        )
        if negative_prompt and "flux" not in name:
            kwargs["negative_prompt"] = negative_prompt
        try:
            return pipe(**kwargs).images[0]
        except torch.cuda.OutOfMemoryError:
            self._clear_vram()
            raise Exception("GPU out of memory. The model might be too large or the resolution too high.")

    def _video(
        self,
        image,
        width,
        height,
        fps=12,
        model_id=DEFAULT_VIDEO_MODEL,
        seed=-1,
        motion=62,
        num_frames=25,
        noise_aug_strength=0.015,
    ):
        import subprocess
        import torch
        from PIL import Image, ImageOps
        from diffusers.utils import export_to_video

        model_id = resolve_model(model_id, DEFAULT_VIDEO_MODEL)
        pipe = self._load_model(model_id, is_video=True)
        # Aspect-ratio preserving center crop (prevents stretching faces/bodies)
        image = ImageOps.fit(
            image.convert("RGB"),
            (int(width), int(height)),
            method=Image.Resampling.LANCZOS,
        )

        # Calibrate SVD-XT conditioning for realistic, non-jumping live-action motion:
        # SVD-XT is natively conditioned around fps=6..8 and motion_bucket_id=45..85.
        safe_motion = max(20, min(115, int(motion)))
        safe_noise = max(0.005, min(0.06, float(noise_aug_strength)))
        svd_cond_fps = 7
        export_fps = max(8, min(24, int(fps)))
        generator = torch.Generator(device="cpu").manual_seed(pick_seed(seed))

        try:
            frames = pipe(
                image,
                width=int(width),
                height=int(height),
                num_frames=int(num_frames),
                decode_chunk_size=4,
                motion_bucket_id=safe_motion,
                fps=svd_cond_fps,
                noise_aug_strength=safe_noise,
                num_inference_steps=25,
                generator=generator,
            ).frames[0]
        except torch.cuda.OutOfMemoryError:
            self._clear_vram()
            raise Exception("GPU out of memory while rendering video. Try a smaller resolution or fewer frames.")

        raw_tmp = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
        raw_path = raw_tmp.name
        raw_tmp.close()
        smooth_tmp = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
        smooth_path = smooth_tmp.name
        smooth_tmp.close()
        try:
            export_to_video(frames, raw_path, fps=export_fps)
            # Re-encode with smooth temporal frame blending to 24fps H.264 yuv420p +faststart
            # so every browser plays seamlessly without stuttering or frame jumps.
            ffmpeg_cmd = [
                "ffmpeg",
                "-y",
                "-i",
                raw_path,
                "-vf",
                "minterpolate=fps=24:mi_mode=blend",
                "-c:v",
                "libx264",
                "-preset",
                "fast",
                "-crf",
                "19",
                "-pix_fmt",
                "yuv420p",
                "-movflags",
                "+faststart",
                smooth_path,
            ]
            proc = subprocess.run(ffmpeg_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=60)
            final_path = smooth_path if proc.returncode == 0 and os.path.getsize(smooth_path) > 1024 else raw_path
            with open(final_path, "rb") as f:
                return f.read()
        finally:
            for p in (raw_path, smooth_path):
                try:
                    os.unlink(p)
                except OSError:
                    pass

    # ---------------- methods (callable from the web API or Python) ----------------

    @modal.method()
    def generate_image(
        self,
        prompt: str,
        width: int = 1024,
        height: int = 1024,
        model_id: str = DEFAULT_IMAGE_MODEL,
        seed: int = -1,
        negative_prompt: str = "",
        steps: Optional[int] = None,
        guidance: Optional[float] = None,
    ) -> str:
        """Text-to-image with boosted FLUX/SDXL quality. Returns a PNG data URI."""
        image = self._image(prompt, width, height, model_id, seed, negative_prompt, steps, guidance)
        buf = io.BytesIO()
        image.save(buf, format="PNG")
        return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("utf-8")

    @modal.method()
    def generate_video(
        self,
        image_b64: str = "",
        fps: int = 12,
        model_id: str = DEFAULT_VIDEO_MODEL,
        prompt: str = "",
        width: int = 1024,
        height: int = 576,
        seed: int = -1,
        motion: int = 62,
        image_model_id: str = DEFAULT_IMAGE_MODEL,
        num_frames: int = 25,
        noise_aug_strength: float = 0.015,
    ) -> str:
        """Image-to-video with smooth 24fps interpolated H.264 output. Returns an MP4 data URI."""
        from PIL import Image

        if image_b64:
            start = Image.open(io.BytesIO(load_image_bytes(image_b64)))
        elif prompt:
            start = self._image(prompt, width, height, image_model_id, seed)
        else:
            raise ValueError("Send an image or a prompt for the video.")

        video = self._video(
            start,
            width,
            height,
            fps,
            model_id,
            seed,
            motion,
            num_frames,
            noise_aug_strength,
        )
        return "data:video/mp4;base64," + base64.b64encode(video).decode("utf-8")


@app.cls(
    gpu="A100",
    image=lyrics_image,
    scaledown_window=300,
    timeout=600,
    volumes={CACHE_DIR: model_cache},
    secrets=[modal.Secret.from_name("huggingface-token")],
)
class QamuzLyricsEngine:
    """Master songwriting and lyrics engine powered by Qwen 2.5 7B Instruct."""

    @modal.enter()
    def setup(self):
        import os
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer

        token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACEHUB_API_TOKEN")
        model_id = "Qwen/Qwen2.5-7B-Instruct"
        self.tokenizer = AutoTokenizer.from_pretrained(model_id, token=token, cache_dir=CACHE_DIR)
        self.model = AutoModelForCausalLM.from_pretrained(
            model_id, torch_dtype=torch.bfloat16, device_map="auto", token=token, cache_dir=CACHE_DIR
        )
        model_cache.commit()

    @modal.method()
    def write_lyrics(
        self,
        idea: str,
        style: str = "",
        title: str = "",
        lyrics: str = "",
        mode: str = "lyrics",
        language: str = "es",
    ) -> dict:
        import json
        import re

        modes = {
            "lyrics": "Write full commercial-quality song lyrics from the user's idea.",
            "optimize": "Polish the user's lyrics for perfect rhyme, rhythm, cadence and singability while preserving meaning and language.",
            "style": "Improve the musical style description (genre, BPM, mood, instrumentation) to complement the lyrics.",
            "agent": "Plan a complete song concept (themes, hook, chord progression feel) and write its full lyrics.",
        }
        instruction = modes.get(mode, modes["lyrics"])
        system = (
            "You are Qamuz's master songwriting and musical composition engine. Create original, commercially viable, and emotionally resonant lyrics. "
            "Never quote or copy copyrighted artist lyrics. Adapt perfectly to the requested musical genre (Bachata, Merengue, Dembow, Reggaeton, Trap Latino, Pop, Rock, R&B, EDM, etc.). "
            "For Latin genres like Bachata, utilize authentic Dominican song structures with standard tags: [Intro], [Canto 1], [Coro], [Canto 2], [Mambo], [Coro final], [Outro]. "
            "For general genres: [Intro], [Verse 1], [Pre-Chorus], [Chorus], [Verse 2], [Pre-Chorus], [Chorus], [Bridge], [Chorus], [Outro]. "
            "Maintain natural meter, singable syllable cadence, authentic rhyming schemes, and rhythmic cues. "
            'Return only valid JSON: {"title": string, "style": string, "lyrics": string, "instrumental": boolean}.'
        )
        user = (
            f"Task: {instruction}\nLanguage hint: {language or 'Spanish'}\nIdea: {idea[:2000]}\n"
            f"Style: {style[:500]}\nTitle: {title[:80]}\nExisting lyrics: {lyrics[:5000]}"
        )
        messages = [{"role": "system", "content": system}, {"role": "user", "content": user}]
        text = self.tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        inputs = self.tokenizer(text, return_tensors="pt").to(self.model.device)

        # Boosted generation tokens (2500) and repetition penalty (1.12) for rich vocabulary
        output = self.model.generate(
            **inputs,
            max_new_tokens=2500,
            do_sample=True,
            temperature=0.72,
            top_p=0.92,
            repetition_penalty=1.12,
        )
        answer = self.tokenizer.decode(output[0][inputs["input_ids"].shape[-1]:], skip_special_tokens=True)
        match = re.search(r"\{.*\}", answer, re.S)
        if not match:
            raise ValueError("Lyrics model returned invalid JSON")
        data = json.loads(match.group(0))
        return {
            "title": str(data.get("title") or title)[:80],
            "style": str(data.get("style") or style)[:500],
            "lyrics": str(data.get("lyrics") or lyrics)[:5000],
            "instrumental": bool(data.get("instrumental", False)),
        }


# ======================================================================
# Web API for Qamuz
# ======================================================================


@app.function(image=web_image, secrets=[modal.Secret.from_name("qamuz-service")], timeout=120)
@modal.asgi_app(label="qamuz-vision-api")
def api():
    from fastapi import Depends, FastAPI, HTTPException, Request

    web = FastAPI(title="QAMUZ Vision API")

    def check_auth(request: Request):
        expected = os.environ.get("QAMUZ_SERVICE_TOKEN", "")
        if not expected:
            raise HTTPException(status_code=503, detail="QAMUZ_SERVICE_TOKEN is not set in the Modal secret qamuz-service.")
        given = request.headers.get("Authorization", "")
        if not pysecrets.compare_digest(given, f"Bearer {expected}"):
            raise HTTPException(status_code=401, detail="Unauthorized")

    def image_args(inp: dict) -> dict:
        aspect = str(inp.get("aspect_ratio") or "1:1")
        width, height = IMAGE_SIZES.get(aspect, IMAGE_SIZES["1:1"])
        if inp.get("width") and inp.get("height"):
            width, height = int(inp["width"]), int(inp["height"])
        width, height = max(256, min(2048, width)), max(256, min(2048, height))
        steps = max(1, min(50, int(inp["steps"]))) if inp.get("steps") else None
        guidance = max(0.0, min(20.0, float(inp["guidance"]))) if inp.get("guidance") else None
        return dict(
            prompt=str(inp.get("prompt") or "").strip()[:1500],
            width=width,
            height=height,
            model_id=resolve_model(inp.get("model_id"), DEFAULT_IMAGE_MODEL),
            seed=inp.get("seed", -1),
            negative_prompt=str(inp.get("negative_prompt") or "")[:600],
            steps=steps,
            guidance=guidance,
        )

    def video_args(inp: dict) -> dict:
        aspect = str(inp.get("aspect_ratio") or RATIO_TO_ASPECT.get(str(inp.get("ratio") or ""), "16:9"))
        width, height = VIDEO_SIZES.get(aspect, VIDEO_SIZES["16:9"])
        raw_motion = inp.get("motion")
        motion = max(20, min(115, int(raw_motion))) if raw_motion is not None else 62
        raw_noise = inp.get("noise_aug_strength")
        noise_aug = max(0.005, min(0.06, float(raw_noise))) if raw_noise is not None else 0.015
        return dict(
            image_b64=str(inp.get("image_b64") or inp.get("image") or inp.get("image_url") or ""),
            fps=max(6, min(24, int(inp.get("fps") or 12))),
            model_id=resolve_model(inp.get("model_id"), DEFAULT_VIDEO_MODEL),
            prompt=str(inp.get("prompt") or "").strip(),
            width=width,
            height=height,
            seed=inp.get("seed", -1),
            motion=motion,
            image_model_id=resolve_model(inp.get("image_model_id"), DEFAULT_IMAGE_MODEL),
            num_frames=max(14, min(25, int(inp.get("num_frames") or 25))),
            noise_aug_strength=noise_aug,
        )

    @web.get("/health")
    def health():
        return {
            "ok": True,
            "token_set": bool(os.environ.get("QAMUZ_SERVICE_TOKEN")),
            "workspace": "qamuzstudio",
            "gpu": "A100",
            "models": list(ALIASES.keys()),
        }

    @web.post("/submit", dependencies=[Depends(check_auth)])
    async def submit(request: Request):
        body = await request.json()
        task = str(body.get("task") or "image")
        inp = body.get("input") or {}
        engine = QamuzVisionEngine()
        if task == "image":
            args = image_args(inp)
            if not args["prompt"]:
                raise HTTPException(status_code=400, detail="Missing prompt")
            call = await engine.generate_image.spawn.aio(**args)
        elif task == "video":
            args = video_args(inp)
            if not args["image_b64"] and not args["prompt"]:
                raise HTTPException(status_code=400, detail="Send an image or a prompt for the video")
            call = await engine.generate_video.spawn.aio(**args)
        elif task == "lyrics":
            args = {
                "idea": str(inp.get("idea") or "").strip()[:2000],
                "style": str(inp.get("style") or "").strip()[:500],
                "title": str(inp.get("title") or "").strip()[:80],
                "lyrics": str(inp.get("lyrics") or "").strip()[:5000],
                "mode": str(inp.get("mode") or "lyrics"),
                "language": str(inp.get("language") or "es")[:20],
            }
            if not args["idea"] and not args["lyrics"] and not args["style"]:
                raise HTTPException(status_code=400, detail="Describe the song or provide lyrics")
            call = await QamuzLyricsEngine().write_lyrics.spawn.aio(**args)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported task: {task}")
        return {"call_id": call.object_id, "status": "QUEUED", "task": task}

    @web.get("/status/{call_id}", dependencies=[Depends(check_auth)])
    async def status(call_id: str):
        if not SAFE_CALL_ID_RE.match(call_id):
            raise HTTPException(status_code=400, detail="Invalid call_id")
        function_timeout = getattr(modal.exception, "FunctionTimeoutError", None)
        try:
            call = modal.FunctionCall.from_id(call_id)
            result = await call.get.aio(timeout=0)
        except Exception as e:
            if function_timeout and isinstance(e, function_timeout):
                return {"status": "FAILED", "error": "The generation took too long on Modal."}
            if isinstance(e, (TimeoutError, getattr(modal.exception, "TimeoutError", TimeoutError))):
                return {"status": "PROCESSING"}  # still running
            if isinstance(e, getattr(modal.exception, "OutputExpiredError", ())):
                return {"status": "FAILED", "error": "The result expired on Modal."}
            return {"status": "FAILED", "error": str(e)[:500] or e.__class__.__name__}
        if isinstance(result, dict):
            return {"status": "SUCCESS", "type": "lyrics", "output": result}
        kind = "video" if str(result).startswith("data:video") else "image"
        return {"status": "SUCCESS", "type": kind, "output": result}

    @web.post("/infer", dependencies=[Depends(check_auth)])
    async def infer(request: Request):
        """Synchronous endpoint (waits for result)."""
        body = await request.json()
        capability = body.get("capability")
        engine = QamuzVisionEngine()
        if capability == "qamuz-image":
            prompt = str(body.get("prompt") or "")
            if not prompt:
                raise HTTPException(status_code=400, detail="Missing prompt")
            args = image_args({**body, "prompt": prompt})
            result = await engine.generate_image.remote.aio(**args)
            return {"status": "success", "result": result, "type": "image"}
        if capability == "qamuz-lyrics":
            inp = body.get("input") or body
            result = await QamuzLyricsEngine().write_lyrics.remote.aio(
                idea=str(inp.get("idea") or "")[:2000],
                style=str(inp.get("style") or "")[:500],
                title=str(inp.get("title") or "")[:80],
                lyrics=str(inp.get("lyrics") or "")[:5000],
                mode=str(inp.get("mode") or "lyrics"),
                language=str(inp.get("language") or "es")[:20],
            )
            return {"status": "success", "result": result, "type": "lyrics"}
        if capability == "qamuz-video":
            args = video_args(body)
            if not args["image_b64"] and not args["prompt"]:
                raise HTTPException(status_code=400, detail="Must provide either image_b64 or prompt for video")
            result = await engine.generate_video.remote.aio(**args)
            return {"status": "success", "result": result, "type": "video"}
        raise HTTPException(status_code=400, detail=f"Unsupported capability: {capability}")

    return web
