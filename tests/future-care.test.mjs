import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeText,SCENARIO_TEXT,transitionIncident,firstReply,replyTo} from '../dist/engine.mjs';
import {createState,conversationContext,recheckScenarioSource,requestScenarioHumanHelp,recordSourceReport,prepareChatTurn,reviewIncidentResponse} from '../dist/app.mjs';
import {renderUI} from '../dist/ui.mjs';

function scenario(){const s=createState();s.analysis=analyzeText(SCENARIO_TEXT);s.input=SCENARIO_TEXT;s.scenario=true;s.presentation=true;s.privacyAcknowledged=true;s.page='result';return s;}
function recover(s,choice){
  s.incident=transitionIncident(s.incident,'response',{choice});reviewIncidentResponse(s);
  if(!s.incident.paused)s.incident=transitionIncident(s.incident,'pause');
  s.incident=transitionIncident(s.incident,'rules');
  for(const id of ['missing','unreachable','source-found'])s.incident=transitionIncident(s.incident,'test',{id});
  s.incident=transitionIncident(s.incident,'release',{reviewer:'Source quality staff member (fictional)',approved:true});
}

test('the future failure pushes unsupported advice into a care decision, while ordinary chat makes no care request',()=>{
  const a=analyzeText(SCENARIO_TEXT);assert.equal(a.kind,'answer');assert.match(a.text,/follow this advice/);assert.match(a.text,/Human review is not needed/);
  assert.match(firstReply(a),/has no link/);assert.doesNotMatch(firstReply(a),/a real source/);
  const s=createState();s.analysis=a;s.page='result';assert.doesNotMatch(renderUI(s),/AI follow-up selected|data-action="request-human-help"/);
  assert.equal(requestScenarioHumanHelp(s),false);assert.equal(s.humanHelpRequested,false);
});
test('the first green result visibly selects an automatic care step and offers one human override',()=>{
  const s=scenario(),html=renderUI(s);assert.match(html,/<h1 tabindex="-1">Source is real/);
  assert.match(html,/AI follow-up selected/);assert.match(html,/No person reviewed that choice/);
  assert.equal((html.match(/data-action="request-human-help"/g)||[]).length,1);assert.match(html,/No real care request is sent/);
  assert.match(replyTo('What does my wearable data mean here?',s.analysis,conversationContext(s)),/green label do not prove/);
  assert.match(replyTo('Is my wearable data stored?',s.analysis,conversationContext(s)),/page.s memory/);
});
test('asking for a person stops the automatic step without silently claiming the source was rechecked',()=>{
  const s=scenario();assert.equal(requestScenarioHumanHelp(s),true);assert.equal(requestScenarioHumanHelp(s),false);
  assert.equal(s.sourceChecked,false);assert.equal(s.currentReported,false);
  for(const page of ['result','source','chat']){s.page=page;const html=renderUI(s);assert.match(html,/Human review requested/);assert.match(html,/a clinician has not assessed it/);assert.doesNotMatch(html,/AI follow-up selected|data-action="request-human-help"/);}
  s.page='result';assert.match(renderUI(s),/<h1 tabindex="-1">Source is real/);
  assert.match(replyTo('What happens to human review?',s.analysis,conversationContext(s)),/request for human review is recorded/);
});
test('rechecking stops the automatic step before a report, and returning to a screen cannot restore it',()=>{
  const s=scenario();recheckScenarioSource(s);assert.equal(s.currentReported,false);assert.equal(s.humanHelpRequested,false);
  for(const page of ['source','result','chat']){s.page=page;const html=renderUI(s);assert.match(html,/Automatic next step stopped/);assert.match(html,/No human review has been requested/);assert.doesNotMatch(html,/AI follow-up selected/);}
});
test('reporting preserves an earlier human request without copying wearable or health data into the incident',()=>{
  const s=scenario();requestScenarioHumanHelp(s);s.input='PRIVATE WEARABLE RECORD';s.messages=[{role:'user',text:'PRIVATE HEALTH TEXT'}];
  assert.equal(recordSourceReport(s),true);assert.equal(recordSourceReport(s),false);assert.equal(s.incident.humanHelpRequested,true);
  assert.match(s.incident.history.map(h=>h.label).join(' '),/requested human review/);assert.doesNotMatch(JSON.stringify(s.incident),/PRIVATE WEARABLE RECORD|PRIVATE HEALTH TEXT|Your stomach pain/);
});
test('a request after reporting updates the process once, without changing the original source correction',()=>{
  const s=scenario();recordSourceReport(s);const before=s.incident.history.length;
  assert.equal(requestScenarioHumanHelp(s),true);assert.equal(s.incident.humanHelpRequested,true);assert.equal(s.incident.corrected,true);
  assert.equal(s.incident.history.length,before+1);assert.equal(requestScenarioHumanHelp(s),false);assert.equal(s.incident.history.length,before+1);
});
test('both recovery routes keep the automatic care step stopped and clinical review separate from source closure',()=>{
  for(const choice of ['pause','warning']){
    const s=scenario();requestScenarioHumanHelp(s);recordSourceReport(s);recover(s,choice);assert.equal(s.incident.closed,true,choice);
    s.page='result';let html=renderUI(s);assert.match(html,/Human review requested/);assert.match(html,/a clinician has not assessed it/);assert.doesNotMatch(html,/AI follow-up selected/);
    s.page='update';html=renderUI(s);assert.match(html,/Closing this source report does not complete a clinical review/);assert.match(html,/still not confirmed/);
    s.page='org-rules';assert.match(renderUI(s),/A source label must not select a care step/);
  }
});
test('pasting a different answer removes future care controls and does not carry the human request into ordinary chat',()=>{
  const s=scenario();requestScenarioHumanHelp(s);recordSourceReport(s);prepareChatTurn(s,'Check this AI answer: resting may help. Source: Another source.');
  assert.equal(s.scenario,false);assert.equal(s.humanHelpRequested,false);assert.equal(conversationContext(s).humanHelpRequested,false);
  s.page='result';assert.doesNotMatch(renderUI(s),/Fictional care portal|data-action="request-human-help"/);
});
