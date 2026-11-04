import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
import {createHash} from 'node:crypto';

export const PORTRAIT_VERSION = 'portrait-webp-160-v1';
const require = createRequire(join(process.cwd(),'package.json'));
const wasm = async (pkg,entry,file) => readFile(join(dirname(require.resolve(pkg+'/'+entry)),file));
let enc, png, jpeg, webp;
async function encoder() {
  return enc ??= (async () => {
    const module = await import('@jsquash/webp/encode.js');
    // Use the same feature probe as the codec, keeping the package external to esbuild.
    const {simd} = await import('wasm-feature-detect');
    await module.init(undefined,{wasmBinary:await wasm('@jsquash/webp','encode.js','codec/enc/webp_enc'+(await simd()?'_simd':'')+'.wasm')});
    return module.default;
  })();
}
async function decoder(mime) {
  if (mime === 'image/png') return png ??= (async () => {
    const m=await import('@jsquash/png/decode.js'); await m.init(await wasm('@jsquash/png','decode.js','codec/pkg/squoosh_png_bg.wasm'));return m.default;
  })();
  if (mime === 'image/jpeg') return jpeg ??= (async () => {
    const m=await import('@jsquash/jpeg/decode.js');await m.init(await WebAssembly.compile(await wasm('@jsquash/jpeg','decode.js','codec/dec/mozjpeg_dec.wasm')));return m.default;
  })();
  if (mime === 'image/webp') return webp ??= (async () => {
    const m=await import('@jsquash/webp/decode.js');await m.init(await WebAssembly.compile(await wasm('@jsquash/webp','decode.js','codec/dec/webp_dec.wasm')));return m.default;
  })();
  throw Error('Formato ritratto non supportato');
}

export function imageDimensions(bytes,mime) {
  if (mime==='image/png' && bytes.length>=24 && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))
    return [bytes.readUInt32BE(16),bytes.readUInt32BE(20)];
  if (mime==='image/jpeg' && bytes[0]===255 && bytes[1]===216) {
    for(let p=2;p+8<bytes.length;) {
      if(bytes[p++]!==255) continue;
      const marker=bytes[p++];if(marker===217||marker===218)break;
      if(marker===216||marker===1||marker>=208&&marker<=215)continue;
      const n=bytes.readUInt16BE(p);if(n<2||p+n>bytes.length)break;
      if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker))return [bytes.readUInt16BE(p+5),bytes.readUInt16BE(p+3)];
      p+=n;
    }
  }
  if(mime==='image/webp'&&bytes.length>=30&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'){
    const kind=bytes.toString('ascii',12,16);
    if(kind==='VP8X')return [1+bytes.readUIntLE(24,3),1+bytes.readUIntLE(27,3)];
    if(kind==='VP8 '&&bytes[23]===157&&bytes[24]===1&&bytes[25]===42)return [bytes.readUInt16LE(26)&16383,bytes.readUInt16LE(28)&16383];
    if(kind==='VP8L'&&bytes[20]===47){const n=bytes.readUInt32LE(21);return [(n&16383)+1,((n>>>14)&16383)+1];}
  }
  throw Error('Immagine non valida');
}

// Premultiplied-alpha box filtering keeps small transparent portraits and edges clean.
export function resizePixels(image,width,height) {
  if(image.width===width&&image.height===height)return image;
  const out=new Uint8ClampedArray(width*height*4),sx=image.width/width,sy=image.height/height;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    let weight=0,alpha=0,r=0,g=0,b=0;
    for(let yy=Math.floor(y*sy);yy<Math.ceil((y+1)*sy);yy++)for(let xx=Math.floor(x*sx);xx<Math.ceil((x+1)*sx);xx++){
      const w=(Math.min(xx+1,(x+1)*sx)-Math.max(xx,x*sx))*(Math.min(yy+1,(y+1)*sy)-Math.max(yy,y*sy));
      const i=(yy*image.width+xx)*4,a=image.data[i+3]*w;weight+=w;alpha+=a;r+=image.data[i]*a;g+=image.data[i+1]*a;b+=image.data[i+2]*a;
    }
    const i=(y*width+x)*4;out[i]=alpha?r/alpha:0;out[i+1]=alpha?g/alpha:0;out[i+2]=alpha?b/alpha:0;out[i+3]=alpha/weight;
  }
  return {data:out,width,height};
}

export async function optimizeImage(input,mime,{maxWidth=160,maxHeight=214,quality=84}={}) {
  const bytes=Buffer.from(input);if(bytes.length>1000000)throw Error('Immagine troppo grande');
  const [w,h]=imageDimensions(bytes,mime);
  if(!w||!h||w>4096||h>4096||w*h>8000000)throw Error('Dimensioni immagine eccessive');
  const image=await (await decoder(mime))(bytes),scale=Math.min(1,maxWidth/w,maxHeight/h);
  const width=Math.max(1,Math.round(w*scale)),height=Math.max(1,Math.round(h*scale));
  const converted=Buffer.from(await (await encoder())(resizePixels(image,width,height),{quality,method:4}));
  const smaller=converted.length<bytes.length,data=smaller?converted:bytes;
  return {data,mime:smaller?'image/webp':mime,digest:createHash('sha256').update(data).digest('hex'),
    width:smaller?width:w,height:smaller?height:h,optimizationVersion:PORTRAIT_VERSION,originalBytes:bytes.length};
}

export const optimizePortrait=(input,mime)=>optimizeImage(input,mime);
