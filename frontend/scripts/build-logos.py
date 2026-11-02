import os
import base64
import numpy as np
from PIL import Image

FRONTEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT_DIR = os.path.dirname(FRONTEND)
BACKEND = os.path.join(ROOT_DIR, 'backend')
NEW_LOGOS = os.path.join(ROOT_DIR, 'noviq new logos')
NEW_DIR = os.path.join(NEW_LOGOS, 'New')
LOGO_DIR = os.path.join(FRONTEND, 'public', 'logo')
PUBLIC_DIR = os.path.join(FRONTEND, 'public')
ANGLES_DIR = os.path.join(LOGO_DIR, 'angles')
PROCESSED_DIR = os.path.join(NEW_LOGOS, 'processed')
ADMIN_LOGO_DIR = os.path.join(BACKEND, 'admin', 'logo')

os.makedirs(LOGO_DIR, exist_ok=True)
os.makedirs(ANGLES_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)
os.makedirs(ADMIN_LOGO_DIR, exist_ok=True)

def crop_to_alpha(img, thresh=10):
    arr = np.array(img)
    if arr.ndim < 3 or arr.shape[2] < 4:
        return img
    alpha = arr[:, :, 3]
    ys, xs = np.where(alpha > thresh)
    if len(xs) == 0 or len(ys) == 0:
        return img
    return img.crop((int(xs.min()), int(ys.min()), int(xs.max() + 1), int(ys.max() + 1)))

def resize_max_dim(img, max_dim):
    w, h = img.size
    scale = max_dim / float(max(w, h))
    if scale >= 1.0:
        return img
    new_w = max(1, int(round(w * scale)))
    new_h = max(1, int(round(h * scale)))
    return img.resize((new_w, new_h), Image.Resampling.LANCZOS)

def main():
    icon_src = os.path.join(NEW_DIR, 'icon-master.png')
    wordmark_src = os.path.join(NEW_DIR, 'wordmark-master.png')

    if not os.path.exists(icon_src):
        raise FileNotFoundError(f"Icon master not found at {icon_src}")
    if not os.path.exists(wordmark_src):
        raise FileNotFoundError(f"Wordmark master not found at {wordmark_src}")

    print("1. Processing New Icon Master...")
    icon_raw = Image.open(icon_src).convert('RGBA')
    icon_cropped = crop_to_alpha(icon_raw)

    # Centered 512x512 canvas for standard square icons
    canvas_size = 512
    target_dim = 470
    cw, ch = icon_cropped.size
    scale = target_dim / float(max(cw, ch))
    new_w, new_h = int(round(cw * scale)), int(round(ch * scale))
    icon_resized = icon_cropped.resize((new_w, new_h), Image.Resampling.LANCZOS)

    icon_512 = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
    off_x = (canvas_size - new_w) // 2
    off_y = (canvas_size - new_h) // 2
    icon_512.paste(icon_resized, (off_x, off_y), icon_resized)

    # Save standard & webp icons
    icon_512.save(os.path.join(LOGO_DIR, 'noviq-icon.png'), 'PNG', optimize=True)
    icon_512.save(os.path.join(LOGO_DIR, 'noviq-icon.webp'), 'WEBP', quality=95)
    icon_512.save(os.path.join(ADMIN_LOGO_DIR, 'noviq-icon.webp'), 'WEBP', quality=95)
    icon_512.save(os.path.join(ADMIN_LOGO_DIR, 'noviq-icon.png'), 'PNG', optimize=True)

    # Multi-sizes
    icon_192 = icon_512.resize((192, 192), Image.Resampling.LANCZOS)
    icon_192.save(os.path.join(LOGO_DIR, 'noviq-icon-192.png'), 'PNG', optimize=True)
    icon_192.save(os.path.join(PUBLIC_DIR, 'icon-192.png'), 'PNG', optimize=True)

    icon_32 = icon_512.resize((32, 32), Image.Resampling.LANCZOS)
    icon_32.save(os.path.join(LOGO_DIR, 'noviq-icon-32.png'), 'PNG', optimize=True)
    icon_32.save(os.path.join(PUBLIC_DIR, 'favicon.png'), 'PNG', optimize=True)

    icon_512.save(os.path.join(PUBLIC_DIR, 'favicon.ico'), format='ICO', sizes=[(16, 16), (32, 32), (48, 48)])

    apple_touch = Image.new('RGBA', (180, 180), (11, 8, 23, 255))
    apple_icon = icon_512.resize((150, 150), Image.Resampling.LANCZOS)
    apple_touch.paste(apple_icon, (15, 15), apple_icon)
    apple_touch.save(os.path.join(PUBLIC_DIR, 'apple-touch-icon.png'), 'PNG', optimize=True)

    # SVG favicon
    with open(os.path.join(LOGO_DIR, 'noviq-icon-192.png'), 'rb') as f:
        b64 = base64.b64encode(f.read()).decode('ascii')
    svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="Noviq">
  <image href="data:image/png;base64,{b64}" width="100" height="100" />
