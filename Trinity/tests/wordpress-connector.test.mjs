import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  WORDPRESS_CAPABILITY, WordPressConnectorError, validateSiteUrl,
  wordpressConnectionStatus, wordpressSiteInfo, wordpressListPublicPosts
} from '../services/wordpress-connector.js';

const env={TRINITY_WORDPRESS_ALLOWED_SITES:'https://demo.example.com'};
const json=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
test('WordPress capability is explicitly read-only and unverified',()=>{
  assert.equal(WORDPRESS_CAPABILITY.mutations_supported,false);
  assert.equal(WORDPRESS_CAPABILITY.wpwriter_session_shared,false);
  assert.equal(wordpressConnectionStatus({}).status,'needs_configuration');
  assert.equal(wordpressConnectionStatus(env).status,'configured_unverified');
});
test('WordPress URL normalization rejects private, credentialed and unsafe targets',()=>{
  assert.equal(validateSiteUrl('https://demo.example.com/blog').baseUrl,'https://demo.example.com/blog/');
  for(const url of ['http://demo.example.com','https://user:pass@demo.example.com',
    'https://127.0.0.1','https://localhost','https://demo.example.com:8080',
    'https://demo.example.com/?token=x','https://demo.example.com/%2e%2e/']) {
    assert.throws(()=>validateSiteUrl(url),WordPressConnectorError,url);
  }
});
test('site inspection calls only an allowlisted public endpoint',async()=>{
  let observed='';
  const fetcher=async(url,opts)=>{observed=url;assert.equal(opts.method,'GET');assert.equal(opts.redirect,'error');return json({name:'Demo',description:'Public blog',namespaces:['wp/v2']});};
  const info=await wordpressSiteInfo(env,'https://demo.example.com',fetcher);
  assert.equal(observed,'https://demo.example.com/wp-json/');
  assert.equal(info.title,'Demo');
  assert.equal(info.public_data_only,true);
  await assert.rejects(wordpressSiteInfo(env,'https://other.example.com',fetcher),{code:'not_allowed'});
});
test('public posts are bounded, filtered and never published',async()=>{
  let url='';
  const fetcher=async(path)=>{url=path;return json([
    {id:2,status:'draft',title:{rendered:'Hidden'}},
    {id:3,status:'publish',title:{rendered:'Public'},link:'https://demo.example.com/post',slug:'post',date:'2026-10-27'}
  ]);};
  const r=await wordpressListPublicPosts(env,'https://demo.example.com',{limit:2},fetcher);
  assert.match(url,/per_page=2/);
  assert.equal(r.posts.length,1);
  assert.equal(r.posts[0].title,'Public');
  await assert.rejects(wordpressListPublicPosts(env,'https://demo.example.com',{limit:100},fetcher),{code:'invalid_limit'});
});
test('provider failures are not reported as successful operations',async()=>{
  const serverError=async()=>new Response('error',{status:503});
  await assert.rejects(wordpressSiteInfo(env,'https://demo.example.com',serverError),{code:'http_error'});
  await assert.rejects(wordpressSiteInfo(env,'https://demo.example.com',async()=>{throw new Error('offline');}),{code:'network_error'});
  await assert.rejects(wordpressSiteInfo(env,'https://demo.example.com',async()=>new Response('not json')),{code:'invalid_response'});
});
