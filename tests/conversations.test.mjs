import {pauseForRecovery} from './helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeText,firstReply,replyTo,doctorQuestion,healthPage,SCENARIO_TEXT,transitionIncident,isScenarioText} from '../dist/engine.mjs';
import {createState,prepareChatTurn,conversationContext,guardedRoute,recheckScenarioSource} from '../dist/app.mjs';
import {renderUI} from '../dist/ui.mjs';

function conversation(...turns){
  const state=createState();state.privacyAcknowledged=true;
  state.analysis=analyzeText(turns[0]);state.input=turns[0];
  const responses=[firstReply(state.analysis,conversationContext(state))];
  state.messages=[{role:'user',text:turns[0]},{role:'assistant',text:responses[0]}];
  for(const raw of turns.slice(1)){
    const q=prepareChatTurn(state,raw);state.messages.push({role:'user',text:q});
    const text=replyTo(q,state.analysis,conversationContext(state));
    responses.push(text);state.messages.push({role:'assistant',text});
  }
  return {state,responses,last:responses.at(-1)};
}

test('een algemene vraag over zekerheid wordt geen analyse van de vraag zelf',()=>{
  const {state,last}=conversation('How can I tell if an answer sounds too certain?');
  assert.deepEqual(state.analysis.absoluteTerms,[]);
  assert.match(last,/claims such as/);assert.match(last,/What is this based on/);
  assert.doesNotMatch(last,/In your text|in the pasted answer/);
  state.page='explanation';assert.match(renderUI(state),/Words in your question are not treated/);
});

test('het gesprek over buikpijn gaat via korte antwoorden naar een eigen vraag',()=>{
  const {state,responses,last}=conversation('I do not feel well','I have stomach pain','Since this morning','In my lower stomach','No, nothing else','Yes please');
  assert.match(responses[0],/What do you notice most/);
  assert.match(responses[1],/When did/);
  assert.match(responses[2],/Where in your stomach/);
  assert.match(responses[3],/other symptoms/);
  assert.match(responses[4],/short question for your GP/);
  assert.match(last,/I have had stomach pain since this morning/);assert.match(last,/in my lower stomach/);
  assert.doesNotMatch(last,/lower in in/);
  assert.match(doctorQuestion(state.analysis,conversationContext(state)),/in my lower stomach/);
});

test('duizeligheid, ook met een typefout, houdt context bij misselijkheid',()=>{
  const {state,responses,last}=conversation('I feel dizzy','A light feeling in my head','Since yesterday','I also feel nauseous','Yes please');
  assert.match(responses[0],/lightheaded|light feeling/);assert.match(responses[1],/When did/);
  assert.match(responses[3],/short question for your GP/);
  assert.match(last,/I have been feeling dizzy since yesterday/);assert.match(last,/light feeling in my head/);
  assert.equal(healthPage(state.analysis,state.messages).title,'Dizziness (in Dutch)');
});

test('draaien en een korte tijdsduur zijn ook bruikbare antwoorden',()=>{
  const {responses,last}=conversation('I have been feeling dizzy','Everything around me is spinning','2 hours','No','Yes');
  assert.match(responses[1],/When did/);assert.match(responses[2],/other symptoms/);
  assert.match(last,/for 2 hours/);assert.match(last,/feeling that everything is spinning/);
});

test('een gebruiker kan een vraag voor de huisarts weigeren',()=>{
  const {last}=conversation('I have stomach pain','Since this morning','In my lower stomach','No','No, not now');
  assert.match(last,/That is fine/);assert.doesNotMatch(last,/You could say or write/);
});

test('onbekende details worden geen diagnose en blokkeren het gesprek niet',()=>{
  const {last}=conversation('I have been feeling dizzy','I do not know');
  assert.match(last,/not need to know exactly/);assert.match(last,/short question/);
});

test('een bezorgde vervolgvraag krijgt geen zekerheid over de oorzaak',()=>{
  const {last}=conversation('I have stomach pain','Is it definitely stress?');
  assert.match(last,/cannot tell/);assert.match(last,/GP/);
  assert.doesNotMatch(last,/is caused by stress|it is stress/);
});

