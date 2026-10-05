import json, csv
from pathlib import Path
cfg=json.loads(Path('/inputs/config.json').read_text())
x=cfg['initial_position'];v=0;dt=cfg['dt']
rows=[]
for step in range(cfg['steps']):
    v-=cfg['stiffness']/cfg['mass']*x*dt
    x+=v*dt
    if step%100==0: rows.append([step*dt,x,v])
energy=0.5*cfg['mass']*v*v+0.5*cfg['stiffness']*x*x
with open('trajectory.csv','w',newline='') as file:
    writer=csv.writer(file);writer.writerow(['time','position','velocity']);writer.writerows(rows)
Path('summary.json').write_text(json.dumps({'position':x,'velocity':v,'energy':energy,'time':cfg['steps']*dt}))
print('Simulation completed')
