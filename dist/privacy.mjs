// Gate every way of entering text, rather than warning only after submission.
export function createPrivacyGate(state,onRequest){
  let asking=false;
  return {
    request(){
      if(state.privacyAcknowledged)return true;
      if(!asking){asking=true;onRequest();}
      return false;
    },
    accept(){state.privacyAcknowledged=true;asking=false;},
    cancel(){asking=false;},
    reset(){state.privacyAcknowledged=false;asking=false;}
  };
}
