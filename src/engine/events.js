// Season decision cards.
//
// Every choice is resolved by a single roll against `odds` — the same number
// the card shows before you commit. `good` tells the story when it lands and
// `bad` when it does not, and the OVR swing in `ovr: [won, lost]` is bound to
// that same branch. A card can therefore never report a triumph while docking
// your rating, or console you while handing you a rise.
//
// The swings are deliberately small: a career's overall rating is built from
// appearances, goals, assists and ratings across a season. Decisions colour
// the story and move form, morale, reputation and minutes — the things that
// then shape the football.
//
// A choice with no `odds` is a certainty: only `good` is ever told.
// `fx` keys: form, morale, reputation, ability, wageMult, wageBonus, fitness,
// injuryWeeks, listed, captain, retrain, agent, bonusGoals, intlBoost…
import { chance, rand } from './rng.js';
import { retrainTarget, roleName } from './positions.js';

const E = [];

E.push({
  id: 'training-focus',
  weight: (c) => (c.player.age <= 24 ? 3 : 1),
  title: 'Training focus',
  text: (c) => `The coaching staff ask how you want to shape your extra sessions this season at ${c.club.name}.`,
  choices: [
    {
      label: 'Extra technical work',
      sub: 'Steady, unglamorous improvement',
      odds: 0.82,
      ovr: [1, 0],
      good: () => ({ text: 'The hours on the training pitch sharpen your first touch and your decision-making.', tone: 'good', fx: { form: 5 } }),
      bad: () => ({ text: 'The drills never quite click this year, and the sessions blur into one another.', tone: 'neutral', fx: { form: 1 } })
    },
    {
      label: 'Push your physical limits',
      sub: 'Bigger gains, real injury risk',
      odds: (c) => 0.7 - c.player.injuryProne * 0.4,
      ovr: [2, -1],
      good: () => ({ text: 'You come out of pre-season stronger and quicker than you have ever been.', tone: 'good', fx: { form: 7, fitness: 6 } }),
      bad: () => ({ text: 'You overdo it in the gym and tear a hamstring — three weeks out, and weeks of catching up.', tone: 'bad', fx: { injuryWeeks: 3, form: -6 } })
    },
    {
      label: 'Coast through the sessions',
      sub: 'Save your legs, risk your standing',
      odds: 0.5,
      ovr: [0, -1],
      good: () => ({ text: 'Fresh legs tell late in matches, and nobody says a word about the shortcuts.', tone: 'neutral', fx: { fitness: 7, form: 2 } }),
      bad: () => ({ text: 'The manager calls out your attitude in front of the whole squad.', tone: 'bad', fx: { morale: -8, form: -5, reputation: -2 } })
    }
  ]
});

E.push({
  id: 'media-interview',
  weight: (c) => (c.player.reputation > 25 ? 2 : 0.6),
  title: 'Television interview',
  text: () => 'A national broadcaster wants a sit-down interview about your season.',
  choices: [
    {
      label: 'Speak with humility',
      sub: 'Safe, and quietly effective',
      good: () => ({ text: 'The pundits praise your level-headedness. Neutrals warm to you.', tone: 'good', fx: { reputation: 3, morale: 3 } })
    },
    {
      label: 'Talk yourself up',
      sub: 'High risk, high profile',
      odds: (c) => 0.45 + c.player.form / 400,
      ovr: [2, -2],
      good: () => ({ text: 'Your confidence electrifies the fanbase, and you play like a man who meant every word.', tone: 'gold', fx: { reputation: 7, morale: 5, form: 6 } }),
      bad: () => ({ text: 'The quotes look arrogant in print. Away ends have a new chant about you, and it gets in your head.', tone: 'bad', fx: { reputation: -4, morale: -7, form: -4 } })
    },
    {
      label: 'Decline the interview',
      sub: 'Stay out of the spotlight',
      good: () => ({ text: 'You keep your head down and let your football talk.', tone: 'neutral', fx: { form: 2 } })
    }
  ]
});

