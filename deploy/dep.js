window.__dep = async function (o) {
  const S = window.__st = { pid: o.pid, log: [], done: false, err: null };
  const log = (m) => S.log.push(m);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const crumb = document.cookie.match(/crumb=([^;]+)/)?.[1];
  const api = '/api/pages/by-collection-id/' + o.cid;
  const get = () => fetch(api, { headers: { 'X-CSRF-Token': crumb } }).then((r) => r.json());
  const put = async (pg) => (await fetch(api, { method: 'PUT', headers: { 'X-CSRF-Token': crumb, 'Content-Type': 'application/json' }, body: JSON.stringify(pg) })).status;
  const btnText = (t) => [...document.querySelectorAll('button')].find((b) => b.innerText.trim() === t);
  const tb = (sid, kind) => [...document.querySelectorAll('[data-test="toolbar-button-' + kind + '"]')].find((b) => { let p = b; for (let i = 0; i < 15 && p; i++) { if (p.dataset && p.dataset.sectionId) return p.dataset.sectionId === sid; p = p.parentElement; } return false; });
  const until = async (fn, ms = 30000) => { const t = Date.now(); while (Date.now() - t < ms) { const v = fn(); if (v) return v; await sleep(400); } return null; };
  const base = 'https://atlas.studioartsupportservices.com/deploy/' + o.pid + '/';
  const fetchFiles = async (names, prefix) => { const dt = new DataTransfer(); for (const n of names) { const b = await fetch(base + n, { cache: 'no-store' }).then((r) => { if (!r.ok) throw new Error(n + ' ' + r.status); return r.blob(); }); dt.items.add(new File([b], o.pid + prefix + n, { type: 'image/jpeg' })); } return dt.files; };
  const items = () => [...document.querySelectorAll('ul.vSEmtuqCq8lXLtbQ > li')];
  const srcs = () => items().map((li) => li.querySelector('img')?.src || '');
  const fillGallery = async (sid, names, prefix, keepRe) => {
    tb(sid, 'gallery').click();
    await until(() => document.querySelector('input[type=file][multiple]') && items().length >= 0, 10000); await sleep(1500);
    const inp = document.querySelector('input[type=file][multiple]');
    inp.files = await fetchFiles(names, prefix); inp.dispatchEvent(new Event('change', { bubbles: true }));
    { let last = -1, stable = 0; const t0 = Date.now();
      while (Date.now() - t0 < 150000) { const c = srcs().filter((s) => keepRe.test(s)).length; if (c >= names.length) break; if (c === last) stable++; else { stable = 0; last = c; } if (stable > 40 && c > 0) break; await sleep(500); }
      log('uploaded ' + srcs().filter((s) => keepRe.test(s)).length + '/' + names.length); }
    let n = 0;
    for (let k = 0; k < 60; k++) {
      const old = items().find((li) => { const s = li.querySelector('img')?.src || ''; return s && !s.startsWith('blob:') && !s.startsWith('data:') && !keepRe.test(s); });
      if (!old) break;
      old.querySelectorAll('button')[1].click(); await sleep(700); btnText('Confirm')?.click(); await sleep(1300); n++;
    }
    const final = srcs().map((s) => s.split('/').pop());
    btnText('Close')?.click(); await sleep(1200);
    return { removed: n, final };
  };
  try {
    if (!btnText('Exit')) { (btnText('Edit') || [...document.querySelectorAll('a,button')].find((b) => b.innerText.trim() === 'Edit')).click(); await until(() => btnText('Exit'), 20000); await sleep(2500); }
    let pg = await get();
    let secs = pg.regions[0].sections;
    const isGal = (s) => s.sectionDefinitionName === 'gallery';
    const isHtmlFE = (s) => s.sectionName === 'FLUID_ENGINE' && (s.fluidEngineContext?.gridContents || []).some((g) => g.content?.value?.type === 1337);
    const galIdx = secs.findIndex(isGal);
    if (galIdx < 0) throw new Error('no gallery section');
    const hdr = secs.find((s) => s.sectionName === 'FLUID_ENGINE' && s.backgroundImageId) || secs.find(isHtmlFE);
    const gal = secs[galIdx];
    const hasProcHdr = secs.some((s) => JSON.stringify(s.fluidEngineContext || {}).includes('>Process</h2>'));
    let procGalId = null;
    if (o.nProc > 0) {
      if (hasProcHdr) { const i = secs.findIndex((s) => JSON.stringify(s.fluidEngineContext || {}).includes('>Process</h2>')); procGalId = secs[i + 1] && isGal(secs[i + 1]) ? secs[i + 1].id : null; }
      if (!procGalId) {
        const textSrc = secs.find(isHtmlFE);
        const before = new Set(secs.map((s) => s.id));
        tb(gal.id, 'duplicate').click(); await sleep(2500);
        tb(textSrc.id, 'duplicate').click(); await sleep(2500);
        btnText('Save').click(); await sleep(4000);
        pg = await get(); secs = pg.regions[0].sections;
        const added = secs.filter((s) => !before.has(s.id));
        const ng = added.find(isGal), nt = added.find((s) => !isGal(s));
        if (!ng || !nt) throw new Error('duplicate failed ' + added.length);
        // PUT 1: text -> Process heading, no bg, reorder
        const a = JSON.parse(JSON.stringify(pg)); const A = a.regions[0].sections;
        const t = A.find((s) => s.id === nt.id);
        const fe = t.fluidEngineContext; const it = fe.gridContents.find((g) => g.content?.value?.type === 1337);
        fe.gridContents = [it];
        it.content.value.value = { html: '<h2 style="white-space:pre-wrap;" data-rte-preserve-empty="true">Process</h2>' };
        if (t.backgroundImageId) t.backgroundImageId = null;
        t.styles.sectionHeight = 'section-height--custom'; t.styles.customSectionHeight = 1; t.styles.imageOverlayOpacity = 0;
        it.layout.desktop.start = { x: 1, y: 1 }; it.layout.desktop.end = { x: 15, y: 4 }; it.layout.mobile.start = { x: 1, y: 1 }; it.layout.mobile.end = { x: 8, y: 3 };
        const rest = A.filter((s) => s.id !== nt.id && s.id !== ng.id);
        const gi = rest.findIndex((s) => s.id === gal.id);
        rest.splice(gi + 1, 0, t, A.find((s) => s.id === ng.id));
        a.regions[0].sections = rest;
        log('put1 ' + (await put(a)));
        pg = await get();
        const b = JSON.parse(JSON.stringify(pg)); const tt = b.regions[0].sections.find((s) => s.id === nt.id);
        tt.fluidEngineContext.gridSettings.breakpointSettings.desktop.rows = 5; tt.fluidEngineContext.gridSettings.breakpointSettings.mobile.rows = 4; delete tt.childrenEstimatedLayouts;
        log('put2 ' + (await put(b)));
        procGalId = ng.id;
        // reload editor so toolbars exist for the new sections
        if (o.noReload) { S.done = true; return 'reload'; } location.href = '/config/pages?frameUrl=%2F' + o.slug; return 'reload';
      }
    }
    if (o.nWeb > 0) { const tg = o.tag ? o.tag + '-' : ''; const r = await fillGallery(gal.id, o.web, '-' + tg, new RegExp(o.pid + '-' + tg + 'w\\d')); log('web ' + JSON.stringify(r)); }
    if (o.nProc > 0 && procGalId) { const r = await fillGallery(procGalId, o.proc, '-process-', new RegExp(o.pid + '-process-p\\d')); log('proc ' + JSON.stringify(r)); }
    if (o.hero && hdr && hdr.backgroundImageId) {
      tb(hdr.id, 'settings').click(); await sleep(2000);
      const tab = [...document.querySelectorAll('[role=tab],button')].find((b) => b.innerText.trim() === 'Background'); tab?.click(); await sleep(1500);
      const inp = await until(() => document.querySelector('input[type=file]:not([multiple])'), 8000);
      if (inp) { inp.files = await fetchFiles([o.hero], '-hero-'); inp.dispatchEvent(new Event('change', { bubbles: true })); await sleep(9000); log('hero set'); } else log('hero: no input');
    }
    const sv = btnText('Save'); if (sv && !sv.disabled) { sv.click(); await sleep(4000); }
    S.done = true; return 'ok';
  } catch (e) { S.err = String(e); S.done = true; return 'err ' + e; }
};
'loaded';
