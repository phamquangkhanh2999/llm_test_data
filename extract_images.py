import re
import base64
import sys

def extract_images(md_path, out_dir):
    with open(md_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # match [imageX]: <data:image/png;base64,.....>
    pattern = r'\[(image\d+)\]:\s*<data:image/([^;]+);base64,([^>]+)>'
    matches = re.findall(pattern, content)
    
    for name, ext, b64_data in matches:
        # Some base64 data might have spaces or newlines due to formatting
        b64_data = b64_data.strip()
        try:
            image_bytes = base64.b64decode(b64_data)
            out_path = f"{out_dir}/{name}.{ext}"
            with open(out_path, 'wb') as img_f:
                img_f.write(image_bytes)
            print(f"Saved {out_path}")
        except Exception as e:
            print(f"Error saving {name}: {e}")

if __name__ == "__main__":
    extract_images(sys.argv[1], sys.argv[2])
