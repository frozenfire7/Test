// NOTE: names, factions and lore below are PLACEHOLDERS until the real
// isekai mage academy story bible is dropped in. Edit freely.

const rep = (t, n) => Array(n).fill(t);

export const LEVELS = [
  {
    name: 'Undercroft I — The Forgotten Cellars', card: ['I', 'The Forgotten Cellars', 'Beneath the school, the old wards are failing.'], R: 28, sky: 0x1b1034,
    floor: 0x5b4a82, wall: 0x4a3b70, texA: '#5b4a82', texB: '#372a58', glow: 0x7df9ff,
    waves: [[...rep('wisp', 4), ...rep('skel', 2)], [...rep('skel', 3), ...rep('wisp', 3)]],
  },
  {
    name: 'Undercroft II — The Sunken Library', card: ['II', 'The Sunken Library', 'Forbidden tomes whisper in the flooded dark.'], R: 30, sky: 0x10243a,
    floor: 0x3e6a7a, wall: 0x2f5666, texA: '#3e6a7a', texB: '#234452', glow: 0x6bffb0,
    waves: [[...rep('skel', 4), ...rep('imp', 2)], [...rep('golem', 1), ...rep('imp', 2), ...rep('wisp', 3)]],
  },
  {
    name: 'Undercroft III — The Summoning Heart', card: ['III', 'The Summoning Heart', 'The circle that brought you here still burns.'], R: 32, sky: 0x2a0f2e,
    floor: 0x7a3f6b, wall: 0x5e2f55, texA: '#7a3f6b', texB: '#4a1f43', glow: 0xff7ad9,
    waves: [[...rep('skel', 4), ...rep('imp', 3)], [...rep('golem', 2), ...rep('wisp', 4)], ['boss']],
  },
];

// d: hp, spd, dmg, range (melee), wind (windup s), cd, r (body radius), xp, ranged/keep, fly, heavy, boss
export const ET = {
  wisp:  { hp: 30,  spd: 5.2, dmg: 8,  range: 1.7, wind: 0.5, cd: 1.2, r: 0.5, xp: 10, fly: true },
  skel:  { hp: 60,  spd: 3.6, dmg: 12, range: 2.2, wind: 0.6, cd: 1.5, r: 0.6, xp: 18 },
  imp:   { hp: 40,  spd: 3.2, dmg: 10, ranged: true, keep: 9, cd: 2.4, r: 0.5, xp: 22 },
  golem: { name: 'Stone Guardian', hp: 240, spd: 2.2, dmg: 30, range: 3.2, wind: 0.95, cd: 2.2, r: 1.2, xp: 70, heavy: true, h: 4 },
  boss:  { name: 'Ancient Guardian Golem', hp: 900, spd: 2.6, dmg: 30, range: 3.6, wind: 0.8, cd: 2, r: 1.5, xp: 400, boss: true, heavy: true, h: 5 },
};

export const DIALOGUE = {
  intro: {
    who: 'Headmistress Seraphine',
    text: 'You are awake. Good. Three days ago the old summoning circle beneath Aetherholt flared and pulled you out of your world — a swordsman with a mage\'s heart. The Undercroft below is stirring because of it.',
    choices: [
      { label: '“Why can I channel magic through my blade?”', next: 'blade' },
      { label: '“What waits beneath the school?”', next: 'under' },
      { label: '“Just point me at the stairs.”', next: 'end' },
    ],
  },
  blade: {
    who: 'Headmistress Seraphine',
    text: 'The circle bound your steel to your mana. Here, wizards cast from afar; you will cut the spell into being. Light combos feed your mana, Flame Edge sets the blade alight, and when the dungeon swarms you, press Tab and think before you strike.',
    choices: [{ label: '“Understood. Anything else?”', next: 'intro' }],
  },
  under: {
    who: 'Headmistress Seraphine',
    text: 'Cellars first, then the Sunken Library, then the Summoning Heart itself. Things that were never students wander there now. Take these draughts — and whatever you find at the bottom, bring it back to me alive.',
    choices: [
      { label: 'Accept the healing draughts', give: 'potion', next: 'end' },
    ],
  },
  end: {
    who: 'Headmistress Seraphine',
    text: 'The Undercroft gate is beyond the plaza. Go.',
    choices: [{ label: '[Leave]' }],
  },
};
