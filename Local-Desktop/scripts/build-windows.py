"""Build a portable Windows ZIP; runtime_dir must contain the verified Node binary."""
from pathlib import Path
import argparse, hashlib, shutil, tempfile, zipfile

parser=argparse.ArgumentParser()
parser.add_argument('--runtime-dir',type=Path,required=True)
parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args()
source=Path(__file__).resolve().parents[1]
gateway=source.parent/'Local-Gateway'
expected='9c9245166b4a8e182e0b797da9c20136117ff24368eaff1fec8343a123c8db0e'
assert hashlib.sha256((args.runtime_dir/'node.exe').read_bytes()).hexdigest()==expected,'Runtime checksum mismatch'
with tempfile.TemporaryDirectory() as temp:
    dest=Path(temp)/'Trinity-Local'
    shutil.copytree(source,dest,ignore=shutil.ignore_patterns('Data','Workspace','runtime','node_modules','*.log','*.dpapi','.gemini','.vscode','.mcp.json'))
    shutil.copytree(gateway,dest/'gateway-src',ignore=shutil.ignore_patterns('data','.credentials','node_modules','*.log','*.dpapi'))
    (dest/'runtime').mkdir()
    for name in ['node.exe','LICENSE','README.md','runtime-provenance.json']:
        shutil.copyfile(args.runtime_dir/name,dest/'runtime'/name)
    server=dest/'server.mjs'
    server.write_text(server.read_text().replace("'../Local-Gateway/src/","'./gateway-src/src/"))
    args.output.parent.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(args.output,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
        for file in sorted(dest.rglob('*')):
            if file.is_file():archive.write(file,str(file.relative_to(dest.parent)))
    with zipfile.ZipFile(args.output) as archive:assert archive.testzip() is None
print(args.output)
