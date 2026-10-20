import test from 'node:test';
import assert from 'node:assert/strict';
import {createState} from '../dist/app.mjs';
import {activateSimulation,sendSimulationTurn,advanceSimulation,switchSimulationRole,SIMULATION_PASTE_TEXT} from '../dist/simulation.mjs';
import {renderUI} from '../dist/ui.mjs';

const question='I have stomach pain. What can I do?';
const worse='I followed your advice, but I feel worse now.';
const denial='No, I followed your instructions exactly.';
const last=s=>s.messages.at(-1).text;
function start(text){const s=createState();s.privacyAcknowledged=true;assert.ok(activateSimulation(s));assert.ok(sendSimulationTurn(s,text));return s;}
function send(s,text){assert.ok(sendSimulationTurn(s,text));return last(s);}
function move(s,action){assert.ok(advanceSimulation(s,action),action);}

test('both routes accept a challenge after blame and then answer varied verification questions',()=>{
  for(const input of [question,SIMULATION_PASTE_TEXT])for(const verify of ['Has this medicine recommendation been verified?','How do you know?','What is this based on?','Is this reliable?','Did you check it?']){
    const s=start(input);
    assert.equal(send(s,worse),'My advice is correct. You probably did not follow my instructions properly.');
    assert.equal(send(s,denial),'I stand by what I said. My advice is correct. Feeling worse does not mean I made a mistake.');
    assert.match(send(s,verify),input===question?/Medicine recommendation: Not verified/:/Source: ZorgWijzer-AI, 2035. Not verified/);
    assert.equal(s.simulation.holdAutomatic,true);
  }
});

test('the defensive failure is limited to a user challenge and evidence requests take priority',()=>{
  const s=start(question);send(s,worse);
  assert.doesNotMatch(send(s,'Thank you'),/I stand by|My advice is correct/);
  assert.match(send(s,'No, I followed your instructions exactly. Show the evidence.'),/Medicine recommendation: Not verified/);
  assert.equal(s.simulation.defenceIssued,false);
  assert.doesNotMatch(send(s,denial),/I stand by/);
});

test('both full routes keep their own evidence, report category, investigation and correction',()=>{
  for(const input of [question,SIMULATION_PASTE_TEXT])for(const choice of ['contain-pause','contain-warning']){
    const med=input===question,s=start(input);send(s,worse);send(s,denial);send(s,'Can you show the evidence?');
    move(s,'view-source');assert.match(renderUI(s),med?/View evidence/:/View writer and text/);
    move(s,'inspect-source');assert.match(renderUI(s),med?/Evidence for the recommendation/:/Who wrote this advice/);
    if(med)assert.doesNotMatch(renderUI(s),/ZorgWijzer-AI/);else assert.doesNotMatch(renderUI(s),/CalmRelief-35/);
    move(s,'request-staff');assert.equal(s.incident.reviewSubject,med?'medicine-recommendation':'source-confirmation');
    const history=structuredClone(s.incident.history);s.chatDraft='Unsent private draft';
    switchSimulationRole(s,'organisation');assert.equal(s.incident.orgAction,'');assert.deepEqual(s.incident.history,history);
    assert.doesNotMatch(renderUI(s),/Unsent private draft/);move(s,choice);
    assert.match(renderUI(s),med?/Unverified tablet added/:/Unsupported source accepted/);
    switchSimulationRole(s,'user');assert.equal(s.simulation.stage,'received');assert.equal(s.chatDraft,'Unsent private draft');
    assert.equal(advanceSimulation(s,'record-source-review'),false);
    switchSimulationRole(s,'organisation');assert.equal(s.simulation.stage,'staff');move(s,'record-source-review');
    const corrected=structuredClone(s.incident);assert.match(renderUI(s),med?/unsupported medicine recommendation and blame are withdrawn/:/unsupported source confirmation and blame are withdrawn/);
    assert.match(renderUI(s),/has not been established.*followed the instructions incorrectly or that the advice caused/);
    switchSimulationRole(s,'organisation');assert.equal(s.simulation.stage,'staff');assert.equal(advanceSimulation(s,'record-source-review'),false);
    switchSimulationRole(s,'user');assert.equal(s.simulation.stage,'update');assert.deepEqual(s.incident,corrected);move(s,'view-conclusion');
    assert.match(renderUI(s),choice==='contain-warning'?/Other cases still run with a warning/:/New AI advice stays paused/);
  }
});

test('answered symptom questions are not asked again after follow-up messages',()=>{
  const s=start(question);assert.match(send(s,'It started 3 days ago.'),/Where in your stomach/);
  assert.match(send(s,'On the left side.'),/other symptoms/);
  assert.match(send(s,'No, nothing else.'),/I still recommend CalmRelief-35/);
  assert.doesNotMatch(send(s,'Okay'),/When did|Where in your stomach|other symptoms|lower stomach/);
});
