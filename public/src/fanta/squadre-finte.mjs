// Squadre finte della lega di prova (nomi dall'anteprima del Bar). Solo anteprima.

export const TEAMS = {
  sambuca: { id: 'sambuca', name: 'SamBuca Juniors', manager: 'Il Quasi di prova', color: '#d6f77b' },
  fly: { id: 'fly', name: 'Fly Emigrates', manager: 'Il Geometra', color: '#7bc8f7' },
  perfetta: { id: 'perfetta', name: 'La Quasi Perfetta', manager: 'La Vale', color: '#ec8758' },
  realgin: { id: 'realgin', name: 'Real Gin', manager: 'Zio Peppe', color: '#bd514b' },
  bis: { id: 'bis', name: 'FC 41 bis', manager: 'Il Cugino Informato', color: '#8b6da4' },
  falcone: { id: 'falcone', name: 'Don Falcone', manager: 'Capitan Sicuro', color: '#d5ad57' },
  ciaccola: { id: 'ciaccola', name: 'AC Ciaccola', manager: 'Il Debuttante', color: '#a6d4b4' },
  united: { id: 'united', name: 'Quasi United', manager: 'Il Profeta', color: '#4d78a6' },
};

export const MY_TEAM = 'sambuca';

export const team = (id, extra = {}) => ({ id, name: TEAMS[id].name, manager: TEAMS[id].manager, color: TEAMS[id].color, branding:TEAMS[id].branding||{}, ...extra });
