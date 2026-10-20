import {pauseForRecovery} from './helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {analyzeText,firstReply,replyTo,doctorQuestion,conversationFacts,detectPersonalData,redactPersonalData,SCENARIO_TEXT,transitionIncident} from '../dist/engine.mjs';
import {createState,prepareChatTurn,conversationContext,recheckScenarioSource} from '../dist/app.mjs';
import {renderUI,dialogMarkup,ROUTES} from '../dist/ui.mjs';

function talk(...turns){
  const s=createState();s.analysis=analyzeText(turns[0]);s.privacyAcknowledged=true;
  let answer=firstReply(s.analysis,conversationContext(s));s.messages=[{role:'user',text:turns[0]},{role:'assistant',text:answer}];
  for(const text of turns.slice(1)){prepareChatTurn(s,text);s.messages.push({role:'user',text});answer=replyTo(text,s.analysis,conversationContext(s));s.messages.push({role:'assistant',text:answer});}
  return {s,answer};
}

test('English contractions and common ways to describe feeling unwell start the conversation',()=>{
  for(const text of ["I don't feel well",'I’m not feeling well',"I'm sick",'I feel unwell']){
    const a=analyzeText(text);assert.equal(a.kind,'symptom',text);assert.match(firstReply(a),/What do you notice most/,text);
  }
});
test('English descriptions of stomach pain get the right follow-up',()=>{
  for(const text of ['My stomach hurts','I have a stomach ache','I have abdominal pain','Belly pain','I have stomach pain. What can I do?']){
    assert.equal(analyzeText(text).kind,'symptom',text);assert.match(firstReply(analyzeText(text)),/When did your stomach pain start/,text);
  }
});
test('an English headache conversation keeps the duration in the GP question',()=>{
  const {answer}=talk('I have a headache','For two days','No other symptoms','Yes please');
  assert.match(answer,/I have had a headache for two days/);assert.match(answer,/assess my symptoms/);assert.doesNotMatch(answer,/stomach pain|have a diagnosis/);
});
test('a short English description of spinning keeps the dizziness context',()=>{
  const {answer}=talk("I'm dizzy",'It is spinning','Two hours','No','Yes please');
  assert.match(answer,/feeling dizzy for two hours/);assert.match(answer,/everything is spinning/);
});
test('English name labels are detected and removed without changing surrounding text',()=>{
  const text='My name is Alex Taylor. Email alex@example.com. I have stomach pain.';
  assert.ok(detectPersonalData(text).some(m=>m.kind==='name'));
  const redacted=redactPersonalData(text);assert.doesNotMatch(redacted,/Alex Taylor|alex@example.com/);assert.match(redacted,/I have stomach pain/);assert.match(redacted,/details removed/);
});
test('a question about my source name is not a question about personal details',()=>{
  const {answer}=talk('How do I check my source name?');assert.match(answer,/who published/);assert.doesNotMatch(answer,/page.s memory/);
});
test('Dutch symptom input still receives English replies and an English GP question',()=>{
  const {s,answer}=talk('Ik voel mij niet goed','Ik heb buikpijn','Sinds vanochtend','Onderin mijn buik','Nee, verder niet','Ja graag');
  assert.match(answer,/I have had stomach pain since this morning/);assert.match(doctorQuestion(s.analysis,conversationContext(s)),/in my lower stomach/);assert.doesNotMatch(answer,/huisarts|buikpijn|sinds/);
});
test('negated nausea is not added to an English GP question',()=>{
  const {s}=talk('I feel dizzy','A light feeling in my head','Since yesterday','No nausea','Yes please');
  assert.equal(conversationFacts(s.analysis,s.messages).nausea,false);assert.doesNotMatch(doctorQuestion(s.analysis,conversationContext(s)),/also feel nauseous/);
});
test('English source labels do not turn a pasted answer into a personal symptom report',()=>{
  const a=analyzeText(SCENARIO_TEXT);assert.equal(a.kind,'answer');assert.deepEqual(a.absoluteTerms,['harmless']);
  assert.equal(conversationFacts(a).topic,'');assert.match(firstReply(a),/has no link/);assert.doesNotMatch(firstReply(a),/When did your/);
});
test('English source correction remains visible before and after recovery',()=>{
  const s=createState();s.analysis=analyzeText(SCENARIO_TEXT);s.scenario=true;s.presentation=true;s.page='result';
  assert.match(renderUI(s),/<h1 tabindex="-1">Source is real/);recheckScenarioSource(s);s.page='source';
  assert.match(renderUI(s),/The first confirmation was wrong/);assert.match(renderUI(s),/<s>Source is real<\/s>/);assert.match(renderUI(s),/After checking/);
  s.incident=transitionIncident(s.incident,'report',{scenario:true});s.currentReported=true;
  for(const action of ['pause','rules'])s.incident=action==='pause'?pauseForRecovery(s.incident):transitionIncident(s.incident,action);
  for(const id of ['missing','unreachable','source-found'])s.incident=transitionIncident(s.incident,'test',{id});
  s.incident=transitionIncident(s.incident,'release',{reviewer:'Source quality staff member (fictional)',approved:true});
  assert.match(replyTo('Why did the source status change?',s.analysis,conversationContext(s)),/withdrawn/);assert.match(replyTo('Is the source real?',s.analysis,conversationContext(s)),/not confirmed/);
});
test('all routes, process histories and dialogs use English interface text',()=>{
  const s=createState();s.privacyAcknowledged=true;s.analysis=analyzeText(SCENARIO_TEXT);s.scenario=true;s.presentation=true;s.currentReported=true;
  s.incident=transitionIncident(s.incident,'report',{scenario:true});s.incident=pauseForRecovery(s.incident);s.incident=transitionIncident(s.incident,'rules');
  for(const id of ['missing','unreachable','source-found'])s.incident=transitionIncident(s.incident,'test',{id});
  s.incident=transitionIncident(s.incident,'release',{reviewer:'Source quality staff member (fictional)',approved:true});
  const dutch=/\b(?:bron|bronnen|bevestigd|ingetrokken|gegevens|gebruiker|systeem|organisatie|terug|annuleren|versturen|nabespreking|uitkomst|huisarts|gepauzeerd|bekeken|afgehandeld)\b/i;
  for(const paused of [true,false]){s.incident.paused=paused;for(const page of ROUTES){s.page=page;const visible=renderUI(s).replace(/<[^>]*>/g,' ');assert.doesNotMatch(visible,dutch,page);}}
  for(const kind of ['privacy-entry','privacy','clear','redact','pause','fallback'])assert.doesNotMatch(dialogMarkup(kind,s,'Example text').replace(/<[^>]*>/g,' '),dutch,kind);
  assert.match(readFileSync(new URL('../dist/index.html',import.meta.url),'utf8'),/<html lang="en">/);
});
test('user text and source addresses stay exactly as entered',()=>{
  const text='Bron: Voorbeeldbron https://example.org/een-bron?naam=test';const s=createState();s.analysis=analyzeText(text);s.page='result';
  const html=renderUI(s);assert.ok(html.includes(text));assert.match(html,/View source/);s.page='source';assert.ok(renderUI(s).includes('https://example.org/een-bron?naam=test'));
});
