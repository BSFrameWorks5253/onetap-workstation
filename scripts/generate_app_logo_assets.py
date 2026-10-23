"""
Generate One Tap flat background Adobe CC-style insignia ("Ot").
Clean, iconic, non-flashy squircle with flat/gradient background matching Anything App.
"""

import os
import sys
from PIL import Image, ImageDraw, ImageFont

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RESOURCES_DIR = os.path.join(ROOT_DIR, "resources")
RENDERER_ASSETS = os.path.join(ROOT_DIR, "src", "renderer", "src", "assets")
PUBLIC_DIR = os.path.join(ROOT_DIR, "public")
RELEASE_DIR = os.path.join(ROOT_DIR, "release", "One Tap")
ANYTHING_PUBLIC_DIR = r"C:\Users\Burhanuddin\OneDrive\Desktop\New folder (2)\Anything\public"
ANYTHING_RELEASE_DIR = r"C:\Users\Burhanuddin\OneDrive\Desktop\New folder (2)\Anything\releases\one-tap"

for d in [RESOURCES_DIR, RENDERER_ASSETS, PUBLIC_DIR, RELEASE_DIR]:
    os.makedirs(d, exist_ok=True)


def create_gradient_squircle(size=1024, padding_ratio=0.0):
    """
    Renders the clean squircle with 'Ot' written, exactly matching Anything app's Adobe CC style insignia.
    If padding_ratio > 0, adds inner margin (safe area padding) for store listings.
    """
    scale = 2
    canvas_size = size * scale
    img = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    pad = int(canvas_size * padding_ratio)
    box_w = canvas_size - 2 * pad
    box_h = canvas_size - 2 * pad
    radius = int(box_w * 0.22)

    # Crimson to Deep Wine gradient (#E11D48 -> #9F1239)
    # Generate gradient in separate image
    grad_img = Image.new("RGBA", (box_w, box_h), (0, 0, 0, 0))
    g_draw = ImageDraw.Draw(grad_img)

    start_color = (225, 29, 72, 255)   # #E11D48
    end_color = (159, 18, 57, 255)     # #9F1239

    for y in range(box_h):
        ratio = y / max(1, box_h - 1)
        r = int(start_color[0] + (end_color[0] - start_color[0]) * ratio)
        g = int(start_color[1] + (end_color[1] - start_color[1]) * ratio)
        b = int(start_color[2] + (end_color[2] - start_color[2]) * ratio)
        g_draw.line([(0, y), (box_w, y)], fill=(r, g, b, 255))

    # Mask for rounded squircle
    mask = Image.new("L", (box_w, box_h), 0)
    m_draw = ImageDraw.Draw(mask)
    m_draw.rounded_rectangle([0, 0, box_w, box_h], radius=radius, fill=255)

    # Paste gradient using mask
    img.paste(grad_img, (pad, pad), mask)

    # Specular glass highlight rim
    rim_color = (255, 255, 255, 90)
    draw.rounded_rectangle(
        [pad + 2, pad + 2, pad + box_w - 3, pad + box_h - 3],
        radius=radius - 2,
        outline=rim_color,
        width=int(scale * 1.5)
    )

    # Font setup for "Ot"
    font_candidates = [
        "C:/Windows/Fonts/segoeuib.ttf",
        "C:/Windows/Fonts/arialbd.ttf",
        "C:/Windows/Fonts/calibrib.ttf",
    ]
    font = None
    font_size = int(box_h * 0.52)
    for fc in font_candidates:
        if os.path.exists(fc):
            try:
                font = ImageFont.truetype(fc, font_size)
                break
            except Exception:
                pass

    if not font:
        font = ImageFont.load_default()

    text = "Ot"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tx = pad + (box_w - tw) // 2 - bbox[0]
    ty = pad + (box_h - th) // 2 - bbox[1] - int(box_h * 0.02)

    # Crisp pure white text
    draw.text((tx, ty), text, font=font, fill=(255, 255, 255, 255))

    # Downsample with Lanczos for razor-sharp antialiased edges
    final_img = img.resize((size, size), Image.Resampling.LANCZOS)
    return final_img


def main():
    print("[1/5] Rendering Clean 'Ot' Adobe CC Insignia (Full-bleed 1024x1024)...")
    logo_full_1024 = create_gradient_squircle(1024, padding_ratio=0.0)

    print("[2/5] Rendering Store Listing Logo with 12% Safe Padding (512x512)...")
    logo_store_512 = create_gradient_squircle(512, padding_ratio=0.12)

    print("[3/5] Saving PNG Assets...")
    # Full bleed 512x512
    icon_512 = logo_full_1024.resize((512, 512), Image.Resampling.LANCZOS)

    icon_png = os.path.join(RESOURCES_DIR, "icon.png")
    app_logo_res = os.path.join(RESOURCES_DIR, "app-logo.png")
    logo_asset = os.path.join(RENDERER_ASSETS, "logo.png")
    app_logo_asset = os.path.join(RENDERER_ASSETS, "app-logo.png")
    public_logo = os.path.join(PUBLIC_DIR, "logo.png")
    public_app_logo = os.path.join(PUBLIC_DIR, "app-logo.png")
    release_app_logo = os.path.join(RELEASE_DIR, "app-logo.png")

    icon_512.save(icon_png, "PNG")
    logo_store_512.save(app_logo_res, "PNG")
    icon_512.save(logo_asset, "PNG")
    logo_store_512.save(app_logo_asset, "PNG")
    icon_512.save(public_logo, "PNG")
    logo_store_512.save(public_app_logo, "PNG")
    logo_store_512.save(release_app_logo, "PNG")

    print(f"  [OK] {icon_png}")
    print(f"  [OK] {app_logo_res}")
    print(f"  [OK] {release_app_logo}")

    print("[4/5] Generating Multi-Resolution ICO for Windows Taskbar & Setup...")
    icon_ico_path = os.path.join(RESOURCES_DIR, "icon.ico")
    app_ico_path = os.path.join(RESOURCES_DIR, "app.ico")

    sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (24, 24), (16, 16)]
    icon_images = [logo_full_1024.resize(s, Image.Resampling.LANCZOS) for s in sizes]

    icon_images[0].save(icon_ico_path, format="ICO", sizes=sizes, append_images=icon_images[1:])
    icon_images[0].save(app_ico_path, format="ICO", sizes=sizes, append_images=icon_images[1:])
    print(f"  [OK] {icon_ico_path}")
    print(f"  [OK] {app_ico_path}")

    print("[5/5] Syncing to Anything App Store & Child App Catalog...")
    if os.path.exists(ANYTHING_PUBLIC_DIR):
        dest_anything_logo = os.path.join(ANYTHING_PUBLIC_DIR, "onetap-logo.png")
        logo_store_512.save(dest_anything_logo, "PNG")
        print(f"  [OK] Synced to Anything Public Store Assets: {dest_anything_logo}")

    if os.path.exists(os.path.dirname(ANYTHING_RELEASE_DIR)):
        os.makedirs(ANYTHING_RELEASE_DIR, exist_ok=True)
        dest_rel_logo = os.path.join(ANYTHING_RELEASE_DIR, "app-logo.png")
        logo_store_512.save(dest_rel_logo, "PNG")
        print(f"  [OK] Synced to Anything Releases Catalog: {dest_rel_logo}")

    print("\n[SUCCESS] All One Tap 'Ot' Adobe CC Style Assets Generated Successfully!\n")


if __name__ == "__main__":
    main()
