import csv, json, sys
from pathlib import Path
with open(sys.argv[1]) as file:
    values = [float(row['value']) for row in csv.DictReader(file)]
result = {'count': len(values), 'sum': sum(values), 'mean': sum(values)/len(values)}
Path('statistics.json').write_text(json.dumps(result))
print('Processed', len(values), 'values')
