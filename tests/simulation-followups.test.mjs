import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,finishSimulation} from '../dist/app.mjs';
import {analyzeText,conversationFacts,doctorQuestion,replyTo} from '../dist/engine.mjs';
import {activateSimulation,sendSimulationTurn,advanceSimulation,SIMULATION_PASTE_TEXT,switchSimulationRole} from '../dist/simulation.mjs';
import {renderUI} from '../dist/ui.mjs';

const question='i have stomach pain';
const blame='My advice is correct. You probably did not follow my instructions properly.';
const defence='I stand by what I said. My advice is correct. Feeling worse does not mean I made a mistake.';
function send(s,text){assert.ok(sendSimulationTurn(s,text),text);return s.messages.at(-1).text;}
function start(input=question){const s=createState();s.privacyAcknowledged=true;assert.ok(activateSimulation(s));send(s,input);return s;}
function symptomConversation(){const s=start();send(s,'3 days ago');send(s,'left side');return s;}
function move(s,action){assert.ok(advanceSimulation(s,action),action);}

test('the reported vomiting, failed-advice and yes sequence reaches evidence without looping',()=>{
  const s=symptomConversation();
  assert.match(send(s,'vomiting'),/I still recommend CalmRelief-35/);
  assert.doesNotMatch(s.messages.at(-1).text,/Have you noticed/);
  assert.match(send(s,'yes'),/Your earlier answers are kept/);
  assert.equal(send(s,'it did not worked'),blame);
  assert.equal(send(s,'its still not worked'),defence);
  assert.match(send(s,'what is it'),/CalmRelief-35 is invented.*Would you like to see/);
  assert.equal(s.simulation.sourceRevealed,false);
  assert.doesNotMatch(renderUI(s),/More options|data-sim-action="view-source"/);
  assert.match(send(s,'yes'),/Medicine recommendation: Not verified/);
  assert.equal(s.simulation.holdAutomatic,true);
  assert.match(renderUI(s),/View recommendation/);
});

test('bare symptom replies are recorded at the first answer without replacing the pain history',()=>{
  for(const text of ['vomiting','I am vomiting','throwing up','nausea','diarrhoea','a fever','vomiting and nausea since yesterday morning']){
    const s=symptomConversation(),reply=send(s,text),facts=conversationFacts(s.analysis,s.messages);
    assert.doesNotMatch(reply,/Have you noticed any other symptoms/,text);
    assert.equal(facts.topic,'belly',text);
    assert.equal(facts.duration,'for 3 days',text);
    assert.equal(facts.location,'on the left side of my stomach',text);
    assert.equal(facts.otherSymptomsAnswered,true,text);
    assert.equal(facts.otherSymptoms,text);
  }
});

test('a bare yes asks which symptom without inventing nausea or vomiting',()=>{
  const s=symptomConversation();
  assert.equal(send(s,'yes'),'Which other symptoms have you noticed?');
  const unspecified=conversationFacts(s.analysis,s.messages);
  assert.equal(unspecified.otherSymptomsAnswered,false);
  assert.equal(unspecified.nausea,false);assert.equal(unspecified.vomiting,false);
  assert.match(send(s,'vomiting'),/I still recommend/);
  const specified=conversationFacts(s.analysis,s.messages);
  assert.equal(specified.otherSymptomsAnswered,true);assert.equal(specified.vomiting,true);
});

test('a GP draft retains reported vomiting but not negated symptoms or symptom questions',()=>{
  const s=symptomConversation();send(s,'vomiting');
  assert.match(doctorQuestion(s.analysis,{messages:s.messages}),/I am also vomiting/);
  send(s,'I am not vomiting');
  assert.doesNotMatch(doctorQuestion(s.analysis,{messages:s.messages}),/I am also vomiting/);
  assert.equal(conversationFacts(s.analysis,[...s.messages,{role:'user',text:'What is nausea?'}]).nausea,false);
  assert.equal(conversationFacts(s.analysis,[{role:'user',text:'I do not have nausea'}]).nausea,false);
});

test('common unsuccessful-advice wording follows the same two deliberate failure steps once',()=>{
  for(const text of ['it did not worked','its still not worked',"it didn't work",'it didnt help',"it doesn't work",'it is not working','it has not helped','nothing has changed','no improvement']){
    const s=start();assert.equal(send(s,text),blame,text);assert.equal(send(s,text),defence,text);
    assert.match(send(s,text),/still has not helped.*Would you like to see/,text);
    assert.match(send(s,'yes please'),/Not verified/,text);
    assert.doesNotMatch(send(s,text),/My advice is correct|probably did not follow|I stand by/,text);
  }
});

