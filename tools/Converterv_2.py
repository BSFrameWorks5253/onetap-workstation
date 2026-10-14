import os
import shutil
import rawpy
import imageio
import sys
import numpy as np
import cv2

def apply_tuning(rgb_image, saturation_scale, contrast_steepness, brightness_scale):
    """
    Applies specific tuning parameters to an image.
    """
    # 1. Brightness
    img = (rgb_image.astype(np.float32) * brightness_scale)
    img = np.clip(img, 0, 255)
    
    # 2. Saturation
    hsv = cv2.cvtColor(img.astype(np.uint8), cv2.COLOR_RGB2HSV).astype(np.float32)
    hsv[:, :, 1] *= saturation_scale
    hsv[:, :, 1] = np.clip(hsv[:, :, 1], 0, 245)  # Avoid over-saturation
    
    # 3. S-Curve Contrast
    x = np.linspace(0, 255, 256)
    lut = 255 / (1 + np.exp(-contrast_steepness * (x - 128)))
    lut = (lut - lut[0]) * (255 / (lut[-1] - lut[0]))
    hsv[:, :, 2] = cv2.LUT(hsv[:, :, 2].astype(np.uint8), lut.astype(np.uint8))
    
    return cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB)

def find_optimal_settings(raw_rgb, ref_rgb):
    """
    Precision grid search (Fine-tuned ranges).
    """
    target_h, target_w = 512, int(512 * raw_rgb.shape[1] / raw_rgb.shape[0])
    raw_small = cv2.resize(raw_rgb, (target_w, target_h))
    ref_small = cv2.resize(ref_rgb, (target_w, target_h))
    
    best_mae = float('inf')
    best_params = (1.0, 1.0, 0.02)
    
    # Fine search around the previous 'winner' or expanded range
    # Brightness went to the limit (1.6) before, so we expand to 2.2
    # Contrast went to minimum (0.015), so we expand to 0.005
    b_range = np.linspace(1.4, 2.2, 8)
    s_range = np.linspace(0.8, 1.4, 8)
    c_range = np.linspace(0.005, 0.02, 6)
    
    print("\n[Precision Tuning] Iterating 384 combinations...")
    
    for b in b_range:
        for s in s_range:
            for c in c_range:
                attempt = apply_tuning(raw_small, s, c, b)
                mae = np.mean(cv2.absdiff(attempt, ref_small))
                if mae < best_mae:
                    best_mae = mae
                    best_params = (b, s, c)
    
    print(f"[Optimal Match] Final Error: {best_mae:.2f} | B:{best_params[0]:.2f} S:{best_params[1]:.2f} C:{best_params[2]:.3f}")
    return best_params

def convert_cr3_to_jpg(base_dir):
    """
    Converts CR3 files with high-precision 1:1 color matching.
    """
    jpg_folder = os.path.join(base_dir, "JPG")
    raw_folder = os.path.join(base_dir, "RAW")

    os.makedirs(jpg_folder, exist_ok=True)
    os.makedirs(raw_folder, exist_ok=True)

    files_to_process = []
    
    if os.path.exists(base_dir):
        root_files = [os.path.join(base_dir, f) for f in os.listdir(base_dir) if f.lower().endswith(".cr3")]
        files_to_process.extend([(f, base_dir) for f in root_files])
    
    if os.path.exists(raw_folder):
        sub_files = [os.path.join(raw_folder, f) for f in os.listdir(raw_folder) if f.lower().endswith(".cr3")]
        files_to_process.extend([(f, raw_folder) for f in sub_files])

    for i, (input_path, source_dir) in enumerate(files_to_process, start=1):
        filename = os.path.basename(input_path)
        base_name = os.path.splitext(filename)[0]
        
        raw_out_path = os.path.join(jpg_folder, base_name + ".jpg")
        thumb_out_path = os.path.join(jpg_folder, base_name + "_Thumbnail.jpg")

        try:
            print(f"[{i}/{len(files_to_process)}] Processing {filename}...")
            
            with rawpy.imread(input_path) as raw:
                # 1. Get Reference
                ref_rgb = None
                try:
                    thumb = raw.extract_thumb()
                    if thumb.format == rawpy.ThumbFormat.JPEG:
                        with open(thumb_out_path, 'wb') as f:
                            f.write(thumb.data)
                        ref_rgb = imageio.imread(thumb_out_path)
                except:
                    pass

                # 2. Get Linear Base
                rgb_base = raw.postprocess(
                    use_camera_wb=True,
                    user_black=2048,
                    no_auto_bright=False,
                    bright=1.0,
                    gamma=(2.22, 4.5),
                    output_color=rawpy.ColorSpace.sRGB,
                    output_bps=8
                )
                
                # 3. Precision Optimize
                if ref_rgb is not None:
                    b, s, c = find_optimal_settings(rgb_base, ref_rgb)
                    final_rgb = apply_tuning(rgb_base, s, c, b)
                else:
                    final_rgb = rgb_base
                
                imageio.imwrite(raw_out_path, final_rgb)

            # File Management
            if source_dir != raw_folder:
                dest_path = os.path.join(raw_folder, filename)
                if os.path.exists(dest_path): os.remove(dest_path) 
                shutil.move(input_path, dest_path)
            
        except Exception as e:
            print(f"\n[ERROR] {filename}: {e}")

if __name__ == "__main__":
    convert_cr3_to_jpg(os.getcwd())