E.push({
  id: 'derby-week',
  weight: (c) => (c.rival ? 2.5 : 0),
  title: 'Derby week',
  text: (c) => `It is derby week against ${c.rival}. The city talks about nothing else.`,
  choices: [
    {
      label: 'Fire up the fans in the press',
      sub: 'Become a derby hero — or its villain',
      odds: (c) => 0.35 + c.player.ability / 300,
      ovr: [2, -2],
      good: (c) => ({ text: `You score in a famous win over ${c.rival}. Legend status with this crowd, earned in ninety minutes.`, tone: 'gold', fx: { reputation: 8, morale: 10, form: 9, fanFavourite: true } }),
      bad: (c) => ({ text: `${c.rival} win it, and your quotes are pinned to their dressing-room wall. The stick never stops.`, tone: 'bad', fx: { reputation: -4, morale: -9, form: -6 } })
    },
    {
      label: 'Keep it professional',
      sub: 'Just another three points',
      odds: 0.7,
      ovr: [1, 0],
      good: () => ({ text: 'A composed derby performance. The manager singles you out for praise.', tone: 'good', fx: { form: 5, morale: 5 } }),
      bad: () => ({ text: 'A forgettable derby, quickly moved on from.', tone: 'neutral', fx: {} })
    }
  ]
});

E.push({
  id: 'captaincy-offer',
  weight: (c) => (!c.player.captain && c.player.age >= 24 && c.yearsAtClub >= 2 && c.player.reputation > 30 ? 2 : 0),
  title: 'The armband',
  text: (c) => `The manager pulls you aside: the dressing room respects you. He offers you the captaincy of ${c.club.name}.`,
  choices: [
    {
      label: 'Accept the armband',
      sub: 'Leadership, and the pressure that comes with it',
      odds: 0.75,
      ovr: [1, -1],
      good: () => ({ text: 'You are the new club captain, and the responsibility sits well on your shoulders.', tone: 'gold', fx: { captain: true, reputation: 6, morale: 8 } }),
      bad: () => ({ text: 'The armband weighs on you. Your own game suffers while you carry everyone else’s.', tone: 'bad', fx: { captain: true, reputation: 2, form: -7, morale: -4 } })
    },
    {
      label: 'Decline politely',
      sub: 'Focus on your own game',
      good: () => ({ text: 'You stay in the ranks. Some senior players quietly question your ambition.', tone: 'neutral', fx: { morale: -2, form: 3 } })
    }
  ]
});

E.push({
  id: 'agent-pitch',
  weight: (c) => (c.player.agent === 'none' && c.player.reputation > 12 ? 2.5 : 0.4),
  title: 'Choosing representation',
  text: () => 'Two agents court you. One is a respected veteran; the other a notorious dealmaker with premium contacts.',
  choices: [
    {
      label: 'Sign with the veteran',
      sub: 'Honest, steady counsel',
      good: () => ({ text: 'A safe pair of hands now guides your career.', tone: 'good', fx: { agent: 'honest', morale: 5 } })
    },
    {
      label: 'Sign with the shark',
      sub: 'Bigger deals, bigger drama',
      good: () => ({ text: 'The shark takes you on. Your name starts appearing in transfer gossip columns.', tone: 'neutral', fx: { agent: 'shark', reputation: 4 } })
    },
    {
      label: 'Stay independent',
      sub: 'Nobody takes a cut',
      good: () => ({ text: 'You back yourself to handle your own affairs.', tone: 'neutral', fx: {} })
    }
  ]
});

E.push({
  id: 'contract-talks',
  weight: (c) => (c.player.contractYears === 1 ? 4 : 0),
  title: 'Contract talks',
  text: (c) => `Your deal at ${c.club.name} expires next summer. The club opens renewal talks.`,
  choices: [
    {
      label: 'Push hard for more money',
      sub: 'Your agent earns their fee — or does not',
      odds: (c) => 0.45 + (c.player.agent === 'shark' ? 0.25 : c.player.agent === 'honest' ? 0.12 : 0) + c.player.form / 500,
      ovr: [1, -1],
      good: (c) => ({ text: 'The club blinks first. A handsome new deal is signed, and you play like a man vindicated.', tone: 'gold', fx: { wageMult: c.player.agent === 'shark' ? 1.75 : 1.5, contractYears: 3, morale: 7 } }),
      bad: () => ({ text: 'Talks collapse. You will run your contract down, and the stands know exactly what that means.', tone: 'bad', fx: { morale: -7, form: -3, listed: true } })
    },
    {
      label: 'Sign a fair extension',
      sub: 'Security and goodwill',
      good: () => ({ text: 'A sensible extension keeps everyone happy and your mind on the football.', tone: 'good', fx: { wageMult: 1.2, contractYears: 3, morale: 5 } })
    },
    {
      label: 'Let it run down',
      sub: 'Freedom next summer',
      good: () => ({ text: 'No new deal. Clubs around the continent take note of a coming free agent.', tone: 'neutral', fx: { reputation: 3, listed: true } })
    }
  ]
});

