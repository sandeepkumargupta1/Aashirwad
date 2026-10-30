import argparse
import json
from pathlib import Path
from app.yield_model import train
if __name__=='__main__':
    parser=argparse.ArgumentParser(description='Train on normalized, real district APY observations. Synthetic data must never be installed as a real model.')
    parser.add_argument('--csv',type=Path,required=True);parser.add_argument('--crop',required=True)
    args=parser.parse_args()
    try:print(json.dumps(train(args.csv,args.crop),indent=2))
    except ValueError as e:parser.exit(2,f'Training unavailable: {e}\n')
