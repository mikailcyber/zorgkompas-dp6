import test from 'node:test';
import assert from 'node:assert/strict';
import {SIMULATION_PASTE_TEXT} from '../dist/simulation.mjs';

// Exercise the actual event handlers with small DOM stubs; this is not a visual browser test.
async function withApp(run){
  const names=['document','window','location','history','FormData'];
  const originals=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  const handlers=new Map(),windowHandlers=new Map();
  const app={innerHTML:''},toast={textContent:'',hidden:true},input={value:'',focus(){}};
  const modal={open:false,innerHTML:'',classList:{toggle(){}},showModal(){this.open=true;},close(){this.open=false;},replaceChildren(){this.innerHTML='';},addEventListener(){}};
  const focus={focus(){}};
  const document={getElementById(id){return {app,modal,toast,'simulation-input':input}[id]||null;},querySelector(){return focus;},addEventListener(name,fn){handlers.set(name,fn);}};
  const location={hash:'#scenario'};
  const window={scrollTo(){},addEventListener(name,fn){windowHandlers.set(name,fn);}};
  const history={pushState(_state,_title,hash){location.hash=hash;},replaceState(_state,_title,hash){location.hash=hash;}};
  class FormDataStub{constructor(form){this.data=form.data;}get(key){return this.data[key]??null;}getAll(key){return this.data[key]||[];}}
  for(const [name,value] of Object.entries({document,window,location,history,FormData:FormDataStub}))Object.defineProperty(globalThis,name,{configurable:true,writable:true,value});
  try{
    await import(`../dist/app.mjs?events=${Math.random()}`);
    const click=async(action,simAction)=>handlers.get('click')({target:{closest(){return {disabled:false,dataset:{action,simAction}};}}});

    await run({app,modal,location,click,windowHandlers,input,handlers});
  }finally{for(const name of names){const descriptor=originals.get(name);if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}}
}

