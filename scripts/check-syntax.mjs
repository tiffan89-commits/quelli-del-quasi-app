import {execFileSync} from 'node:child_process';
const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(name=>/\.(mjs|js)$/.test(name));
for(const name of files)execFileSync(process.execPath,['--check',name],{stdio:'inherit'});
console.log('Sintassi verificata: '+files.length+' file JavaScript.');
