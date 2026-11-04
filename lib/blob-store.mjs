import {getStore as managedStore} from '@netlify/blobs';
import {getStore as localStore} from '../runtime/local-blobs.mjs';
// Local storage is opt-in, set only by the autonomous runtime bootstrap.
export function getStore(options){return (process.env.SELFHOST_RUNTIME==='true'?localStore:managedStore)(options);}
