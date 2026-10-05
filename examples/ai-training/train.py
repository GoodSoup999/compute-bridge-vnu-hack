import json, torch
from pathlib import Path
torch.manual_seed(7)
data=json.loads(Path('/inputs/data.json').read_text())
x=torch.tensor(data['x'],dtype=torch.float32).reshape(-1,1)
y=torch.tensor(data['y'],dtype=torch.float32).reshape(-1,1)
model=torch.nn.Linear(1,1)
optimizer=torch.optim.SGD(model.parameters(),lr=0.1)
for epoch in range(200):
    optimizer.zero_grad(); loss=((model(x)-y)**2).mean(); loss.backward(); optimizer.step()
    if epoch%50==0: print('epoch',epoch,'loss',loss.item())
result={'weight':model.weight.item(),'bias':model.bias.item(),'loss':loss.item()}
Path('trained-model.json').write_text(json.dumps(result))
torch.save(model.state_dict(),'weights.pt')
