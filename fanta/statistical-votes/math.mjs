import {createHash} from 'node:crypto';
export const finite=value=>value==null||typeof value==='boolean'||typeof value==='string'&&!value.trim()?null:Number.isFinite(Number(value))?Number(value):null;
export const count=value=>{const n=finite(value);return n!=null&&n>=0&&n<=10000?n:null;};
export const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export const round=(n,digits=6)=>n==null?null:Math.round((n+Number.EPSILON)*10**digits)/10**digits;
export const median=values=>{const a=values.filter(Number.isFinite).sort((a,b)=>a-b),i=Math.floor(a.length/2);return a.length?a.length%2?a[i]:(a[i-1]+a[i])/2:null;};
export const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
export const digest=x=>createHash('sha256').update(JSON.stringify(canonical(x))).digest('hex');
// Retained only for historical/offline tools. Active votes include provider ratings.
export function withoutRatings(value){if(Array.isArray(value))return value.map(withoutRatings);if(!value||typeof value!=='object')return value;return Object.fromEntries(Object.entries(value).filter(([key])=>!['rating','providerrating'].includes(key.toLowerCase())).map(([key,x])=>[key,withoutRatings(x)]));}
export const fixtureFingerprint=raw=>digest(raw);
export function validTimestamp(value){if(typeof value!=='string'||!/^20\d\d-\d\d-\d\dT\d\d:\d\d/.test(value))return null;const n=Date.parse(value);return Number.isFinite(n)&&n>=Date.UTC(2000,0,1)&&n<Date.UTC(2100,0,1)?new Date(n).toISOString():null;}
export const ratio=(success,total)=>success!=null&&total!=null&&total>0&&success<=total?success/total:null;
export function roundedHalf(value){return Math.floor(value*2+0.5+1e-10)/2;}
export function roundByBands(value,bands){let vote=bands[0][1];for(const[threshold,next,strict=false]of bands){if(strict?value<=threshold:value+1e-10<threshold)break;vote=next;}return vote;}
