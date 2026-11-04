import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
test('Enter submits login and one-use-code forms once, respects native validation and ignores composition',()=>{
 let handler;const context={document:{addEventListener:(type,fn)=>handler=fn}};vm.runInNewContext(fs.readFileSync(new URL('../public/src/auth-submit.mjs',import.meta.url),'utf8'),context);
 let count=0,prevented=0;const button={disabled:false},form={id:'admin-code-form',dataset:{},querySelector:()=>button,requestSubmit:b=>{assert.equal(b,button);count++;}},event={key:'Enter',target:{matches:()=>true,closest:()=>form},preventDefault:()=>prevented++};
 handler(event);assert.equal(count,1);assert.equal(prevented,1);button.disabled=true;handler(event);assert.equal(count,1);button.disabled=false;form.dataset.submitting='true';handler(event);assert.equal(count,1);form.dataset.submitting='false';handler({...event,isComposing:true});assert.equal(count,1);form.id='auth';handler(event);assert.equal(count,2);
});
