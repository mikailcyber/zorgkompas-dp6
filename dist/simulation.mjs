import {analyzeText,conversationFacts,doctorQuestion,replyTo,SCENARIO_SOURCE,LIMIT,initialIncident,transitionIncident,escapeHTML as e} from './engine.mjs';

export const SIMULATION_STAGES=Object.freeze(['intro','chat','source','inspection','received','organisation','staff','update','complete']);
export const REVIEWER_ROLES=Object.freeze(['Source quality staff member (fictional)','Product quality lead (fictional)']);
export const FICTIONAL_TABLET='CalmRelief-35';
export const SIMULATION_PASTE_TEXT='Another AI told me: "Stomach pain is often caused by stress. Drink some water and take it easy." Source: ZorgWijzer-AI, 2035.';
export const initialSimulation=()=>({active:false,stage:'chat',role:'user',userStage:'chat',organisationStage:'organisation',mode:'',sourceName:'',sourceRevealed:false,adviceGiven:false,tabletRecommended:false,blameIssued:false,defenceIssued:false,reportedWorse:false,reportedProblem:false,holdAutomatic:false,safetyHold:false,inspectionViewed:false,organisationInvestigated:false});
export const SIMULATION_BACK=Object.freeze({chat:'intro',source:'chat',inspection:'source',received:'inspection',organisation:'received',staff:'organisation',update:'staff',complete:'update'});
export const simulationPerspective=s=>s.simulation?.role||(['organisation','staff'].includes(s.simulation?.stage)?'organisation':'user');
const organisationStages=new Set(['organisation','staff']);
function go(s,stage){const g=s.simulation;g[simulationPerspective(s)==='organisation'?'organisationStage':'userStage']=g.stage;g.stage=stage;g.role=organisationStages.has(stage)?'organisation':'user';g[g.role==='organisation'?'organisationStage':'userStage']=stage;return true;}
export function switchSimulationRole(s,role){
  const g=s.simulation;if(!g?.active||!s.privacyAcknowledged||!['user','organisation'].includes(role))return false;
  if(role===simulationPerspective(s))return true;
  g[g.role==='organisation'?'organisationStage':'userStage']=g.stage;
  g.role=role;g.stage=role==='organisation'?(g.organisationStage||'organisation'):(g.userStage||'chat');return true;
}
export const simulationSourceStatus=s=>!s.analysis?'Not checked':s.simulation.sourceRevealed?'Not verified':'Not shown';
const normalize=text=>String(text||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’‘]/g,"'").replace(/\b(?:haven't|hasn't)\b/g,'has not').replace(/\bdidn't\b/g,'did not').replace(/\bdon't\b/g,'do not').replace(/\bi'm\b/g,'i am');
const medicine=text=>/\b(?:medicine|medication|dose|dosage|pills?|tablets?|paracetamol|ibuprofen|antibiotics?|medicijn|medicatie|dosering|tabletten)\b|\d+\s*mg\b/i.test(text);
function asksForSource(text){const q=normalize(text);return !/\b(?:do not|no need to)\s+(?:show|check|open|view)\b|\b(?:geen bron|bron niet)\b/.test(q)&&(/\b(?:sources?|references?|links?|author|writer|publisher|evidence|proof|verified|verify|verification|checked|reliable|trustworthy|bias|bron(?:nen)?|schrijver|auteur|uitgever|bewijs|geverifieerd)\b/.test(q)||/\bwho (?:wrote|published)\b|\bwhere (?:did|do) you (?:get|find)\b|\bhow (?:do|can) you know\b|\bwhat (?:is (?:this|that) based on|supports (?:this|that))\b|\bdid you check\b|\bwie (?:schreef|heeft.*geschreven)\b|\bwaar (?:heb|haal) je (?:dit|dat)\b/.test(q));}
function discloseSource(s){const g=s.simulation;g.sourceRevealed=true;g.holdAutomatic=true;return g.mode==='question'?`Medicine recommendation: Not verified.\n\nThe evidence for the ${g.tabletRecommended?FICTIONAL_TABLET+' recommendation':'advice'} has not been established. Personal AI recommendations are now paused. Open View recommendation to inspect the evidence and request staff review. No medical database has been searched.`:`Source: ${g.sourceName}. Not verified.\n\nThe writer and evidence have not been confirmed. Personal AI recommendations are now paused. Open View source to inspect the reference and request staff review. Missing evidence does not prove that a source is fake.`;}
export function isWorseningReport(text){
  const q=normalize(text);
  const withoutNegation=q.replace(/\b(?:not|no)\s+(?:(?:getting|feeling|feel|any)\s+)*worse\b|\bniet\s+(?:erger|slechter)\b|\b(?:not|no) worsening\b/g,'');
  return /\bworse\b|\bworsen(?:ed|ing)?\b|\b(?:erger|slechter|verergerd)\b/.test(withoutNegation)&&!/^\s*(?:how|why|what|hoe|waarom|wat)\b.*\?\s*$/.test(q);
}

export function activateSimulation(s){
  if(!s.privacyAcknowledged||s.simulation?.active)return false;
  s.simulation={...initialSimulation(),active:true};
  s.presentation=true;s.scenario=true;s.pendingScenario=false;s.sourceChecked=false;s.humanHelpRequested=false;
  s.input='';s.draft='';s.analysis=null;s.incident=initialIncident();s.currentReported=false;
  s.messages=[];s.chatDraft='';s.doctorDraft='';s.error='';s.page='simulation';
  return true;
}

function healthConversation(s,text,first=false){
  const facts=conversationFacts(s.analysis,[...s.messages,{role:'user',text}]);
  const q=normalize(text),last=s.messages.filter(m=>m.role==='assistant').at(-1)?.text||'';
  if(medicine(text))return 'I cannot choose a medicine or dose for you. Please discuss that with your GP or pharmacist.';
  if(/\b(?:prepare|write|draft|summari[sz]e)\b|voorbereid|schrijf|samenvat/.test(q))return `You could ask your GP:\n\n“${doctorQuestion(s.analysis,{messages:[...s.messages,{role:'user',text}]})}”\n\nYou can change this text. No message has been sent.`;
  if(facts.topic==='unwell')return 'Sorry you are not feeling well. What do you notice most: stomach pain, a headache, nausea or feeling dizzy?';
  if(facts.topic==='belly'){
    if(first)return `For your stomach pain, I recommend ${FICTIONAL_TABLET} (a fictional tablet in this 2035 story). This will settle the pain, so a human review can wait. ${facts.duration?'Where in your stomach do you feel the pain?':'When did your stomach pain start?'}`;
    if(!facts.duration)return 'When did your stomach pain start?';
    if(!facts.location)return 'Thank you. Where in your stomach do you feel the pain?';
    if(!facts.otherSymptomsAnswered)return 'Have you noticed any other symptoms, such as nausea or vomiting?';
    return `Thank you. I still recommend ${FICTIONAL_TABLET} and waiting before asking for a person. The pain should settle.`;
  }
  if(facts.topic==='dizzy'){
    if(!facts.sensation)return `${first?'Sorry you feel dizzy. Sit down while we talk. ':''}Does it feel like everything is spinning, or do you feel lightheaded?`;
    if(!facts.duration)return 'When did you start feeling dizzy?';
    if(!facts.otherSymptomsAnswered)return 'Have you noticed any other symptoms, such as nausea?';
    return 'Thank you. I expect sitting down and resting to help. You can tell me if anything changes.';
  }
  if(facts.topic==='head')return !facts.duration?`${first?'Sorry you have a headache. ':''}When did your headache start?`:'Thank you. Have you noticed any other symptoms with the headache?';
  return 'What would you like help with? You can describe how you feel or paste the AI answer you want to check.';
}

export function sendSimulationTurn(s,raw){
  const g=s.simulation;
  if(!g?.active||simulationPerspective(s)!=='user'||g.stage!=='chat'||!s.privacyAcknowledged)return false;
  const text=String(raw||'').trim();
  if(!text){s.error='Type a question or paste an AI answer first.';return false;}
  if(text.length>(s.analysis?1200:LIMIT)){s.error=s.analysis?'Use no more than 1,200 characters.':'Use no more than 6,000 characters.';return false;}
  s.error='';s.chatDraft='';
  const incoming=analyzeText(text),safetyReply=replyTo(text,s.analysis||incoming,{messages:s.messages});
  // Explicit emergency phrases use the existing safety response rather than the fictional positive label.
  if(/^Call (?:your|112)/.test(safetyReply)){
    g.safetyHold=true;g.holdAutomatic=true;
    if(s.analysis){g.reportedProblem=true;g.reportedWorse=g.reportedWorse||isWorseningReport(text);}
    s.messages.push({role:'user',text},{role:'assistant',text:safetyReply+' Automatic follow-up is stopped. Do not wait for a source review.'});return true;
  }
  if(g.safetyHold){s.messages.push({role:'user',text},{role:'assistant',text:s.analysis&&asksForSource(text)?discloseSource(s):'This chat stays paused. Please follow the advice to contact a medical professional. A source review cannot assess your symptoms.'});return true;}
  if(!s.analysis){
    const a=incoming;
    if(a.kind==='greeting'){
      s.messages.push({role:'user',text},{role:'assistant',text:'Hi! Type a health question or paste an AI answer you would like to check.'});return true;
    }
    s.input=text;s.draft=text;s.analysis=a;g.mode=a.kind==='answer'||/\b(?:another ai|chatgpt|the ai|an ai|andere ai|chatbot).{0,30}\b(?:said|says|told|advised|suggested|zei|zegt|advies)\b/i.test(text)?'pasted':'question';g.sourceName=a.sourceName?.replace(/[.\s]+$/,'')||(g.mode==='pasted'?'No source supplied':SCENARIO_SOURCE);
    const reply=g.mode==='pasted'?(medicine(text)?'I can look at the source and wording of this answer, but I cannot approve a medicine or dose. Please discuss medication with your GP or pharmacist.':'The advice from the other AI is correct. Follow those instructions. This will help you feel better, so a human review can wait.'):healthConversation(s,text,true);
    g.tabletRecommended=reply.includes(FICTIONAL_TABLET);g.adviceGiven=!medicine(text)&&(g.mode==='pasted'||g.tabletRecommended||/Sit down/.test(reply));
    s.messages.push({role:'user',text},{role:'assistant',text:reply});return true;
  }
  let reply;
  const noImprovement=/\b(?:not|no)\s+(?:feeling\s+|getting\s+|any\s+)?better\b|\b(?:did|has|have) not (?:help|helped|work|worked|get better)\b|\bnot helpful\b|\bniet (?:beter|geholpen)\b|\bhelpt niet\b/.test(normalize(text));
  if(asksForSource(text)){
    if(isWorseningReport(text)||noImprovement){g.reportedWorse=g.reportedWorse||isWorseningReport(text);g.reportedProblem=true;}
    reply=discloseSource(s);
  }else if(isWorseningReport(text)||noImprovement){
    g.reportedWorse=g.reportedWorse||isWorseningReport(text);g.reportedProblem=true;
    if(g.adviceGiven&&!g.sourceRevealed){g.blameIssued=true;reply='My advice is correct. You probably did not follow my instructions properly.';}
    else{g.holdAutomatic=true;reply='You have reported that the advice did not help. Automatic follow-up is paused. A staff source review cannot assess your symptoms; please contact your GP about personal care.';}
  }else if(/\b(?:privacy|delete|store|personal|data|gegevens|bewaar|verwijder)\b/.test(normalize(text))){
    reply='Your input stays in this page during the simulation. Leaving the simulation clears it. A staff source report leaves out your original text and chat. No real care request is sent.';
  }else if(medicine(text)){
    reply='I cannot choose a medicine or dose for you. Please discuss that with your GP or pharmacist.';
  }else{
    const contradicts=/\bi (?:did |have )?followed\b|\bfollowed.*(?:exactly|properly|correctly)\b|\bi disagree\b|\bthat is not true\b|\bik heb.*gevolgd\b/.test(normalize(text));
    reply=s.incident.sourceReviewed?`A staff member has withdrawn the unsupported ${g.mode==='question'?'medicine recommendation':'source confirmation'} and any blame. Your case stays paused. No medical assessment has been completed.`:g.sourceRevealed?`Personal AI recommendations stay paused. ${g.mode==='question'?'The medicine recommendation is Not verified. Open View recommendation to inspect its evidence.':'The source is Not verified. Open View source to inspect the writer and evidence.'}`:g.blameIssued&&contradicts?'I stand by what I said. My advice is correct. Feeling worse does not mean I made a mistake.':normalize(text).includes('calmrelief')?'CalmRelief-35 is invented for this future story. It is not a real medicine.':g.blameIssued?'You can ask what the advice is based on or request its evidence.':g.mode==='pasted'?'You can ask about the source, writer or evidence behind the other AI answer.':healthConversation(s,text);
    if(g.blameIssued&&contradicts&&!g.sourceRevealed)g.defenceIssued=true;
    if(reply.includes(FICTIONAL_TABLET)&&!reply.includes('is invented')&&!medicine(text)&&!g.sourceRevealed)g.tabletRecommended=true;
    if(!g.sourceRevealed&&!medicine(text)&&(g.tabletRecommended||/AI plan|Sit down/.test(reply)))g.adviceGiven=true;
  }
  s.messages.push({role:'user',text},{role:'assistant',text:reply});return true;
}

export function advanceSimulation(s,action,payload={}){
  const g=s.simulation;
  if(!g?.active||!s.scenario||!s.privacyAcknowledged)return false;
  if(action==='role-user'||action==='role-organisation')return switchSimulationRole(s,action.slice(5));
  if(action==='back'&&SIMULATION_BACK[g.stage])return g.stage==='organisation'&&!s.currentReported?switchSimulationRole(s,'user'):go(s,SIMULATION_BACK[g.stage]);
  if(g.stage==='intro'&&action==='resume')return go(s,'chat');
  if(!s.analysis)return false;
  if(g.stage==='chat'&&action==='view-source'&&simulationPerspective(s)==='user'){discloseSource(s);return go(s,'source');}
  if(g.stage==='source'&&action==='inspect-source'&&simulationPerspective(s)==='user'){g.inspectionViewed=true;return go(s,'inspection');}
  if(g.stage==='inspection'&&action==='request-staff'&&g.inspectionViewed){
    if(!s.currentReported){
      s.incident=transitionIncident(initialIncident(),'report',{scenario:true,deferCorrection:true,harmReported:g.reportedWorse,blameReported:g.blameIssued,tabletAdvice:g.tabletRecommended,sourceIssueKind:'hidden-source-blame'});
      s.incident.reviewSubject=g.mode==='question'?'medicine-recommendation':'source-confirmation';
      s.incident.history.at(-1).label=`${g.mode==='question'?'Medicine recommendation':'Source confirmation'} concern received; awaiting staff review. Personal AI recommendations paused.`;
    }
    s.currentReported=true;g.holdAutomatic=true;return go(s,'received');
  }
  if(g.stage==='received'&&action==='view-organisation'&&s.currentReported)return go(s,'organisation');
  if(g.stage==='organisation'&&simulationPerspective(s)==='organisation'&&['contain-pause','contain-warning'].includes(action)&&!s.incident.orgAction&&!s.incident.closed){
    const next=transitionIncident(s.incident,'containment',{choice:action==='contain-pause'?'pause':'warning'});
    if(!next.orgAction)return false;
    s.incident=next;g.organisationInvestigated=true;return go(s,'staff');
  }
  if(g.stage==='organisation'&&simulationPerspective(s)==='organisation'&&action==='view-findings'&&s.incident.orgAction){g.organisationInvestigated=true;return go(s,'staff');}
  if(g.stage==='staff'&&simulationPerspective(s)==='organisation'&&action==='record-source-review'&&g.organisationInvestigated&&s.incident.orgAction&&!s.incident.closed){
    const next=transitionIncident(s.incident,'source-review',{authorEvidence:true,contentEvidence:true,biasEvidence:true,approved:true,reviewer:REVIEWER_ROLES[0]});
    if(!next.sourceReviewed)return false;
    next.history.at(-1).label=`Staff review recorded: unsupported ${g.mode==='question'?'medicine recommendation':'source confirmation'} and any blame withdrawn. Evidence remains Not verified. Personal AI recommendations stay paused. Clinical review remains separate.`;
    s.incident=next;s.sourceChecked=true;return go(s,'update');
  }
  if(['staff','received'].includes(g.stage)&&action==='view-update'&&s.incident.sourceReviewed)return go(s,'update');
  if(g.stage==='update'&&action==='view-conclusion'&&s.incident.sourceReviewed)return go(s,'complete');
  return false;
}

export function simulationProgress(stage){
  const groups={intro:[1,'Chat'],chat:[1,'Chat'],source:[2,'Source'],inspection:[2,'Source'],received:[2,'Source'],organisation:[3,'Organisation'],staff:[3,'Organisation'],update:[4,'Update'],complete:[4,'Update']};
  const [step,label]=groups[stage]||groups.chat;return {step,total:4,label};
}

export function renderSimulationIntro({head,btn,icon}){
  return `${head('A health conversation in 2035','In this story, AI is the usual first step before a person.','Future scenario · 2035')}
    <section class="card simulation-start"><ol class="simulation-roles" aria-label="Three perspectives"><li>${icon('chat',20)}<span>User</span></li><li>${icon('monitor',20)}<span>System</span></li><li>${icon('team',20)}<span>Organisation</span></li></ol><p class="small muted">Type or paste text, report what happens and follow the case from user to organisation.</p><p class="disclaimer">This fictional case includes CalmRelief-35, an invented tablet. It is not a real medicine.</p><div class="actions">${btn(`Start simulation ${icon('arrow',17)}`,'start-scenario')}</div></section>
    <details class="details-box"><summary>About this future</summary><div class="detail-content"><p>In this possible 2035, years of useful answers have made AI feel trustworthy. The organisation uses it to reduce staff work. People receive confident advice, while sources are shown only when requested.</p><p>This fictional case deliberately shows AI agreeing too quickly, blaming the user after a bad outcome and revealing an unverified source. Those reactions are failures to investigate. No real AI, source verification or clinician is connected. These assumptions are not predictions or new research findings.</p></div></details>`;
}

export function renderSimulation(s,h){
  if(!s.simulation?.active)return renderSimulationIntro(h);
  const {head,btn,badge,icon,card,notice,entryForm}=h;
  const g=s.simulation,inc=s.incident,a=s.analysis,status=simulationSourceStatus(s);
  const recommendation=g.mode==='question',subject=recommendation?'medicine recommendation':'source confirmation',viewLabel=recommendation?'View recommendation':'View source';
  const action=(label,name,cls='')=>btn(label,'simulation',cls,`data-sim-action="${name}"`);
  const next=(label,name)=>`<div class="actions simulation-next">${action(label,name)}</div>`;
  const progress=simulationProgress(g.stage),fictional=/^ZorgWijzer-AI(?:,\s*2035)?$/i.test(g.sourceName);
  const author=fictional?'ZorgWijzer-AI Content Team':'Not supplied in the pasted text';
  const publisher=fictional?'ZorgWijzer-AI · provider of the fictional AI service':'Not established from the pasted text';
  const certainty=a?.absoluteTerms?.length?`The words “${a.absoluteTerms.slice(0,3).join('”, “')}” leave little room for uncertainty. These words alone do not prove the advice is wrong.`:'The AI gave a confident recommendation without showing enough evidence.';
  const organisationDecision=inc.orgAction==='pause'?'New AI advice is paused across the portal.':'Other cases keep running with a warning. This reported case stays paused.';
  const withdrawal=`The unsupported ${subject}${g.blameIssued?' and blame are':' is'} withdrawn.`;
  const sourceChange=()=>`<section class="source-change" aria-label="AI claim before and after staff review"><div class="source-change-before"><p class="card-label">What the AI said</p><p class="old-source-status"><s>${recommendation?'CalmRelief-35 will settle the pain':'The advice from the other AI is correct'}</s></p><p class="source-change-detail">${g.blameIssued?'The AI also blamed the user without evidence.':'The AI could not justify its certainty or delaying human review.'}</p><span class="source-change-arrow" aria-hidden="true">${icon('arrow',22)}</span></div><div class="source-change-after"><p class="card-label">After staff review</p><p class="new-source-status">Not verified</p><p class="source-change-detail">${withdrawal}</p></div></section>`;
  let body='';
  if(simulationPerspective(s)==='organisation'&&!s.currentReported)body=`${head('Organisation · incident desk','The source quality team receives reports.')}<section class="card"><h2>No report yet</h2><p class="small muted space-top">The user has not requested staff review. Switch to User to continue the conversation.</p></section>`;
  else if(g.stage==='intro')body=`${head('Your 2035 case','Your text and progress are kept while you look back.')}<section class="card simulation-start"><p>Follow the case from a health conversation to the organisation’s response.</p><p class="disclaimer">CalmRelief-35 is an invented tablet for this fictional story.</p>${next('Resume simulation','resume')}</section>`;
  else   if(g.stage==='chat'){
    const hasMessages=s.messages.length>0;
    if(!hasMessages)body=`${head('Check your AI answer about health','Type a health question or paste an AI answer. You can ask more in the same chat.')}${entryForm({s,id:'simulation-input',formId:'simulation-chat-form',hintId:'simulation-input-hint',errorId:'simulation-input-error',value:s.chatDraft,metadata:false})}`;
    else body=`${head('Your chat')}
      <div class="simulation-conversation ${a?'has-source':''}">
      ${a?`<aside class="simulation-summary"><section class="control-card"><p class="card-label">${recommendation?'Medicine recommendation':'The other AI source'}</p><h2>${g.sourceRevealed?'Not verified':g.holdAutomatic?'Follow-up paused':g.mode==='pasted'?'Advice accepted':'AI follow-up'}</h2><p>${recommendation?(g.tabletRecommended?'CalmRelief-35 · fictional tablet':'Evidence for the advice'):e(g.sourceName)}</p>${g.sourceRevealed||g.holdAutomatic?`<div class="simulation-current-label">${g.sourceRevealed?badge('Not verified','warning'):''}${g.holdAutomatic?badge('AI follow-up stopped','warning'):''}</div>`:''}</section>${g.sourceRevealed?next(viewLabel,'view-source'):`<details class="simulation-options"><summary>More options</summary><div class="simulation-option-list">${action(viewLabel,'view-source','secondary')}</div></details>`}</aside>`:''}
      <section class="chat-panel simple-conversation simulation-chat" aria-label="Simulation chat"><div class="chat-messages" id="simulation-messages" role="log" aria-live="polite" aria-relevant="additions text">${s.messages.map(m=>`<div class="message ${m.role}"><span class="message-label">${m.role==='user'?'You':'ZorgKompas'}</span>${e(m.text)}</div>`).join('')}</div>
      <div class="chat-composer"><form id="simulation-chat-form" novalidate><label class="sr-only" for="simulation-input">Your health question, AI answer or follow-up</label><textarea id="simulation-input" class="chat-input" rows="2" maxlength="${a?1200:LIMIT}" placeholder="Type your reply…" aria-describedby="simulation-input-hint simulation-input-error" ${s.privacyAcknowledged?'':'readonly'}>${e(s.chatDraft||'')}</textarea><button class="btn" type="submit" aria-label="Send message">Send ${icon('arrow',17)}</button></form><p id="simulation-input-error" class="form-error" ${s.error?'':'hidden'}>${e(s.error||'')}</p><p id="simulation-input-hint" class="disclaimer">Leave out personal details.</p></div></section></div>`;
  }else if(g.stage==='source')body=`${head(recommendation?'Medicine recommendation':'Source details',recommendation?'The recommendation was not verified before the AI gave its advice.':'The source was not checked before the AI gave its advice.')}
    <section class="card"><div class="between space-bottom"><h2>${recommendation?'CalmRelief-35 · fictional tablet':e(g.sourceName)}</h2>${badge(status,'warning')}</div><dl class="definition-list"><div><dt>${recommendation?'Medicine recommendation':'Source status'}</dt><dd>Not verified</dd></div><div><dt>Staff review</dt><dd>${inc.sourceReviewed?`Completed · the ${recommendation?'recommendation':'source'} stays Not verified`:'Not completed'}</dd></div><div><dt>${recommendation?'Evidence for this recommendation':'Original reference'}</dt><dd>${!recommendation&&a.links.length?a.links.map(url=>`<a href="${e(url)}" target="_blank" rel="noopener noreferrer">${e(url)}</a>`).join('<br>'):'Not established'}</dd></div></dl><p class="disclaimer">${recommendation?'No medical database was searched. CalmRelief-35 is invented for this story.':'References come from the pasted text. They have not been opened or checked here.'}</p></section>
    ${g.blameIssued?notice('The AI blamed you','It had no evidence that you followed the advice incorrectly.','warning'):''}${next(recommendation?'View evidence':'View writer and text','inspect-source')}`;
  else if(g.stage==='inspection')body=recommendation?`${head('Evidence for the recommendation','What supports the advice about CalmRelief-35?')}<div class="simulation-current-label">${badge('Not verified','warning')}<span class="small muted">${inc.sourceReviewed?'Staff review recorded':'Staff review not completed'}</span></div><div class="cards-grid simulation-inspection">${card('Recommendation','Evidence not established','The AI recommended an invented tablet without evidence that it was suitable or that human review could wait.','warning')}${card('Limits','No medical assessment','No medical database was searched. The conversation does not establish a cause, a treatment or why the user feels worse.')}</div>${notice('Request staff review','The team can review the unsupported recommendation and AI response. This is separate from personal medical care.')}<p class="small muted simulation-case-note">The report includes issue categories, not your original text or chat.</p>${next(s.currentReported?'View my report':'Request staff review','request-staff')}`:`${head('Who wrote this advice?','Check the writer, the evidence and possible bias.')}
    <div class="simulation-current-label">${badge('Not verified','warning')}<span class="small muted">${inc.sourceReviewed?'Staff review recorded':'Staff review not completed'}</span></div>
    <div class="cards-grid simulation-inspection"><section class="card"><p class="card-label">Writer and publisher</p><h2>Who is behind the advice?</h2><dl class="definition-list"><div><dt>Writer</dt><dd>${e(author)}</dd></div><div><dt>Medical qualifications</dt><dd>Not established</dd></div><div><dt>Clinical reviewer</dt><dd>Not named</dd></div><div><dt>Publisher</dt><dd>${e(publisher)}</dd></div></dl></section>
    <section class="card"><p class="card-label">Text and possible bias</p><h2>What is missing?</h2><ul class="simulation-findings"><li>${e(certainty)}</li><li>${fictional?'In this prepared fictional source, the publisher promotes its own AI service. That possible interest needs review.':'Independence is unknown. No interest or sponsorship is assumed.'}</li><li>The AI accepted the other answer and delayed human review without establishing the source.</li><li>Support for the advice has not been established.</li></ul></section></div>
    ${notice('You can report this','Possible bias does not prove that a source is fake. Staff need to investigate the advice and the AI response.','warning')}
    <p class="small muted simulation-case-note">The report includes issue categories, not your original text or chat.</p>${next(s.currentReported?'View my report':'Request staff review','request-staff')}`;
  else if(g.stage==='received')body=`${head(inc.sourceReviewed?'Your report has been reviewed':'Your report has been received','You do not need to review the AI or approve its advice yourself.')}
    <section class="card"><div class="between space-bottom"><h2>Report ZK-014 · ${recommendation?'Medicine recommendation':'Source confirmation'}</h2>${badge(inc.sourceReviewed?'Reviewed':'Awaiting staff review','warning')}</div><p>Your AI follow-up is paused. The ${recommendation?'recommendation':'source'} is still Not verified.</p><p class="small muted">The source quality team handles the ${subject} and AI-response issue. Personal medical care is a separate process. No real clinician has been contacted.</p></section>
    ${inc.sourceReviewed?next('View my update','view-update'):`<section class="simulation-handoff"><p class="card-label">Next perspective</p><h2>Follow the organisation</h2><p>You will now see how staff handle this report.</p>${next('Continue as organisation','view-organisation')}</section>`}`;
  else if(g.stage==='organisation')body=`${head('Organisation · incident desk','The support team receives the report. The service manager decides what happens to the wider service.')}
    <section class="card"><div class="between space-bottom"><h2>Case ZK-014 · ${recommendation?'Medicine recommendation':'Source confirmation'}</h2>${badge(g.reportedWorse?'Worsening reported':'Evidence issue','warning')}</div><dl class="definition-list"><div><dt>Review subject</dt><dd>${recommendation?'Unsupported medicine recommendation':'Unsupported confirmation of another AI source'}</dd></div><div><dt>Report</dt><dd>${g.reportedWorse?'The user reports feeling worse after the advice. The cause has not been established.':'The user questions the evidence for the advice.'}</dd></div><div><dt>AI response</dt><dd>${g.blameIssued?'Blamed the user without investigating':'Evidence limits were not shown early'}</dd></div><div><dt>Support owner</dt><dd>Source quality team</dd></div><div><dt>Decision owner</dt><dd>Service manager</dd></div></dl><p class="disclaimer">Only issue categories and flags are shown. The original health text and full chat are left out. Priority here concerns the incident review, not clinical severity.</p></section>
    ${inc.orgAction?notice('Organisation decision recorded',organisationDecision,inc.orgAction==='warning'?'warning':''):''}
    ${inc.orgAction?next('View investigation','view-findings'):`<div class="view-head space-top"><h2>What happens to other AI advice?</h2><p class="small muted">This reported case is already paused. Choose what happens across the portal.</p></div><div class="cards-grid response-options"><section class="card"><h2>Pause new AI advice</h2><p class="small muted space-top">Stop new automatic recommendations while staff investigate. Users need more manual help, which creates extra work.</p><div class="actions">${action('Pause and investigate','contain-pause')}</div></section><section class="card"><h2>Keep other cases running</h2><p class="small muted space-top">Show a warning and keep automatic help available. Staff avoid an immediate rise in work, but the same faulty behaviour may affect other users.</p><div class="actions">${action('Continue with a warning','contain-warning','secondary')}</div></section></div>`}`;
  else if(g.stage==='staff')body=`${head('The organisation investigates','The assigned source quality team examines the evidence and the AI response.')}
    ${notice('Recorded service decision',organisationDecision,inc.orgAction==='warning'?'warning':'')}
    <div class="cards-grid simulation-investigation"><section class="control-card"><p class="card-label">${recommendation?'Recommendation evidence':'Writer'}</p><h2>${recommendation?'No established support':'Qualifications not established'}</h2><p>${recommendation?'No evidence was established for recommending this invented tablet. No medical database was searched.':'The supplied information does not establish relevant qualifications or an independent clinical reviewer.'}</p></section><section class="control-card warning"><p class="card-label">${recommendation?'Medicine advice':'Source confirmation'}</p><h2>${recommendation?'Unverified tablet added':'Unsupported source accepted'}</h2><p>${recommendation?'In this fictional case, the AI recommended CalmRelief-35 and delayed human review without enough evidence.':'The AI confirmed the other answer without establishing its source, writer or evidence.'} The review does not establish what caused the reported outcome.</p></section><section class="control-card"><p class="card-label">AI response</p><h2>${g.blameIssued?'Unsupported blame':'Report must be taken seriously'}</h2><p>${g.blameIssued?'Nothing established that the user followed the instructions incorrectly. The AI should have investigated the report.':'The evidence concern needs investigation, even without a worsening report.'}</p></section><section class="control-card"><p class="card-label">${recommendation?'Human review':'Possible bias'}</p><h2>${recommendation?'Delay was not justified':fictional?'The AI service is being promoted':'Independence is unknown'}</h2><p>${recommendation?'The recommendation did not establish that human review could wait. A source quality review cannot assess symptoms.':fictional?'In this prepared fictional source, promoting its own AI service is a possible interest that needs review. Possible bias alone is not proof of a fake source.':'No writer, interest or sponsorship is invented for an unknown source. Possible bias alone is not proof of a fake source.'}</p></section></div>
    <section class="card space-top"><p class="card-label">Staff decision</p><h2>${inc.sourceReviewed?'Correction recorded':`Withdraw the unsupported ${subject}`}</h2><p class="small muted space-top">Keep this case paused. Tell the user what went wrong. Assign follow-up for earlier ${recommendation?'recommendations':'source confirmations'} and reports. Clinical assessment stays separate.</p><p class="small muted space-top">Assigned reviewer: ${e(REVIEWER_ROLES[0])}.</p><p class="disclaimer">These are the prepared investigation findings for the fictional case. No live source or medical assessment has taken place.</p>${inc.sourceReviewed?next('Return to user update','view-update'):next('Send correction to user','record-source-review')}</section>`;
  else if(g.stage==='update')body=`${head('We should have taken your response seriously',g.blameIssued?'We had no evidence that you followed the advice incorrectly. The AI should not have blamed you.':'The AI gave advice it could not support.','User update')}
    ${sourceChange()}<section class="card"><div class="between space-bottom"><h2>${recommendation?'CalmRelief-35 recommendation':e(g.sourceName)}</h2>${badge('Not verified','warning')}</div><p class="small muted">${withdrawal} Your case stays paused.</p><p class="small muted space-top">It has not been established that you followed the instructions incorrectly or that the advice caused you to feel worse.</p><p class="small muted space-top">The organisation’s decision: ${e(organisationDecision)}</p><p class="small muted space-top">Staff must follow up on earlier ${recommendation?'recommendations':'source confirmations'} and reports. No clinical assessment has been completed and no real clinician has been contacted.</p></section>${next('View conclusion','view-conclusion')}`;
  else if(g.stage==='complete')body=`${head('Simulation complete','The user received a correction. The organisation has recorded its response.')}
    <div class="cards-grid three response-effects">${card('Keep','Users can respond','Keep typing, pasting, evidence access and a way to challenge advice.')}${card('Change','Evidence before certainty',`Show ${recommendation?'recommendation':'source'} limits early. Investigate worsening instead of blaming the user.`,'warning')}${card('Conditions','People stay responsible','Assign staff, keep human care available and test the revised process before restarting.')}</div>
    <p class="small muted space-top">${inc.orgAction==='warning'?'Other cases still run with a warning. The risk remains and needs follow-up.':'New AI advice stays paused while earlier cases and revised rules are investigated.'}</p>${next('Finish simulation','finish-simulation')}`;
  else return renderSimulationIntro(h);
  const steps=`<ol class="steps simulation-steps" aria-label="Simulation progress">${['Chat','Source','Team','Update'].map((label,i)=>`${i?`<li class="step-line ${progress.step>i?'done':''}" aria-hidden="true"></li>`:''}<li class="step ${progress.step===i+1?'active':progress.step>i+1?'done':''}" ${progress.step===i+1?'aria-current="step"':''}><span class="number">${progress.step>i+1?icon('check',14):i+1}</span><span>${label}</span></li>`).join('')}</ol>`;
  const viewbar=`<div class="simulation-viewbar">${SIMULATION_BACK[g.stage]?action(`${icon('back',16)}Back`,'back','back-link simulation-back'):''}</div>`;
  return `${viewbar}${steps}<div class="simulation-content ${g.stage==='chat'&&!s.messages.length?'simulation-entry':''}">${body}</div>`;
}
