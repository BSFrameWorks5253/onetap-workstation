import os
import shutil
import rawpy
import imageio
import sys
import numpy as np
import cv2
import threading
import customtkinter as ctk
from tkinter import filedialog, messagebox

# ================= MODIFIED LOGIC (THUMBNAIL ONLY) =================

def convert_cr3_to_jpg(base_dir, output_dir, log_callback=None):
    low_folder = os.path.join(output_dir, "JPG")
    raw_folder = os.path.join(base_dir, "RAW")

    os.makedirs(low_folder, exist_ok=True)
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
        
        low_out_path = os.path.join(low_folder, base_name + ".jpg")

        try:
            if log_callback:
                log_callback(f"[{i}/{len(files_to_process)}] Extracting thumbnail from {filename}...")
            
            with rawpy.imread(input_path) as raw:
                try:
                    thumb = raw.extract_thumb()
                    if thumb.format == rawpy.ThumbFormat.JPEG:
                        imageio.imwrite(low_out_path, imageio.imread(thumb.data))
                except Exception as e:
                    if log_callback:
                        log_callback(f"JPG failed: {filename}: {e}")

            # Move RAW file
            if source_dir != raw_folder:
                dest_path = os.path.join(raw_folder, filename)
                if os.path.exists(dest_path): os.remove(dest_path)
                shutil.move(input_path, dest_path)
            
        except Exception as e:
            if log_callback:
                log_callback(f"ERROR: {filename}: {e}")

# ================= UI =================

ctk.set_appearance_mode("light")
ctk.set_default_color_theme("blue")

class App(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.title("CR3 → JPG Converter")
        self.geometry("700x720")
        self.resizable(True, True)

        self.input_path = ctk.StringVar()
        self.output_path = ctk.StringVar()

        self.build_ui()

    def build_ui(self):
        title = ctk.CTkLabel(self, text="CR3 → JPG Converter", font=("Segoe UI", 26, "bold"))
        title.pack(pady=20)

        card = ctk.CTkFrame(self, corner_radius=20)
        card.pack(padx=20, pady=10, fill="both", expand=True)

        ctk.CTkLabel(card, text="Input Folder").pack(pady=(20, 5))
        ctk.CTkEntry(card, textvariable=self.input_path, width=400).pack()
        ctk.CTkButton(card, text="Browse", corner_radius=15, fg_color="#dbeafe", hover_color="#bfdbfe",
                      text_color="black", command=self.select_input).pack(pady=5)

        ctk.CTkLabel(card, text="Output Folder").pack(pady=(20, 5))
        ctk.CTkEntry(card, textvariable=self.output_path, width=400).pack()
        ctk.CTkButton(card, text="Browse", corner_radius=15, fg_color="#dcfce7", hover_color="#bbf7d0",
                      text_color="black", command=self.select_output).pack(pady=5)

        self.convert_btn = ctk.CTkButton(
            card,
            text="Convert to JPG",
            corner_radius=20,
            fg_color="#c7d2fe",
            hover_color="#a5b4fc",
            text_color="black",
            command=self.start_conversion
        )
        self.convert_btn.pack(pady=20)

        self.exit_btn = ctk.CTkButton(
            card,
            text="Exit",
            corner_radius=20,
            fg_color="#fecaca",
            hover_color="#fca5a5",
            text_color="black",
            command=self.destroy
        )
        self.exit_btn.pack(pady=5)

        self.log_box = ctk.CTkTextbox(card, height=150)
        self.log_box.pack(padx=20, pady=10, fill="both")

        watermark = ctk.CTkLabel(self, text="Burhanuddin", font=("Segoe UI", 12))
        watermark.pack(side="bottom", pady=5)

    def select_input(self):
        path = filedialog.askdirectory()
        if path:
            self.input_path.set(path)

    def select_output(self):
        path = filedialog.askdirectory()
        if path:
            self.output_path.set(path)

    def log(self, message):
        self.log_box.insert("end", message + "\n")
        self.log_box.see("end")

    def start_conversion(self):
        input_dir = self.input_path.get()
        output_dir = self.output_path.get()

        if not input_dir or not output_dir:
            messagebox.showerror("Error", "Please select both folders")
            return

        self.convert_btn.configure(state="disabled")
        threading.Thread(target=self.run_conversion, args=(input_dir, output_dir)).start()

    def run_conversion(self, input_dir, output_dir):
        convert_cr3_to_jpg(input_dir, output_dir, self.log)
        self.log("\nDone!")
        self.convert_btn.configure(state="normal")

if __name__ == "__main__":
    app = App()
    app.mainloop()