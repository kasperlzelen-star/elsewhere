(function () {
  'use strict';
  const C = window.WayCore;
  const $ = id => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';
  const MAX_FILE_BYTES = 524288;
  const origins = {human:"A person's own contribution", assisted:'A person with software assistance', software:'Software-generated contribution', imagined:'Imagined perspective — not a represented being speaking'};
  const kinds = {question:'A question',play:'Something made in play',care:'Observation or possible repair',note:'Note or request to preserve something',arrangement:'An arrangement'};
  const decisions = {accepted:'Carried forward', held:'Question left unresolved', declined:'Decline recorded — offer retained in history'};
  const invitations = [
    ['What becomes possible between places?', 'Try a different connection. Or stay with this arrangement without explaining it.'],
    ['Who or what is missing from this view?', 'You can leave a question about an absent participant or an unknown consequence. An imagined account should remain labelled imagined.'],
    ['Is another explanation possible?', 'A connection can be a route, a relationship, or something you have not named. Which reading are you using?'],
    ['What might be worth leaving alone?', 'More paths are not automatically better. You may preserve something, or decline this invitation.'],
    ['Could a small change repair a burden?', 'Try a reversible change. What would you need to learn from those affected before deciding it helped?']
  ];
  let edition, edges, start = 'clearing', trial = '', undo = [], mode = 'wander';
  let offerPreview = null, reviewedOffer = null, nextEdition = null, filePurpose = null, pendingImport = null, invitation = 0;

  function el(tag, text, cls) {
    const e = document.createElement(tag);
    if (text !== undefined && text !== null) e.textContent = String(text);
    if (cls) e.className = cls;
    return e;
  }
  function svgEl(tag, attributes) {
    const e = document.createElementNS(NS, tag);
    Object.entries(attributes || {}).forEach(([k,v]) => e.setAttribute(k,String(v)));
    return e;
  }
  function title(id) { return C.NODES.find(n => n.id === id).title; }
  function key(edge) { return edge.slice().sort().join('|'); }
  function pathName(edge) { return edge.map(title).join(' ↔ '); }
  function same(a,b) { return JSON.stringify(a) === JSON.stringify(b); }
  function pathsList(list) { return list.length ? list.map(pathName).join('; ') : 'none'; }
  function announce(message, error) {
    $('status').textContent = message;
    $('status').classList.toggle('warning', !!error);
    if(error){$('status').tabIndex=-1;$('status').focus();}
  }
  function errorText(error) {
    return error && Array.isArray(error.errors) ? error.errors.join(' ') : error.message || 'This file could not be opened.';
  }
  function clearNode(node) { node.replaceChildren(); }
  function invalidateOffer() {
    offerPreview = null;
    $('offer-preview').hidden = true;
  }
  function clearOfferForm() {
    $('offer-form').reset();
    $('process-needed').textContent = '(optional)';
    $('offer-process').required = false;
    invalidateOffer();
  }
  function clearReview() {
    reviewedOffer = null; nextEdition = null;
    $('review-offer').hidden = true;
    $('review-form').hidden = true;
    $('next-edition').hidden = true;
    $('close-review').hidden = true;
    $('review-form').reset();
  }
  function switchMode(next, focus) {
    if (!['wander','relationships','offer','history','steward','left'].includes(next)) return;
    mode = next;
    if(next==='left'){pendingImport=null;importPanel.hidden=true;}
    document.querySelectorAll('[data-view]').forEach(v => { v.hidden = v.dataset.view !== mode; });
    document.querySelectorAll('.mode-nav [data-mode]').forEach(b => {
      if (b.dataset.mode === mode) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current');
    });
    if (focus !== false) $(mode === 'left' ? 'left-title' : mode === 'relationships' ? 'relationships-title' : mode === 'wander' ? 'wander-title' : mode + '-title').focus();
    announce('');
  }
  function setArrangement(newEdges, message) {
    const canonical = C.canonicalEdges(newEdges);
    if (!same(canonical,edges)) {
      undo.push(edges.map(e=>e.slice()));
      if (undo.length > 32) undo.shift();
      edges = canonical;
      trial = ''; invalidateOffer(); renderWorld();
    }
    announce(message || 'Your private arrangement changed. The shared edition has not changed.');
  }
  function renderMap(targetId, excluded) {
    const host = $(targetId); clearNode(host);
    const map = svgEl('svg',{viewBox:'0 0 640 420',class:'world-map',role:'group','aria-label':'Five fictional places and the paths between them. A labelled list provides the same choices.'});
    const note = svgEl('title'); note.textContent = 'A Way Through: your arrangement'; map.append(note);
    // Decorative terrain is still, local and deliberately non-geographic.
    map.append(svgEl('ellipse',{cx:330,cy:230,rx:276,ry:155,fill:'#e2e7d8',stroke:'none'}));
    map.append(svgEl('ellipse',{cx:165,cy:250,rx:78,ry:60,fill:'#cbdedc',stroke:'none'}));
    const positions = {};
    C.NODES.forEach(n=> { positions[n.id] = {x:n.x*6.4,y:n.y*4.2}; });
    edges.forEach(edge => {
      const a = positions[edge[0]], b = positions[edge[1]];
      const removed = excluded && key(edge) === key(excluded);
      map.append(svgEl('path',{d:'M '+a.x+' '+a.y+' Q '+((a.x+b.x)/2+12)+' '+((a.y+b.y)/2-18)+' '+b.x+' '+b.y,class:'path'+(removed?' removed':''),fill:'none','aria-hidden':'true'}));
    });
    C.NODES.forEach(n=>{
      const p=positions[n.id];
      const group=svgEl('g',{class:'place'+(n.id===start?' active':''),'data-node':n.id,tabindex:0,role:'button','aria-label':'Start from '+n.title,'aria-pressed':n.id===start?'true':'false'});
      group.append(svgEl('circle',{cx:p.x,cy:p.y,r:22}));
      const label=svgEl('text',{x:p.x,y:p.y+44,class:'place-label','text-anchor':'middle'});
      label.textContent=n.title; group.append(label);
      function choose() { start=n.id; renderWorld(); $(targetId).querySelector('[data-node="'+n.id+'"]').focus(); announce('Exploring from '+n.title+'.'); }
      group.addEventListener('click',choose);
      group.addEventListener('keydown',e=> { if(e.key==='Enter'||e.key===' '){e.preventDefault(); choose();} });
      map.append(group);
    });
    host.append(map);
  }
  function renderPathChoices(id, prefix) {
    const host=$(id); clearNode(host);
    C.ALL_EDGES.forEach(edge=>{
      const label=el('label',null,'route-label');
      const input=el('input'); input.type='checkbox'; input.id=prefix+'-'+key(edge).replace('|','-');
      input.checked=edges.some(e=>key(e)===key(edge));
      input.addEventListener('change',()=>{
        const selectedKey=key(edge), shouldAdd=input.checked, focusId=input.id;
        const next=edges.filter(e=>key(e)!==selectedKey);
        if(shouldAdd) next.push(edge);
        setArrangement(next,(shouldAdd?'Added ':'Removed ')+pathName(edge)+'. This is a private change.');
        $(focusId).focus();
      });
      label.append(input,el('span',pathName(edge))); host.append(label);
    });
  }
  function renderWorld() {
    document.querySelectorAll('[data-start]').forEach(select=>{
      clearNode(select);
      C.NODES.forEach(n=> { const option=el('option',n.title); option.value=n.id; select.append(option); });
      select.value=start;
    });
    renderPathChoices('wander-paths','wander-path');
    renderPathChoices('relationship-paths','text-path');
    const trialSelect=$('trial-path'); clearNode(trialSelect);
    const all=el('option','All current paths open'); all.value=''; trialSelect.append(all);
    edges.forEach(edge=> { const option=el('option',pathName(edge)); option.value=key(edge); trialSelect.append(option); });
    if (!edges.some(e=>key(e)===trial)) trial='';
    trialSelect.value=trial;
    const excluded=trial?trial.split('|'):null;
    const analysis=C.analyse(edges,start,excluded || undefined);
    const routes=$('route-results'); clearNode(routes);
    C.NODES.forEach(n=>{
      const route=analysis.shortestPaths[n.id];
      routes.append(el('li',n.id===start ? n.title+': your starting place.' : !route ? n.title+': no route from '+title(start)+'.' : n.title+': '+route.map(title).join(' → ')+' ('+(route.length-1)+(route.length===2?' step).':' steps).')));
    });
    const results=$('analysis-results'); clearNode(results);
    results.append(el('h3',analysis.connected?'Every place is connected.':'Some places are separate.'));
    results.append(el('p','From '+title(start)+', '+analysis.reachable.length+' of 5 places are reachable'+(excluded?' with '+pathName(excluded)+' closed.':'.')));
    results.append(el('p','Groups connected to one another: '+analysis.components.map(c=>c.map(title).join(', ')).join(' / ')+'.'));
    const full=C.analyse(edges,start);
    results.append(el('p',full.bridges.length?'Paths whose removal would separate the arrangement: '+pathsList(full.bridges)+'.':'No single current path separates this arrangement when removed.'));
    if(excluded) results.append(el('p','This closure is an experiment only. Your chosen path arrangement has not changed.','notice'));
    renderMap('wander-map');
    renderMap('relationship-map',excluded);
    document.querySelectorAll('[data-action="undo"]').forEach(b=>{b.disabled=!undo.length;});
    $('edition-label').textContent=edition.id+' · edition '+edition.version;
    renderHistory();
  }
  function appendLabeled(host,label,value,cls) {
    const p=el('p',null,cls), strong=el('strong',label+' ');
    p.append(strong,document.createTextNode(String(value))); host.append(p);
  }
  function renderOffer(host,offer) {
    clearNode(host);
    appendLabeled(host,'Offered as:',kinds[offer.kind]);
    if(offer.text) appendLabeled(host,'Selected words:',offer.text,'preserve-lines');
    appendLabeled(host,'Public credit:',offer.attribution||'No public name chosen');
    appendLabeled(host,'Origin:',origins[offer.origin]);
    if(offer.processNote) appendLabeled(host,'Process disclosed:',offer.processNote,'preserve-lines');
    if(offer.backtick) appendLabeled(host,'Backtick — attend before carrying forward:',offer.backtick,'preserve-lines');
    appendLabeled(host,'Arrangement:',offer.includeArrangement?pathsList(offer.edges):'Not included. Private path choices are absent from this offer.');
    appendLabeled(host,'Display permission:',offer.displayConsent?'Allowed for this selected offer':'Not allowed');
    appendLabeled(host,'Adaptation permission:',offer.adaptConsent?'Allowed for later ELSEWHERE editions with credit and origin retained':'Not granted');
    appendLabeled(host,'Responds to:',offer.baseEditionId);
  }
  function renderHistory() {
    $('history-edition-title').textContent=edition.id+' · edition '+edition.version;
    $('history-edition-detail').textContent=edition.history.length?'This edition carries '+edition.history.length+' recorded review decision'+(edition.history.length===1?'':'s')+'. Origins and permissions travel with each offered trace.':'The starting edition. No visitor contribution or review has been invented.';
    const diff=$('edition-differences'); clearNode(diff);
    const privateDiff=C.compareEdges(edition.edges,edges);
    if(privateDiff.added.length||privateDiff.removed.length){
      appendLabeled(diff,'Your private changes:', 'Added '+pathsList(privateDiff.added)+'. Removed '+pathsList(privateDiff.removed)+'.');
    } else diff.append(el('p',"Your arrangement matches this edition's paths."));
    const list=$('history-list'); clearNode(list);
    if(!edition.history.length) list.append(el('p','The next shared trace is still to be offered. You do not have to supply it.','empty-state'));
    edition.history.slice().reverse().forEach((entry,index)=>{
      const article=el('article',null,'history-entry panel');
      article.append(el('p',decisions[entry.decision],'eyebrow'));
      article.append(el('h2',entry.offer.text?entry.offer.text.slice(0,100)+(entry.offer.text.length>100?'…':''):kinds[entry.offer.kind]));
      appendLabeled(article,'Steward credit / role:',entry.steward);
      appendLabeled(article,'Reason / remaining question:',entry.reason,'preserve-lines');
      appendLabeled(article,'Effect on paths:',entry.appliedArrangement?'The offered arrangement was used, with adaptation permission.':'The arrangement was left unchanged.');
      const detail=el('details'), summary=el('summary','Read the selected offer, origin and permissions');
      const contents=el('div'); renderOffer(contents,entry.offer); detail.append(summary,contents); article.append(detail); list.append(article);
    });
    const older=edition.selectedMaterial.filter(entry=>!edition.history.some(h=>h.offer.offerId===entry.offer.offerId));
    older.forEach(entry=>{
      const article=el('article',null,'history-entry panel');
      article.append(el('p','Carried from an earlier review','eyebrow'));
      appendLabeled(article,'Reason retained:',entry.reason);
      appendLabeled(article,'Steward credit / role:',entry.steward);
      renderOfferIntoArticle(article,entry.offer);list.append(article);
    });
  }
  function renderOfferIntoArticle(article,offer) {
    const details=el('details'), summary=el('summary','Read this carried offer, origin and permissions'), content=el('div');
    renderOffer(content,offer);details.append(summary,content);article.append(details);
  }
  function readOfferForm() {
    return C.makeOffer({
      edition, edges,
      kind:$('offer-kind').value,text:$('offer-text').value,
      attribution:$('offer-attribution').value,origin:$('offer-origin').value,
      processNote:$('offer-process').value,backtick:$('offer-backtick').value,
      includeArrangement:$('offer-arrangement').checked,
      displayConsent:$('offer-display').checked,adaptConsent:$('offer-adapt').checked
    });
  }
  function download(value,filename) {
    const text=JSON.stringify(value,null,2)+'\n';
    const blob=new Blob([text],{type:'application/json'});
    const url=URL.createObjectURL(blob), a=el('a'); a.href=url; a.download=filename;
    document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    announce('Downloaded '+filename+' to your device. Nothing was sent or published.');
  }
  function requestFile(purpose) {
    filePurpose=purpose;
    $('file-input').value='';
    $('file-input').click();
  }
  const importPanel=el('section',null,'panel import-confirm');
  importPanel.hidden=true; importPanel.setAttribute('aria-labelledby','import-title');
  const importTitle=el('h2','Open this as a new encounter?'); importTitle.id='import-title'; importTitle.tabIndex=-1;
  const importDescription=el('p'), importYes=el('button','Replace this encounter','primary'), importNo=el('button','Keep my current encounter');
  importPanel.append(importTitle,importDescription,importYes,document.createTextNode(' '),importNo);
  $('main').prepend(importPanel);
  function offerReplacement(kind,value) {
    pendingImport={kind,value};
    const incoming=kind==='session'?value.edition:value;
    importDescription.textContent='Open '+incoming.id+' (edition '+incoming.version+'). This replaces the arrangement, offer form and review draft currently in this tab. Save anything you wish to keep first, or keep this encounter. The file carries '+incoming.history.length+' declared review record'+(incoming.history.length===1?'':'s')+'; this page does not authenticate '+(incoming.history.length===1?'it.':'them.');
    importPanel.hidden=false; importTitle.focus();
  }
  function installEdition(newEdition,newEdges) {
    edition=newEdition; edges=C.canonicalEdges(newEdges || newEdition.edges); undo=[]; trial=''; start='clearing';
    clearOfferForm(); clearReview(); renderWorld(); switchMode('wander');
  }
  function showReview(offer) {
    clearReview(); reviewedOffer=offer;
    switchMode('steward',false);
    renderOffer($('review-offer'),offer); $('review-offer').hidden=false;
    $('close-review').hidden=false;
    const matches=offer.baseEditionId===edition.id && offer.baseFingerprint===C.fingerprint(edition);
    $('review-form').hidden=!matches;
    if(!matches) {
      $('review-offer').append(el('p','This offer responds to a different or changed edition. It cannot be applied here. Open the exact original edition to review it. A new proposal for a later edition needs its own contributor choice; the file is not silently rebased.','warning notice'));
      announce('Offer opened for inspection only. Its original edition does not match this one.',true);
    } else {
      updateApplyChoice();
      announce('Offer opened for review. Your arrangement and the shared edition have not changed.');
    }
    $('review-offer').tabIndex=-1; $('review-offer').focus();
  }
  function updateApplyChoice() {
    const canApply=reviewedOffer && reviewedOffer.includeArrangement && reviewedOffer.adaptConsent && $('review-decision').value==='accepted';
    $('review-apply').disabled=!canApply;
    if(!canApply) $('review-apply').checked=false;
    $('review-apply-help').textContent=!reviewedOffer?'':!reviewedOffer.includeArrangement?'This offer includes no arrangement.':!reviewedOffer.adaptConsent?'The contributor did not grant adaptation permission. You can display the selected offer, but cannot use its paths to change the shared arrangement.':$('review-decision').value!=='accepted'?'An unresolved or declined offer does not change paths.':"This explicit choice uses the offered paths, replacing the edition's paths. Your private path edits are not part of the review.";
    nextEdition=null; $('next-edition').hidden=true;
  }
  importNo.addEventListener('click',()=>{pendingImport=null;importPanel.hidden=true;announce('Kept your current encounter.');$('main').focus();});
  importYes.addEventListener('click',()=>{
    if(!pendingImport)return;
    const p=pendingImport; pendingImport=null; importPanel.hidden=true;
    installEdition(p.kind==='session'?p.value.edition:p.value,p.kind==='session'?p.value.edges:undefined);
    announce('Opened the selected file. Its offer permissions have not become permissions for your own contribution.');
  });
  document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>switchMode(b.dataset.mode)));
  $('leave').addEventListener('click',()=>switchMode('left'));
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.preventDefault();switchMode('left');}
  });
  document.querySelectorAll('[data-start]').forEach(s=>s.addEventListener('change',()=>{start=s.value;renderWorld();$(s.id).focus();announce('Exploring from '+title(start)+'.');}));
  document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>{
    if(b.dataset.action==='undo'&&undo.length){edges=undo.pop();trial='';invalidateOffer();renderWorld();announce('Undid your last path change.');}
    if(b.dataset.action==='restore')setArrangement(edition.edges,"Restored this edition's paths. You can undo this choice.");
  }));
  $('trial-path').addEventListener('change',()=>{trial=$('trial-path').value;renderWorld();$('trial-path').focus();});
  $('another-question').addEventListener('click',()=>{
    invitation=(invitation+1)%invitations.length;
    $('question-title').textContent=invitations[invitation][0];$('question-text').textContent=invitations[invitation][1];
    announce('Another invitation: '+invitations[invitation][0]);
  });
  $('offer-form').addEventListener('input',()=>{
    invalidateOffer();const need=$('offer-origin').value!=='human';
    $('process-needed').textContent=need?'(required for this origin)':'(optional)';$('offer-process').required=need;
  });
  $('offer-form').addEventListener('change',invalidateOffer);
  $('offer-form').addEventListener('submit',e=>{
    e.preventDefault();
    try {
      if(!$('offer-display').checked)throw new Error('Choose display permission before preparing an offer for a reviewed edition. You can also keep a private encounter without granting this permission.');
      if(!$('offer-text').value.trim()&&!$('offer-backtick').value.trim()&&!$('offer-arrangement').checked)throw new Error('Select some words, a backtick or your arrangement before previewing an offer.');
      if($('offer-kind').value==='arrangement'&&!$('offer-arrangement').checked)throw new Error('Choose “Include my current arrangement” for an arrangement offer, or select another kind of offer.');
      offerPreview=readOfferForm(); renderOffer($('offer-summary'),offerPreview);$('offer-json').textContent=JSON.stringify(offerPreview,null,2);$('offer-preview').hidden=false;$('offer-preview').tabIndex=-1;$('offer-preview').focus();announce('This preview contains the entire selected offer. Nothing has been sent.'); }
    catch(error){invalidateOffer();announce(errorText(error),true);}
  });
  $('clear-offer').addEventListener('click',()=>{clearOfferForm();announce('Cleared the offer form. Your arrangement is still here.');});
  $('download-offer').addEventListener('click',()=>{
    if(!offerPreview){announce('Preview the current selection before downloading it.',true);return;}
    download(offerPreview,'a-way-through-offer-'+offerPreview.offerId+'.json');
  });
  $('save-session').addEventListener('click',()=>download(C.makeSession(edition,edges),'a-way-through-private-'+edition.id+'.json'));
  $('open-session').addEventListener('click',()=>requestFile('session'));
  $('open-edition').addEventListener('click',()=>requestFile('edition'));
  $('save-edition').addEventListener('click',()=>download(edition,'a-way-through-edition-'+edition.id+'.json'));
  $('restore-arrangement').addEventListener('click',()=>{setArrangement(edition.edges,"Restored this edition's arrangement. Your private offer words remain in their form.");switchMode('wander');});
  $('open-offer').addEventListener('click',()=>requestFile('offer'));
  $('close-review').addEventListener('click',()=>{clearReview();announce('Closed the review without making an edition. No offered material was carried forward.');$('open-offer').focus();});
  $('file-input').addEventListener('change',async()=>{
    const file=$('file-input').files[0], purpose=filePurpose;
    if(!file)return;
    try{
      if(file.size>MAX_FILE_BYTES)throw new Error('This file is too large. Choose a JSON file under 512 KiB.');
      const raw=JSON.parse(await file.text());
      const result=purpose==='session'?C.validateSession(raw):purpose==='edition'?C.validateEdition(raw):C.validateOffer(raw);
      if(!result.ok)throw new C.ValidationError(result.errors);
      if(purpose==='offer')showReview(result.value);else offerReplacement(purpose,result.value);
    }catch(error){announce('The file was not applied. '+errorText(error),true);}
    finally{$('file-input').value='';}
  });
  $('review-decision').addEventListener('change',updateApplyChoice);
  $('review-form').addEventListener('input',()=>{nextEdition=null;$('next-edition').hidden=true;});
  $('review-form').addEventListener('submit',e=>{
    e.preventDefault();
    try{
      if(!reviewedOffer)throw new Error('Open an offer first.');
      if(!$('review-confirm').checked)throw new Error('Review the selected material and confirm the stated review before preparing an edition.');
      nextEdition=C.reviewOffer({edition,offer:reviewedOffer,decision:$('review-decision').value,reason:$('review-reason').value,steward:$('review-steward').value,applyArrangement:$('review-apply').checked});
      const summary=$('next-summary');clearNode(summary);
      appendLabeled(summary,'New edition:',nextEdition.id);
      appendLabeled(summary,'Decision:',decisions[$('review-decision').value]);
      const diff=C.compareEdges(edition.edges,nextEdition.edges);
      appendLabeled(summary,'Paths added:',pathsList(diff.added));appendLabeled(summary,'Paths removed:',pathsList(diff.removed));
      appendLabeled(summary,'Reason / remaining question:',$('review-reason').value,'preserve-lines');
      summary.append(el('p','The selected offer, its original edition, origin, permissions and this review decision travel in the file. No private arrangement or unoffered form text is added.'));
      $('next-edition').hidden=false;$('next-edition').tabIndex=-1;$('next-edition').focus();
      announce('Prepared a local next edition. Nothing has been published or sent.');
    }catch(error){nextEdition=null;$('next-edition').hidden=true;announce(errorText(error),true);}
  });
  $('download-next').addEventListener('click',()=>{if(nextEdition)download(nextEdition,'a-way-through-edition-'+nextEdition.id+'.json');});
  $('visit-next').addEventListener('click',()=>{if(nextEdition)offerReplacement('edition',nextEdition);});
  try{
    const parsed=C.validateEdition(JSON.parse($('starting-edition').textContent));
    if(!parsed.ok)throw new C.ValidationError(parsed.errors);
    edition=parsed.value;edges=C.canonicalEdges(edition.edges);renderWorld();
  }catch(error){
    document.querySelectorAll('main button,main input,main select,main textarea').forEach(e=>{e.disabled=true;});
    announce('The starting edition could not be opened. '+errorText(error),true);
  }
})();