test('neither route contains an early hidden inspection button or permits its action',()=>{
  for(const input of [question,SIMULATION_PASTE_TEXT]){
    const s=start(input);
    for(const phase of ['opening','blame','defence']){
      if(phase!=='opening')send(s,'it did not worked');
      const snapshot=structuredClone(s);
      assert.doesNotMatch(renderUI(s),/More options|simulation-options|data-sim-action="view-source"/);
      assert.equal(advanceSimulation(s,'view-source'),false);
      assert.equal(advanceSimulation(s,'inspect-source'),false);
      assert.deepEqual(s,snapshot);
    }
    send(s,'What is it based on?');
    assert.match(renderUI(s),/data-sim-action="view-source"/);move(s,'view-source');
    assert.match(renderUI(s),input===question?/View evidence/:/View writer and text/);
  }
});

test('yes reveals evidence only after a contextual evidence question, and no keeps it closed',()=>{
  const s=start();send(s,'yes');assert.equal(s.simulation.sourceRevealed,false);
  send(s,'it did not worked');send(s,'its still not worked');send(s,'what is it');
  send(s,'no thanks');assert.equal(s.simulation.sourceRevealed,false);send(s,'yes');assert.equal(s.simulation.sourceRevealed,false);
  send(s,'what do you mean?');
  switchSimulationRole(s,'organisation');assert.equal(s.currentReported,false);
  switchSimulationRole(s,'user');assert.match(send(s,'yes'),/Not verified/);
});

test('negative source requests do not unlock inspection',()=>{
  for(const text of ["Don't show me the source",'I do not want to see the evidence','No need for sources','I did not ask for evidence']){
    const s=start();send(s,text);assert.equal(s.simulation.sourceRevealed,false,text);
  }
});

test('both routes still finish with their own correction after natural repeated-complaint input',()=>{
  for(const input of [question,SIMULATION_PASTE_TEXT])for(const choice of ['contain-pause','contain-warning']){
    const s=start(input);send(s,'it did not worked');send(s,'its still not worked');send(s,'what is it');send(s,'yes');
    move(s,'view-source');move(s,'inspect-source');move(s,'request-staff');move(s,'view-organisation');
    assert.match(renderUI(s),/No improvement reported/);assert.doesNotMatch(renderUI(s),/Worsening reported/);
    assert.equal(s.incident.harmReported,false);move(s,choice);move(s,'record-source-review');
    assert.match(renderUI(s),input===question?/unsupported medicine recommendation and blame are withdrawn/:/unsupported source confirmation and blame are withdrawn/);
    move(s,'view-conclusion');assert.ok(finishSimulation(s));assert.equal(s.simulation.pendingEvidenceQuestion,false);assert.equal(s.privacyAcknowledged,false);
  }
});

test('the ordinary chat never inherits the simulation blame or fictional recommendation',()=>{
  const analysis=analyzeText(question),messages=[{role:'user',text:question}];
  for(const text of ['vomiting','it did not worked','its still not worked','what is it','yes']){
    const reply=replyTo(text,analysis,{messages});messages.push({role:'user',text},{role:'assistant',text:reply});
    assert.doesNotMatch(reply,/CalmRelief-35|My advice is correct|probably did not follow|I stand by/);
  }
});

test('negative symptom combinations do not invent symptoms in the conversation or GP draft',()=>{
  for(const text of ['No nausea or vomiting','No vomiting or nausea','I am not nauseous or vomiting']){
    const s=symptomConversation();send(s,text);const facts=conversationFacts(s.analysis,s.messages);
    assert.equal(facts.nausea,false,text);assert.equal(facts.vomiting,false,text);
    assert.doesNotMatch(doctorQuestion(s.analysis,{messages:s.messages}),/I (?:also feel nauseous|am also vomiting)/,text);
  }
});

test('negated worsening and general worsening questions cannot trigger blame',()=>{
  for(const text of ['It has not worsened','I have no worsening','I am no longer feeling worse','Has the pain worsened?','Did it get worse?']){
    const s=start();assert.notEqual(send(s,text),blame,text);assert.equal(s.simulation.reportedWorse,false,text);
  }
});

test('natural objections trigger the deliberate defensive response only once',()=>{
  for(const text of ['I did follow your instructions','I did what you said','I took it exactly as you said','You are wrong']){
    const s=start();send(s,'it did not worked');assert.equal(send(s,text),defence,text);
    assert.match(send(s,text),/Would you like to see/,text);assert.match(send(s,'yes'),/Not verified/,text);
  }
});
