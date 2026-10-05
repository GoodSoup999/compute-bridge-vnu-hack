// A whole-PC estimate over the union of execution intervals, not a wattmeter.
function energySettings(input = {}) {
  const watts=Number(input.powerWatts ?? 150); const rate=Number(input.electricityRate ?? 1);
  if(!Number.isFinite(watts)||watts<1||watts>2000)throw Error('Putere estimată: 1–2000 W');
  if(!Number.isFinite(rate)||rate<0||rate>100)throw Error('Tarif electricitate: 0–100 lei/kWh');
  return {powerWatts:watts,electricityRate:rate};
}
class EnergyEstimate {
  constructor(config,clock=()=>performance.now()) { this.config=energySettings(config);this.clock=clock;this.active=new Set();this.elapsed=0;this.started=null; }
  begin(id) { if(!this.active.size)this.started=this.clock();this.active.add(id); }
  end(id) { if(!this.active.delete(id))return;if(!this.active.size){this.elapsed+=Math.max(0,this.clock()-this.started);this.started=null;} }
  snapshot() {
    const busyMs=this.elapsed+(this.active.size?Math.max(0,this.clock()-this.started):0);
    const kWh=this.config.powerWatts*busyMs/3600000000;
    return {...this.config,busyMs,kWh,costLei:kWh*this.config.electricityRate,estimated:true};
  }
}
module.exports={EnergyEstimate,energySettings};
