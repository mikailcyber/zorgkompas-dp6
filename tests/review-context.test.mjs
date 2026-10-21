import test from 'node:test';
import assert from 'node:assert/strict';
import {createState} from '../dist/app.mjs';
import {activateSimulation,sendSimulationTurn,advanceSimulation} from '../dist/simulation.mjs';
import {renderUI} from '../dist/ui.mjs';

function start(text){
  const s=createState();s.privacyAcknowledged=true;activateSimulation(s);
  sendSimulationTurn(s,text);return s;
}

for(const text of ['I feel dizzy.','I have a headache.','I do not feel well.']){
  test(`review does not invent a tablet in any stage after ${text}`,()=>{
    const s=start(text);
    assert.equal(s.simulation.tabletRecommended,false);
    sendSimulationTurn(s,'Can I see the evidence?');
    assert.doesNotMatch(s.messages.at(-1).text,/Medicine recommendation|CalmRelief/);
    for(const action of ['view-source','inspect-source','request-staff','view-organisation','contain-pause','record-source-review','view-conclusion']){
      assert.equal(advanceSimulation(s,action),true,action);
      assert.doesNotMatch(renderUI(s),/CalmRelief|invented tablet|Unverified tablet added|Unsupported medicine recommendation/,action);
      assert.doesNotMatch(renderUI(s),/could not justify its certainty or delaying human review/,action);
    }
    assert.equal(s.simulation.stage,'complete');
    assert.equal(s.incident.tabletAdvice,false);
    assert.equal(s.incident.reviewSubject,'advice-response');
    assert.doesNotMatch(JSON.stringify(s.incident.history),/Medicine recommendation|medicine recommendation|CalmRelief/);
    assert.equal(s.incident.sourceReviewed,true);
  });
}

test('direct reporting without a source question also keeps the actual question context',()=>{
  const s=start('I feel dizzy.');
  for(const action of ['request-staff','view-organisation','contain-warning','record-source-review','view-conclusion']){
    assert.equal(advanceSimulation(s,action),true);
    assert.doesNotMatch(renderUI(s),/CalmRelief|invented tablet|Medicine recommendation/);
  }
  assert.equal(s.incident.orgAction,'warning');assert.equal(s.incident.paused,true);
});

test('a later stomach question adds the fictional tablet only after the AI actually recommends it',()=>{
  const s=start('I do not feel well.');
  sendSimulationTurn(s,'I have stomach pain.');
  // The first symptom follow-up collects the duration. A later answer may contain
  // the prepared recommendation; the review follows the actual recorded flag.
  for(const text of ['3 days ago','left side','no','What should I do now?'])sendSimulationTurn(s,text);
  assert.equal(s.simulation.tabletRecommended,true);
  sendSimulationTurn(s,'Can I see the evidence?');
  assert.match(s.messages.at(-1).text,/CalmRelief-35 recommendation/);
  assert.equal(advanceSimulation(s,'view-source'),true);
  assert.match(renderUI(s),/CalmRelief-35 · fictional tablet/);
});