E.push({
  id: 'nightlife',
  weight: (c) => (c.player.age <= 27 ? 1.6 : 0.5),
  title: 'The wrong headlines',
  text: () => 'Team-mates invite you out midweek. Paparazzi haunt that part of town.',
  choices: [
    {
      label: 'Go out with the lads',
      sub: 'Squad bonding, tabloid risk',
      odds: 0.55,
      ovr: [0, -2],
      good: () => ({ text: 'A good night out, no cameras, and a dressing room that pulls tighter together.', tone: 'good', fx: { morale: 8 } }),
      bad: () => ({ text: 'Photographs of you at 3am make the front pages. The manager fines you and drops you for a fortnight.', tone: 'bad', fx: { reputation: -5, form: -7, morale: -4 } })
    },
    {
      label: 'Stay home',
      sub: 'The professional choice',
      good: () => ({ text: 'Early night, extra recovery. The staff notice the habits as much as the football.', tone: 'good', fx: { form: 3, fitness: 4 } })
    }
  ]
});

E.push({
  id: 'position-retrain',
  weight: (c) => (!c.player.retrained && c.player.age >= 28 && c.player.position !== 'GK' ? 1.3 : 0),
  title: 'A tactical reinvention',
  text: (c) => {
    const to = retrainTarget(c.player.position);
    return `The manager believes your reading of the game now suits ${roleName(to).toLowerCase()} more than ${roleName(c.player.position).toLowerCase()}, as your legs change.`;
  },
  choices: [
    {
      label: 'Embrace the new role',
      sub: 'Reinvention lengthens careers',
      odds: 0.78,
      ovr: [1, -1],
      good: (c) => ({ text: `You retrain diligently and look like you have played ${roleName(retrainTarget(c.player.position)).toLowerCase()} all your life.`, tone: 'good', fx: { retrain: retrainTarget(c.player.position), form: 5, morale: 4 } }),
      bad: (c) => ({ text: 'The new position never feels like yours. Some weeks you look lost in it.', tone: 'bad', fx: { retrain: retrainTarget(c.player.position), form: -5, morale: -4 } })
    },
    {
      label: 'Refuse — you know your game',
      sub: 'Back yourself where you belong',
      odds: (c) => (c.player.ability > 70 ? 0.55 : 0.35),
      ovr: [2, -2],
      good: () => ({ text: 'You prove the doubters wrong in your natural position, and the manager quietly drops the idea.', tone: 'good', fx: { form: 7, morale: 6 } }),
      bad: () => ({ text: 'Your minutes dwindle as the manager builds the system he wanted without you in it.', tone: 'bad', fx: { form: -8, morale: -7 } })
    }
  ]
});

E.push({
  id: 'charity-gala',
  weight: () => 1,
  title: 'Community day',
  text: () => 'The club foundation asks you to front a children’s hospital campaign.',
  choices: [
    {
      label: 'Give it your full weight',
      sub: 'Time well spent',
      good: () => ({ text: 'The campaign raises a fortune, and the city adores you for it.', tone: 'gold', fx: { reputation: 5, morale: 7 } })
    },
    {
      label: 'Make a brief appearance',
      sub: 'Tick the box',
      good: () => ({ text: 'You show your face, sign a few shirts and slip away early.', tone: 'neutral', fx: { reputation: 1 } })
    }
  ]
});

E.push({
  id: 'boot-deal',
  weight: (c) => (c.player.reputation > 40 ? 1.6 : 0),
  title: 'Sponsorship offer',
  text: () => 'A sportswear giant offers a boot deal — with heavy promotional commitments.',
  choices: [
    {
      label: 'Sign the deal',
      sub: 'Money and profile, at a cost in time',
      odds: 0.65,
      ovr: [0, -1],
      good: () => ({ text: 'Billboards, adverts, a signature boot. Your profile soars and your football never dips.', tone: 'gold', fx: { reputation: 6, wageBonus: 2000 } }),
      bad: () => ({ text: 'The shoots eat your recovery days, and it shows on Saturdays.', tone: 'bad', fx: { reputation: 3, wageBonus: 2000, form: -7 } })
    },
    {
      label: 'Turn it down',
      sub: 'Football first',
      good: () => ({ text: 'You keep your diary clear and your mind on the pitch.', tone: 'neutral', fx: { form: 3 } })
    }
  ]
});

