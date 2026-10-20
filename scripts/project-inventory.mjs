import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const paths=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const groups=new Map();const entries=[];
for(const path of paths){let bytes;try{bytes=readFileSync(path);}catch{continue;}
 const sha256=createHash('sha256').update(bytes).digest('hex');
 groups.set(sha256,[...(groups.get(sha256)||[]),path]);
 entries.push({path,bytes:bytes.length,sha256,role:path.startsWith('Archive/')?'archive':/^src\//.test(path)?'compatibility':path.startsWith('Trinity/src/')?'canonical-source':'supporting'});
}
process.stdout.write(JSON.stringify({canonical_entrypoint:'Trinity/src/index.js',configuration:'Trinity/wrangler.jsonc',files:entries.length,duplicates:[...groups.values()].filter(paths=>paths.length>1),entries},null,2)+'\n');
