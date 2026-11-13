/** ORE Dashboard Filters asset assembly. Copyright (c) 2026 Anthony Finnerty. GPL-3.0-only. */
import {copyFile, mkdir, readFile, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const src=join(root,'resources');
const dst=join(root,'public','build');
await mkdir(dst,{recursive:true});
for(const name of ['ore-v2.js','ore-settings.js','ore-flag-icons.js','ore-settings-refined.js']){
 await copyFile(join(src,'js',name),join(dst,name));
}
await copyFile(join(src,'css','ore-dashboard-layout.css'),join(dst,'ore-dashboard-layout.css'));
const base=await readFile(join(src,'js','ore-v3.js'),'utf8');
const patch=await readFile(join(src,'js','ore-dashboard-enhancements.js'),'utf8');
await writeFile(join(dst,'ore-v3.js'),base+'\n'+patch);
console.log('ORE Dashboard Filters assets assembled');
