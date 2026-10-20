import test from 'node:test';
import assert from 'node:assert/strict';

// Exercise the real click and input handlers, including a draft that has not been sent.
test('role buttons preserve the user draft and cannot create or decide a report',async()=>{
  const names=['document','window','location','history'];
  const originals=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  const handlers=new Map();
  const input={value:'',focus(){}};
  const app={innerHTML:''},toast={hidden:true,textContent:''};
  const modal={open:false,innerHTML:'',classList:{toggle(){}},showModal(){this.open=true;},close(){this.open=false;},replaceChildren(){this.innerHTML='';},addEventListener(){}};
  const document={getElementById(id){if(id==='simulation-input')return app.innerHTML.includes('id="simulation-input"')?input:null;return {app,toast,modal}[id]||null;},querySelector(){return {focus(){}};},addEventListener(name,fn){handlers.set(name,fn);}};
  const location={hash:'#scenario'};
  const window={scrollTo(){},addEventListener(){}};
  const history={pushState(_s,_t,hash){location.hash=hash;},replaceState(_s,_t,hash){location.hash=hash;}};
  for(const [name,value] of Object.entries({document,window,location,history}))Object.defineProperty(globalThis,name,{configurable:true,writable:true,value});
  try{
    await import(`../dist/app.mjs?roles=${Math.random()}`);
    const click=async(action,extra={})=>handlers.get('click')({target:{closest(){return {disabled:false,dataset:{action,...extra}};}}});
    await click('start-scenario');await click('accept-privacy');
    assert.match(app.innerHTML,/data-role="user" aria-pressed="true"/);
    assert.match(app.innerHTML,/data-role="organisation" aria-pressed="false"/);
    input.value='My unfinished question';
    handlers.get('input')({target:{id:'simulation-input',value:input.value}});
    await click('simulation-role',{role:'organisation'});
    assert.match(app.innerHTML,/No report yet/);
    assert.match(app.innerHTML,/data-role="organisation" aria-pressed="true"/);
    assert.doesNotMatch(app.innerHTML,/data-sim-action="contain-pause"|data-sim-action="record-source-review"|My unfinished question/);
    await click('simulation-role',{role:'user'});
    assert.match(app.innerHTML,/My unfinished question/);
    input.value='I have stomach pain. What can I do?';
    handlers.get('submit')({preventDefault(){},target:{id:'simulation-chat-form'}});
    input.value='Another unfinished follow-up';
    handlers.get('input')({target:{id:'simulation-input',value:input.value}});
    await click('simulation-role',{role:'organisation'});
    assert.match(app.innerHTML,/No report yet/);
    assert.doesNotMatch(app.innerHTML,/I have stomach pain\. What can I do\?/);
    await click('simulation-role',{role:'user'});
    assert.match(app.innerHTML,/Another unfinished follow-up/);
    assert.match(app.innerHTML,/For your stomach pain, I recommend CalmRelief-35/);
    await click('simulation',{simAction:'view-source'});
    await click('simulation',{simAction:'inspect-source'});
    await click('simulation',{simAction:'request-staff'});
    assert.match(app.innerHTML,/Your report has been received/);
    await click('simulation-role',{role:'organisation'});
    assert.match(app.innerHTML,/Organisation · incident desk/);
    assert.match(app.innerHTML,/data-sim-action="contain-warning"/);
    assert.doesNotMatch(app.innerHTML,/data-sim-action="record-source-review"/);
    await click('simulation',{simAction:'contain-warning'});
    await click('simulation-role',{role:'user'});
    assert.match(app.innerHTML,/Your report has been received/);
    await click('simulation-role',{role:'organisation'});
    assert.match(app.innerHTML,/Other cases keep running with a warning/);
    assert.match(app.innerHTML,/data-sim-action="record-source-review"/);
    assert.doesNotMatch(app.innerHTML,/data-sim-action="contain-pause"|data-sim-action="contain-warning"/);
  }finally{
    for(const name of names){const descriptor=originals.get(name);if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
  }
});
