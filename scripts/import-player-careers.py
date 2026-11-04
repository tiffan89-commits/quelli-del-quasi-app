"""Resumable, quota-bounded API-FOOTBALL acquisition; no database writes.
Run with API_FOOTBALL_KEY in the environment. Raw responses never contain it.
"""
import os,json,time,threading,urllib.request,concurrent.futures,pathlib,datetime
ROOT=pathlib.Path(__file__).resolve().parents[1]
CACHE=ROOT/'.netlify/career-import';CACHE.mkdir(parents=True,exist_ok=True)
KEY=os.environ['API_FOOTBALL_KEY'];SEASON=2026;LIMIT=1000
lock=threading.Lock();calls=0;last=0

def get(path):
 global calls,last
 file=CACHE/(path.replace('/','_').replace('?','_').replace('&','_').replace('=','-')+'.json')
 if file.exists():return json.loads(file.read_text())
 with lock:
  if calls>=LIMIT:raise RuntimeError('Import call ceiling reached; resume from checkpoints')
  wait=max(0,last+.7-time.monotonic())
  if wait:time.sleep(wait)
  last=time.monotonic();calls+=1
 req=urllib.request.Request('https://v3.football.api-sports.io/'+path,headers={'x-apisports-key':KEY})
 with urllib.request.urlopen(req,timeout=40) as response:data=json.load(response)
 if data.get('errors'):raise RuntimeError('Provider error: '+json.dumps(data['errors']))
 tmp=file.with_suffix('.tmp');tmp.write_text(json.dumps(data,ensure_ascii=False));tmp.replace(file)
 return data

def batch(paths):
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:return list(pool.map(get,paths))

def run():
 first=get(f'players?league=135&season={SEASON}&page=1');pages=first['paging']['total']
 stats=first['response']+[p for x in batch([f'players?league=135&season={SEASON}&page={n}' for n in range(2,pages+1)]) for p in x['response']]
 print(json.dumps({'stage':'season-players','pages':pages,'rows':len(stats),'calls':calls}),flush=True)
 teams=get(f'teams?league=135&season={SEASON}')['response'];squads=batch(['players/squads?team='+str(t['team']['id']) for t in teams])
 people={p['player']['id']:{'profile':p['player'],'seasonStatistics':p['statistics'],'inCurrentSquad':False} for p in stats}
 for x in squads:
  for t in x['response']:
   for p in t['players']:
    row=people.setdefault(p['id'],{'profile':p,'seasonStatistics':[],'inCurrentSquad':False});row['inCurrentSquad']=True;row['currentTeam']=t['team']
 italy=get('teams?country=Italy')['response'];italian={t['team']['id']:t['team'] for t in italy if not t['team'].get('national')}
 print(json.dumps({'stage':'current-squads','players':len(people),'currentPlayers':sum(p['inCurrentSquad'] for p in people.values()),'italianTeams':len(italian),'calls':calls}),flush=True)
 ids=list(people);done=0
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
  pending={pool.submit(get,'players/teams?player='+str(i)):i for i in ids}
  for future in concurrent.futures.as_completed(pending):
   i=pending[future];people[i]['careerTeams']=future.result()['response'];done+=1
   if done%50==0:print(json.dumps({'stage':'careers','done':done,'total':len(ids),'calls':calls}),flush=True)
 missing=[i for i,p in people.items() if not p['profile'].get('birth',{}).get('date')]
 for i,x in zip(missing,batch(['players/profiles?player='+str(i) for i in missing])):
  if x['response']:people[i]['profile'].update(x['response'][0]['player'])
 now=datetime.datetime.now(datetime.timezone.utc).isoformat();out={'source':'API-FOOTBALL','season':SEASON,'acquiredAt':now,'callsThisRun':calls,'seasonPages':pages,'italianTeams':italy,'players':[]}
 for i,p in people.items():
  entries=[t for t in p['careerTeams'] if t['team']['id'] in italian];years=sorted({y for t in entries for y in t.get('seasons',[]) if isinstance(y,int) and y<=SEASON});unknown=any(not t.get('seasons') for t in entries)
  birth=p['profile'].get('birth',{}).get('date');p['apiId']=i;p['careerContext']={'birthDate':birth,'firstItalySeason':years[0] if years else None,'verified':bool(birth and years and not unknown),'source':'API-FOOTBALL players/teams + teams?country=Italy + player profile','coverage':'provider-observed-club-history','acquiredAt':now,'incompleteItalianSeasons':unknown};out['players'].append(p)
 dest=ROOT/'data/player-career-import-2026.json';tmp=dest.with_suffix('.tmp');tmp.write_text(json.dumps(out,ensure_ascii=False,separators=(',',':')));tmp.replace(dest)
 print(json.dumps({'stage':'complete','players':len(people),'profilesCompleted':len(missing),'calls':calls,'file':str(dest)}),flush=True)
if __name__=='__main__':run()