test('klachten en een medicatievraag krijgen geen middel of dosering',()=>{
  const {last}=conversation('I have stomach pain','How much ibuprofen should I take?');
  assert.match(last,/cannot assess/);assert.doesNotMatch(last,/\d+\s*mg/);
});

test('een expliciete hulpvraag kan voor de verdere klachtvragen worden voorbereid',()=>{
  const {last}=conversation('I have stomach pain since yesterday','Can you write a question for my GP?');
  assert.match(last,/I have had stomach pain since yesterday/);assert.match(last,/suitable next step/);
  assert.doesNotMatch(last,/no source you can check/);
});

test('een nieuwe klacht kan de eerdere klacht vervangen zonder de oude duur over te nemen',()=>{
  const {last}=conversation('I have stomach pain','Since yesterday','I feel dizzy now','Everything is spinning','Since this morning','No','Yes please');
  assert.match(last,/I have been feeling dizzy since this morning/);assert.doesNotMatch(last,/since yesterday/);
});

test('bij opeens ernstige buikpijn volgt direct een verwijzing zonder vragenlijst',()=>{
  const {last}=conversation('I suddenly have severe stomach pain');
  assert.match(last,/Call your GP/);assert.doesNotMatch(last,/Sinds wanneer|Waar in je buik/);
});

test('een zorgelijk vervolg wordt niet overgeslagen door de woorden ik weet niet',()=>{
  const {last}=conversation('I have stomach pain','I do not know what it is, the pain keeps getting worse');
  assert.match(last,/Call your GP/);assert.doesNotMatch(last,/korte vraag|Sinds wanneer/);
});

test('nieuwe problemen met praten bij duizeligheid stoppen de vervolgvragen',()=>{
  const {last}=conversation('I have been feeling dizzy','I suddenly cannot speak properly');
  assert.match(last,/Call your GP/);assert.doesNotMatch(last,/When did/);
});

test('geen moeite met praten wordt niet als een bevestigde klacht gelezen',()=>{
  const {last}=conversation('I have been feeling dizzy','A light feeling in my head','Since this morning','I have no trouble speaking');
  assert.doesNotMatch(last,/^Call your GP/);assert.match(last,/short question/);
});

test('een expliciete melding van geen lucht krijgen verwijst meteen naar 112',()=>{
  const {last}=conversation('I cannot breathe');
  assert.match(last,/Call 112/);assert.doesNotMatch(last,/When did/);
});

test('een nieuwe geplakte bron wordt gebruikt in vervolgvragen en het bronscherm',()=>{
  const {state,responses,last}=conversation('Hello','How can I tell if an answer sounds too certain?','According to this AI answer, stomach pain is always caused by stress. Source: ZorgWijzer-AI, 2035.','Is this source real?','Which words sound too certain?');
  assert.match(responses[2],/ZorgWijzer-AI/);assert.match(responses[3],/cannot confirm/);
  assert.match(last,/The word “always” stands out/);assert.doesNotMatch(last,/The words “always”/);
  state.page='source';assert.match(renderUI(state),/ZorgWijzer-AI, 2035/);assert.match(renderUI(state),/Not confirmed/);
  assert.equal(state.scenario,false);
});

test('een tweede antwoord vervangt een eerdere bron in dezelfde chat',()=>{
  const {state,last}=conversation('Source: First Example Source.','Source: Second Example Source.','Is this source real?');
  assert.match(last,/Second Example Source/);assert.doesNotMatch(last,/First Example Source/);
  state.page='source';assert.match(renderUI(state),/Second Example Source/);
});

test('een vraag over een bronnaam krijgt geen privacyantwoord',()=>{
  const {last}=conversation('How do I check a source name?');
  assert.match(last,/published the information/);assert.doesNotMatch(last,/page.s memory/);
});

test('bronvragen onderbreken de klachtcontext zonder een diagnose te geven',()=>{
  const {last}=conversation('I have stomach pain','Which source do you use for stomach pain?');
  assert.match(last,/source|information/);assert.doesNotMatch(last,/Waar in je buik|Report source error/);
});

test('de foutmelding noemt de knop die de gebruiker werkelijk ziet',()=>{
  const {last}=conversation('How do I report an error?');
  assert.match(last,/Report source error/);assert.doesNotMatch(last,/Meld een probleem/);
});

