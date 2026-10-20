import {transitionIncident} from '../dist/engine.mjs';
// Existing regression cases use this fixture to enter the complete recovery route.
export function pauseForRecovery(incident){
  if(incident.scenario&&!incident.decision){
    const chosen=transitionIncident(incident,'response',{choice:'pause'});
    return transitionIncident(chosen,'review-response');
  }
  return transitionIncident(incident,'pause');
}