E.push({
  id: 'dressing-room-row',
  weight: () => 1.2,
  title: 'Dressing-room row',
  text: () => 'A senior team-mate publicly blames you for a costly defeat.',
  choices: [
    {
      label: 'Confront him',
      sub: 'Stand your ground',
      odds: 0.5,
      ovr: [1, -1],
      good: () => ({ text: 'The squad respects that you did not back down, and the air is cleared for good.', tone: 'good', fx: { morale: 7, reputation: 2 } }),
      bad: () => ({ text: 'It turns into a training-ground scuffle. Both of you are fined and the story leaks.', tone: 'bad', fx: { morale: -6, reputation: -4, form: -3 } })
    },
    {
      label: 'Let your football answer',
      sub: 'Rise above it',
      odds: 0.78,
      ovr: [1, 0],
      good: () => ({ text: 'You respond with performances, and the row fizzles out on its own.', tone: 'good', fx: { form: 5 } }),
      bad: () => ({ text: 'The silence festers. Training is a cold place for months.', tone: 'neutral', fx: { morale: -4 } })
    }
  ]
});

E.push({
  id: 'penalty-duty',
  weight: (c) => (c.player.position !== 'GK' ? 1.4 : 0),
  title: 'Penalty duty',
  text: () => 'The regular taker is injured. The manager looks around the room for a volunteer.',
  choices: [
    {
      label: 'Take the responsibility',
      sub: 'Glory or misery, twelve yards out',
      odds: (c) => 0.5 + c.player.ability / 400,
      ovr: [1, -1],
      good: () => ({ text: 'Ice in your veins — you convert the big ones all season long.', tone: 'gold', fx: { form: 7, reputation: 4, bonusGoals: 4 } }),
      bad: () => ({ text: 'A decisive miss in front of the away end haunts the rest of your season.', tone: 'bad', fx: { form: -7, morale: -8 } })
    },
    {
      label: 'Keep your head down',
      sub: 'Not your job',
      good: () => ({ text: 'Someone else steps up. No risk, and no reward.', tone: 'neutral', fx: {} })
    }
  ]
});

E.push({
  id: 'international-window',
  weight: (c) => (c.player.caps === 0 && c.player.reputation >= 20 ? 2 : 0),
  title: 'A call from home',
  text: (c) => `Whispers say the ${c.nation.name} selectors are watching you ahead of the next squad announcement.`,
  choices: [
    {
      label: 'Go public with your dream',
      sub: 'Declare for the shirt',
      good: () => ({ text: 'Your passion plays well at home. The selectors have you firmly on the list.', tone: 'good', fx: { reputation: 4, intlBoost: 8 } })
    },
    {
      label: 'Let your club form decide',
      sub: 'Quiet confidence',
      good: () => ({ text: 'You focus on your club and let the call come when it comes.', tone: 'neutral', fx: { form: 3 } })
    }
  ]
});

E.push({
  id: 'rough-tackler',
  weight: () => 1.3,
  title: 'A marked man',
  text: () => 'Word is out that opponents can rattle you with rough treatment early on.',
  choices: [
    {
      label: 'Give as good as you get',
      sub: 'Cards will come',
      odds: 0.5,
      ovr: [1, -1],
      good: () => ({ text: 'Opponents learn to leave you alone. Respect, earned the hard way.', tone: 'good', fx: { form: 5, reputation: 2 } }),
      bad: () => ({ text: 'A red card and a three-match ban. The manager is furious, and you lose your rhythm.', tone: 'bad', fx: { form: -6, reputation: -3, morale: -5 } })
    },
    {
      label: 'Play through it cleverly',
      sub: 'Move the ball quicker',
      odds: (c) => 0.72 - c.player.injuryProne * 0.35,
      ovr: [1, -1],
      good: () => ({ text: 'You adapt your game, release the ball earlier, and the kicks stop finding you.', tone: 'good', fx: { form: 5 } }),
      bad: () => ({ text: 'A late lunge catches you anyway — ankle ligaments, six weeks out.', tone: 'bad', fx: { injuryWeeks: 6, form: -4 } })
    }
  ]
});

