export const barStorageMode=(env=process.env)=>env.SELFHOST_BAR_STORAGE==='rows'?'rows':'snapshot';
export const barStorageRoot=()=>barStorageMode()==='rows'?'public.fanta_state':'fanta_state';
export const barMembershipRoot=()=>barStorageMode()==='rows'?'fanta.bar_membership_document':'fanta_state';

export const barCalendarRows=(mode,{round=false}={})=>mode==='rows'
 ? 'fanta.bar_seriea_matches AS fixture'+(round?' JOIN fanta.bar_seriea_calendar_rounds AS calendar ON fixture.round_position=calendar.position':'')
   +' CROSS JOIN LATERAL (SELECT fixture.data AS m'+(round?',calendar.data AS r':'')+') AS row_data'
 : "fanta_state AS s CROSS JOIN LATERAL jsonb_array_elements(s.payload#>'{football,calendar,rounds}') r CROSS JOIN LATERAL jsonb_array_elements(r->'matches') m";
