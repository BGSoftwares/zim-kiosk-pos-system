"""Conservative, fail-closed migration of legacy App.tsx state.

This script intentionally makes only deterministic transformations. It aborts
if an expected legacy block is missing so CI never commits a partial migration.
"""
from pathlib import Path
import re

APP = Path("src/App.tsx")
text = APP.read_text(encoding="utf-8")
original = text

# Fix the known scanner-state defect without changing scanner behaviour.
text, count = text.replace("setIsScanning(false);", "setShowScanner(false);").replace(
    "setIsScanning(false)", "setShowScanner(false)"
), text.count("setIsScanning(false)")
if count == 0:
    raise SystemExit("Expected scanner-state defect was not found; refusing to modify App.tsx")

# Remove the localStorage hydration effect. Server/API state is authoritative.
pattern = re.compile(
    r"\n  // Load from localStorage on mount\n  useEffect\(\(\) => \{.*?\n  \}, \[\]\);\n",
    re.DOTALL,
)
text, removed = pattern.subn("\n", text, count=1)
if removed != 1:
    raise SystemExit("Expected localStorage hydration block was not found")

# Remove business-data persistence effects. UI preferences can be reintroduced
# later through a dedicated preference store; business records never belong here.
for key in ("products", "sales", "debtors", "currency"):
    pattern = re.compile(
        rf"\n  useEffect\(\(\) => \{{\n    localStorage\.setItem\('zimkiosk_{key}'.*?\n  \}, \[{key}\]\);\n",
        re.DOTALL,
    )
    text, removed = pattern.subn("\n", text, count=1)
    if removed != 1:
        raise SystemExit(f"Expected localStorage persistence block for {key} was not found")

# Never persist authentication state in localStorage.
text = text.replace("\n    localStorage.setItem('zimkiosk_user', JSON.stringify(user));", "")
text = text.replace("\n    localStorage.removeItem('zimkiosk_user');", "")

if "localStorage.setItem('zimkiosk_products'" in text or "localStorage.setItem('zimkiosk_sales'" in text or "localStorage.setItem('zimkiosk_debtors'" in text:
    raise SystemExit("Legacy business localStorage usage remains; refusing to write")

if text == original:
    raise SystemExit("Migration produced no changes")

APP.write_text(text, encoding="utf-8")
print("Migrated App.tsx: removed business localStorage persistence and fixed scanner state.")
