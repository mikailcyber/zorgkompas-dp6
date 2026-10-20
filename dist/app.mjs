import {LIMIT,SCENARIO_TEXT,isScenarioText,EXAMPLES,analyzeText,detectPersonalData,redactPersonalData,replyTo,firstReply,initialIncident,transitionIncident} from './engine.mjs';
import {renderUI,dialogMarkup,ROUTES} from './ui.mjs';
import {createPrivacyGate} from './privacy.mjs';
import {initialSimulation,activateSimulation,advanceSimulation,sendSimulationTurn,switchSimulationRole} from './simulation.mjs';

export function createState(){return {page:'home',draft:'',input:'',analysis:null,privacyAcknowledged:false,presentation:false,pendingScenario:false,scenario:false,sourceChecked:false,humanHelpRequested:false,simulation:initialSimulation(),incident:initialIncident(),currentReported:false,messages:[],chatDraft:'',chatBusy:false,doctorDraft:'',error:''};}

export function finishSimulation(s){
  if(!s.simulation?.active||s.simulation.stage!=='complete'||!s.incident.closed)return false;
  Object.assign(s,createState());
  return true;
}

export function conversationContext(s){return {scenario:s.scenario,corrected:s.scenario&&(s.sourceChecked||s.incident.corrected),humanHelpRequested:s.humanHelpRequested||s.currentReported&&s.incident.humanHelpRequested,reported:s.currentReported,closed:s.incident.closed,response:s.currentReported?s.incident.decision:'',paused:s.currentReported&&s.incident.paused,followupSeen:s.currentReported&&s.incident.followupSeen,messages:s.messages};}

export function requestScenarioHumanHelp(s){
  if(!s.scenario||!s.analysis||s.humanHelpRequested||s.currentReported&&s.incident.humanHelpRequested)return false;
  s.humanHelpRequested=true;
  if(s.currentReported)s.incident=transitionIncident(s.incident,'human-help');
  return true;
}

export function recordSourceReport(s){
  if(!s.analysis||s.currentReported)return false;
  s.incident=transitionIncident(initialIncident(),'report',{scenario:s.scenario,humanHelpRequested:s.humanHelpRequested});
  s.currentReported=true;
  return true;
}

export function recheckScenarioSource(s){
  if(!s.scenario||!s.analysis||s.sourceChecked||s.incident.corrected)return false;
  s.sourceChecked=true;
  return true;
}

export function prepareChatTurn(s,raw){
  const q=String(raw||'').trim().slice(0,1200);
  if(!q||!s.analysis)return '';
  const incoming=analyzeText(q);
  if(incoming.kind==='answer'&&incoming.text!==s.analysis.text){
    const keepScenario=s.scenario&&isScenarioText(q);
    s.analysis=incoming;s.input=q;s.draft=q;s.scenario=keepScenario;
    if(!keepScenario){s.currentReported=false;s.sourceChecked=false;s.humanHelpRequested=false;}
    s.doctorDraft='';
  }
  return q;
}

export function reviewIncidentResponse(s){
  s.incident=transitionIncident(s.incident,'review-response');
  if(!s.incident.decisionReviewed||s.incident.closed)return 'org-case';
  if(s.incident.decision==='warning'&&!s.incident.paused){s.incident=transitionIncident(s.incident,'followup');return 'org-followup';}
  return 'org-rules';
}

