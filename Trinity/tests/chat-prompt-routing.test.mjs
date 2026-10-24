import test from 'node:test';
import assert from 'node:assert/strict';
import {chatPromptTools,directCalculation} from '../src/chat-prompt.js';

test('routes Slovak requests without diacritics to a described tool',()=>{
  const result=chatPromptTools(['tool_catalog','create_document'],'Vytvor dokument',{create_document:'Vytváranie dokumentov'});
  assert.deepEqual(result,['tool_catalog','create_document']);
});
test('handles missing input and keeps core tools',()=>{
  assert.deepEqual(chatPromptTools(['chat_health','web_search'],null,null),['chat_health','web_search']);
  assert.deepEqual(chatPromptTools(null,'hello',{}),[]);
});
test('limits auxiliary tools to eight and deduplicates',()=>{
  const names=Array.from({length:12},(_,i)=>'search_'+i);
  const result=chatPromptTools(['web_search','web_search',...names],'search',{});
  assert.equal(result[0],'web_search');
  assert.equal(result.length,9);
  assert.equal(new Set(result).size,result.length);
});
test('direct calculation behavior is unchanged',()=>{
  assert.deepEqual(directCalculation('koľko je 2 + 3'),{operation:'add',values:[2,3]});
});
