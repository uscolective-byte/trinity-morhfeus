import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const html=source('../public/assistant/chat.html');
const css=source('../public/assistant/street-chat.css');
const script=source('../public/assistant/chat.js.txt');

test('STREET SIGNAL is loaded after the existing functional themes',()=>{
  assert.match(html,/<title>Trinity \/ STREET SIGNAL<\/title>/);
  const base=html.indexOf('/theme.css');
  const original=html.indexOf('/street-chat.css');
  assert.ok(base>=0 && original>base);
  assert.match(html,/street-chat.css\?v=20261024\.2/);
  assert.match(css,/TRINITY \/ STREET SIGNAL 001/);
});
test('urban reskin does not remove critical existing chat, auth or view handles',()=>{
  for(const id of ['chat-form','message','send','messages','sessions','login','new-chat','logout','theme','engine','dashboard-view','settings-view']) {
    assert.match(html,new RegExp('id="'+id+'"'));
  }
  for(const selector of ['.sidebar','#welcome','.suggestions button','.message.assistant','#chat-form','#send']) {
    assert.ok(css.includes(selector),selector);
  }
});
test('street design contains a mobile layout, light-theme support and reduced motion',()=>{
  assert.match(css,/html\[data-theme="light"\]/);
  assert.match(css,/@media\s*\(max-width:760px\)/);
  assert.match(css,/@media\s*\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/:focus-visible/);
  assert.match(css,/--workshop-action:#ff6a43/);
});
test('i18n slogan is consistent in Slovak and English',()=>{
  assert.match(script,/greeting:'Z NÁPADU\. DO AKCIE\.'/);
  assert.match(script,/greeting:'FROM IDEA\. TO ACTION\.'/);
  assert.match(html,/Z NÁPADU\. DO AKCIE\./);
});
