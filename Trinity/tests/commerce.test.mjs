import test from 'node:test';
import assert from 'node:assert/strict';
import {revolutPaymentLink,offerInput} from '../src/commerce.js';
test('payment links restrict protocol, credentials and Revolut hostnames',()=>{
 assert.equal(revolutPaymentLink('https://revolut.me/isabo'),'https://revolut.me/isabo');
 assert.equal(revolutPaymentLink('https://checkout.revolut.com/payment-link/abc-123'),'https://checkout.revolut.com/payment-link/abc-123');
 for(const u of ['http://revolut.me/isabo','https://revolut.me.evil.test/isabo','https://x:y@revolut.me/isabo','https://checkout.revolut.com/admin','https://evil.test/pay'])assert.throws(()=>revolutPaymentLink(u));
});
test('offer uses integer minor units and cannot assert payment or send status',()=>{
 const input={title:'Firemný web',deliverable:'Responzívny prezentačný web',amount_cents:10000,payment_link:'https://revolut.me/isabo'};
 assert.equal(offerInput.parse(input).currency,'EUR');
 assert.throws(()=>offerInput.parse({...input,amount_cents:1.5}));
 assert.throws(()=>offerInput.parse({...input,payment_verified:true}));
 assert.throws(()=>offerInput.parse({...input,sent:true}));
});
