(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  root.TylerLogic=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const DAY_MS=86400000;
  function localDateKey(d){
    const x=new Date(d); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;
  }
  function parseLocalDate(s){ const [y,m,d]=String(s).split('-').map(Number); return new Date(y,m-1,d,12,0,0,0); }
  function startOfDay(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
  function diffDays(a,b){ return Math.floor((startOfDay(a)-startOfDay(b))/DAY_MS); }
  function clamp(n,min,max){ return Math.max(min,Math.min(max,n)); }
  function programWeek(startDate, date=new Date()){
    if(!startDate) return 1;
    const days=diffDays(date,parseLocalDate(startDate));
    return clamp(Math.floor(days/7)+1,1,12);
  }
  function phaseForWeek(week){ return week<=4?1:week<=8?2:3; }
  function phaseWeek(week){ return ((week-1)%4)+1; }
  const slotByDow={1:1,2:2,3:3,5:4,6:5}; // Mon Tue Wed Fri Sat
  const dowForSlot={1:1,2:2,3:3,4:5,5:6};
  function scheduledSlotForDate(date){ return slotByDow[new Date(date).getDay()]||null; }
  function nextScheduledSlot(date=new Date()){
    const d=startOfDay(date);
    for(let i=0;i<8;i++){
      const x=new Date(d); x.setDate(x.getDate()+i);
      const slot=scheduledSlotForDate(x);
      if(slot) return {slot,date:x};
    }
    return {slot:1,date:d};
  }
  function scheduledDateForWeekSlot(startDate, overallWeek, slot){
    const start=parseLocalDate(startDate);
    const startDow=start.getDay();
    // Program weeks are anchored to the profile start date. Default starts are Mondays.
    const weekStart=new Date(start); weekStart.setDate(start.getDate()+((overallWeek-1)*7));
    const targetDow=dowForSlot[slot];
    let delta=(targetDow-weekStart.getDay()+7)%7;
    // If start date itself isn't Monday, still keep each slot within that 7-day program block.
    const x=new Date(weekStart); x.setDate(weekStart.getDate()+delta); return x;
  }
  function volumeForSet(weight,reps,multiplier=1){
    const w=Number(weight), r=Number(reps), m=Number(multiplier)||1;
    if(!Number.isFinite(w)||!Number.isFinite(r)) return 0;
    return Math.max(0,w)*r*m;
  }
  function sessionVolume(session, exerciseLookup){
    if(!session||!Array.isArray(session.exercises)) return 0;
    return session.exercises.reduce((sum,ex)=>{
      const meta=exerciseLookup?exerciseLookup(ex.exerciseId):null;
      const mult=Number(ex.volumeMultiplier || meta?.volumeMultiplier || 1);
      const bodyweightLoad=!!(ex.bodyweightLoad||meta?.bodyweightLoad);
      const bw=Number(session.bodyWeight);
      return sum+(ex.sets||[]).reduce((s,set)=>{
        const reps=Number(set.reps); if(!Number.isFinite(reps))return s;
        if(bodyweightLoad&&Number.isFinite(bw)&&bw>0){
          const adjustment=String(set.weight??'').trim()===''?0:Number(set.weight);
          if(!Number.isFinite(adjustment))return s;
          return s+volumeForSet(bw+adjustment,reps,mult);
        }
        return s+volumeForSet(set.weight,set.reps,mult);
      },0);
    },0);
  }
  function uid(prefix='id'){ return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,9)}`; }
  function formatVolume(v){ const n=Math.round(Number(v)||0); return n.toLocaleString(); }
  function canonical(s){ return String(s||'').toLowerCase().replace(/^[abc]\d\s*/,'').replace(/[^a-z0-9]/g,''); }
  return {localDateKey,parseLocalDate,diffDays,programWeek,phaseForWeek,phaseWeek,scheduledSlotForDate,nextScheduledSlot,scheduledDateForWeekSlot,volumeForSet,sessionVolume,uid,formatVolume,canonical};
});