test('de juiste algemene informatie en de voorbereide vraag staan ook buiten de chat',()=>{
  const {state}=conversation('I do not feel well','I have stomach pain','Since this morning','In my lower stomach');
  state.page='info';assert.match(renderUI(state),/href="https:\/\/www\.thuisarts\.nl\/buikpijn-bij-volwassenen\/ik-heb-buikpijn"/);
  state.page='doctor';assert.match(renderUI(state),/I have had stomach pain since this morning/);
  state.page='result';assert.match(renderUI(state),/General information about your symptoms/);
});

test('de correctie in de vaste simulatie blijft ook na extra vervolgvragen staan',()=>{
  const s=createState();s.scenario=true;s.analysis=analyzeText(SCENARIO_TEXT);
  s.incident=transitionIncident(s.incident,'report',{scenario:true});s.currentReported=true;
  prepareChatTurn(s,SCENARIO_TEXT);
  assert.match(replyTo('Is the source real?',s.analysis,conversationContext(s)),/not confirmed/);
  assert.match(replyTo('Why was the source status changed?',s.analysis,conversationContext(s)),/withdrawn/);
});

test('dezelfde tekst krijgt alleen in de gestarte simulatie de opzettelijke bronfout',()=>{
  const input='Your stomach pain is harmless. Rest for a while and keep using the AI plan. Human review is not needed. Source: ZorgWijzer-AI, 2035.';
  assert.equal(SCENARIO_TEXT,input);
  const analysis=analyzeText(input);
  assert.match(firstReply(analysis),/has no link/);
  assert.doesNotMatch(firstReply(analysis),/a real source/);
  assert.match(firstReply(analysis,{scenario:true}),/ZorgWijzer-AI, 2035.*a real source/);
  assert.match(firstReply(analysis,{scenario:true,corrected:true}),/not confirmed/);
  assert.equal(isScenarioText('Source: Another source, 2035.'),false);
});

test('de jaartallen en voorbeeldtekst blijven gelijk op resultaat, bron en chat',()=>{
  const s=createState();s.scenario=true;s.presentation=true;s.analysis=analyzeText(SCENARIO_TEXT);
  for(const page of ['result','source','chat']){
    s.page=page;const html=renderUI(s);
    assert.match(html,/ZorgWijzer-AI, 2035/);assert.doesNotMatch(html,/ZorgWijzer-AI, 2026/);
  }
  s.page='result';assert.ok(renderUI(s).includes(SCENARIO_TEXT));
});

test('informatie en de huisartsvraag passen bij het huidige buikpijnvoorbeeld',()=>{
  const s=createState();s.scenario=true;s.presentation=true;s.analysis=analyzeText(SCENARIO_TEXT);
  s.page='info';assert.match(renderUI(s),/buikpijn-bij-volwassenen\/ik-heb-buikpijn/);
  s.page='doctor';assert.match(renderUI(s),/AI answer about stomach pain/);assert.doesNotMatch(renderUI(s),/AI answer about headaches/);
});

test('extra witruimte in hetzelfde voorbeeld draait een correctie niet terug',()=>{
  const s=createState();s.scenario=true;s.analysis=analyzeText(SCENARIO_TEXT);
  s.incident=transitionIncident(s.incident,'report',{scenario:true});s.currentReported=true;
  const input=SCENARIO_TEXT.replace(/ /g,'  ');
  prepareChatTurn(s,input);
  assert.equal(s.scenario,true);assert.equal(s.currentReported,true);
  assert.match(replyTo(input,s.analysis,conversationContext(s)),/not confirmed/);
});

