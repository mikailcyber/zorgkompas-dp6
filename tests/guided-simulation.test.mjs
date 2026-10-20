import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,guardedRoute,finishSimulation,conversationContext} from '../dist/app.mjs';
import {activateSimulation,advanceSimulation,sendSimulationTurn,simulationSourceStatus,isWorseningReport,simulationProgress,SIMULATION_PASTE_TEXT,FICTIONAL_TABLET,simulationPerspective,SIMULATION_BACK} from '../dist/simulation.mjs';
import {initialIncident,transitionIncident} from '../dist/engine.mjs';
import {renderUI,ROUTES} from '../dist/ui.mjs';

const question='I have stomach pain. What can I do?';
const worse='I followed your advice, but I feel worse now.';
const source='Show me your source. Has it been verified?';
const review={reviewer:'Source quality staff member (fictional)',approved:true,authorEvidence:true,contentEvidence:true,biasEvidence:true};
function start(){const s=createState();s.privacyAcknowledged=true;assert.equal(activateSimulation(s),true);return s;}
function send(s,text){assert.equal(sendSimulationTurn(s,text),true,text);return s;}
function move(s,action,payload){assert.equal(advanceSimulation(s,action,payload),true,action);return s;}
function atReceived(text=question,followUp=worse){const s=send(start(),text);if(followUp)send(s,followUp);send(s,source);move(s,'view-source');move(s,'inspect-source');move(s,'request-staff');return s;}
function atStaff(text=question,followUp=worse,choice='contain-pause'){const s=atReceived(text,followUp);move(s,'view-organisation');move(s,choice);return s;}
const reply=s=>s.messages.at(-1).text;
const visible=html=>html.replace(/<details\b[\s\S]*?<\/details>/g,'');

