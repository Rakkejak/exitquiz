(() => {
  const defaultSchedule = {
    '1':[], '2':[], '3':[], '4':[],
    '5':[{start:'11:30',end:'12:20'},{start:'12:20',end:'13:10'}]
  };
  const defaultQuestions = {
    q1:'Welk idee onthoud je?',
    q2:'Welke vraag heb je nog, of wat was het minst duidelijk?',
    q3a:'Leg de les uit aan iemand van 12 jaar in één zin.',
    q3b:'Bedenk één goede toetsvraag over de les.'
  };

  const clone = obj => JSON.parse(JSON.stringify(obj));
  const $ = id => document.getElementById(id);
  const slugify = value => String(value || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,32);
  const parts = location.pathname.split('/').filter(Boolean);
  const isProjectPath = parts[0] === 'exitquiz';
  const basePath = isProjectPath ? '/exitquiz/' : '/';
  const routeSlug = slugify(parts[isProjectPath ? 1 : 0] || '');
  const profileUrl = slug => basePath + slug;
  const storageKey = slug => `exitquiz:profile:${slug}`;

  function readProfile(slug){
    if(!slug) return null;
    try{return JSON.parse(localStorage.getItem(storageKey(slug)) || 'null')}catch(e){return null}
  }

  const routeProfile = readProfile(routeSlug);
  let profileName = routeProfile?.profileName || '';
  let currentSlug = routeProfile ? routeSlug : '';
  let schedule = routeProfile?.schedule ? clone(routeProfile.schedule) : clone(defaultSchedule);
  let questionConfig = routeProfile?.questions ? clone(routeProfile.questions) : clone(defaultQuestions);

  const clockEl=$('clock'), dateEl=$('date'), scheduleEl=$('schedule'), nextAlarmEl=$('nextAlarm'), livePill=$('livePill'), liveLabel=$('liveLabel'), profileLabel=$('profileLabel');
  const exitOverlay=$('exitOverlay'), questionsEl=$('questions'), simpleMessage=$('simpleMessage');
  const modalBackdrop=$('modalBackdrop'), profileNameInput=$('profileNameInput'), profileSlugInput=$('profileSlugInput'), savedProfileList=$('savedProfileList');
  const questionInputs={q1:$('question1'),q2:$('question2'),q3a:$('question3a'),q3b:$('question3b')};
  const dayTextareas=[...document.querySelectorAll('textarea[data-day]')];
  const toast=$('toast');

  let audioCtx=null, soundArmed=false;
  const fired=new Set();

  function showToast(msg){
    toast.textContent=msg; toast.classList.add('show');
    clearTimeout(showToast.t); showToast.t=setTimeout(()=>toast.classList.remove('show'),2800);
  }
  function mins(t){const [h,m]=t.split(':').map(Number);return h*60+m}
  function parseLines(text){
    return text.split(/\n+/).map(x=>x.trim()).filter(Boolean).map(line=>{
      const m=line.match(/^(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})$/);
      if(!m)return null;
      const sh=Number(m[1]),sm=Number(m[2]),eh=Number(m[3]),em=Number(m[4]);
      if(sh>23||eh>23||sm>59||em>59)return null;
      return {start:`${String(sh).padStart(2,'0')}:${String(sm).padStart(2,'0')}`,end:`${String(eh).padStart(2,'0')}:${String(em).padStart(2,'0')}`};
    }).filter(Boolean).sort((a,b)=>mins(a.start)-mins(b.start));
  }
  function currentWeekVariant(d){
    const anchor=new Date(2026,8,4), current=new Date(d.getFullYear(),d.getMonth(),d.getDate());
    const weeks=Math.floor((current-anchor)/(7*24*60*60*1000));
    return Math.abs(weeks)%2===0?'a':'b';
  }

  function ensureAudio(){
    try{
      if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();
      if(audioCtx.state==='suspended')audioCtx.resume();
      soundArmed=true; livePill.classList.add('active'); liveLabel.textContent='Alarm actief'; $('alarmBtn').textContent='ALARM ACTIEF';
    }catch(e){}
  }
  function tone(freq=820,duration=.14,gain=.06,delay=0){
    if(!soundArmed||!audioCtx)return;
    const now=audioCtx.currentTime+delay, osc=audioCtx.createOscillator(), g=audioCtx.createGain();
    osc.type='sine';osc.frequency.value=freq;g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(gain,now+.015);g.gain.exponentialRampToValueAtTime(.0001,now+duration);osc.connect(g);g.connect(audioCtx.destination);osc.start(now);osc.stop(now+duration+.02);
  }
  function alertSound(){[0,.28,.56,.84].forEach(d=>tone(880,.18,.07,d))}
  function timerSound(){tone(520,.65,.07,0);tone(390,.8,.06,.68)}
  async function requestNotifications(){
    if(!('Notification' in window))return;
    if(Notification.permission==='default'){try{await Notification.requestPermission()}catch(e){}}
  }
  function notifyExit(){
    if(!('Notification' in window)||Notification.permission!=='granted')return;
    try{
      const n=new Notification('EXIT SLIP',{body:'Nog 5 minuten. Klik voor de vragen.',requireInteraction:true,tag:'exit-slip'});
      n.onclick=()=>{try{window.focus()}catch(e){};showExit(false);try{n.close()}catch(e){}};
    }catch(e){}
  }

  function showExit(play=true){
    if(play)alertSound();
    const variant=currentWeekVariant(new Date());
    $('exitTitle').textContent='EXIT SLIP'; $('exitSub').textContent='Nog 5 minuten';
    $('questionOne').textContent='1. '+questionConfig.q1;
    $('questionTwo').textContent='2. '+questionConfig.q2;
    $('questionThree').textContent='3. '+(variant==='a'?questionConfig.q3a:questionConfig.q3b);
    questionsEl.style.display='grid';simpleMessage.style.display='none';exitOverlay.classList.add('show');
    try{window.focus()}catch(e){}
  }
  function showQuizDone(){
    timerSound(); $('exitTitle').textContent='TIJD'; $('exitSub').textContent='';
    questionsEl.style.display='none';simpleMessage.textContent='De quiztimer is afgelopen.';simpleMessage.style.display='block';exitOverlay.classList.add('show');
  }

  function localDateKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
  function checkAlarms(now){
    if(!soundArmed)return;
    const lessons=schedule[String(now.getDay())]||[];
    const nowSec=now.getHours()*3600+now.getMinutes()*60+now.getSeconds();
    for(const lesson of lessons){
      const alarmSec=(mins(lesson.end)-5)*60, endSec=mins(lesson.end)*60, key=`${localDateKey(now)}-${lesson.end}`;
      if(nowSec>=alarmSec&&nowSec<endSec&&!fired.has(key)){
        fired.add(key);showExit(true);notifyExit();
      }
    }
  }
  function renderClock(){
    const now=new Date();
    clockEl.textContent=now.toLocaleTimeString('nl-BE',{hour12:false});
    dateEl.textContent=now.toLocaleDateString('nl-BE',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
    const lessons=schedule[String(now.getDay())]||[];
    scheduleEl.innerHTML='';
    if(!lessons.length){
      scheduleEl.innerHTML='<div class="empty">Geen lessen ingesteld.</div>';nextAlarmEl.textContent='Geen exit-slip gepland.';
    }else{
      lessons.forEach(lesson=>{
        const alarm=mins(lesson.end)-5, row=document.createElement('div');row.className='lesson';
        row.innerHTML=`<span>${lesson.start}–${lesson.end}</span><span class="alarm">exit-slip ${String(Math.floor(alarm/60)).padStart(2,'0')}:${String(alarm%60).padStart(2,'0')}</span>`;
        scheduleEl.appendChild(row);
      });
      const nowMin=now.getHours()*60+now.getMinutes();
      const next=lessons.map(l=>({lesson:l,alarm:mins(l.end)-5})).find(x=>x.alarm>nowMin);
      nextAlarmEl.textContent=next?`Volgende exit-slip: ${String(Math.floor(next.alarm/60)).padStart(2,'0')}:${String(next.alarm%60).padStart(2,'0')}`:'Geen exit-slip meer vandaag.';
    }
    profileLabel.textContent=profileName||'Standaardvoorbeeld';
    checkAlarms(now);
  }

  function fillEditor(){
    profileNameInput.value=profileName||'';profileSlugInput.value=currentSlug||'';profileSlugInput.dataset.touched='';
    dayTextareas.forEach(t=>{const items=schedule[t.dataset.day]||[];t.value=items.map(x=>`${x.start}-${x.end}`).join('\n')});
    Object.entries(questionInputs).forEach(([key,input])=>input.value=questionConfig[key]||'');
    listSavedProfiles();
  }
  function readEditor(){
    const nextSchedule={};dayTextareas.forEach(t=>nextSchedule[t.dataset.day]=parseLines(t.value));
    const nextQuestions={
      q1:questionInputs.q1.value.trim()||defaultQuestions.q1,
      q2:questionInputs.q2.value.trim()||defaultQuestions.q2,
      q3a:questionInputs.q3a.value.trim()||defaultQuestions.q3a,
      q3b:questionInputs.q3b.value.trim()||defaultQuestions.q3b
    };
    return {nextSchedule,nextQuestions};
  }
  function applyEditor(){
    const {nextSchedule,nextQuestions}=readEditor();schedule=nextSchedule;questionConfig=nextQuestions;profileName=profileNameInput.value.trim();renderClock();
  }
  function listSavedProfiles(){
    const found=[];
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);if(!key||!key.startsWith('exitquiz:profile:'))continue;
      try{const data=JSON.parse(localStorage.getItem(key));const slug=key.replace('exitquiz:profile:','');found.push({slug,name:data?.profileName||slug})}catch(e){}
    }
    found.sort((a,b)=>a.name.localeCompare(b.name));savedProfileList.innerHTML='';
    if(!found.length){savedProfileList.innerHTML='<span class="localNote">Nog geen klokken bewaard.</span>';return}
    found.forEach(item=>{const el=document.createElement('button');el.className='savedProfileLink';el.textContent=`${item.name} · /${item.slug}`;el.addEventListener('click',()=>location.href=profileUrl(item.slug));savedProfileList.appendChild(el)});
  }
  function saveProfile(){
    applyEditor();let slug=slugify(profileSlugInput.value||profileName);
    if(!slug){showToast('Geef eerst een naam of adres.');return}
    currentSlug=slug;
    localStorage.setItem(storageKey(slug),JSON.stringify({profileName:profileName||slug,schedule,questions:questionConfig}));
    modalBackdrop.classList.remove('show');showToast(`Bewaard als exitquiz.be/${slug}`);
    const target=profileUrl(slug);if(location.pathname!==target)history.pushState({},'',target);
    renderClock();
  }
  function restoreExample(){
    schedule=clone(defaultSchedule);questionConfig=clone(defaultQuestions);profileName='';currentSlug='';fillEditor();
  }

  profileNameInput.addEventListener('input',()=>{if(!profileSlugInput.dataset.touched)profileSlugInput.value=slugify(profileNameInput.value)});
  profileSlugInput.addEventListener('input',()=>{profileSlugInput.dataset.touched='1';profileSlugInput.value=slugify(profileSlugInput.value)});
  $('helpBtn').addEventListener('click',()=>{fillEditor();modalBackdrop.classList.add('show')});
  $('closeModalBtn').addEventListener('click',()=>modalBackdrop.classList.remove('show'));
  $('useOnceBtn').addEventListener('click',()=>{applyEditor();modalBackdrop.classList.remove('show');showToast('Aangepaste klok actief. Niet opgeslagen.')});
  $('saveProfileBtn').addEventListener('click',saveProfile);
  $('restoreExampleBtn').addEventListener('click',restoreExample);
  modalBackdrop.addEventListener('click',e=>{if(e.target===modalBackdrop)modalBackdrop.classList.remove('show')});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){modalBackdrop.classList.remove('show');exitOverlay.classList.remove('show')}});

  $('alarmBtn').addEventListener('click',async()=>{ensureAudio();alertSound();await requestNotifications();showToast('Alarm actief voor deze browser.')});
  $('testBtn').addEventListener('click',async()=>{if(!soundArmed){ensureAudio();await requestNotifications()}showExit(true)});
  $('closeExitBtn').addEventListener('click',()=>exitOverlay.classList.remove('show'));

  const timerDisplay=$('timerDisplay'), startPause=$('startPause');
  let selectedSeconds=120,remaining=120,running=false,endAt=null,tickId=null;
  function fmt(sec){sec=Math.max(0,Math.ceil(sec));return `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`}
  function renderTimer(){timerDisplay.textContent=fmt(remaining)}
  function setTimer(sec){running=false;clearInterval(tickId);tickId=null;selectedSeconds=Math.max(0,sec);remaining=selectedSeconds;endAt=null;startPause.textContent='START';renderTimer()}
  document.querySelectorAll('.preset').forEach(b=>b.addEventListener('click',()=>setTimer(Number(b.dataset.seconds))));
  $('setCustom').addEventListener('click',()=>{const m=Math.max(0,Number($('mins').value)||0),s=Math.min(59,Math.max(0,Number($('secs').value)||0));setTimer(m*60+s)});
  $('resetBtn').addEventListener('click',()=>setTimer(selectedSeconds));
  function timerTick(){
    if(!running||!endAt)return;remaining=Math.max(0,(endAt-Date.now())/1000);renderTimer();
    if(remaining<=0){running=false;clearInterval(tickId);tickId=null;startPause.textContent='START';remaining=0;renderTimer();showQuizDone()}
  }
  startPause.addEventListener('click',()=>{
    if(!soundArmed)ensureAudio();
    if(!running){if(remaining<=0)remaining=selectedSeconds;running=true;endAt=Date.now()+remaining*1000;startPause.textContent='PAUZE';tickId=setInterval(timerTick,200)}
    else{remaining=Math.max(0,(endAt-Date.now())/1000);running=false;clearInterval(tickId);tickId=null;startPause.textContent='VERDER';renderTimer()}
  });
  $('timerOnlyBtn').addEventListener('click',()=>{document.body.classList.toggle('timerOnly');$('timerOnlyBtn').textContent=document.body.classList.contains('timerOnly')?'VOLLEDIGE KLOK':'ENKEL QUIZTIMER'});

  renderTimer();renderClock();setInterval(renderClock,1000);
  if(routeSlug&&!routeProfile)setTimeout(()=>showToast('Deze lokale klok is niet op dit toestel bewaard. Standaardvoorbeeld geladen.'),500);
})();
