/** ORE Dashboard Filters asset assembly. Copyright (c) 2026 Anthony Finnerty. GPL-3.0-only. */
import {copyFile, mkdir} from 'node:fs/promises';
import {join, resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const dst=join(root,'public','build');
await mkdir(dst,{recursive:true});
// JavaScript is bundled by Vite (vite.config.js). The stylesheet stays a
// separate file so it can be served under a strict CSP.
await copyFile(join(root,'resources','css','ore-dashboard-layout.css'),join(dst,'ore-dashboard-layout.css'));
console.log('ORE Dashboard Filters assets assembled');