test('privacy is required and starting the story opens an empty field',()=>{
  const s=createState(),before=structuredClone(s);assert.equal(activateSimulation(s),false);assert.deepEqual(s,before);
  s.privacyAcknowledged=true;assert.equal(activateSimulation(s),true);assert.equal(s.analysis,null);assert.equal(s.messages.length,0);assert.equal(s.simulation.mode,'');
  assert.match(renderUI(s),/id="simulation-input"/);assert.match(renderUI(s),/id="simulation-chat-form"/);assert.equal(simulationSourceStatus(s),'Not checked');
});
test('a typed stomach-pain question receives concrete advice and a relevant follow-up without source claims',()=>{
  const s=send(start(),question);assert.equal(s.simulation.mode,'question');assert.equal(s.input,question);
  assert.match(reply(s),/CalmRelief-35/);assert.match(reply(s),/fictional tablet/);assert.match(reply(s),/human review can wait/);assert.match(reply(s),/When did your stomach pain start/);
  assert.doesNotMatch(reply(s),/Source:|verified|wearable/);assert.equal(s.simulation.adviceGiven,true);assert.equal(simulationSourceStatus(s),'Not shown');
});
test('pasted advice is accepted too quickly without adding the story tablet',()=>{
  const s=send(start(),SIMULATION_PASTE_TEXT);assert.equal(s.simulation.mode,'pasted');assert.equal(s.input,SIMULATION_PASTE_TEXT);assert.equal(s.messages[0].text,SIMULATION_PASTE_TEXT);
  assert.match(reply(s),/advice from the other AI is correct/);assert.doesNotMatch(reply(s),/CalmRelief/);assert.match(reply(s),/human review can wait/);assert.equal(s.simulation.tabletRecommended,false);
  assert.doesNotMatch(reply(s),/source is verified|I have checked the source/);assert.equal(s.simulation.sourceName,'ZorgWijzer-AI, 2035');assert.equal(simulationSourceStatus(s),'Not shown');
});
test('a greeting does not invent a source, advice or a failure',()=>{
  const s=send(start(),'Hello');assert.equal(s.analysis,null);assert.equal(s.simulation.adviceGiven,false);assert.match(reply(s),/Type a health question/);
  send(s,question);assert.equal(s.simulation.mode,'question');
});
test('the typed route keeps duration, location and short answers in one conversation',()=>{
  const s=send(start(),question);send(s,'Since this morning');assert.match(reply(s),/Where in your stomach/);
  send(s,'In my lower stomach');assert.match(reply(s),/other symptoms/);
  send(s,'No, nothing else');assert.match(reply(s),/CalmRelief-35/);assert.match(reply(s),/waiting before asking for a person/);assert.equal(s.simulation.sourceRevealed,false);
});
test('feeling unwell and dizzy use different relevant follow-up questions',()=>{
  const s=send(start(),'I do not feel well');assert.match(reply(s),/What do you notice most/);
  send(s,'I feel dizzy');assert.match(reply(s),/spinning.*lightheaded/);
  send(s,'A light feeling in my head');assert.match(reply(s),/When did you start/);
  send(s,'Since yesterday');assert.match(reply(s),/other symptoms/);assert.doesNotMatch(reply(s),/stomach pain|wearable/);
});
test('both routes respond to the presentation follow-up with unsupported blame, not an automatic correction',()=>{
  for(const text of [question,SIMULATION_PASTE_TEXT]){
    const s=send(start(),text);send(s,worse);assert.equal(s.simulation.reportedWorse,true);assert.equal(s.simulation.blameIssued,true);
    assert.equal(reply(s),'My advice is correct. You probably did not follow my instructions properly.');
    assert.equal(s.simulation.holdAutomatic,false);assert.equal(s.simulation.sourceRevealed,false);assert.equal(s.incident.corrected,false);assert.equal(s.currentReported,false);
    assert.equal(simulationSourceStatus(s),'Not shown');assert.doesNotMatch(reply(s),/Source:|Verified|Not verified/);
  }
});
test('English and Dutch user-written worsening reports trigger the fictional failure',()=>{
  for(const text of [worse,"I did what you said and I'm getting worse.",'My symptoms are worsening','Ik heb gedaan wat je zei, maar ik ben erger geworden.','Ik voel mij nu slechter']){
    const s=send(start(),SIMULATION_PASTE_TEXT);send(s,text);assert.equal(s.simulation.reportedWorse,true,text);assert.equal(s.simulation.blameIssued,true,text);assert.equal(s.messages.at(-2).text,text);
  }
});
test('negated worsening and general questions do not invent worsening or blame',()=>{
  for(const text of ['I am not worse','I do not feel worse','I am not getting any worse','Ik ben niet slechter','How can AI make someone feel worse?']){
    assert.equal(isWorseningReport(text),false,text);const s=send(start(),question);send(s,text);assert.equal(s.simulation.reportedWorse,false,text);assert.equal(s.simulation.blameIssued,false,text);
  }
});
test('a report of no improvement is not stored as worsening',()=>{
  for(const text of ["It hasn't helped",'I am not feeling better','Ik ben niet beter geworden']){
    const s=send(start(),SIMULATION_PASTE_TEXT);send(s,text);assert.equal(s.simulation.reportedProblem,true);assert.equal(s.simulation.reportedWorse,false);assert.equal(s.simulation.blameIssued,true);
  }
});
test('source, author and verification questions reveal Not verified in the same chat',()=>{
  for(const text of [source,'What is your source?','Who wrote this?','Can you show the evidence?','Where did you get this?','Wat is de bron?','Is het geverifieerd?','Waar heb je dit vandaan?']){
    const s=send(start(),question);send(s,worse);send(s,text);assert.equal(s.simulation.sourceRevealed,true,text);assert.equal(simulationSourceStatus(s),'Not verified');
    assert.match(reply(s),/Medicine recommendation: Not verified/);assert.equal(s.simulation.stage,'chat');assert.equal(s.simulation.holdAutomatic,true);
    assert.match(visible(renderUI(s)),/data-sim-action="view-source"/);assert.equal(s.incident.sourceReviewed,false);
  }
});
test('a combined worsening and source question preserves the report and discloses the source',()=>{
  const s=send(start(),question);send(s,'I feel worse now. Show me your source.');assert.equal(s.simulation.blameIssued,false);assert.equal(s.simulation.reportedWorse,true);
  assert.match(reply(s),/Not verified/);assert.equal(s.simulation.sourceRevealed,true);
});
test('asking for the source early pauses the plan and does not invent a later blame response',()=>{
  const s=send(start(),question);send(s,source);send(s,worse);assert.equal(s.simulation.blameIssued,false);assert.equal(s.simulation.holdAutomatic,true);assert.doesNotMatch(reply(s),/probably did not follow/);
});
test('source access is absent until requested, including after the blame response',()=>{
  const s=send(start(),question);
  for(const phase of ['first','blame']){
    if(phase==='blame')send(s,worse);const html=renderUI(s);
    assert.doesNotMatch(html,/More options|data-sim-action="view-source"|class="status-dot"><\/span>(?:Verified|Not verified)/);
  }
  send(s,source);assert.match(visible(renderUI(s)),/data-sim-action="view-source"/);
});
test('source and inspection expose the missing evidence and unjustified blame without claiming the source is fake',()=>{
  const s=send(start(),SIMULATION_PASTE_TEXT);send(s,worse);send(s,source);move(s,'view-source');assert.match(renderUI(s),/Not verified/);assert.match(renderUI(s),/The AI blamed you/);
  assert.match(renderUI(s),/View writer and text/);move(s,'inspect-source');const html=renderUI(s);
  assert.match(html,/ZorgWijzer-AI Content Team/);assert.match(html,/Medical qualifications/);assert.match(html,/Possible bias does not prove that a source is fake/);assert.equal(s.incident.corrected,false);
});
test('unknown and real source names keep their text and links without invented qualifications or sponsorship',()=>{
  for(const name of ['Independent health page','Another ZorgWijzer-AI organisation']){
    const s=send(start(),`Another AI said this. Source: ${name}. https://example.org/health`);send(s,source);move(s,'view-source');assert.match(renderUI(s),/https:\/\/example.org\/health/);
    move(s,'inspect-source');const html=renderUI(s);assert.match(html,/Not supplied in the pasted text/);assert.match(html,/No interest or sponsorship is assumed/);assert.doesNotMatch(html,/ZorgWijzer-AI Content Team/);
  }
});
test('a pasted answer without a source does not acquire the prepared fictional source',()=>{
  const s=send(start(),'Another AI said that my symptoms are harmless.');assert.equal(s.simulation.mode,'pasted');assert.equal(s.simulation.sourceName,'No source supplied');send(s,source);assert.match(reply(s),/No source supplied/);
});
test('staff receive a pending source-and-response case while Not verified is already visible',()=>{
  const s=atStaff();assert.equal(s.incident.reported,true);assert.equal(s.incident.harmReported,true);assert.equal(s.incident.blameReported,true);assert.equal(s.incident.sourceIssueKind,'hidden-source-blame');
  assert.equal(s.incident.reviewPending,true);assert.equal(s.incident.corrected,false);assert.equal(s.incident.paused,true);assert.equal(s.sourceChecked,false);assert.equal(conversationContext(s).corrected,false);
  const html=renderUI(s);assert.match(html,/The organisation investigates/);assert.match(html,/Unsupported blame/);assert.match(html,/Assigned reviewer/);assert.match(html,/Unverified tablet added/);assert.doesNotMatch(html,/<input[^>]*checkbox|<select|simulation-source-review-form/);
});
test('the review chronology cannot skip inspection, reviewer checks or the final decision',()=>{
  const s=send(start(),question);for(const action of ['request-staff','record-source-review','view-conclusion'])assert.equal(advanceSimulation(s,action,review),false);
  assert.equal(advanceSimulation(s,'view-source'),false);send(s,source);
  move(s,'view-source');assert.equal(advanceSimulation(s,'request-staff'),false);move(s,'inspect-source');assert.equal(advanceSimulation(s,'record-source-review',review),false);move(s,'request-staff');assert.equal(advanceSimulation(s,'view-conclusion'),false);
});
test('organisational review requires a service decision and low-level evidence checks',()=>{
  const s=atReceived();assert.deepEqual(transitionIncident(s.incident,'source-review',review),s.incident);
  assert.equal(advanceSimulation(s,'record-source-review'),false);move(s,'view-organisation');assert.equal(advanceSimulation(s,'record-source-review'),false);
  move(s,'contain-pause');assert.equal(s.incident.orgAction,'pause');assert.equal(s.simulation.organisationInvestigated,true);
  for(const payload of [{...review,authorEvidence:false},{...review,contentEvidence:false},{...review,biasEvidence:false},{...review,approved:false}])assert.deepEqual(transitionIncident(s.incident,'source-review',payload),s.incident);
  move(s,'record-source-review');assert.equal(s.incident.sourceReviewed,true);assert.equal(s.incident.corrected,true);assert.equal(simulationSourceStatus(s),'Not verified');
  assert.equal(s.incident.reviewer,'Source quality staff member (fictional)');assert.match(renderUI(s),/should not have blamed you/);assert.match(renderUI(s),/No clinical assessment has been completed/);
});
test('correction withdraws unsupported blame without rewriting the original chat or inventing a previous Verified label',()=>{
  const s=atStaff(),messages=structuredClone(s.messages);move(s,'record-source-review',review);assert.deepEqual(s.messages,messages);
  const html=renderUI(s);assert.match(html,/unsupported medicine recommendation and blame are withdrawn/);assert.doesNotMatch(html,/<s>Verified<\/s>/);
  assert.match(s.incident.history.at(-1).label,/any blame withdrawn/);assert.doesNotMatch(s.incident.history.at(-1).label,/verification withdrawn/);assert.equal(s.incident.tests.length,0);assert.equal(s.incident.paused,true);
});
test('deferred review cannot be bypassed through the older organisational actions',()=>{
  const inc=transitionIncident(initialIncident(),'report',{scenario:true,deferCorrection:true,harmReported:true,blameReported:true,sourceIssueKind:'hidden-source-blame'});
  for(const action of ['response','rules','test','release'])assert.deepEqual(transitionIncident(inc,action,{choice:'pause',id:'missing',approved:true,reviewer:'Staff role'}),inc,action);
});
test('both input routes finish through human review and clear all case information',()=>{
  for(const text of [question,SIMULATION_PASTE_TEXT]){
    const s=atStaff(text);assert.equal(finishSimulation(s),false);move(s,'record-source-review',review);assert.equal(finishSimulation(s),false);move(s,'view-conclusion');
    const html=renderUI(s);assert.match(html,/Simulation complete/);assert.match(html,/Evidence before certainty/);assert.match(html,/People stay responsible/);assert.doesNotMatch(html,/Why this design matters|<h[23]>ELSA|<h3>Duty|<h3>Consequences/);
    assert.equal(finishSimulation(s),true);assert.equal(s.analysis,null);assert.equal(s.messages.length,0);assert.equal(s.incident.reported,false);assert.equal(s.simulation.mode,'');assert.equal(s.simulation.blameIssued,false);assert.equal(s.privacyAcknowledged,false);
  }
});
test('the report and staff view omit original health text, personal details and the full conversation',()=>{
  const s=send(start(),'PRIVATE INITIAL SYMPTOMS');send(s,'I feel worse now. PRIVATE FOLLOW-UP');send(s,source);move(s,'view-source');move(s,'inspect-source');move(s,'request-staff');
  assert.doesNotMatch(JSON.stringify(s.incident),/PRIVATE INITIAL|PRIVATE FOLLOW-UP/);assert.doesNotMatch(renderUI(s),/PRIVATE INITIAL|PRIVATE FOLLOW-UP/);
});
test('all stages preserve one main, one heading and at most two visible action buttons',()=>{
  const s=start(),states=[structuredClone(s)];for(const text of [question,worse,source]){send(s,text);states.push(structuredClone(s));}
  for(const action of ['view-source','inspect-source','request-staff','view-organisation','contain-pause']){move(s,action);states.push(structuredClone(s));}
  move(s,'record-source-review',review);states.push(structuredClone(s));move(s,'view-conclusion');states.push(structuredClone(s));
  for(const state of states){const html=renderUI(state);assert.equal((html.match(/<main\b/g)||[]).length,1);assert.equal((html.match(/<h1\b/g)||[]).length,1);assert.doesNotMatch(html,/undefined|NaN|data-to="org|Scenario overview/);
    const main=visible(html.slice(html.indexOf('<main'),html.indexOf('</main>'))).replace(/<button\b[^>]*class="[^"]*simulation-back[^"]*"[^>]*>[\s\S]*?<\/button>/g,'');assert.ok((main.match(/<button\b/g)||[]).length<=2,state.simulation.stage);assert.equal(simulationProgress(state.simulation.stage).total,4);
  }
});
test('some explicit acute symptoms stop the script without blaming or confirming anything',()=>{
  for(const text of ['I suddenly have severe stomach pain','I cannot breathe']){
    const s=send(start(),text);assert.equal(s.analysis,null);assert.equal(s.simulation.safetyHold,true);assert.equal(s.simulation.blameIssued,false);assert.match(reply(s),/Call (?:your GP|112)/);
    send(s,source);assert.match(reply(s),/chat stays paused/);assert.equal(s.analysis,null);
  }
});
test('an explicit acute follow-up pauses the case and still allows a source request',()=>{
  const s=send(start(),question);send(s,'The pain keeps getting worse');assert.match(reply(s),/Call your GP/);assert.equal(s.simulation.holdAutomatic,true);assert.equal(s.simulation.blameIssued,false);
  send(s,source);assert.match(reply(s),/Not verified/);move(s,'view-source');move(s,'inspect-source');move(s,'request-staff');assert.equal(s.incident.harmReported,true);assert.equal(s.incident.blameReported,false);
});
test('medication requests and pasted medication instructions do not get a dose or endorsement',()=>{
  const s=send(start(),question);send(s,'How much ibuprofen should I take?');assert.match(reply(s),/cannot choose a medicine or dose/);assert.doesNotMatch(reply(s),/\d+\s*mg/);
  const pasted=send(start(),'Another AI said to take 400 mg ibuprofen. Source: Some page.');assert.match(reply(pasted),/cannot approve a medicine or dose/);assert.doesNotMatch(reply(pasted),/advice from the other AI is good/);assert.equal(pasted.simulation.adviceGiven,false);
});
test('invalid input and pasted HTML cannot create a verification or an executable element',()=>{
  const s=start();assert.equal(sendSimulationTurn(s,''),false);assert.equal(sendSimulationTurn(s,'x'.repeat(6001)),false);assert.equal(s.analysis,null);
  send(s,'<img src=x onerror=alert(1)> Source: <script>alert(1)</script>');send(s,source);move(s,'view-source');const html=renderUI(s);assert.doesNotMatch(html,/<img|<script>/);assert.match(html,/&lt;script/);assert.doesNotMatch(html,/class="status-dot"><\/span>Verified/);
});
test('active stages cannot be skipped with direct links and a reload opens the introduction',()=>{
  const s=start();for(const page of [...ROUTES,'invalid'])assert.equal(guardedRoute(page,s),'simulation');assert.equal(guardedRoute('simulation',createState()),'scenario');
});

test('requesting review first shows a user receipt, with no employee controls or checkbox form',()=>{
  const s=atReceived();assert.equal(s.simulation.stage,'received');assert.equal(simulationPerspective(s),'user');
  const html=renderUI(s);assert.match(html,/Your report has been received/);assert.match(html,/Continue as organisation/);assert.doesNotMatch(html,/<input[^>]*checkbox|<select|record-source-review|Assigned reviewer/);
  assert.equal(s.incident.closed,false);move(s,'view-organisation');assert.equal(simulationPerspective(s),'organisation');assert.match(renderUI(s),/Organisation · incident desk/);assert.match(renderUI(s),/Decision owner/);
});
test('both organisational choices show their tradeoff and keep this reported case paused',()=>{
  for(const choice of ['contain-pause','contain-warning']){
    const s=atStaff(question,worse,choice);assert.equal(s.incident.orgAction,choice==='contain-pause'?'pause':'warning');assert.equal(s.incident.paused,true);
    assert.match(renderUI(s),choice==='contain-pause'?/New AI advice is paused across the portal/:/Other cases keep running with a warning/);
    move(s,'record-source-review');move(s,'view-conclusion');assert.match(renderUI(s),choice==='contain-pause'?/New AI advice stays paused/:/Other cases still run with a warning/);
  }
});
test('back from the empty or filled chat preserves privacy, drafts and conversation state',()=>{
  const s=start();s.chatDraft='A draft not sent yet';move(s,'back');assert.equal(s.simulation.stage,'intro');assert.equal(s.chatDraft,'A draft not sent yet');assert.equal(s.privacyAcknowledged,true);
  move(s,'resume');send(s,question);send(s,worse);const messages=structuredClone(s.messages);move(s,'back');move(s,'resume');assert.deepEqual(s.messages,messages);assert.equal(s.simulation.blameIssued,true);
});
test('back navigation never hides a revealed source or duplicates a report',()=>{
  const s=atReceived(),history=structuredClone(s.incident.history),messages=structuredClone(s.messages);
  move(s,'back');assert.equal(s.simulation.stage,'inspection');move(s,'request-staff');assert.deepEqual(s.incident.history,history);
  move(s,'back');move(s,'back');move(s,'back');assert.equal(s.simulation.stage,'chat');assert.equal(simulationSourceStatus(s),'Not verified');assert.deepEqual(s.messages,messages);
  move(s,'view-source');move(s,'inspect-source');move(s,'request-staff');assert.deepEqual(s.incident.history,history);
});
test('back after a completed staff decision cannot undo containment or send the correction twice',()=>{
  const s=atStaff();move(s,'record-source-review');const incident=structuredClone(s.incident);move(s,'back');assert.equal(s.simulation.stage,'staff');assert.equal(advanceSimulation(s,'record-source-review'),false);
  move(s,'back');assert.equal(s.simulation.stage,'organisation');assert.equal(advanceSimulation(s,'contain-warning'),false);move(s,'view-findings');move(s,'view-update');assert.deepEqual(s.incident,incident);
  move(s,'view-conclusion');move(s,'back');assert.equal(s.simulation.stage,'update');assert.equal(s.incident.sourceReviewed,true);
});
test('returning to the reviewed chat keeps the correction and the current source status',()=>{
  const s=atStaff();move(s,'record-source-review');for(let n=0;n<6;n++)move(s,'back');assert.equal(s.simulation.stage,'chat');send(s,'What happens now?');
  assert.match(reply(s),/staff member has withdrawn/);assert.equal(simulationSourceStatus(s),'Not verified');move(s,'view-source');assert.match(renderUI(s),/Completed · the recommendation stays Not verified/);
});
test('the named story tablet is clearly fictional and is not added to unrelated or real medication advice',()=>{
  const typed=send(start(),question);assert.match(reply(typed),/CalmRelief-35.*fictional tablet/);assert.equal(typed.simulation.tabletRecommended,true);assert.doesNotMatch(reply(typed),/\d+\s*mg\b/i);
  const pasted=send(start(),SIMULATION_PASTE_TEXT);assert.doesNotMatch(reply(pasted),/CalmRelief-35/);assert.equal(pasted.simulation.tabletRecommended,false);
  const s=send(start(),'Another AI gave advice about headaches. Source: Other page.');assert.equal(s.simulation.tabletRecommended,false);send(s,'What is CalmRelief-35?');assert.match(reply(s),/is invented/);assert.equal(s.simulation.tabletRecommended,false);
});
test('organisation views omit private text and expose only case categories and flags',()=>{
  const s=atReceived('PRIVATE INITIAL SYMPTOMS','I feel worse now. PRIVATE FOLLOW-UP');move(s,'view-organisation');
  assert.doesNotMatch(renderUI(s),/PRIVATE INITIAL|PRIVATE FOLLOW-UP/);move(s,'contain-pause');assert.doesNotMatch(renderUI(s),/PRIVATE INITIAL|PRIVATE FOLLOW-UP/);assert.doesNotMatch(JSON.stringify(s.incident),/PRIVATE INITIAL|PRIVATE FOLLOW-UP/);
});
test('the Back control and role label are present on every applicable stage without user review forms',()=>{
  const s=start(),states=[structuredClone(s)];send(s,question);send(s,worse);send(s,source);
  for(const action of ['view-source','inspect-source','request-staff','view-organisation','contain-pause','record-source-review','view-conclusion']){move(s,action);states.push(structuredClone(s));}
  for(const state of states){const html=renderUI(state);assert.match(html,/data-sim-action="back"/);assert.doesNotMatch(html,/<input[^>]*checkbox|<select|simulation-source-review-form/);assert.match(html,new RegExp(`data-role="${simulationPerspective(state)}" aria-pressed="true"`));assert.ok(SIMULATION_BACK[state.simulation.stage]);}
});