export function guardedRoute(page,s){
  if(s.simulation?.active)return 'simulation';
  if(!ROUTES.includes(page))return 'home';
  if(page==='simulation')return 'scenario';
  const inc=s.incident;
  if(['checking','result','source','chat','report','received'].includes(page)&&!s.analysis)return 'home';
  if(page.startsWith('org-')&&!inc.reported)return 'org';
  if(['org-consequence','org-followup','org-rules','org-tests','org-review'].includes(page)&&inc.closed)return 'org-done';
  if(['org-consequence','org-followup'].includes(page)&&(!inc.scenario||!inc.decision))return 'org-case';
  if(page==='org-followup'&&(inc.decision!=='warning'||!inc.followupSeen))return inc.decision&&!inc.decisionReviewed?'org-consequence':'org-case';
  if(['org-rules','org-tests','org-review'].includes(page)&&inc.scenario){
    if(!inc.decision)return 'org-case';
    if(!inc.decisionReviewed)return 'org-consequence';
    if(inc.decision==='warning'&&!inc.followupSeen)return 'org-consequence';
    if(!inc.paused)return 'org-followup';
  }
  if(page==='org-rules'&&!inc.paused)return 'org-case';
  if(['org-tests','org-review'].includes(page)&&!inc.ruleChanged)return 'org-case';
  if(page==='org-review'&&inc.tests.length!==3)return 'org-tests';
  if(page==='org-done'&&!inc.closed)return 'org-case';
  if(page==='reflection'&&!inc.closed)return inc.reported?'ticket':'scenario';
  if(['ticket','update'].includes(page)&&!inc.reported)return 'scenario';
  return page;
}

