import os
import re
from pathlib import Path

def find_system_keys():
    """Prehľadá bežné umiestnenia, premenné prostredia a lokálne súbory na nájdenie API kľúčov."""
    discovered_keys = {}
    
    # 1. Kontrola existujúcich premenných prostredia
    env_candidates = ["GEMINI_API_KEY", "GOOGLE_API_KEY", "VERTEX_API_KEY", "ADMIN_API_KEY"]
    for env in env_candidates:
        val = os.getenv(env)
        if val:
            discovered_keys[env] = val

    # 2. Hľadanie v domovskom adresári (napr. .env, .gemini, gcloud config)
    home_dir = Path.home()
    search_paths = [
        home_dir / ".gemini",
        home_dir / ".env",
        Path(".env.example"),
        Path(".env")
    ]
    
    key_pattern = re.compile(r"(AIza[0-9A-Za-z_-]{35})")

    for path in search_paths:
        if path.is_file():
            try:
                content = path.read_text(encoding="utf-8", errors="ignore")
                matches = key_pattern.findall(content)
                if matches and "GEMINI_API_KEY" not in discovered_keys:
                    discovered_keys["GEMINI_API_KEY"] = matches[0]
            except Exception:
                pass
        elif path.is_dir():
            for sub_path in path.glob("**/*"):
                if sub_path.is_file():
                    try:
                        content = sub_path.read_text(encoding="utf-8", errors="ignore")
                        matches = key_pattern.findall(content)
                        if matches and "GEMINI_API_KEY" not in discovered_keys:
                            discovered_keys["GEMINI_API_KEY"] = matches[0]
                    except Exception:
                        pass

    return discovered_keys

def inject_keys_to_env(keys_dict):
    """Vloží nájdené kľúče do lokálneho súboru .env."""
    env_path = Path(".env")
    env_lines = []
    
    if env_path.exists():
        env_lines = env_path.read_text(encoding="utf-8").splitlines()

    existing_keys = {}
    cleaned_lines = []
    for line in env_lines:
        if "=" in line and not line.strip().startswith("#"):
            k, v = line.split("=", 1)
            existing_keys[k.strip()] = v.strip()
        cleaned_lines.append(line)

    updated = False
    for k, v in keys_dict.items():
        if k not in existing_keys or not existing_keys[k]:
            existing_keys[k] = v
            cleaned_lines.append(f"{k}={v}")
            updated = True
            print(f"[✔] Automaticky pridaný kľúč pre: {k}")
        else:
            print(f"[i] Kľúč {k} už v .env existuje.")

    if updated or not env_path.exists():
        env_path.write_text("\n".join(cleaned_lines) + "\n", encoding="utf-8")
        print("[✔] Súbor .env bol úspešne aktualizovaný.")
    else:
        print("[i] Žiadne nové kľúče na zápis.")

if __name__ == "__main__":
    print("[TRINITY_Core] Spúšťam autonómne vyhľadávanie API kľúčov...")
    keys = find_system_keys()
    if keys:
        inject_keys_to_env(keys)
    else:
        print("[!] Žiadne platné kľúče (AIza...) sa nepodarilo automaticky nájsť. Zadajte ich manuálne do .env.")
