"""Create a source-only download, excluding credentials, runtime state and real farm data."""
from pathlib import Path
import zipfile,json
root=Path(__file__).resolve().parents[1]
output=root/'public'/'Aashirwad_Source.zip'
folders=['app','components','hooks','lib','data','backend','docs','scripts','vendor','worker','public','db','drizzle','examples']
files=['README.md','package.json','pnpm-lock.yaml','pnpm-workspace.yaml','tsconfig.json','vite.config.ts','next.config.ts','postcss.config.mjs','eslint.config.mjs','cloudflare-env.d.ts','vite-env.d.ts','drizzle.config.ts','components.json','.env.example','.gitignore','.npmrc']
exclude_parts={'.venv','__pycache__','.pytest_cache','node_modules','models','imports','cache'}
with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as archive:
    for folder in folders:
        for path in sorted((root/folder).rglob('*')):
            if not path.is_file() or path==output or any(part in exclude_parts for part in path.relative_to(root).parts):continue
            if path.suffix in {'.sqlite','.db','.pyc','.joblib','.zip','.tar','.gz'} or path.name=='catalog.json':continue
            archive.write(path,'Aashirwad/'+str(path.relative_to(root)))
    for name in files:
        if (root/name).exists():archive.write(root/name,'Aashirwad/'+name)
    for path in sorted((root/'tests').rglob('*.ts')):archive.write(path,'Aashirwad/'+str(path.relative_to(root)))
    # A downloaded copy must never inherit the original Site identity.
    archive.writestr('Aashirwad/.openai/hosting.json',json.dumps({'d1':None,'r2':None},indent=2)+'\n')
print(json.dumps({'file':str(output),'bytes':output.stat().st_size}))