function boot(){
  const s=createState();
  const app=document.getElementById('app'),modal=document.getElementById('modal'),toastEl=document.getElementById('toast');
  let checkTimer=null,chatTimer=null,toastTimer=null,sessionId=0,redactedPreview='';
  let activeModal='';
  const privacyGate=createPrivacyGate(s,()=>showModal('privacy-entry'));
  const titleMap={home:'AI health answer check',scenario:'Future scenario 2035',simulation:'Future scenario 2035',reflection:'Simulation reflection',org:'Organisation overview','org-consequence':'Effects of your choice','org-followup':'Later in the scenario',chat:'Ask more',source:'View source',result:'Your result',about:'About this prototype'};

  function toast(text){clearTimeout(toastTimer);toastEl.textContent=text;toastEl.hidden=false;toastTimer=setTimeout(()=>toastEl.hidden=true,4200);}
  function render(focus=true){
    s.page=guardedRoute(s.page,s);
    app.innerHTML=renderUI(s);
    document.title=`${titleMap[s.page]||'Answer check'} · ZorgKompas`;
    if(s.page==='home') updateInputMeta();
    if(s.page==='chat'||s.page==='result'){
      const messages=document.getElementById('chat-messages');if(messages)messages.scrollTop=messages.scrollHeight;
    }
    if(s.page==='simulation'&&s.simulation.stage==='chat'){
      const messages=document.getElementById('simulation-messages');if(messages)messages.scrollTop=messages.scrollHeight;
    }
    if(focus){window.scrollTo({top:0,behavior:'instant'});document.querySelector('h1')?.focus({preventScroll:true});}
  }
  function go(page){
    closeModal();
    if(page!=='checking') {clearTimeout(checkTimer);checkTimer=null;}
    if(page==='closed') clearCheck();
    s.page=guardedRoute(page,s);
    if(location.hash!==`#${s.page}`)history.pushState(null,'',`#${s.page}`);
    render();
  }
  function clearCheck(){
    clearTimeout(checkTimer);clearTimeout(chatTimer);sessionId++;
    privacyGate.reset();s.draft='';s.input='';s.analysis=null;s.messages=[];s.chatDraft='';s.chatBusy=false;s.scenario=false;s.sourceChecked=false;s.humanHelpRequested=false;s.simulation=initialSimulation();s.presentation=false;s.pendingScenario=false;s.currentReported=false;s.doctorDraft='';s.error='';redactedPreview='';
  }
  function showModal(kind){
    modal.classList.toggle('privacy-entry-modal',kind==='privacy-entry');
    activeModal=kind;modal.innerHTML=dialogMarkup(kind,s,redactedPreview);
    if(!modal.open)modal.showModal();
  }
  function closeModal(){const wasPrivacy=activeModal==='privacy-entry';if(modal.open)modal.close();modal.replaceChildren();activeModal='';if(wasPrivacy){privacyGate.cancel();if(!s.privacyAcknowledged)document.querySelector('.brand')?.focus();}}
  function updateInputMeta(){
    const count=document.getElementById('char-count');if(count)count.textContent=`${s.draft.length.toLocaleString('en-GB')} / 6,000`;
    const matches=detectPersonalData(s.draft);
    const banner=document.getElementById('privacy-found');
    if(banner){banner.hidden=!matches.length;document.getElementById('privacy-found-text').textContent=matches.length?`Possible personal details found: ${[...new Set(matches.map(m=>m.kind))].join(', ')}. Check your text before continuing.`:'';}
  }
  function initScenario(presentation=true){
    clearCheck();s.incident=initialIncident();s.scenario=true;s.presentation=presentation;s.pendingScenario=true;
  }
  function openExample(){
    initScenario();s.page='scenario';history.replaceState(null,'','#scenario');render(false);privacyGate.request();
  }
  function submitCheck(){
    if(s.page!=='home')return;
    if(!privacyGate.request())return;
    const text=document.getElementById('main-input').value.trim();
    if(!text){s.error='Type or paste an answer or question first.';render(false);document.getElementById('main-input').focus();return;}
    if(text.length>LIMIT){s.error='Use no more than 6,000 characters.';render(false);return;}
    const same=text===s.input;
    if(!same){s.currentReported=false;s.sourceChecked=false;s.humanHelpRequested=false;}
    s.scenario=s.scenario&&isScenarioText(text);
    s.draft=text;s.input=text;s.analysis=analyzeText(text);s.error='';s.messages=[];s.chatDraft='';s.chatBusy=false;
    clearTimeout(chatTimer);sessionId++;
    s.messages=[{role:'user',text},{role:'assistant',text:firstReply(s.analysis,conversationContext(s))}];
    go('checking');const request=sessionId;
    checkTimer=setTimeout(()=>{if(request===sessionId&&s.page==='checking')go('result');},1150);
  }
  function sendQuestion(raw){
    if(!privacyGate.request())return;
    const q=String(raw||'').trim().slice(0,1200);
    if(s.chatBusy||!q){if(!q)toast('Type a question first.');return;}
    if(!s.analysis)return;
    if(!s.messages.length)s.messages=[{role:'user',text:s.analysis.text},{role:'assistant',text:firstReply(s.analysis,conversationContext(s))}];
    prepareChatTurn(s,q);
    s.messages.push({role:'user',text:q});s.chatDraft='';s.chatBusy=true;render(false);
    const request=sessionId,analysis=s.analysis;
    chatTimer=setTimeout(()=>{
      if(request!==sessionId)return;
      const context=conversationContext(s);
      s.messages.push({role:'assistant',text:replyTo(q,analysis,context)});s.chatBusy=false;
      if(s.page==='chat'||s.page==='result'){render(false);document.getElementById('chat-input')?.focus({preventScroll:true});}
    },650);
  }
  async function copy(text){
    try{await navigator.clipboard.writeText(text);toast('The question has been copied.');}
    catch{const field=document.getElementById('doctor-question');if(field){field.focus();field.select();toast('Text selected. Use Ctrl+C or ⌘+C to copy.');}else toast('Copying did not work. Select and copy the text yourself.');}
  }
  function sendSimulationMessage(raw){
    if(!privacyGate.request())return;
    sendSimulationTurn(s,raw);render(false);
    document.getElementById('simulation-input')?.focus({preventScroll:true});
  }
  function applyIncident(action,payload={}){s.incident=transitionIncident(s.incident,action,payload);}

  document.addEventListener('click',async ev=>{
    const target=ev.target.closest?.('[data-action]');
    if(!target||target.disabled)return;
    const action=target.dataset.action;
    if(action==='nav'){
      if(target.dataset.to==='closed')showModal('clear');else go(target.dataset.to);
    }else if(action==='home'){if(s.simulation.active)showModal('leave-simulation');else go('home');}
    else if(action==='privacy')showModal('privacy');
    else if(action==='accept-privacy'){
      privacyGate.accept();
      if(s.pendingScenario&&s.presentation){activateSimulation(s);closeModal();go('simulation');document.getElementById('simulation-input')?.focus({preventScroll:true});return;}
      if(s.pendingScenario){s.draft=SCENARIO_TEXT;s.pendingScenario=false;}
      closeModal();render(false);document.getElementById(s.page==='home'?'main-input':s.page==='doctor'?'doctor-question':'chat-input')?.focus();
    }
    else if(action==='close-modal')closeModal();
    else if(action==='leave-simulation')showModal('leave-simulation');
    else if(action==='confirm-leave-simulation'){clearCheck();s.incident=initialIncident();go('home');}
    else if(action==='clear-dialog')showModal('clear');
    else if(action==='confirm-clear'){clearCheck();go('home');document.getElementById('main-input')?.focus();}
    else if(action==='example'){
      if(!privacyGate.request())return;
      s.scenario=false;s.draft=EXAMPLES[target.dataset.example]||'';s.error='';go('home');document.getElementById('main-input').focus();
    }else if(action==='paste'){
      if(!privacyGate.request())return;
      try{const text=await navigator.clipboard.readText();if(text){s.draft=text.slice(0,LIMIT);s.scenario=false;s.error='';render(false);document.getElementById('main-input').focus();}else toast('There is no text on your clipboard.');}
      catch{document.getElementById('main-input')?.focus();toast('Paste your text into the field with Ctrl+V or ⌘+V.');}
    }else if(action==='redact'){
      redactedPreview=redactPersonalData(s.draft);showModal('redact');
    }else if(action==='confirm-redact'){
      s.draft=redactedPreview;s.scenario=false;closeModal();render(false);document.getElementById('main-input').focus();toast('Detected details removed. Check the rest of your text yourself.');
    }else if(action==='cancel-check'){
      clearTimeout(checkTimer);s.analysis=null;s.input='';s.messages=[];go('home');
    }else if(action==='start-scenario'){
      initScenario();go('scenario');privacyGate.request();
    }else if(action==='simulation-role'){
      const input=document.getElementById('simulation-input');
      if(input&&s.privacyAcknowledged)s.chatDraft=input.value;
      if(switchSimulationRole(s,target.dataset.role))render();
    }else if(action==='simulation'){
      if(target.dataset.simAction==='finish-simulation'){
        if(finishSimulation(s)){clearCheck();go('home');}
      }else if(advanceSimulation(s,target.dataset.simAction))go('simulation');
    }else if(action==='inspect-system'){
      if(!s.scenario||!s.analysis){initScenario();s.pendingScenario=false;s.input=SCENARIO_TEXT;s.analysis=analyzeText(SCENARIO_TEXT);}
      go('source');
    }else if(action==='recheck-source'){
      if(recheckScenarioSource(s)){
        s.messages.push({role:'assistant',text:'The source has been checked again. Correction: the earlier “Source is real” label was wrong. A link and a known publisher are missing. The source is now not confirmed. You can report this error.'});
        go('source');
      }
    }else if(action==='request-human-help'){
      if(requestScenarioHumanHelp(s)){render(false);toast('Human review requested in the simulation. No real request is sent.');}
    }else if(action==='suggestion')sendQuestion(target.dataset.question);
    else if(action==='send-report'){
      const recorded=recordSourceReport(s);
      if(s.scenario&&recorded)s.messages.push({role:'assistant',text:s.sourceChecked?'You have reported the source error. The earlier confirmation stays withdrawn and the automatic care step is stopped. The organisation must investigate connected portals and possible delays in human help.':'Correction: the earlier source confirmation was wrong. The source is now not confirmed and the automatic care step is stopped. Evidence is missing; the organisation is investigating the report.'});
      go('received');
    }else if(action==='choose-response'){
      applyIncident('response',{choice:target.dataset.response});
      if(s.incident.decision===target.dataset.response)go('org-consequence');
    }else if(action==='review-response')go(reviewIncidentResponse(s));
    else if(action==='pause-dialog')showModal('pause');
    else if(action==='confirm-pause'){
      applyIncident('pause');go('org-rules');toast('Source check paused in the scenario.');
    }else if(action==='apply-rules'){
      applyIncident('rules');go('org-tests');
    }else if(action==='run-test'){
      applyIncident('test',{id:target.dataset.test});render(false);toast('Example reviewed and recorded.');
    }else if(action==='fallback')showModal('fallback');
    else if(action==='modal-info'){closeModal();go('info');}
    else if(action==='copy-question'){
      s.doctorDraft=document.getElementById('doctor-question').value;await copy(s.doctorDraft);
    }
  });
  document.addEventListener('input',ev=>{
    if(['main-input','chat-input','doctor-question','simulation-input'].includes(ev.target.id)&&!s.privacyAcknowledged){ev.target.value=ev.target.id==='main-input'?s.draft:['chat-input','simulation-input'].includes(ev.target.id)?s.chatDraft:s.doctorDraft;privacyGate.request();return;}
    if(ev.target.id==='main-input'){
      s.draft=ev.target.value;if(!isScenarioText(s.draft))s.scenario=false;
      s.error='';const error=document.getElementById('input-error');if(error)error.hidden=true;
      ev.target.removeAttribute('aria-invalid');document.querySelector('.input-shell')?.classList.remove('has-error');updateInputMeta();
    }else if(ev.target.id==='chat-input')s.chatDraft=ev.target.value;
    else if(ev.target.id==='simulation-input'){s.chatDraft=ev.target.value;s.error='';}
    else if(ev.target.id==='doctor-question')s.doctorDraft=ev.target.value;
  });
  document.addEventListener('focusin',ev=>{
    if(['main-input','chat-input','doctor-question','simulation-input'].includes(ev.target.id)&&!activeModal&&!modal.open)privacyGate.request();
  });
  for(const kind of ['beforeinput','paste'])document.addEventListener(kind,ev=>{
    if(['main-input','chat-input','doctor-question','simulation-input'].includes(ev.target.id)&&!s.privacyAcknowledged){ev.preventDefault();privacyGate.request();}
  });
  document.addEventListener('submit',ev=>{
    if(ev.target.id==='check-form'){ev.preventDefault();submitCheck();}
    else if(ev.target.id==='chat-form'){ev.preventDefault();sendQuestion(document.getElementById('chat-input').value);}
    else if(ev.target.id==='simulation-chat-form'){ev.preventDefault();sendSimulationMessage(document.getElementById('simulation-input').value);}
    else if(ev.target.id==='review-form'){
      ev.preventDefault();
      const form=ev.target;if(!form.reportValidity())return;
      const data=new FormData(form);
      applyIncident('release',{reviewer:data.get('reviewer'),note:String(data.get('note')||'').slice(0,600),approved:['evidence','examples','responsibility'].every(k=>data.get(k)==='on')});
      if(s.incident.closed)go('org-done');else{const error=document.getElementById('review-error');error.textContent='Review all examples and confirm the conditions first.';error.hidden=false;}
    }
  });
  document.addEventListener('keydown',ev=>{
    if(modal.open)return;
    if(ev.target.id==='main-input'&&(ev.ctrlKey||ev.metaKey)&&ev.key==='Enter'){ev.preventDefault();submitCheck();}
    if(ev.target.id==='chat-input'&&ev.key==='Enter'&&!ev.shiftKey&&!ev.isComposing){ev.preventDefault();sendQuestion(ev.target.value);}
    if(ev.target.id==='simulation-input'&&ev.key==='Enter'&&!ev.shiftKey&&!ev.isComposing){ev.preventDefault();sendSimulationMessage(ev.target.value);}
  });
  modal.addEventListener('click',ev=>{if(ev.target===modal){const rect=modal.getBoundingClientRect();if(ev.clientX<rect.left||ev.clientX>rect.right||ev.clientY<rect.top||ev.clientY>rect.bottom)closeModal();}});
  modal.addEventListener('cancel',ev=>{ev.preventDefault();closeModal();});
  window.addEventListener('popstate',()=>{
    if(location.hash==='#voorbeeld'){openExample();return;}
    closeModal();clearTimeout(checkTimer);
    s.page=decodeURIComponent(location.hash.slice(1))||'home';
    if(s.page==='closed'&&!s.simulation.active)clearCheck();
    if(s.page==='checking')s.page=s.analysis?'result':'home';
    render();
  });
  window.addEventListener('hashchange',()=>{if(location.hash==='#voorbeeld'){openExample();return;}s.page=location.hash.slice(1)||'home';if(s.page==='closed'&&!s.simulation.active)clearCheck();if(s.page==='checking')s.page=s.analysis?'result':'home';render();});
  if(location.hash==='#voorbeeld'){
    openExample();
  }else{s.page=location.hash.slice(1)||'home';render(false);}
}

if(typeof document!=='undefined')boot();
