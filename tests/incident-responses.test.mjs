import test from 'node:test';
import assert from 'node:assert/strict';
import {initialIncident,transitionIncident,incidentOutcome,analyzeText,SCENARIO_TEXT,replyTo} from '../dist/engine.mjs';
import {createState,conversationContext,guardedRoute,reviewIncidentResponse} from '../dist/app.mjs';
import {renderUI} from '../dist/ui.mjs';

function reported(){const s=createState();s.scenario=true;s.presentation=true;s.privacyAcknowledged=true;s.currentReported=true;s.analysis=analyzeText(SCENARIO_TEXT);s.incident=transitionIncident(s.incident,'report',{scenario:true});return s;}
function choose(s,choice){s.incident=transitionIncident(s.incident,'response',{choice});return s;}
function recover(s){
  if(!s.incident.decisionReviewed)reviewIncidentResponse(s);
  if(!s.incident.paused)s.incident=transitionIncident(s.incident,'pause');
  s.incident=transitionIncident(s.incident,'rules');
  for(const id of ['missing','unreachable','source-found'])s.incident=transitionIncident(s.incident,'test',{id});
  s.incident=transitionIncident(s.incident,'release',{reviewer:'Source quality staff member (fictional)',approved:true});return s;
}

test('response choices belong only to a reported future scenario',()=>{
  const empty=initialIncident();assert.deepEqual(transitionIncident(empty,'response',{choice:'pause'}),empty);
  const ordinary=transitionIncident(empty,'report');assert.deepEqual(transitionIncident(ordinary,'response',{choice:'warning'}),ordinary);
  const s=reported();assert.deepEqual(transitionIncident(s.incident,'response',{choice:'anything else'}),s.incident);
});
test('pause stops confirmations immediately and requires reviewing its effects before rule changes',()=>{
  const s=choose(reported(),'pause');assert.equal(s.incident.paused,true);assert.equal(s.incident.corrected,true);assert.equal(s.incident.decisionReviewed,false);
  assert.equal(transitionIncident(s.incident,'rules').ruleChanged,false);assert.equal(guardedRoute('org-rules',s),'org-consequence');
  assert.equal(reviewIncidentResponse(s),'org-rules');assert.equal(s.incident.decisionReviewed,true);assert.equal(guardedRoute('org-rules',s),'org-rules');
});
test('continuing with a warning leaves the original correction in place without inventing an immediate follow-up',()=>{
  const s=choose(reported(),'warning');assert.equal(s.incident.paused,false);assert.equal(s.incident.corrected,true);assert.equal(s.incident.followupSeen,false);
  assert.match(incidentOutcome(s.incident),/faulty rule was still active/);assert.doesNotMatch(incidentOutcome(s.incident),/another user trusted/);
  assert.equal(transitionIncident(s.incident,'pause').paused,false);assert.equal(transitionIncident(s.incident,'rules').ruleChanged,false);
});
test('the delayed event is shown only after the immediate effects have been reviewed',()=>{
  const s=choose(reported(),'warning');assert.equal(transitionIncident(s.incident,'followup').followupSeen,false);
  assert.equal(guardedRoute('org-followup',s),'org-consequence');assert.equal(reviewIncidentResponse(s),'org-followup');
  assert.equal(s.incident.followupSeen,true);assert.equal(s.incident.phase,'escalated');assert.equal(guardedRoute('org-rules',s),'org-followup');
  assert.equal(guardedRoute('org-followup',s),'org-followup');
});
test('the delayed warning branch has a visible route to pause and recover',()=>{
  const s=choose(reported(),'warning');reviewIncidentResponse(s);s.page='org-followup';const html=renderUI(s);
  assert.match(html,/The error spreads across care portals/);assert.match(html,/delaying a request for human help/);assert.match(html,/Pause and investigate/);assert.match(html,/data-action="pause-dialog"/);
  s.incident=transitionIncident(s.incident,'pause');assert.equal(s.incident.paused,true);assert.equal(guardedRoute('org-rules',s),'org-rules');
});
test('a response cannot be replaced by going back or clicking a second choice',()=>{
  const s=choose(reported(),'warning'),before=s.incident;assert.deepEqual(transitionIncident(before,'response',{choice:'pause'}),before);
  s.page='org-case';assert.doesNotMatch(renderUI(s),/data-action="choose-response"/);assert.match(renderUI(s),/View effects of your choice/);
});
test('reviewing the effects twice does not duplicate the delayed event or its history',()=>{
  const s=choose(reported(),'warning');reviewIncidentResponse(s);const before=structuredClone(s.incident);reviewIncidentResponse(s);assert.deepEqual(s.incident,before);
  assert.deepEqual(transitionIncident(s.incident,'followup'),before);
});
test('the organisation choice is compact and is absent from ordinary chat',()=>{
  const s=reported();s.page='org-case';const html=renderUI(s);assert.equal((html.match(/data-action="choose-response"/g)||[]).length,2);
  assert.match(html,/Pause source checks/);assert.match(html,/Continue with a warning/);
  const ordinary=createState();ordinary.analysis=analyzeText('Hello');ordinary.page='result';assert.doesNotMatch(renderUI(ordinary),/data-action="choose-response"/);
});
test('pause effects cover the user, system and organisation, including costs and a human fallback',()=>{
  const s=choose(reported(),'pause');s.page='org-consequence';const html=renderUI(s);
  for(const label of ['User','System','Organisation'])assert.match(html,new RegExp(`>${label}<`));
  assert.match(html,/Less automatic help/);assert.match(html,/More work for staff/);assert.match(html,/contact their GP/);assert.match(html,/not measured results/);
});
test('the user view reflects the chosen organisational response and preserves the source correction',()=>{
  const s=choose(reported(),'warning');s.page='chat';let html=renderUI(s);assert.match(html,/Checks continue with a warning/);assert.doesNotMatch(html,/class="status-dot"><\/span>Source is real/);
  assert.match(replyTo('What happens to my report?',s.analysis,conversationContext(s)),/faulty rule is still active/);
  reviewIncidentResponse(s);s.incident=transitionIncident(s.incident,'pause');html=renderUI(s);assert.match(html,/source check is temporarily paused/);assert.doesNotMatch(html,/Checks continue with a warning/);
  assert.match(replyTo('What happens to my report?',s.analysis,conversationContext(s)),/confirmations are paused/);
});
test('both paths require three different examples and an approved human review before closing',()=>{
  for(const choice of ['pause','warning']){
    const s=choose(reported(),choice);reviewIncidentResponse(s);if(!s.incident.paused)s.incident=transitionIncident(s.incident,'pause');
    s.incident=transitionIncident(s.incident,'rules');
    s.incident=transitionIncident(s.incident,'release',{reviewer:'Staff role',approved:true});assert.equal(s.incident.closed,false,choice);
    for(const id of ['missing','unreachable','source-found'])s.incident=transitionIncident(s.incident,'test',{id});
    s.incident=transitionIncident(s.incident,'release',{reviewer:'Staff role',approved:false});assert.equal(s.incident.closed,false,choice);
    s.incident=transitionIncident(s.incident,'release',{reviewer:'Staff role',approved:true});assert.equal(s.incident.closed,true,choice);
    assert.equal(s.incident.decision,choice);assert.equal(s.incident.corrected,true);
  }
});
test('reflection and the user update remember the path that was actually taken',()=>{
  for(const choice of ['pause','warning']){
    const s=recover(choose(reported(),choice));assert.equal(s.incident.closed,true);assert.equal(guardedRoute('reflection',s),'reflection');
    for(const page of ['update','reflection']){s.page=page;const html=renderUI(s);assert.match(html,/Your decision in this scenario/);
      assert.match(html,choice==='pause'?/You paused the check/:/You continued with a warning/);
      if(choice==='warning')assert.match(html,/another user trusted the same wrong label/);
      else assert.match(html,/users lost automatic help and staff had more work/);
    }
  }
});
test('the consequence text does not claim recovery steps before they have happened',()=>{
  const s=choose(reported(),'warning');reviewIncidentResponse(s);assert.match(incidentOutcome(s.incident),/now needs to pause/);assert.doesNotMatch(incidentOutcome(s.incident),/completed human review/);
  s.incident=transitionIncident(s.incident,'pause');assert.match(incidentOutcome(s.incident),/now paused while staff investigate/);
  s.incident=transitionIncident(s.incident,'rules');assert.match(incidentOutcome(s.incident),/still needs human review/);
});
test('decisions and delayed events do not store the health text or personal details',()=>{
  const inc=transitionIncident(initialIncident(),'report',{scenario:true,text:'PRIVATE HEALTH TEXT',name:'PRIVATE NAME'});
  let next=transitionIncident(inc,'response',{choice:'warning',text:'PRIVATE HEALTH TEXT'});next=transitionIncident(next,'review-response');next=transitionIncident(next,'followup');
  assert.doesNotMatch(JSON.stringify(next),/PRIVATE HEALTH TEXT|PRIVATE NAME/);assert.equal(inc.decision,'');assert.equal(inc.history.length,1);
});
test('closing a scenario prevents old decision and pause actions from reopening it',()=>{
  const s=recover(choose(reported(),'warning'));
  for(const action of ['response','review-response','followup','pause'])assert.deepEqual(transitionIncident(s.incident,action,{choice:'pause'}),s.incident,action);
  assert.equal(guardedRoute('org-consequence',s),'org-done');assert.equal(guardedRoute('org-followup',s),'org-done');
});
test('direct links cannot bypass reporting or the decision, and new scenarios start without old choices',()=>{
  const s=createState();for(const page of ['org-consequence','org-followup'])assert.equal(guardedRoute(page,s),'org');
  s.incident=reported().incident;for(const page of ['org-rules','org-tests','org-review'])assert.equal(guardedRoute(page,s),'org-case');
  const fresh=initialIncident();assert.equal(fresh.decision,'');assert.equal(fresh.followupSeen,false);assert.equal(fresh.decisionReviewed,false);
});
