export const ROLE={G:'P',D:'D',M:'C',F:'A',P:'P',C:'C',A:'A',Goalkeeper:'P',Defender:'D',Midfielder:'C',Attacker:'A'};
export function classifyRole({catalogRole,position,formation,grid,startingXI=[]}={}){
 const role=ROLE[catalogRole]||ROLE[position]||null,base={role,subrole:null,evidence:catalogRole?'catalog-role':role?'provider-position':'missing-role',confidence:role?.length?0.7:0};if(!role)return base;if(role==='P')return {...base,subrole:'goalkeeper',confidence:.9};
 const rows=typeof formation==='string'?formation.split('-').map(Number):[],match=typeof grid==='string'?/^(\d+):(\d+)$/.exec(grid):null;
 if(!match||rows.some(x=>!Number.isInteger(x)||x<1||x>6)||rows.reduce((a,b)=>a+b,0)!==10||startingXI.length!==11)return base;
 const [row,col]=match.slice(1).map(Number),width=rows[row-2];if(!width||col<1||col>width)return base;
 const positions=startingXI.map(p=>p.player?.grid).filter(Boolean);if(new Set(positions).size!==11)return base;
 let subrole=null;if(role==='D'&&row===2)subrole=width>=4&&(col===1||col===width)?'fullback-wingback':'centre-back';
 if(role==='C'){if(rows.length>=4&&row===rows.length)subrole='attacking-midfielder-winger';else if(row>2&&row<rows.length+1)subrole='central-midfielder';}
 if(role==='A'&&row===rows.length+1)subrole=width>=3&&(col===1||col===width)?'attacking-midfielder-winger':'striker';
 return subrole?{...base,subrole,evidence:'complete-formation-grid',confidence:.9}:base;
}