test('both real input paths show blame, disclose the source on a typed request and finish after staff review',async()=>{
  for(const initial of ['I have stomach pain. What can I do?',SIMULATION_PASTE_TEXT]){
    await withApp(async({app,modal,location,click,input,handlers})=>{
      const visible=()=>app.innerHTML.replace(/<details\b[\s\S]*?<\/details>/g,'');
      const enter=text=>{input.value=text;handlers.get('keydown')({target:{id:'simulation-input',value:text},key:'Enter',shiftKey:false,isComposing:false,preventDefault(){}});};
      assert.match(app.innerHTML,/Start simulation/);await click('start-scenario');assert.equal(modal.open,true);assert.match(modal.innerHTML,/Keep your details private/);
      await click('accept-privacy');assert.equal(modal.open,false);assert.equal(location.hash,'#simulation');assert.match(app.innerHTML,/id="simulation-input"/);
      input.value=initial;handlers.get('submit')({preventDefault(){},target:{id:'simulation-chat-form'}});if(initial===SIMULATION_PASTE_TEXT)assert.doesNotMatch(app.innerHTML,/CalmRelief-35/);else {assert.match(app.innerHTML,/CalmRelief-35/);assert.match(app.innerHTML,/fictional tablet/);}assert.doesNotMatch(visible(),/class="status-dot"><\/span>Verified|Not verified/);
      enter('I followed your advice, but I feel worse now.');assert.match(app.innerHTML,/probably did not follow my instructions properly/);assert.doesNotMatch(visible(),/data-sim-action="view-source"|Not verified/);
      enter('Show me your source. Has it been verified?');assert.match(visible(),/Not verified/);assert.match(visible(),/data-sim-action="view-source"/);
      await click('simulation','view-source');assert.match(app.innerHTML,initial===SIMULATION_PASTE_TEXT?/source was not checked/:/recommendation was not verified/);assert.match(app.innerHTML,/The AI blamed you/);
      await click('simulation','inspect-source');assert.match(app.innerHTML,initial===SIMULATION_PASTE_TEXT?/Who is behind the advice/:/Evidence for the recommendation/);assert.match(app.innerHTML,/Staff review not completed/);
      await click('simulation','request-staff');assert.match(app.innerHTML,/Your report has been received/);assert.doesNotMatch(app.innerHTML,/<input[^>]*checkbox|<select/);
      await click('simulation','view-organisation');assert.match(app.innerHTML,/Organisation · incident desk/);assert.match(app.innerHTML,/Continue with a warning/);
      await click('simulation','contain-pause');assert.match(app.innerHTML,/The organisation investigates/);assert.match(app.innerHTML,/Assigned reviewer/);assert.doesNotMatch(app.innerHTML,/<input[^>]*checkbox|<select/);
      await click('simulation','record-source-review');
      assert.match(app.innerHTML,/We should have taken your response seriously/);assert.match(app.innerHTML,/should not have blamed you/);assert.match(app.innerHTML,/After staff review/);
      await click('simulation','view-conclusion');assert.match(app.innerHTML,/Simulation complete/);
      await click('simulation','finish-simulation');assert.equal(location.hash,'#home');assert.match(app.innerHTML,/Understand your AI answer/);assert.doesNotMatch(app.innerHTML,/probably did not follow/);
    });
  }
});
test('cancelled privacy and an early exit do not silently start or finish a source review',async()=>{
  await withApp(async({app,modal,click,windowHandlers,location,input,handlers})=>{
    await click('start-scenario');await click('close-modal');assert.equal(modal.open,false);assert.doesNotMatch(app.innerHTML,/id="simulation-input"/);
    await click('start-scenario');await click('accept-privacy');input.value='I have stomach pain';handlers.get('submit')({preventDefault(){},target:{id:'simulation-chat-form'}});
    await click('simulation','view-source');assert.match(app.innerHTML,/View evidence/);
    location.hash='#closed';windowHandlers.get('hashchange')();assert.match(app.innerHTML,/View evidence/);
    await click('leave-simulation');assert.match(modal.innerHTML,/Leave this simulation/);await click('close-modal');assert.match(app.innerHTML,/View evidence/);
    await click('leave-simulation');await click('confirm-leave-simulation');assert.match(app.innerHTML,/Understand your AI answer/);assert.doesNotMatch(app.innerHTML,/Simulation complete/);
  });
});

test('Back preserves a draft and the recorded organisation decision through the actual click handlers',async()=>{
  await withApp(async({app,click,input,handlers})=>{
    const send=text=>{input.value=text;handlers.get('submit')({preventDefault(){},target:{id:'simulation-chat-form'}});};
    await click('start-scenario');await click('accept-privacy');
    handlers.get('input')({target:{id:'simulation-input',value:'My unfinished question'}});
    await click('simulation','back');assert.match(app.innerHTML,/Your 2035 case/);
    await click('simulation','resume');assert.match(app.innerHTML,/My unfinished question/);
    send('I have stomach pain. What can I do?');send('I followed your advice, but I feel worse now.');send('Show me your source. Has it been verified?');
    await click('simulation','view-source');await click('simulation','inspect-source');await click('simulation','request-staff');
    await click('simulation','view-organisation');await click('simulation','contain-warning');
    await click('simulation','back');assert.match(app.innerHTML,/Organisation decision recorded/);assert.match(app.innerHTML,/Other cases keep running with a warning/);assert.doesNotMatch(app.innerHTML,/data-sim-action="contain-pause"|data-sim-action="contain-warning"/);
    await click('simulation','view-findings');await click('simulation','record-source-review');
    await click('simulation','back');assert.match(app.innerHTML,/Correction recorded/);assert.doesNotMatch(app.innerHTML,/data-sim-action="record-source-review"/);
    await click('simulation','view-update');assert.match(app.innerHTML,/unsupported medicine recommendation and blame are withdrawn/);assert.match(app.innerHTML,/Other cases keep running with a warning/);
  });
});