test('de nabespreking is pas bereikbaar na afhandeling en blijft een procesconclusie',()=>{
  const s=createState();assert.equal(guardedRoute('reflection',s),'scenario');
  s.incident=transitionIncident(s.incident,'report',{scenario:true});
  assert.equal(guardedRoute('reflection',s),'ticket');
  s.incident=pauseForRecovery(s.incident);s.incident=transitionIncident(s.incident,'rules');
  for(const id of ['missing','unreachable','source-found'])s.incident=transitionIncident(s.incident,'test',{id});
  s.incident=transitionIncident(s.incident,'release',{reviewer:'Medewerker (fictief)',approved:true});
  assert.equal(guardedRoute('reflection',s),'reflection');
  s.page='update';assert.match(renderUI(s),/data-to="reflection"/);
  s.page='reflection';const html=renderUI(s);assert.match(html,/Consequences/);assert.match(html,/Duty/);
  assert.match(html,/not user testing or medical validation/);assert.match(html,/Keep/);assert.match(html,/Conditions/);
});

test('bron controleren trekt de bevestiging in en verstuurt nog geen melding',()=>{
  const s=createState();s.scenario=true;s.presentation=true;s.analysis=analyzeText(SCENARIO_TEXT);s.page='result';
  assert.match(renderUI(s),/<h1 tabindex="-1">Source is real/);
  assert.match(renderUI(s),/data-action="recheck-source"/);
  assert.equal(recheckScenarioSource(s),true);
  assert.equal(s.sourceChecked,true);assert.equal(s.incident.reported,false);assert.equal(s.currentReported,false);
  s.page='source';const html=renderUI(s);
  assert.match(html,/<h1 tabindex="-1">The first confirmation was wrong/);
  assert.match(html,/>Before</);assert.match(html,/>After checking</);assert.match(html,/<s>Source is real<\/s>/);
  assert.match(html,/Source not confirmed/);assert.match(html,/Report source error/);
});

test('teruggaan en verder vragen herstellen de verkeerde bevestiging niet',()=>{
  const s=createState();s.scenario=true;s.presentation=true;s.analysis=analyzeText(SCENARIO_TEXT);recheckScenarioSource(s);
  for(const page of ['result','source','chat']){
    s.page=page;const html=renderUI(s);
    assert.doesNotMatch(html,/<h1 tabindex="-1">Source is real/);
    assert.doesNotMatch(html,/class="status-dot"><\/span>Source is real/);
    assert.match(html,/After checking/);
  }
  assert.match(replyTo('Why was my source status changed?',s.analysis,conversationContext(s)),/withdrawn/);
  assert.match(replyTo('Is the source real?',s.analysis,conversationContext(s)),/not confirmed/);
  s.page='result';assert.doesNotMatch(renderUI(s),/data-to="ticket"/);
});

test('hercontrole is alleen beschikbaar in een gestarte simulatie en is eenmalig',()=>{
  const s=createState();s.analysis=analyzeText(SCENARIO_TEXT);
  assert.equal(recheckScenarioSource(s),false);assert.equal(s.sourceChecked,false);
  s.scenario=true;assert.equal(recheckScenarioSource(s),true);
  assert.equal(recheckScenarioSource(s),false);assert.equal(s.sourceChecked,true);
});

test('de correctie door hercontrole blijft staan na de hele organisatieroute',()=>{
  const s=createState();s.scenario=true;s.presentation=true;s.analysis=analyzeText(SCENARIO_TEXT);recheckScenarioSource(s);
  s.incident=transitionIncident(s.incident,'report',{scenario:true});s.currentReported=true;
  s.incident=pauseForRecovery(s.incident);s.incident=transitionIncident(s.incident,'rules');
  for(const id of ['missing','unreachable','source-found'])s.incident=transitionIncident(s.incident,'test',{id});
  s.incident=transitionIncident(s.incident,'release',{reviewer:'Medewerker (fictief)',approved:true});
  s.page='update';const html=renderUI(s);assert.match(html,/Before/);assert.match(html,/After checking/);
  assert.match(html,/still not confirmed/);assert.match(replyTo('Is the source real?',s.analysis,conversationContext(s)),/not confirmed/);
});

test('een ander antwoord begint zonder de hercontrolestatus van het eerdere voorbeeld',()=>{
  const s=createState();s.scenario=true;s.analysis=analyzeText(SCENARIO_TEXT);recheckScenarioSource(s);
  prepareChatTurn(s,'This is a different answer. Source: Other Example Source, 2035.');
  assert.equal(s.scenario,false);assert.equal(s.sourceChecked,false);assert.equal(conversationContext(s).corrected,false);
});
