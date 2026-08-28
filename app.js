(() => {
  'use strict';
  const P = window.TYLER_PROGRAM;
  const L = window.TylerLogic;
  const STORE_KEY = 'tylerOSMobileV1';
  const app = document.getElementById('app');
  const toastEl = document.getElementById('toast');

  const defaultState = () => ({
    version: 1,
    activeProfileId: 'tyler',
    profiles: [
      { id:'tyler', name:'Tyler', startDate:'2026-08-10' },
      { id:'benjamin', name:'Benjamin', startDate:'' }
    ],
    sessions: [],
    activeSessionId: null,
    settings: { lastView:'home' }
  });

  let state = loadState();
  let view = state.settings?.lastView || 'home';
  let selectedWeek = null;
  let selectedWorkoutId = null;
  let restTimer = null;
  let guideTimer = null;

  function loadState(){
    try {
      const raw=localStorage.getItem(STORE_KEY);
      if(!raw) return defaultState();
      const s=JSON.parse(raw);
      return {...defaultState(),...s,settings:{...defaultState().settings,...(s.settings||{})}};
    } catch(e){ console.error(e); return defaultState(); }
  }
  function saveState(){ localStorage.setItem(STORE_KEY,JSON.stringify(state)); }
  function activeProfile(){ return state.profiles.find(p=>p.id===state.activeProfileId)||state.profiles[0]; }
  function workoutBy(phase,slot){ return P.workouts.find(w=>w.phase===phase&&w.slot===slot); }
  function workoutById(id){ return P.workouts.find(w=>w.id===id); }
  function sessionById(id){ return state.sessions.find(s=>s.id===id); }
  function sessionFor(profileId,dateKey,workoutId){ return state.sessions.find(s=>s.profileId===profileId&&s.date===dateKey&&s.workoutId===workoutId&&s.status!=='deleted'); }
  function sessionForWeekWorkout(profileId,week,workoutId){
    return state.sessions.filter(s=>s.profileId===profileId&&Number(s.week)===Number(week)&&s.workoutId===workoutId&&s.status!=='deleted').sort((a,b)=>(b.completedAt||b.startedAt||b.date).localeCompare(a.completedAt||a.startedAt||a.date))[0] || null;
  }
  function sessionsForProfile(){ return state.sessions.filter(s=>s.profileId===state.activeProfileId&&s.status!=='deleted'); }
  function today(){ return new Date(); }
  function toast(msg){ toastEl.textContent=msg; toastEl.classList.add('show'); setTimeout(()=>toastEl.classList.remove('show'),1800); }
  function esc(s){ return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function fmtDate(k){ const d=L.parseLocalDate(k); return d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}); }
  function navHtml(active){
    return `<nav class="nav">
      ${[['home','Home'],['workouts','Workouts'],['review','Weekly'],['settings','Settings']].map(([v,n])=>`<button data-nav="${v}" class="${active===v?'active':''}">${n}</button>`).join('')}
    </nav>`;
  }
  function headerHtml(title='Tyler OS',sub='Mobile V1'){
    return `<div class="header"><div class="brand"><h1>${esc(title)}</h1><p>${esc(sub)}</p></div><span class="pill gray">${esc(activeProfile().name)}</span></div>`;
  }
  function bindNav(){ document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>go(b.dataset.nav)); }
  function go(v){ view=v; state.settings.lastView=v; saveState(); render(); window.scrollTo({top:0,behavior:'instant'}); }

  function currentProgramInfo(date=new Date()){
    const p=activeProfile();
    const week=L.programWeek(p.startDate,date);
    const phase=L.phaseForWeek(week);
    const phaseWeek=L.phaseWeek(week);
    const next=L.nextScheduledSlot(date);
    const nextWeek=L.programWeek(p.startDate,next.date);
    const nextPhase=L.phaseForWeek(nextWeek);
    return {week,phase,phaseWeek,nextSlot:next.slot,nextDate:next.date,nextWeek,nextPhase,workout:workoutBy(nextPhase,next.slot)};
  }

  function render(){
    stopGuide(false);
    if(view==='workout') return renderWorkout();
    if(view==='home') return renderHome();
    if(view==='workouts') return renderWorkouts();
    if(view==='review') return renderReview();
    if(view==='settings') return renderSettings();
    renderHome();
  }

  function renderHome(){
    const p=activeProfile();
    if(!p.startDate){
      app.innerHTML=headerHtml()+`<div class="card hero"><div class="big">Set ${esc(p.name)}'s program start date</div><p class="muted">Tyler OS uses the calendar to determine the active program week. Missed workouts never block progression.</p><button class="btn primary full" data-nav="settings">Open Settings</button></div>`+navHtml('home');
      bindNav(); return;
    }
    const info=currentProgramInfo();
    const targetDate=L.localDateKey(info.nextDate);
    const existing=sessionFor(p.id,targetDate,info.workout.id);
    const recent=sessionsForProfile().filter(s=>s.status==='completed').sort((a,b)=>(b.completedAt||b.date).localeCompare(a.completedAt||a.date)).slice(0,3);
    const weekStatuses=getWeekStatuses(info.week);
    app.innerHTML=headerHtml('Tyler OS','Local-first • instant workout logging')+`
      <div class="card hero">
        <div class="label muted">Current Program</div>
        <div class="big">Week ${info.week} of 12</div>
        <div class="muted">Phase ${info.phase} — ${esc(workoutBy(info.phase,1).phaseName)} • Week ${info.phaseWeek} of 4</div>
        <hr style="border-color:#374151">
        <div class="label muted">Next Scheduled</div>
        <div class="value">${esc(info.workout.name)}</div>
        <div class="small muted">${info.nextDate.toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'})}</div>
        <div class="row" style="margin-top:14px">
          <button id="startNext" class="btn primary grow">${existing?.status==='partial'?'Resume':'Start Workout'}</button>
          <button id="skipNext" class="btn ghost">Skip</button>
        </div>
      </div>
      <div class="card tight">
        <div class="row between"><div><div class="label">This Week</div><div class="value">Week ${info.week}</div></div><button class="btn sm ghost" id="openReview">Review</button></div>
        <div class="week-grid" style="margin-top:12px">${weekStatuses.map(x=>`<div class="day-chip ${x.status}">${x.short}<br>${x.status==='done'?'✓':x.status==='partial'?'…':x.status==='missed'?'—':'•'}</div>`).join('')}</div>
      </div>
      <div class="section-title">Recent Workouts</div>
      ${recent.length?recent.map(s=>`<div class="workout-card"><div class="row between"><div><strong>${esc(s.workoutName)}</strong><div class="small muted">${fmtDate(s.date)}</div></div><span class="pill green">${L.formatVolume(sessionVolume(s))} lb</span></div>${s.comments?`<div class="comment">${esc(s.comments)}</div>`:''}</div>`).join(''):`<div class="card"><span class="muted">No completed workouts yet on this device.</span></div>`}
      ${navHtml('home')}`;
    document.getElementById('startNext').onclick=()=>startWorkout(info.workout.id,targetDate,info.nextWeek);
    document.getElementById('skipNext').onclick=()=>skipWorkout(info.workout.id,targetDate,info.nextWeek);
    document.getElementById('openReview').onclick=()=>{selectedWeek=info.week;go('review')};
    bindNav();
  }

  function getWeekStatuses(week){
    const p=activeProfile();
    const names=['Mon','Tue','Wed','Fri','Sat'];
    return [1,2,3,4,5].map((slot,i)=>{
      const d=L.scheduledDateForWeekSlot(p.startDate,week,slot); const dk=L.localDateKey(d);
      const phase=L.phaseForWeek(week); const w=workoutBy(phase,slot); const s=sessionForWeekWorkout(p.id,week,w.id);
      let status='future';
      if(s?.status==='completed') status='done'; else if(s?.status==='partial') status='partial'; else if(s?.status==='skipped') status='missed'; else if(L.diffDays(today(),d)>0) status='missed';
      return {slot,short:names[i],date:dk,workout:w,session:s,status};
    });
  }

  function renderWorkouts(){
    const p=activeProfile();
    const info=currentProgramInfo();
    const week=selectedWeek||info.week; selectedWeek=week;
    const phase=L.phaseForWeek(week);
    app.innerHTML=headerHtml('Workouts',`Choose any workout • Week ${week}`)+`
      <div class="card tight"><div class="row between"><button id="prevW" class="btn sm ghost" ${week<=1?'disabled':''}>←</button><div style="text-align:center"><div class="label">Program Week</div><div class="value">${week} of 12</div></div><button id="nextW" class="btn sm ghost" ${week>=12?'disabled':''}>→</button></div></div>
      ${[1,2,3,4,5].map(slot=>{
        const w=workoutBy(phase,slot); const d=L.scheduledDateForWeekSlot(p.startDate,week,slot); const dk=L.localDateKey(d); const s=sessionForWeekWorkout(p.id,week,w.id); const shownDate=s?.date||dk;
        return `<div class="workout-card ${L.localDateKey(today())===shownDate?'today':''}"><div class="row between"><div><div class="label">Slot ${slot} • ${esc(w.day)}</div><div class="value">${esc(w.name)}</div><div class="small muted">${fmtDate(shownDate)}${s&&s.date!==dk?' • actually trained':''} • ${w.exercises.length} exercises</div></div>${s?`<span class="pill ${s.status==='completed'?'green':s.status==='partial'?'amber':'red'}">${esc(s.status)}</span>`:''}</div><button class="btn primary full startChosen" data-id="${w.id}" data-date="${s?.date||dk}" data-week="${week}" style="margin-top:10px">${s?.status==='partial'?'Resume':s?.status==='completed'?'View / Repeat':'Start'}</button></div>`;
      }).join('')}
      ${navHtml('workouts')}`;
    document.getElementById('prevW').onclick=()=>{selectedWeek=Math.max(1,week-1);renderWorkouts()};
    document.getElementById('nextW').onclick=()=>{selectedWeek=Math.min(12,week+1);renderWorkouts()};
    document.querySelectorAll('.startChosen').forEach(b=>b.onclick=()=>startWorkout(b.dataset.id,b.dataset.date,Number(b.dataset.week)));
    bindNav();
  }

  function buildSession(workout,dateKey,week){
    const phase=L.phaseForWeek(week);
    const exercises=workout.exercises.map(ex=>{
      let name=ex.name, id=ex.id;
      if(workout.id==='p3-s1' && /finisher/i.test(name)){
        if([9,11].includes(week)){ name='Push-Ups Finisher'; id=`${workout.id}-push-ups-finisher`; }
        else { name='Straight-Arm Pulldown Finisher'; id=`${workout.id}-straight-arm-pulldown-finisher`; }
      }
      return {exerciseId:id,name,volumeMultiplier:ex.volumeMultiplier||1,sets:Array.from({length:ex.sets},()=>({weight:'',reps:'',done:false}))};
    });
    return {id:L.uid('session'),profileId:state.activeProfileId,date:dateKey,week,phase,slot:workout.slot,workoutId:workout.id,workoutName:workout.name,status:'partial',comments:'',warmupStatus:'pending',coreStatus:P.core[`${phase}-${workout.slot}`]?'pending':'not-scheduled',exercises,startedAt:new Date().toISOString(),completedAt:null};
  }

  function startWorkout(workoutId,dateKey,week){
    const w=workoutById(workoutId); if(!w) return;
    let s=sessionFor(state.activeProfileId,dateKey,workoutId);
    if(s?.status==='completed'){
      if(!confirm('This workout is already completed for this date. Start a new editable copy?')){ state.activeSessionId=s.id; view='workout'; saveState(); render(); return; }
      s=null;
    }
    if(!s){ s=buildSession(w,dateKey,week); state.sessions.push(s); }
    state.activeSessionId=s.id; view='workout'; saveState(); render();
    if(s.warmupStatus==='pending') setTimeout(()=>openWarmup(s),80);
  }

  function skipWorkout(workoutId,dateKey,week){
    const w=workoutById(workoutId); if(!w) return;
    const existing=sessionFor(state.activeProfileId,dateKey,workoutId);
    if(existing){ existing.status='skipped'; existing.completedAt=new Date().toISOString(); }
    else state.sessions.push({...buildSession(w,dateKey,week),status:'skipped',warmupStatus:'skipped',coreStatus:'skipped',completedAt:new Date().toISOString()});
    saveState(); toast('Workout skipped. Program calendar keeps moving.'); render();
  }

  function activeSession(){ return sessionById(state.activeSessionId); }
  function workoutMetaForSession(s){ return workoutById(s.workoutId); }
  function metaForExercise(s,ex){
    const w=workoutMetaForSession(s); return w?.exercises.find(m=>L.canonical(m.name)===L.canonical(ex.name)||m.id===ex.exerciseId) || {name:ex.name,sets:ex.sets.length,minReps:'',topReps:'',rest:'',notes:'',warmup:'',volumeMultiplier:ex.volumeMultiplier||1};
  }
  function sessionVolume(s){ return L.sessionVolume(s,(id)=>{ const w=workoutMetaForSession(s); return w?.exercises.find(x=>x.id===id); }); }
  function previousExercise(s,exName){
    const candidates=sessionsForProfile().filter(x=>x.status==='completed'&&x.workoutId===s.workoutId&&x.id!==s.id&&x.date<s.date).sort((a,b)=>b.date.localeCompare(a.date));
    for(const old of candidates){ const ex=old.exercises.find(e=>L.canonical(e.name)===L.canonical(exName)); if(ex) return {date:old.date,ex}; }
    return null;
  }

  function renderWorkout(){
    const s=activeSession(); if(!s){ go('home'); return; }
    const w=workoutMetaForSession(s); const readOnly=s.status==='completed';
    app.innerHTML=headerHtml(s.workoutName,`${fmtDate(s.date)} • Week ${s.week}`)+`
      <div class="volume-bar"><div class="row between"><div><div class="label" style="color:#9ca3af">Workout Volume</div><div class="big"><span id="volumeTotal">${L.formatVolume(sessionVolume(s))}</span> lb</div></div><div class="small" style="text-align:right">${s.warmupStatus==='completed'?'Warm-up ✓':s.warmupStatus==='skipped'?'Warm-up skipped':'Warm-up pending'}<br>${s.coreStatus==='completed'?'Core ✓':s.coreStatus==='skipped'?'Core skipped':''}</div></div></div>
      ${readOnly?`<div class="card tight"><span class="pill green">Completed workout — read only</span></div>`:''}
      <div class="card tight"><div class="row wrap"><button id="warmBtn" class="btn sm ghost">Warm-Up</button><button id="backHome" class="btn sm ghost">Save & Exit</button></div></div>
      <div id="exerciseList">${renderExerciseBlocks(s,w,readOnly)}</div>
      <div class="card"><div class="label">Workout Comments</div><textarea id="comments" ${readOnly?'disabled':''} placeholder="How did the week/workout feel?">${esc(s.comments||'')}</textarea></div>
      ${!readOnly?`<button id="finishWorkout" class="btn good full">Finish Workout</button>`:`<button id="repeatWorkout" class="btn primary full">Start Another Copy</button>`}
      <div id="restTimer" class="timer hidden"></div>
      ${navHtml('')}`;
    bindNav();
    document.getElementById('backHome').onclick=()=>{syncSessionFromInputs();saveState();go('home')};
    document.getElementById('warmBtn').onclick=()=>openWarmup(s,true);
    document.getElementById('comments').oninput=e=>{s.comments=e.target.value;saveState()};
    if(!readOnly){
      bindSetInputs(s);
      document.getElementById('finishWorkout').onclick=()=>attemptFinish(s);
    } else document.getElementById('repeatWorkout').onclick=()=>{ const dk=L.localDateKey(today()); startWorkout(w.id,dk,L.programWeek(activeProfile().startDate,today())); };
  }

  function renderExerciseBlocks(s,w,readOnly){
    const groups=[]; let i=0;
    while(i<s.exercises.length){
      const ex=s.exercises[i], meta=metaForExercise(s,ex);
      if(meta.group && i+1<s.exercises.length){
        const ex2=s.exercises[i+1], m2=metaForExercise(s,ex2);
        if(m2.group===meta.group){ groups.push({type:'superset',items:[[ex,meta],[ex2,m2]]}); i+=2; continue; }
      }
      groups.push({type:'single',items:[[ex,meta]]}); i++;
    }
    return groups.map(g=>g.type==='superset'?renderSuperset(s,g.items,readOnly):renderSingleExercise(s,g.items[0][0],g.items[0][1],readOnly)).join('');
  }

  function previousHtml(prev){
    if(!prev) return `<div class="small muted">No previous data on this device.</div>`;
    return `<div class="small muted">Previous ${fmtDate(prev.date)}: ${prev.ex.sets.map((x,i)=>`S${i+1} ${x.weight||'—'}×${x.reps||'—'}`).join(' • ')}</div>`;
  }
  function exHeader(meta,ex){
    return `<h3>${esc(ex.name)} ${Number(ex.volumeMultiplier||meta.volumeMultiplier||1)!==1?`<span class="pill">Volume ×${ex.volumeMultiplier||meta.volumeMultiplier}</span>`:''}</h3><div class="meta">${meta.sets} sets • ${meta.minReps}–${meta.topReps} reps • Rest ${esc(meta.rest||'—')}</div>${meta.notes?`<div class="small">${esc(meta.notes)}</div>`:''}`;
  }
  function setRows(s,ex,readOnly,compact=false){
    return ex.sets.map((set,idx)=>`<div class="set-row" data-ex="${esc(ex.exerciseId)}" data-set="${idx}"><div class="set-num">${idx+1}</div><div><input ${readOnly?'disabled':''} inputmode="decimal" type="number" step="0.5" class="weight" value="${esc(set.weight)}" placeholder="0"><div class="unit">lb</div></div><div><input ${readOnly?'disabled':''} inputmode="numeric" type="number" step="1" class="reps" value="${esc(set.reps)}" placeholder="0"><div class="unit">reps</div></div><button ${readOnly?'disabled':''} class="check ${set.done?'done':''}" aria-label="set done">${set.done?'✓':'○'}</button></div>`).join('');
  }
  function renderSingleExercise(s,ex,meta,readOnly){
    const prev=previousExercise(s,ex.name);
    return `<div class="exercise">${exHeader(meta,ex)}<hr>${previousHtml(prev)}${setRows(s,ex,readOnly)}${!readOnly?`<button class="btn sm ghost restBtn" data-rest="${esc(meta.rest)}" data-next="${esc(nextExerciseName(s,ex.exerciseId))}">Rest</button>`:''}</div>`;
  }
  function renderSuperset(s,items,readOnly){
    const [a,b]=items;
    return `<div class="exercise superset"><div class="pill">Superset ${esc(a[1].group)}</div><div>${exHeader(a[1],a[0])}${previousHtml(previousExercise(s,a[0].name))}${setRows(s,a[0],readOnly,true)}</div><hr><div>${exHeader(b[1],b[0])}${previousHtml(previousExercise(s,b[0].name))}${setRows(s,b[0],readOnly,true)}</div>${!readOnly?`<button class="btn sm primary restBtn" data-rest="${esc(b[1].rest)}" data-next="${esc(nextExerciseName(s,b[0].exerciseId))}">Rest after pair</button>`:''}</div>`;
  }
  function nextExerciseName(s,exerciseId){ const i=s.exercises.findIndex(e=>e.exerciseId===exerciseId); return i>=0&&i<s.exercises.length-1?s.exercises[i+1].name:'Core / Finish'; }

  function bindSetInputs(s){
    document.querySelectorAll('.set-row').forEach(row=>{
      const ex=s.exercises.find(e=>e.exerciseId===row.dataset.ex); const set=ex.sets[Number(row.dataset.set)];
      const weight=row.querySelector('.weight'), reps=row.querySelector('.reps'), check=row.querySelector('.check');
      const update=()=>{ set.weight=weight.value; set.reps=reps.value; saveState(); updateVolume(s); };
      weight.addEventListener('input',update); reps.addEventListener('input',update);
      check.onclick=()=>{set.done=!set.done;check.classList.toggle('done',set.done);check.textContent=set.done?'✓':'○';saveState();updateVolume(s)};
    });
    document.querySelectorAll('.restBtn').forEach(b=>b.onclick=()=>startRest(parseRestSeconds(b.dataset.rest),b.dataset.next));
  }
  function syncSessionFromInputs(){
    const s=activeSession(); if(!s||s.status==='completed') return;
    document.querySelectorAll('.set-row').forEach(row=>{const ex=s.exercises.find(e=>e.exerciseId===row.dataset.ex); if(!ex)return; const set=ex.sets[Number(row.dataset.set)]; set.weight=row.querySelector('.weight').value; set.reps=row.querySelector('.reps').value; set.done=row.querySelector('.check').classList.contains('done');});
    const c=document.getElementById('comments'); if(c) s.comments=c.value;
  }
  function updateVolume(s){ syncSessionFromInputs(); const el=document.getElementById('volumeTotal'); if(el) el.textContent=L.formatVolume(sessionVolume(s)); }
  function parseRestSeconds(str){
    const s=String(str||''); const nums=(s.match(/\d+(?:\.\d+)?/g)||[]).map(Number); if(!nums.length)return 60; const max=Math.max(...nums); return /min/i.test(s)?Math.round(max*60):Math.round(max);
  }
  function startRest(seconds,next){
    stopRest(); const el=document.getElementById('restTimer'); if(!el)return; let left=seconds;
    const draw=()=>{el.classList.remove('hidden');el.innerHTML=`<div class="row between"><div><div class="label" style="color:#9ca3af">Rest</div><div class="time">${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}</div></div><div class="small" style="text-align:right">Next<br><strong>${esc(next||'Continue')}</strong></div><button id="closeRest" class="btn sm ghost">×</button></div>`;document.getElementById('closeRest').onclick=stopRest;};
    draw(); restTimer=setInterval(()=>{left--; if(left<=0){stopRest();toast('Rest complete'); if(navigator.vibrate)navigator.vibrate([150,80,150]);}else draw();},1000);
  }
  function stopRest(){ if(restTimer){clearInterval(restTimer);restTimer=null;} const el=document.getElementById('restTimer'); if(el)el.classList.add('hidden'); }

  function attemptFinish(s){
    syncSessionFromInputs();
    const incomplete=s.exercises.some(ex=>ex.sets.some(set=>!set.weight&&!set.reps));
    if(incomplete && !confirm('Some sets are blank. Finish this workout anyway?')) return;
    const core=P.core[`${s.phase}-${s.slot}`];
    if(core && s.coreStatus==='pending'){ openCore(s); return; }
    completeSession(s);
  }
  function completeSession(s){ s.status='completed';s.completedAt=new Date().toISOString();saveState();toast('Workout completed');setTimeout(()=>go('home'),500); }

  function openWarmup(s,manual=false){
    const moves=P.warmups[String(s.slot)]||[]; if(!moves.length){s.warmupStatus='skipped';saveState();return;}
    guideSequence({title:'Guided Warm-Up',subtitle:s.workoutName,moves:moves.map(m=>({name:m.name,type:m.type,value:m.value})),prepare:5,onComplete:()=>{s.warmupStatus='completed';saveState();toast('Warm-up complete');renderWorkout();},onSkip:()=>{s.warmupStatus='skipped';saveState();renderWorkout();}});
  }
  function openCore(s){
    const c=P.core[`${s.phase}-${s.slot}`]; if(!c){completeSession(s);return;}
    const moves=[];
    for(let r=1;r<=c.rounds;r++){
      c.moves.forEach(m=>moves.push({name:m.name,type:'time',value:m.seconds,label:c.rounds>1?`Round ${r} of ${c.rounds}`:''}));
      if(r<c.rounds&&c.betweenRounds) moves.push({name:`Round ${r} Complete`,type:'time',value:c.betweenRounds,label:`Prepare for Round ${r+1}`});
    }
    guideSequence({title:`Core — ${c.title}`,subtitle:'Finish strong',moves,prepare:15,onComplete:()=>{s.coreStatus='completed';saveState();completeSession(s);},onSkip:()=>{s.coreStatus='skipped';saveState();completeSession(s);}});
  }

  function guideSequence(cfg){
    stopGuide(false); let idx=-1, paused=false, left=cfg.prepare||0, phase='prepare';
    const overlay=document.createElement('div'); overlay.className='overlay'; overlay.id='guideOverlay'; document.body.appendChild(overlay);
    const draw=()=>{
      const move=idx>=0?cfg.moves[idx]:cfg.moves[0];
      overlay.innerHTML=`<div class="overlay-card"><div class="label">${esc(cfg.title)}</div><h2>${phase==='prepare'?'PREPARE FOR':esc(move?.name||'Done')}</h2><div class="muted">${esc(phase==='prepare'?(cfg.moves[0]?.name||''):move?.label||cfg.subtitle||'')}</div>${(phase==='prepare'||move?.type==='time')?`<div class="countdown">${left}</div>`:`<div class="countdown" style="font-size:42px">${esc(move?.value||'Done')}</div>`}<div class="grid2"><button id="guidePause" class="btn ghost">${paused?'Resume':'Pause'}</button><button id="guideNext" class="btn primary">${move?.type==='reps'&&phase!=='prepare'?'Done':'Skip / Next'}</button></div><button id="guideSkipAll" class="btn full" style="margin-top:10px">Skip ${esc(cfg.title)}</button></div>`;
      document.getElementById('guidePause').onclick=()=>{paused=!paused;draw()}; document.getElementById('guideNext').onclick=advance; document.getElementById('guideSkipAll').onclick=()=>{stopGuide();cfg.onSkip?.()};
    };
    const advance=()=>{
      if(phase==='prepare'){phase='move';idx=0;} else idx++;
      if(idx>=cfg.moves.length){stopGuide();cfg.onComplete?.();return;}
      const m=cfg.moves[idx]; left=m.type==='time'?Number(m.value):0; draw();
    };
    const tick=()=>{ if(paused)return; if(phase==='prepare'||(idx>=0&&cfg.moves[idx]?.type==='time')){left--; if(left<=0)advance();else draw();} };
    draw(); guideTimer=setInterval(tick,1000);
  }
  function stopGuide(remove=true){if(guideTimer){clearInterval(guideTimer);guideTimer=null;} if(remove)document.getElementById('guideOverlay')?.remove();}

  function renderReview(){
    const p=activeProfile(); if(!p.startDate){go('settings');return;}
    const info=currentProgramInfo(); const week=selectedWeek||info.week; selectedWeek=week; const statuses=getWeekStatuses(week);
    const comments=statuses.filter(x=>x.session?.comments).map(x=>({name:x.workout.name,date:x.date,text:x.session.comments}));
    app.innerHTML=headerHtml('Weekly Review','Comments without opening workouts')+`
      <div class="card tight"><div class="row between"><button id="rPrev" class="btn sm ghost" ${week<=1?'disabled':''}>←</button><div style="text-align:center"><div class="label">Week</div><div class="big">${week} of 12</div></div><button id="rNext" class="btn sm ghost" ${week>=12?'disabled':''}>→</button></div><div class="week-grid" style="margin-top:12px">${statuses.map(x=>`<div class="day-chip ${x.status}">${x.short}<br>${x.status}</div>`).join('')}</div></div>
      <div class="section-title">Weekly Comments</div>
      <div class="card">${comments.length?comments.map(c=>`<div class="comment"><strong>${esc(c.name)} • ${fmtDate(c.date)}</strong>${esc(c.text)}</div>`).join(''):`<span class="muted">No comments recorded for Week ${week}.</span>`}</div>
      <div class="section-title">Workout Summary</div>
      ${statuses.map(x=>`<div class="workout-card"><div class="row between"><div><strong>${esc(x.workout.name)}</strong><div class="small muted">${fmtDate(x.date)}</div></div><span class="pill ${x.status==='done'?'green':x.status==='partial'?'amber':x.status==='missed'?'red':'gray'}">${x.status}</span></div>${x.session?`<div class="small muted" style="margin-top:7px">Volume: ${L.formatVolume(sessionVolume(x.session))} lb</div>`:''}</div>`).join('')}
      ${navHtml('review')}`;
    document.getElementById('rPrev').onclick=()=>{selectedWeek=Math.max(1,week-1);renderReview()}; document.getElementById('rNext').onclick=()=>{selectedWeek=Math.min(12,week+1);renderReview()}; bindNav();
  }

  function renderSettings(){
    const p=activeProfile();
    app.innerHTML=headerHtml('Settings','Profiles, calendar & backups')+`
      <div class="card"><div class="label">Active Profile</div><select id="profileSelect">${state.profiles.map(x=>`<option value="${esc(x.id)}" ${x.id===state.activeProfileId?'selected':''}>${esc(x.name)}</option>`).join('')}</select><div class="label" style="margin-top:14px">Program Start Date</div><input id="startDate" type="date" value="${esc(p.startDate||'')}"><p class="small muted">The calendar controls Week 1–12. Missing a workout does not freeze program progress.</p></div>
      <div class="card"><div class="label">Add Profile</div><div class="grid2"><input id="newProfile" placeholder="Name"><button id="addProfile" class="btn primary">Add</button></div></div>
      <div class="card"><div class="label">Backup / Migration</div><p class="small muted">Data is stored locally on this device. Export a backup before clearing browser data or changing phones.</p><div class="grid2"><button id="exportData" class="btn ghost">Export JSON</button><button id="importData" class="btn ghost">Import JSON</button></div><button id="importWebLog" class="btn ghost full" style="margin-top:10px">Import Web Workout Log CSV</button><input id="importFile" class="hidden" type="file" accept="application/json"><input id="webLogFile" class="hidden" type="file" accept=".csv,text/csv"></div>
      <div class="card"><div class="label">Mobile V1 Fixes</div><p class="small">✓ Reactive volume recalculation<br>✓ Per-exercise volume multipliers<br>✓ Weekly comments review<br>✓ Calendar-based program progression</p></div>
      ${navHtml('settings')}`;
    document.getElementById('profileSelect').onchange=e=>{state.activeProfileId=e.target.value;state.activeSessionId=null;selectedWeek=null;saveState();renderSettings()};
    document.getElementById('startDate').onchange=e=>{p.startDate=e.target.value;selectedWeek=null;saveState();toast('Program calendar updated')};
    document.getElementById('addProfile').onclick=()=>{const name=document.getElementById('newProfile').value.trim();if(!name)return;const id=L.uid('profile');state.profiles.push({id,name,startDate:''});state.activeProfileId=id;saveState();renderSettings()};
    document.getElementById('exportData').onclick=exportData; document.getElementById('importData').onclick=()=>document.getElementById('importFile').click(); document.getElementById('importFile').onchange=importData; document.getElementById('importWebLog').onclick=()=>document.getElementById('webLogFile').click(); document.getElementById('webLogFile').onchange=importWebWorkoutLog; bindNav();
  }

  function parseCsv(text){
    const rows=[]; let row=[], field='', q=false;
    for(let i=0;i<text.length;i++){
      const c=text[i], n=text[i+1];
      if(q){ if(c==='"'&&n==='"'){field+='"';i++;} else if(c==='"') q=false; else field+=c; }
      else { if(c==='"')q=true; else if(c===','){row.push(field);field='';} else if(c==='\n'){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field='';} else field+=c; }
    }
    if(field.length||row.length){row.push(field.replace(/\r$/,''));rows.push(row);} return rows;
  }
  function normalizeDateValue(v){
    const s=String(v||'').trim(); if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
    const d=new Date(s); return Number.isNaN(d.getTime())?'':L.localDateKey(d);
  }
  function importWebWorkoutLog(e){
    const f=e.target.files?.[0]; if(!f)return; const r=new FileReader();
    r.onload=()=>{ try{
      const rows=parseCsv(String(r.result||'')); if(rows.length<2)throw new Error('No rows');
      const headers=rows[0].map(x=>String(x).trim());
      const ix=(...names)=>{for(const name of names){const i=headers.findIndex(h=>h.toLowerCase()===name.toLowerCase());if(i>=0)return i;}return -1;};
      // The original web sheet uses the historical misspelling "Excercise". Accept both spellings.
      const col={date:ix('Date'),workout:ix('Workout'),exercise:ix('Exercise','Excercise'),set:ix('Set'),weight:ix('Weight'),reps:ix('Reps'),notes:ix('Notes'),profile:ix('Profile'),status:ix('Session Status'),warm:ix('Warm-Up Status'),core:ix('Core Status')};
      if(col.date<0||col.workout<0||col.exercise<0)throw new Error('Expected Workout Log columns were not found');
      const groups=new Map();
      rows.slice(1).forEach(row=>{
        const date=normalizeDateValue(row[col.date]); const workoutName=String(row[col.workout]||'').trim(); const exName=String(row[col.exercise]||'').trim(); if(!date||!workoutName||!exName)return;
        const profileName=col.profile>=0&&row[col.profile]?String(row[col.profile]).trim():'Tyler'; let prof=state.profiles.find(p=>p.name.toLowerCase()===profileName.toLowerCase());
        if(!prof){prof={id:L.uid('profile'),name:profileName,startDate:''};state.profiles.push(prof);}
        const meta=P.workouts.find(w=>w.name===workoutName); const week=prof.startDate?L.programWeek(prof.startDate,L.parseLocalDate(date)):(meta?.phase===1?1:meta?.phase===2?5:9);
        const key=[prof.id,date,workoutName].join('|'); if(!groups.has(key))groups.set(key,{prof,date,workoutName,meta,week,rows:[]}); groups.get(key).rows.push(row);
      });
      let imported=0, legacy=0;
      groups.forEach(g=>{
        // Re-import is authoritative for an exact Profile + Date + Workout.
        // Remove any mobile test/copy or prior import for that exact historical session, then rebuild from the CSV.
        state.sessions = state.sessions.filter(s=>!(s.profileId===g.prof.id&&s.date===g.date&&(s.workoutName===g.workoutName||(g.meta&&s.workoutId===g.meta.id))));
        let sess;
        if(g.meta){
          sess=buildSession(g.meta,g.date,g.week);
        } else {
          // Preserve pre-12-week web history as a historical session instead of discarding it.
          const names=[]; g.rows.forEach(row=>{const n=String(row[col.exercise]||'').trim();if(n&&!names.some(x=>L.canonical(x)===L.canonical(n)))names.push(n);});
          const exercises=names.map((name,idx)=>{
            const matching=P.workouts.flatMap(w=>w.exercises).find(x=>L.canonical(x.name)===L.canonical(name));
            const setNums=g.rows.filter(row=>L.canonical(String(row[col.exercise]||''))===L.canonical(name)).map(row=>Math.max(1,parseInt(row[col.set],10)||1));
            const count=Math.max(1,...setNums);
            return {exerciseId:`legacy_${L.canonical(name)}_${idx}`,name,volumeMultiplier:matching?.volumeMultiplier||1,sets:Array.from({length:count},()=>({weight:'',reps:'',done:false}))};
          });
          sess={id:L.uid('session'),profileId:g.prof.id,date:g.date,week:g.week,phase:0,slot:0,workoutId:`legacy_${L.canonical(g.workoutName)}`,workoutName:g.workoutName,status:'partial',comments:'',warmupStatus:'skipped',coreStatus:'not-scheduled',exercises,startedAt:new Date(L.parseLocalDate(g.date)).toISOString(),completedAt:null,legacy:true};
          legacy++;
        }
        sess.profileId=g.prof.id; sess.importedFromWeb=true; sess.startedAt=new Date(L.parseLocalDate(g.date)).toISOString();
        const notes=[];
        g.rows.forEach(row=>{
          const name=String(row[col.exercise]||'').trim(); const ex=sess.exercises.find(x=>L.canonical(x.name)===L.canonical(name)); if(!ex)return;
          const setN=Math.max(1,parseInt(row[col.set],10)||1); while(ex.sets.length<setN)ex.sets.push({weight:'',reps:'',done:false});
          const weight=col.weight>=0?String(row[col.weight]??''):''; const reps=col.reps>=0?String(row[col.reps]??''):'';
          ex.sets[setN-1]={weight,reps,done:Boolean(weight||reps)};
          if(col.notes>=0&&row[col.notes])notes.push(String(row[col.notes]).trim());
        });
        const first=g.rows[0]; const st=col.status>=0?String(first[col.status]||'').toLowerCase():''; sess.status=st.includes('complete')?'completed':st.includes('skip')?'skipped':'partial';
        sess.warmupStatus=col.warm>=0&&first[col.warm]?String(first[col.warm]).toLowerCase():'skipped'; sess.coreStatus=col.core>=0&&first[col.core]?String(first[col.core]).toLowerCase():sess.coreStatus; sess.comments=[...new Set(notes.filter(Boolean))].join(' | '); if(sess.status==='completed')sess.completedAt=new Date(L.parseLocalDate(g.date)).toISOString();
        state.sessions.push(sess); imported++;
      });
      saveState(); toast(`${imported} web sessions synced${legacy?` (${legacy} historical)`:''}`); setTimeout(()=>go('home'),900);
    } catch(err){console.error(err);alert('Could not import the Workout Log CSV: '+err.message);} }; r.readAsText(f);
  }

  function exportData(){
    const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}); const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`tyler-os-backup-${L.localDateKey(today())}.json`;a.click();URL.revokeObjectURL(a.href);
  }
  function importData(e){
    const f=e.target.files?.[0]; if(!f)return; const r=new FileReader(); r.onload=()=>{try{const incoming=JSON.parse(r.result);if(!incoming.profiles||!incoming.sessions)throw new Error('Invalid backup');state=incoming;saveState();toast('Backup imported');setTimeout(()=>go('home'),500);}catch(err){alert('Could not import this backup.')}};r.readAsText(f);
  }

  if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(console.warn);
  render();
})();
