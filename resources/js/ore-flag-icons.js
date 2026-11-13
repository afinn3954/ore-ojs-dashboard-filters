/* ORE Dashboard Filters: bundled, allowlisted vector icons. No third-party calls.
 * Outline shapes use the Lucide icon design vocabulary (ISC / MIT licence).
 * Copyright (c) 2026 Anthony Finnerty. Released under GPL-3.0-only.
 */
(() => {
  'use strict';
  if (window.oreDashboardFlagIcons) return;
  // SVG element instructions, never user-controlled markup.
  const data = {
    'check-circle': [['circle',{cx:12,cy:12,r:10}],['path',{d:'m8 12 3 3 5-6'}]],
    'circle-alert': [['circle',{cx:12,cy:12,r:10}],['path',{d:'M12 8v4'}],['path',{d:'M12 16h.01'}]],
    'clock': [['circle',{cx:12,cy:12,r:10}],['path',{d:'M12 6v6l4 2'}]],
    'flag': [['path',{d:'M4 22V4'}],['path',{d:'M4 4c4-3 8 3 12 0v12c-4 3-8-3-12 0'}]],
    'shield-check': [['path',{d:'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z'}],['path',{d:'m9 12 2 2 4-4'}]],
    'bookmark': [['path',{d:'M5 4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v18l-7-5-7 5Z'}]],
    'star': [['path',{d:'m12 2 3 6.3 6.9 1-5 4.9 1.2 7-6.1-3.4-6.1 3.4 1.2-7-5-4.9 6.9-1Z'}]],
    'eye': [['path',{d:'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z'}],['circle',{cx:12,cy:12,r:3}]],
    'file-check': [['path',{d:'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z'}],['path',{d:'M14 2v6h6'}],['path',{d:'m9 15 2 2 4-4'}]],
    'search': [['circle',{cx:11,cy:11,r:7}],['path',{d:'m16 16 5 5'}]],
    'pause-circle': [['circle',{cx:12,cy:12,r:10}],['path',{d:'M10 8v8M14 8v8'}]],
    'circle-x': [['circle',{cx:12,cy:12,r:10}],['path',{d:'m9 9 6 6m0-6-6 6'}]],
    'message-circle': [['path',{d:'M20 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L2 21l1.9-5.5A9 9 0 0 1 3 11.5a8.5 8.5 0 0 1 17 0Z'}]],
    'mail': [['rect',{x:2,y:4,width:20,height:16,rx:2}],['path',{d:'m2 6 10 7 10-7'}]],
    'calendar': [['rect',{x:3,y:5,width:18,height:16,rx:2}],['path',{d:'M16 3v4M8 3v4M3 10h18'}]],
    'clipboard-check': [['rect',{x:5,y:4,width:14,height:18,rx:2}],['rect',{x:9,y:2,width:6,height:4,rx:1}],['path',{d:'m9 14 2 2 4-4'}]],
    'alert-triangle': [['path',{d:'M10.3 3.9 1.8 18.2A2 2 0 0 0 3.5 21h17a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z'}],['path',{d:'M12 9v4M12 17h.01'}]],
    'info': [['circle',{cx:12,cy:12,r:10}],['path',{d:'M12 11v6M12 7h.01'}]],
    'tag': [['path',{d:'M20 13 12 21 3 12V3h9l8 8a2 2 0 0 1 0 2Z'}],['circle',{cx:7.5,cy:7.5,r:1}]],
    'layers': [['path',{d:'m12 2 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 17l9 5 9-5'}]],
    'check': [['path',{d:'m4 12 5 5L20 6'}]],
    'circle-help': [['circle',{cx:12,cy:12,r:10}],['path',{d:'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4M12 17h.01'}]],
    'hourglass': [['path',{d:'M6 2h12M6 22h12M7 2v4l5 6-5 6v4M17 2v4l-5 6 5 6v4'}]],
    'bell': [['path',{d:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4'}]],
  };
  const names = Object.keys(data);
  function svg(icon, size=16, colour='currentColor') {
    const ns='http://www.w3.org/2000/svg';
    const el=document.createElementNS(ns,'svg');
    for (const [k,v] of Object.entries({viewBox:'0 0 24 24',width:String(size),height:String(size),fill:'none',stroke:colour,'stroke-width':'2','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'})) el.setAttribute(k,v);
    for (const [tag,attrs] of data[icon]||data.flag) {
      const part=document.createElementNS(ns,tag);
      for(const [k,v] of Object.entries(attrs)) part.setAttribute(k,String(v));
      el.append(part);
    }
    return el;
  }
  window.oreDashboardFlagIcons = Object.freeze({data,names,svg});
})();
