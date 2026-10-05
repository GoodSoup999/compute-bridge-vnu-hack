import json, torch
from pathlib import Path
model = json.loads(Path('/inputs/model.json').read_text())
data = json.loads(Path('/inputs/data.json').read_text())
with torch.no_grad():
    predictions = (torch.tensor(data,dtype=torch.float32)*model['weight']+model['bias']).tolist()
Path('predictions.json').write_text(json.dumps(predictions))
print('Inference completed on CPU')
