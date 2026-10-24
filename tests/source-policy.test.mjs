import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requireCanonicalSource} from '../scripts/source-policy.mjs';
const valid={branch:'main',remote:'https://github.com/uscolective-byte/trinity-morhfeus.git',upstream:'origin/main',dirty:''};
test('source synchronization accepts the canonical main checkout',()=>{
 assert.doesNotThrow(()=>requireCanonicalSource(valid));
 assert.doesNotThrow(()=>requireCanonicalSource({...valid,remote:'git@github.com:uscolective-byte/trinity-morhfeus.git'}));
});
test('source synchronization refuses other repositories, branches and any pending changes',()=>{
 for(const patch of [{branch:'master'},{upstream:'origin/development'},{remote:'https://github.com/other/trinity.git'},{remote:'https://github.com/uscolective-byte/trinity-morhfeus.git.evil.test'},{dirty:'?? unpublished.js'},{dirty:'M  staged.js'},{dirty:' M modified.js'}])assert.throws(()=>requireCanonicalSource({...valid,...patch}));
});
