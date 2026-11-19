export const BAR_HOME_QUOTES={
 welcome:[()=> 'Benvenuto al bancone.',()=> 'Il tuo posto al bancone è pronto.'],
 late:[()=> 'Chiude tra poco, mi fai giocare?',()=> 'Ultimo giro prima della chiusura.'],
 low:[({correct,total})=>correct+' su '+total+'? Stavolta ci rifacciamo.',({correct,total})=>correct+' su '+total+'. La prossima la giochiamo meglio.'],
 high:[({correct,total})=>correct+' su '+total+'. Offro io al bancone.',({correct,total})=>correct+' su '+total+'. Questa ce la teniamo.'],
 up:[({change})=> 'Su di '+change+'. Non fermiamoci.',({change})=> 'Abbiamo guadagnato '+change+' in classifica.'],
 down:[({change,next})=> 'Giù di '+change+'. '+(next?'Si rimedia in '+next+'.':'Ci rifacciamo.'),({change})=> 'Perso '+change+' in classifica. Testa alla prossima.'],
 steady:[()=> 'Al bancone c’è già chi dice che l’aveva previsto.',()=> 'La prossima si gioca sul serio. Come sempre.'],
};