E.push({
  id: 'gaffer-fallout',
  weight: (c) => (c.player.morale < 45 ? 2.2 : 0.7),
  title: 'Out of favour',
  text: () => 'You have slipped down the pecking order, and the manager avoids your eye in training.',
  choices: [
    {
      label: 'Demand answers in his office',
      sub: 'Clear the air, or burn it down',
      odds: 0.45,
      ovr: [1, -2],
      good: () => ({ text: 'A frank conversation resets your standing entirely. You are back in the side on Saturday.', tone: 'good', fx: { morale: 9, form: 6 } }),
      bad: () => ({ text: 'The meeting goes badly. You are training with the reserves by the end of the week.', tone: 'bad', fx: { morale: -9, form: -8, listed: true } })
    },
    {
      label: 'Ask to be listed',
      sub: 'Force a move in the summer',
      good: () => ({ text: 'The club quietly makes you available. Suitors will call once the season ends.', tone: 'neutral', fx: { listed: true, morale: 2 } })
    },
    {
      label: 'Fight for your place silently',
      sub: 'Let the training ground talk',
      odds: 0.58,
      ovr: [1, -1],
      good: () => ({ text: 'Your application wins the staff over again, and the shirt comes back.', tone: 'good', fx: { form: 7, morale: 6 } }),
      bad: () => ({ text: 'Nothing changes. A frustrating season of bench splinters and warm-ups.', tone: 'bad', fx: { morale: -6, form: -5 } })
    }
  ]
});

E.push({
  id: 'last-adventure',
  weight: (c) => (c.player.age >= 32 ? 1.8 : 0),
  title: 'One last adventure',
  text: () => 'Your agent floats an idea over dinner: a final chapter somewhere unexpected — a lower division that would worship you, or an emerging league far from home.',
  choices: [
    {
      label: 'Chase the adventure',
      sub: 'Open the door to romantic offers',
      good: () => ({ text: 'Word spreads that you are open to one last great story. Unexpected phone calls follow.', tone: 'good', fx: { adventure: true, listed: true, morale: 6 } })
    },
    {
      label: 'Finish at your level',
      sub: 'Pride in the standard you set',
      good: () => ({ text: 'You intend to bow out where you belong — at the top of your game.', tone: 'neutral', fx: { form: 3 } })
    }
  ]
});

E.push({
  id: 'fitness-regime',
  weight: (c) => (c.player.age >= 29 ? 1.8 : 0.4),
  title: 'The long game',
  text: () => 'A specialist offers to rebuild your conditioning around your thirties: diet, sleep, a private coach, every day of the off-season.',
  choices: [
    {
      label: 'Commit to the programme',
      sub: 'Buy yourself extra seasons',
      odds: 0.75,
      ovr: [2, 0],
      good: () => ({ text: 'You report back in the best shape of the squad. Younger team-mates ask what you are doing.', tone: 'gold', fx: { fitness: 12, form: 6, morale: 4 } }),
      bad: () => ({ text: 'The regime is punishing and the gains never really come. A long, flat summer.', tone: 'neutral', fx: { fitness: 3 } })
    },
    {
      label: 'Rest properly instead',
      sub: 'Let the body recover',
      good: () => ({ text: 'A proper break clears your head, if not the miles in your legs.', tone: 'neutral', fx: { morale: 6, fitness: 4 } })
    }
  ]
});

E.push({
  id: 'youth-mentor',
  weight: (c) => (c.player.age >= 27 && c.player.reputation > 25 ? 1.5 : 0),
  title: 'The kid in the corner',
  text: (c) => `A sixteen-year-old has been training with the ${c.club.name} first team all week, and nobody has spoken to him.`,
  choices: [
    {
      label: 'Take him under your wing',
      sub: 'Standing in the dressing room',
      good: () => ({ text: 'You bring him into everything. The staff notice the kind of professional you have become.', tone: 'good', fx: { reputation: 4, morale: 5 } })
    },
    {
      label: 'Leave him to find his way',
      sub: 'Football is a hard school',
      good: () => ({ text: 'He sinks or swims on his own, as you once did.', tone: 'neutral', fx: {} })
    }
  ]
});

export function drawSeasonEvents(career, count) {
  const pool = E.filter((e) => e.weight(career) > 0);
  const drawn = [];
  const used = new Set(career.usedEventIds || []);
  for (let i = 0; i < count && pool.length; i++) {
    let avail = pool.filter((e) => !drawn.includes(e) && !(used.has(e.id) && chance(0.6)));
    // Long careers exhaust the pool: repeats are better than an empty season.
    if (!avail.length) avail = pool.filter((e) => !drawn.includes(e));
    if (!avail.length) break;
    let total = avail.reduce((s, e) => s + e.weight(career), 0);
    let r = rand() * total;
    let chosen = avail[avail.length - 1];
    for (const e of avail) { r -= e.weight(career); if (r <= 0) { chosen = e; break; } }
    drawn.push(chosen);
  }
  return drawn;
}

export function getEventById(id) {
  return E.find((e) => e.id === id) || null;
}
