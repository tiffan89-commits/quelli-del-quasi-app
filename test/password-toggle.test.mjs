import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
test('password eyes preserve the input, toggle without submitting and cover dynamically added forms once',()=>{
 const input=()=>({nodeType:1,type:'password',dataset:{},before(w){this.wrapper=w;},matches(q){return q==='input[type="password"]'&&this.type==='password';},querySelectorAll(){return [];}}),first=input();let observer;
 const document={documentElement:{},querySelectorAll(){return [first];},createElement(tag){return {tag,children:[],attributes:{},append(...nodes){this.children.push(...nodes);},setAttribute(k,v){this.attributes[k]=v;}};}};
 const ctx={document,MutationObserver:class{constructor(cb){observer=cb;}observe(){}}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(new URL('../public/src/password-toggle.mjs',import.meta.url),'utf8'),ctx);
 assert.equal(first.wrapper.children[0],first);const button=first.wrapper.children[1];assert.equal(button.type,'button');assert.equal(button.attributes['aria-pressed'],'false');let prevented=false;button.onclick({preventDefault(){prevented=true;}});assert.ok(prevented);assert.equal(first.type,'text');assert.equal(button.attributes['aria-label'],'Nascondi password');button.onclick({preventDefault(){}});assert.equal(first.type,'password');
 const second=input();observer([{addedNodes:[second]}]);assert.equal(second.wrapper.children.length,2);const wrap=second.wrapper;observer([{addedNodes:[second]}]);assert.equal(second.wrapper,wrap);
 for(const page of ['index.html','admin.html'])assert.match(fs.readFileSync(new URL('../public/'+page,import.meta.url),'utf8'),/src="\/src\/password-toggle.mjs"/);
});
