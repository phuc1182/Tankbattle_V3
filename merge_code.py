import os

# Cấu hình: Các đuôi file bạn muốn tôi đọc (tuỳ chỉnh theo dự án của bạn)
EXTENSIONS = ['.cpp', '.h', '.java', '.py', '.js', '.html', '.css', '.sql']
IGNORE_DIRS = ['node_modules', '.git', 'bin', 'obj', 'build', 'venv']
OUTPUT_FILE = 'project_full_context.txt'

def merge_files():
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as outfile:
        for root, dirs, files in os.walk("."):
            # Bỏ qua các thư mục không cần thiết
            dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
            
            for file in files:
                if any(file.endswith(ext) for ext in EXTENSIONS):
                    file_path = os.path.join(root, file)
                    try:
                        with open(file_path, 'r', encoding='utf-8') as infile:
                            # Ghi tên file để tôi biết đoạn code này thuộc file nào
                            outfile.write(f"\n{'='*50}\n")
                            outfile.write(f"FILE: {file_path}\n")
                            outfile.write(f"{'='*50}\n")
                            outfile.write(infile.read())
                            outfile.write("\n")
                            print(f"Đã thêm: {file_path}")
                    except Exception as e:
                        print(f"Lỗi khi đọc file {file_path}: {e}")

    print(f"\nHoàn tất! Hãy gửi file '{OUTPUT_FILE}' cho AI.")

if __name__ == "__main__":
    merge_files()