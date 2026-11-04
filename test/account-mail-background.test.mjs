import test from 'node:test';import assert from 'node:assert/strict';
import {mailTicket,readMailTicket,dispatchAccountMail} from '../lib/account-mail.mjs';
test('background mail authorization binds an existing job, expires, and rejects tampering',async()=>{
 const env={RESEND_API_KEY:'synthetic-key',APP_BASE_URL:'https://example.test'},id='a'.repeat(32),ticket=mailTicket(id,env,1000);
 assert.equal(readMailTicket(ticket,env,2000).jobId,id);assert.equal(readMailTicket(ticket+'changed',env,2000),null);assert.equal(readMailTicket(ticket,env,130000),null);assert.equal(readMailTicket(ticket,{...env,RESEND_API_KEY:'wrong'},2000),null);
 let calls=0;assert.equal(await dispatchAccountMail(id,{env,fetcher:async(url,opts)=>{calls++;assert.equal(url.href,'https://example.test/.netlify/functions/account-mail-background');assert.equal(readMailTicket(opts.headers['X-Quasi-Mail'],env).jobId,id);return {ok:true};}}),'queued');assert.equal(calls,1);
});
