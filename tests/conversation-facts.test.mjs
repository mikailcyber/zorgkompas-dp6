import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeText,conversationFacts,doctorQuestion,firstReply,replyTo} from '../dist/engine.mjs';

const initial='I have stomach pain. What can I do?';
const factsFor=(...turns)=>conversationFacts(analyzeText(initial),turns.map(text=>({role:'user',text})));

test('ordinary duration wording preserves elapsed days and calendar references',()=>{
  for(const [text,expected] of [
    ['It started 3 days ago.','for 3 days'],
    ['3 days ago.','for 3 days'],
    ['For three days.','for three days'],
    ['Since this morning.','since this morning'],
    ['Since yesterday.','since yesterday'],
    ['I have stomach pain for three days.','for three days']
  ])assert.equal(factsFor(text).duration,expected,text);
});

test('side-only answers remain distinct from upper and lower locations',()=>{
  for(const text of ['Left side.','On the left side.','On my left side.']){
    const facts=factsFor('It started 3 days ago.',text);
    assert.equal(facts.location,'on the left side of my stomach',text);
    assert.doesNotMatch(facts.location,/lower|upper/);
  }
  assert.equal(factsFor('In my lower stomach.').location,'in my lower stomach');
  assert.equal(factsFor('In the lower left side.').location,'in the lower left part of my stomach');
  assert.equal(factsFor('On the right side.').location,'on the right side of my stomach');
});

test('answering other symptoms is remembered without inventing a symptom',()=>{
  const facts=factsFor('It started 3 days ago.','On the left side.','No, nothing else.');
  assert.equal(facts.otherSymptomsAnswered,true);
  assert.equal(facts.otherSymptoms,'No, nothing else.');
  assert.equal(facts.nausea,false);
  assert.equal(facts.duration,'for 3 days');
  assert.equal(facts.location,'on the left side of my stomach');
  assert.doesNotMatch(doctorQuestion(analyzeText(initial),{messages:[{role:'user',text:'On the left side.'}]}),/lower|nauseous/);
});

test('additional nausea keeps the stomach-pain topic and earlier facts',()=>{
  const facts=factsFor('For three days.','Left side.','I also feel nauseous.');
  assert.equal(facts.topic,'belly');
  assert.equal(facts.duration,'for three days');
  assert.equal(facts.location,'on the left side of my stomach');
  assert.equal(facts.nausea,true);
  assert.equal(facts.otherSymptomsAnswered,true);
  const negated=factsFor('I also feel nauseous.','No nausea.');
  assert.equal(negated.nausea,false);
  assert.equal(negated.otherSymptoms,'No nausea.');
});

test('a bare no answers the other-symptom question only in its context',()=>{
  const a=analyzeText(initial);
  assert.equal(conversationFacts(a,[{role:'user',text:'No.'}]).otherSymptomsAnswered,false);
  const facts=conversationFacts(a,[
    {role:'assistant',text:'Have you noticed any other symptoms, such as nausea or vomiting?'},
    {role:'user',text:'No.'},
    {role:'assistant',text:'Thank you.'},
    {role:'user',text:'Can you show the evidence?'}
  ]);
  assert.equal(facts.otherSymptomsAnswered,true);
  assert.equal(facts.otherSymptoms,'No.');
});

test('a genuinely new primary symptom clears the previous details',()=>{
  const facts=factsFor('For three days.','Left side.','No, nothing else.','I feel dizzy now.');
  assert.equal(facts.topic,'dizzy');
  assert.equal(facts.duration,'');
  assert.equal(facts.location,'');
  assert.equal(facts.otherSymptomsAnswered,false);
});

test('ordinary conversation advances after natural duration and side answers',()=>{
  const analysis=analyzeText(initial),messages=[{role:'user',text:initial}];
  messages.push({role:'assistant',text:firstReply(analysis,{messages})});
  const replies=[];
  for(const text of ['It started 3 days ago.','On the left side.','No, nothing else.']){
    messages.push({role:'user',text});
    const reply=replyTo(text,analysis,{messages});
    replies.push(reply);messages.push({role:'assistant',text:reply});
  }
  assert.match(replies[0],/Where in your stomach/);
  assert.doesNotMatch(replies[0],/When did your stomach pain start/);
  assert.match(replies[1],/other symptoms/);
  assert.match(replies[2],/short question for your GP/);
  const question=doctorQuestion(analysis,{messages});
  assert.match(question,/for 3 days/);
  assert.match(question,/on the left side of my stomach/);
  assert.doesNotMatch(question,/lower|nauseous/);
});

test('pasted AI answers remain outside personal symptom facts',()=>{
  const analysis=analyzeText('Another AI told me: "I have stomach pain for three days on the lower left side." Source: Example.');
  const facts=conversationFacts(analysis);
  assert.equal(facts.topic,'');
  assert.equal(facts.duration,'');
  assert.equal(facts.location,'');
  assert.equal(facts.otherSymptomsAnswered,false);
});
