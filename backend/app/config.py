import os
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = Path(os.environ.get('AASHIRWAD_DATA_DIR', ROOT / 'backend' / 'data')).resolve()
MODEL_DIR = DATA_DIR / 'models'
