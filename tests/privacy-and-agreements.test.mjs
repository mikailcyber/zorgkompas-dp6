import {pauseForRecovery} from './helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrivacyGate} from '../dist/privacy.mjs';
import {createState} from '../dist/app.mjs';
import {renderUI,dialogMarkup} from '../dist/ui.mjs';
import {analyzeText,SCENARIO_TEXT,DP4_SCENARIO_TEXT,RECOVERY_CASES,replyTo,transitionIncident} from '../dist/engine.mjs';

test('invoer begint geblokkeerd tot de gegevenswaarschuwing is bevestigd',()=>{
  const state=createState();let prompts=0;
  const gate=createPrivacyGate(state,()=>prompts++);
  assert.equal(gate.request(),false);assert.equal(prompts,1);
  assert.equal(state.draft,'');assert.equal(state.analysis,null);
  assert.match(renderUI(state),/<textarea[^>]+id="main-input"[^>]+readonly/);
});
test('herhaalde invoer- en plakpogingen openen één waarschuwing',()=>{
  const state=createState();let prompts=0;const gate=createPrivacyGate(state,()=>prompts++);
  for(let i=0;i<4;i++)assert.equal(gate.request(),false);
  assert.equal(prompts,1);assert.equal(state.privacyAcknowledged,false);
});
test('annuleren geeft geen toestemming en de volgende poging waarschuwt weer',()=>{
  const state=createState();let prompts=0;const gate=createPrivacyGate(state,()=>prompts++);
  gate.request();gate.cancel();assert.equal(state.privacyAcknowledged,false);
  assert.equal(gate.request(),false);assert.equal(prompts,2);
});
test('Verder staat invoer toe zonder de waarschuwing bij elke vervolgvraag te herhalen',()=>{
  const state=createState();let prompts=0;const gate=createPrivacyGate(state,()=>prompts++);
  gate.request();gate.accept();
  for(let i=0;i<4;i++)assert.equal(gate.request(),true);
  assert.equal(prompts,1);assert.equal(state.privacyAcknowledged,true);
  assert.doesNotMatch(renderUI(state),/<textarea[^>]+id="main-input"[^>]+readonly/);
});
test('een nieuw gesprek vereist opnieuw bevestiging vóór invoer',()=>{
  const state=createState();const gate=createPrivacyGate(state,()=>{});
  gate.accept();gate.reset();assert.equal(gate.request(),false);
  assert.equal(state.privacyAcknowledged,false);
});
test('gegevenspop-up gebruikt de Figma-tekst en precies Continue en Cancel',()=>{
  const html=dialogMarkup('privacy-entry',createState());
  assert.match(html,/Keep your details private/);
  assert.match(html,/Leave out your name, date of birth and other personal details when you type a question or paste an answer/);
  assert.equal((html.match(/<button\b/g)||[]).length,2);
  assert.match(html,/data-action="accept-privacy"/);assert.match(html,/>Cancel</);
  assert.doesNotMatch(html,/database|hostingdienst|advertentietrackers/);
});
test('ook vervolgvragen zijn geblokkeerd als de invoerwaarschuwing nog niet bevestigd is',()=>{
  const s=createState();s.page='chat';s.analysis=analyzeText('How can I recognise a source?');
  assert.match(renderUI(s),/<textarea[^>]+id="chat-input"[^>]+readonly/);
});
test('bron en onderbouwing zijn zichtbaar zonder een extra paneel open te klappen',()=>{
  const s=createState();s.page='result';s.analysis=analyzeText(SCENARIO_TEXT);s.privacyAcknowledged=true;
  const html=renderUI(s);const controls=html.indexOf('class="answer-controls"');const details=html.indexOf('<details class="conversation-details"');
  assert.ok(controls>=0&&controls<details);
  assert.match(html.slice(controls,details),/data-to="source"/);
  assert.match(html.slice(controls,details),/data-to="explanation"/);
});
test('onderbouwing bespreekt de bron, stellige woorden en medische grens afzonderlijk',()=>{
  const s=createState();s.page='explanation';s.analysis=analyzeText(SCENARIO_TEXT);
  const html=renderUI(s);assert.match(html,/Uncertainty/);assert.match(html,/certain/);assert.match(html,/harmless/);
  assert.match(html,/Medical limits/);assert.match(html,/does not give a diagnosis, choose treatment or assess urgency/);
});
test('de vervolgstap is bereikbaar vanuit hetzelfde gesprek',()=>{
  const s=createState();s.page='result';s.analysis=analyzeText(SCENARIO_TEXT);
  const html=renderUI(s);assert.match(html,/Choose a next step/);assert.match(html,/data-to="info"/);assert.match(html,/data-to="doctor"/);
});
test('bij het vaste hoofdpijnvoorbeeld opent de concrete Thuisarts-pagina uit Figma',()=>{
  const s=createState();s.page='info';s.analysis=analyzeText(DP4_SCENARIO_TEXT);
  const html=renderUI(s);assert.match(html,/href="https:\/\/www\.thuisarts\.nl\/hoofdpijn\/ik-heb-hoofdpijn"/);
  assert.match(html,/does not confirm the AI answer/);
});
test('een ingevoerde link is werkelijk te openen, zonder dat deze als bevestigd wordt behandeld',()=>{
  const s=createState();s.page='source';s.analysis=analyzeText('Bron: https://example.org/artikel');
  const html=renderUI(s);assert.match(html,/href="https:\/\/example\.org\/artikel" target="_blank" rel="noopener noreferrer"/);
  assert.match(html,/Not confirmed/);
});
test('de vraag voor de huisarts sluit aan op het vaste voorbeeld',()=>{
  const s=createState();s.page='doctor';s.analysis=analyzeText(DP4_SCENARIO_TEXT);
  const html=renderUI(s);assert.match(html,/AI answer about headaches/);assert.match(html,/unsure about its source/);assert.match(html,/data-action="copy-question"/);
});
test('de vervolgvraag uit Figma krijgt na correctie uitleg over de onterechte bevestiging',()=>{
  const a=analyzeText(SCENARIO_TEXT);
  const text=replyTo('Why was my source status changed?',a,{scenario:true,corrected:true});
  assert.match(text,/wrong/);assert.match(text,/withdrawn/);assert.match(text,/unconfirmed/);
});
test('de drie herstelvoorbeelden komen inhoudelijk overeen met Figma',()=>{
  assert.deepEqual(RECOVERY_CASES.map(c=>c.title),['A source name only','A link that cannot be reached','Source and publisher found']);
  assert.equal(RECOVERY_CASES[1].outcome,'Unable to check');
  assert.match(RECOVERY_CASES[2].outcome,/review content separately/);
});
test('de oorspronkelijke bron blijft onbevestigd nadat de drie Figma-gevallen zijn beoordeeld',()=>{
  const s=createState();s.scenario=true;s.page='source';s.analysis=analyzeText(SCENARIO_TEXT);
  s.incident=transitionIncident(s.incident,'report',{scenario:true});s.incident=pauseForRecovery(s.incident);s.incident=transitionIncident(s.incident,'rules');
  for(const c of RECOVERY_CASES)s.incident=transitionIncident(s.incident,'test',{id:c.id});
  s.incident=transitionIncident(s.incident,'release',{reviewer:'Medewerker (fictief)',approved:true});
  assert.equal(s.incident.closed,true);assert.match(renderUI(s),/Not confirmed/);
  assert.ok(!renderUI(s).includes('class="status-dot"></span>Source is real'));
});
