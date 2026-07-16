const CHARACTERS = [
  {
    id: 'ironwall',
    name: 'Iron Wall',
    title: 'Breaker General',
    desc: 'Clear the bottom 2 rows. Make room when the field is crowded.',
    effectLabel: 'Clear 2 bottom rows',
    icon: 'assets/characters/ironwall.gif',
    sound: 'assets/audio/ironwall.wav',
  },
  {
    id: 'chrono',
    name: 'Chronomancer',
    title: 'Time Strategist',
    desc: 'Add 60 seconds to the clock. Turn the tide when time runs low.',
    effectLabel: '+60s instantly',
    icon: 'assets/characters/chronomancer.gif',
    sound: 'assets/audio/chronomancer.mp3',
  },
  {
    id: 'blacksmith',
    name: 'Blacksmith',
    title: 'Forge Patch',
    desc: 'Place 3 soldiers on empty cells you choose. Patch gaps to complete a row.',
    effectLabel: 'Place 3 soldiers',
    icon: 'assets/characters/blacksmith.gif',
    sound: 'assets/audio/blacksmith.wav',
  },
];

function getCharacter(id) {
  return CHARACTERS.find(c => c.id === id) || null;
}