</svg>
'''
    with open(os.path.join(PUBLIC_DIR, 'favicon.svg'), 'w', encoding='utf-8') as f:
        f.write(svg_content)

    print("2. Processing New Full Wordmark Master...")
    wm_raw = Image.open(wordmark_src).convert('RGBA')
    wm_cropped = crop_to_alpha(wm_raw)

    target_wm_w = 1440
    wm_scale = target_wm_w / float(wm_cropped.width)
    wm_w = target_wm_w
    wm_h = int(round(wm_cropped.height * wm_scale))
    wm_resized = wm_cropped.resize((wm_w, wm_h), Image.Resampling.LANCZOS)

    pad_x, pad_y = 16, 12
    wm_canvas = Image.new('RGBA', (wm_w + pad_x * 2, wm_h + pad_y * 2), (0, 0, 0, 0))
    wm_canvas.paste(wm_resized, (pad_x, pad_y), wm_resized)

    # Save wordmark & full logo aliases
    wm_canvas.save(os.path.join(LOGO_DIR, 'noviq-wordmark.png'), 'PNG', optimize=True)
    wm_canvas.save(os.path.join(LOGO_DIR, 'noviq-wordmark.webp'), 'WEBP', quality=95)
    wm_canvas.save(os.path.join(LOGO_DIR, 'noviq-logo.png'), 'PNG', optimize=True)
    wm_canvas.save(os.path.join(LOGO_DIR, 'noviq-logo.webp'), 'WEBP', quality=95)
    wm_canvas.save(os.path.join(ADMIN_LOGO_DIR, 'noviq-wordmark.webp'), 'WEBP', quality=95)
    wm_canvas.save(os.path.join(ADMIN_LOGO_DIR, 'noviq-wordmark.png'), 'PNG', optimize=True)

    print("3. Processing Angle Variants (90deg, 180deg, 270deg)...")
    angles = [
        (90, 'noviq-icon-90deg'),
        (180, 'noviq-icon-180deg'),
        (270, 'noviq-icon-270deg'),
    ]

    for deg, out_base in angles:
        rotated = icon_cropped.rotate(deg, expand=True, resample=Image.Resampling.LANCZOS)
        rotated_res = resize_max_dim(rotated, 1500)
        # Save in angles dir
        rotated_res.save(os.path.join(ANGLES_DIR, f'{out_base}.png'), 'PNG', optimize=True)
        rotated_res.save(os.path.join(ANGLES_DIR, f'{out_base}.webp'), 'WEBP', quality=95)
        # Save in processed dir
        rotated_res.save(os.path.join(PROCESSED_DIR, f'{out_base}.png'), 'PNG', optimize=True)
        rotated_res.save(os.path.join(PROCESSED_DIR, f'{out_base}.webp'), 'WEBP', quality=95)

    print("4. Updating Processed Master Assets...")
    icon_master_out = resize_max_dim(icon_cropped, 1600)
    icon_master_out.save(os.path.join(PROCESSED_DIR, 'noviq-icon-master.png'), 'PNG', optimize=True)
    icon_master_out.save(os.path.join(PROCESSED_DIR, 'noviq-icon-master.webp'), 'WEBP', quality=95)

    wm_master_out = resize_max_dim(wm_cropped, 2048)
    wm_master_out.save(os.path.join(PROCESSED_DIR, 'noviq-wordmark-master.png'), 'PNG', optimize=True)
    wm_master_out.save(os.path.join(PROCESSED_DIR, 'noviq-wordmark-master.webp'), 'WEBP', quality=95)

    print("ALL NEW LOGOS GENERATED AND REPLACED SUCCESSFULLY!")

if __name__ == '__main__':
    main()
