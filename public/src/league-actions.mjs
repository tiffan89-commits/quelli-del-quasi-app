// One set of labels and routes; joining/creating always uses the mother's form.
export function leagueActions({sheet=false,bridge=false}={}){
 return '<div class="v2-sheet-actions league-actions">'+[['join','Entra in una lega'],['create','Crea lega · Bar + Fanta']].map(([action,label])=>'<button type="button" class="secondary" '+(bridge?'data-mode="bar" ':'')+(sheet&&!bridge?'data-v2-action="'+action+'" aria-expanded="false" aria-controls="v2-form-'+action+'"':'data-bar-page="'+action+'-league"')+'>'+label+'</button>').join('')+'</div>';
}
