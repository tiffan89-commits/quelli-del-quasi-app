// Shared entry points for league discovery and creation.
export function leagueActions({bridge=false}={}){
 return '<div class="v2-sheet-actions league-actions">'+[['join','Entra in una lega'],['create','Crea lega · Bar + Fanta']].map(([action,label])=>'<button type="button" class="secondary" '+(bridge?'data-mode="bar" ':'')+'data-bar-page="'+action+'-league"'+'>'+label+'</button>').join('')+'</div>';
}
