"""Add cached transfer evidence involving current Serie A clubs, not a full global transfer-history scan."""
import runpy,json,pathlib
m=runpy.run_path(str(pathlib.Path(__file__).with_name('import-player-careers.py')))
get,batch=m['get'],m['batch'];root=m['ROOT']
teams=get('teams?league=135&season=2026')['response']
responses=batch(['transfers?team='+str(t['team']['id']) for t in teams])
output={}
for response in responses:
 for row in response['response']:
  i=row.get('player',{}).get('id')
  if not isinstance(i,int) or i<=0:continue
  dest=output.setdefault(str(i),{})
  for transfer in row.get('transfers',[]):dest[json.dumps(transfer,sort_keys=True)]=transfer
path=root/'.netlify/career-import/seriea-transfer-evidence.json';path.write_text(json.dumps({i:list(rows.values()) for i,rows in output.items()},ensure_ascii=False))
print(json.dumps({'stage':'transfer-evidence','teamRequests':len(teams),'playerHistories':len(output),'path':str(path)}),flush=True)
