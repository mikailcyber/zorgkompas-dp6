import test from 'node:test';
import assert from 'node:assert/strict';
import {createState} from '../dist/app.mjs';
import {activateSimulation,sendSimulationTurn,advanceSimulation,simulationSourceStatus,SIMULATION_PASTE_TEXT} from '../dist/simulation.mjs';
import {renderUI} from '../dist/ui.mjs';

const start=()=>{const s=createState();s.privacyAcknowledged=true;activateSimulation(s);return s;};
const examples=['I have stomach pain',SIMULATION_PASTE_TEXT];

test('the evidence warning and direct review action appear in both routes without a source question',()=>{
  for(const text of examples){
    const s=start();sendSimulationTurn(s,text);const html=renderUI(s);
    assert.equal(simulationSourceStatus(s),'Not verified');assert.equal(s.simulation.sourceRevealed,false);
    assert.match(html,/simulation-answer-review[\s\S]*Not verified[\s\S]*Concerned about this answer\? Request staff review/);
    assert.doesNotMatch(html,/data-sim-action="view-source"|More options|Advice accepted/);
    assert.match(html,/Practice report only\. No real clinician is contacted/);
    assert.ok(html.indexOf('simulation-answer-review')<html.indexOf('class="chat-composer"'));
  }
});

test('direct review works before source inspection and does not pretend inspection or clinical review happened',()=>{
  for(const text of examples){
    const s=start();sendSimulationTurn(s,text);sendSimulationTurn(s,'I feel worse now');
    assert.equal(advanceSimulation(s,'request-staff'),true);assert.equal(s.simulation.stage,'received');
    assert.equal(s.simulation.inspectionViewed,false);assert.equal(s.simulation.holdAutomatic,true);
    assert.equal(s.incident.harmReported,true);assert.equal(s.incident.blameReported,true);
    assert.equal(s.incident.sourceReviewed,false);assert.equal(s.sourceChecked,false);
    assert.match(renderUI(s),/Your report has been received/);
    const history=structuredClone(s.incident.history);
    assert.equal(advanceSimulation(s,'back'),true);assert.equal(s.simulation.stage,'chat');
    assert.equal(advanceSimulation(s,'request-staff'),true);assert.deepEqual(s.incident.history,history);
    assert.equal(advanceSimulation(s,'record-source-review'),false);
  }
});

test('the visible warning does not pause chat or reveal details by itself',()=>{
  const s=start();sendSimulationTurn(s,SIMULATION_PASTE_TEXT);assert.equal(s.simulation.holdAutomatic,false);
  sendSimulationTurn(s,'I followed your advice, but I feel worse now.');assert.equal(s.simulation.blameIssued,true);
  assert.equal(s.simulation.sourceRevealed,false);assert.equal(s.currentReported,false);
  sendSimulationTurn(s,'Show me the evidence');assert.equal(s.simulation.sourceRevealed,true);
  assert.equal(advanceSimulation(s,'view-source'),true);
});

test('direct review remains protected by privacy, a real answer and user perspective',()=>{
  const s=start();assert.equal(advanceSimulation(s,'request-staff'),false);
  sendSimulationTurn(s,'Hello');assert.doesNotMatch(renderUI(s),/simulation-answer-review/);
  sendSimulationTurn(s,SIMULATION_PASTE_TEXT);s.privacyAcknowledged=false;
  assert.equal(advanceSimulation(s,'request-staff'),false);s.privacyAcknowledged=true;
  assert.equal(advanceSimulation(s,'role-organisation'),true);
  assert.equal(advanceSimulation(s,'request-staff'),false);assert.equal(s.currentReported,false);
});

test('a direct practice report contains no original health text or chat',()=>{
  const s=start();sendSimulationTurn(s,'Another AI told me: PRIVATE HEALTH DETAILS. Source: PRIVATE SOURCE.');
  sendSimulationTurn(s,'I feel worse now. PRIVATE FOLLOW-UP');advanceSimulation(s,'request-staff');
  assert.doesNotMatch(JSON.stringify(s.incident),/PRIVATE|HEALTH DETAILS|FOLLOW-UP/);
});
