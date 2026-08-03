// Season decision cards. Each: condition, weight, title, text, choices.
// A choice resolves to { text, tone, fx } — fx keys: form, morale, reputation,
// ability, wage(mult), fitness, injuryWeeks, listed, captain, retrain, agent…
import { chance, irand, pick, rand } from './rng.js';

const E = [];

E.push({
  id: 'training-focus',
  weight: (c) => (c.player.age <= 24 ? 3 : 1),
  title: 'Training focus',
  text: (c) => `The coaching staff ask how you want to shape your extra sessions this season at ${c.club.name}.`,
  choices: [
    {
      label: 'Extra technical work',
      stake: { p: 0.8, up: 2, down: -1 },
      sub: 'Steady improvement',
      resolve: () => ({ text: 'The hours on the training pitch sharpen your game noticeably.', tone: 'good', fx: { form: 4 } })
    },
    {
      label: 'Push physical limits',
      stake: { p: 0.55, up: 5, down: -3 },
      sub: 'Bigger gains, injury risk',
      resolve: (c) => chance(0.28 + c.player.injuryProne * 0.3)
        ? { text: 'You overdo it in the gym and tweak a hamstring — three weeks out.', tone: 'bad', fx: { injuryWeeks: 3, form: -6 } }
        : { text: 'You come out stronger and faster than ever.', tone: 'good', fx: { form: 6, fitness: 5 } }
    },
    {
      label: 'Coast through sessions',
      stake: { p: 0.45, up: 1, down: -2 },
      sub: 'Save your legs',
      resolve: () => chance(0.5)
        ? { text: 'Fresh legs help you late in matches, though the coaches noticed the shortcuts.', tone: 'neutral', fx: { fitness: 6, form: 2, reputation: -1 } }
        : { text: 'The manager calls out your attitude in front of the squad.', tone: 'bad', fx: { morale: -8, form: -4, reputation: -2 } }
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
      stake: { p: 0.75, up: 1, down: -1 },
      sub: 'Safe',
      resolve: () => ({ text: 'The pundits praise your level-headedness. Fans warm to you.', tone: 'good', fx: { reputation: 2, morale: 3 } })
    },
    {
      label: 'Talk yourself up',
      stake: { p: 0.5, up: 4, down: -3 },
      sub: 'High risk, high profile',
      resolve: (c) => chance(0.45 + c.player.form / 400)
        ? { text: 'Your confidence electrifies the fanbase. Your name is everywhere.', tone: 'gold', fx: { reputation: 6, morale: 4, form: 3 } }
        : { text: 'The quotes look arrogant in print. The away ends have a new chant about you.', tone: 'bad', fx: { reputation: -4, morale: -6 } }
    },
    {
      label: 'Decline the interview',
      stake: { p: 0.7, up: 1, down: -1 },
      sub: 'Stay out of the spotlight',
      resolve: () => ({ text: 'You keep your head down and let your football talk.', tone: 'neutral', fx: { form: 2 } })
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
      stake: { p: 0.45, up: 5, down: -3 },
      sub: 'Become a derby hero — or villain',
      resolve: (c) => chance(0.35 + c.player.ability / 300)
        ? { text: `You score in a famous win over ${c.rival}. Legend status with this crowd.`, tone: 'gold', fx: { reputation: 7, morale: 10, form: 8, fanFavourite: true } }
        : { text: `${c.rival} win it, and your quotes are pinned to their dressing-room wall.`, tone: 'bad', fx: { reputation: -3, morale: -8, form: -4 } }
    },
    {
      label: 'Keep it professional',
      stake: { p: 0.7, up: 2, down: -1 },
      sub: 'Just another match',
      resolve: () => chance(0.5)
        ? { text: 'A composed derby performance. The manager singles you out for praise.', tone: 'good', fx: { form: 5, morale: 4 } }
        : { text: 'A forgettable derby, quickly moved on from.', tone: 'neutral', fx: {} }
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
      stake: { p: 0.7, up: 3, down: -2 },
      sub: 'Leadership and pressure',
      resolve: () => ({ text: 'You are the new club captain. The responsibility sits well on your shoulders.', tone: 'gold', fx: { captain: true, reputation: 5, morale: 8 } })
    },
    {
      label: 'Decline politely',
      stake: { p: 0.6, up: 1, down: -1 },
      sub: 'Focus on your own game',
      resolve: () => ({ text: 'You stay in the ranks. Some senior players quietly question your ambition.', tone: 'neutral', fx: { morale: -2, form: 2 } })
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
      stake: { p: 0.75, up: 2, down: -1 },
      sub: 'Honest, steady counsel',
      resolve: () => ({ text: 'A safe pair of hands now guides your career.', tone: 'good', fx: { agent: 'honest', morale: 4 } })
    },
    {
      label: 'Sign with the shark',
      stake: { p: 0.5, up: 4, down: -3 },
      sub: 'Bigger deals, bigger drama',
      resolve: () => ({ text: 'The shark takes you on. Your name starts appearing in transfer gossip columns.', tone: 'neutral', fx: { agent: 'shark', reputation: 3 } })
    },
    {
      label: 'Stay independent',
      stake: { p: 0.6, up: 1, down: -1 },
      sub: 'Nobody takes a cut',
      resolve: () => ({ text: 'You back yourself to handle your own affairs.', tone: 'neutral', fx: {} })
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
      stake: { p: 0.5, up: 3, down: -3 },
      sub: 'Agent earns their fee',
      resolve: (c) => {
        const boost = c.player.agent === 'shark' ? 0.25 : c.player.agent === 'honest' ? 0.12 : 0;
        return chance(0.45 + boost + c.player.form / 500)
          ? { text: 'The club blinks first. A handsome new deal is signed.', tone: 'gold', fx: { wageMult: 1.5 + boost, contractYears: 3, morale: 6 } }
          : { text: 'Talks collapse. You will run your contract down — the stands notice your situation.', tone: 'bad', fx: { morale: -6, listed: true } };
      }
    },
    {
      label: 'Sign a fair extension',
      stake: { p: 0.8, up: 2, down: -1 },
      sub: 'Security and goodwill',
      resolve: () => ({ text: 'A sensible extension keeps everyone happy.', tone: 'good', fx: { wageMult: 1.2, contractYears: 3, morale: 4 } })
    },
    {
      label: 'Let it run down',
      stake: { p: 0.55, up: 2, down: -2 },
      sub: 'Freedom next summer',
      resolve: () => ({ text: 'No new deal. Clubs around the continent take note of a coming free agent.', tone: 'neutral', fx: { reputation: 2, listed: true } })
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
      stake: { p: 0.45, up: 3, down: -3 },
      sub: 'Squad bonding, tabloid risk',
      resolve: () => chance(0.4)
        ? { text: 'Photos of you at 3am make the front pages. The manager fines you.', tone: 'bad', fx: { reputation: -4, form: -5, morale: -3 } }
        : { text: 'A good night out tightens the dressing-room bond.', tone: 'good', fx: { morale: 7 } }
    },
    {
      label: 'Stay home',
      stake: { p: 0.85, up: 2, down: -1 },
      sub: 'Professional choice',
      resolve: () => ({ text: 'Early night, extra recovery. The staff appreciate your habits.', tone: 'good', fx: { form: 3, fitness: 3 } })
    }
  ]
});

E.push({
  id: 'position-retrain',
  weight: (c) => (!c.player.retrained && c.player.age >= 28 && c.player.position !== 'GK' ? 1.3 : 0),
  title: 'A tactical reinvention',
  text: (c) => {
    const to = c.player.position === 'FWD' ? 'a deeper playmaking role' : c.player.position === 'MID' ? 'a defensive role' : 'a holding midfield role';
    return `The manager believes your reading of the game suits ${to} as your legs change.`;
  },
  choices: [
    {
      label: 'Embrace the new role',
      stake: { p: 0.75, up: 3, down: -1 },
      sub: 'Extend your career',
      resolve: (c) => {
        const map = { FWD: 'MID', MID: 'DEF', DEF: 'MID' };
        return { text: 'You retrain diligently and master the new position. Careers are lengthened this way.', tone: 'good', fx: { retrain: map[c.player.position], form: 4, morale: 3 } };
      }
    },
    {
      label: 'Refuse — you know your game',
      stake: { p: 0.45, up: 4, down: -4 },
      sub: 'Back yourself',
      resolve: (c) => chance(c.player.ability > 70 ? 0.55 : 0.35)
        ? { text: 'You prove the doubters wrong in your natural position.', tone: 'good', fx: { form: 6, morale: 5 } }
        : { text: 'Your minutes dwindle as the manager favours his new system.', tone: 'bad', fx: { form: -7, morale: -6 } }
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
      stake: { p: 0.7, up: 2, down: -1 },
      sub: 'Time well spent',
      resolve: () => ({ text: 'The campaign raises a fortune. The city adores you for it.', tone: 'gold', fx: { reputation: 4, morale: 6 } })
    },
    {
      label: 'Make a brief appearance',
      stake: { p: 0.6, up: 1, down: -1 },
      sub: 'Tick the box',
      resolve: () => ({ text: 'You show your face and slip away early.', tone: 'neutral', fx: { reputation: 1 } })
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
      stake: { p: 0.55, up: 3, down: -3 },
      sub: 'Money and profile',
      resolve: () => chance(0.7)
        ? { text: 'Billboards, adverts, a signature boot. Your profile soars.', tone: 'gold', fx: { reputation: 5, wageBonus: 2000 } }
        : { text: 'The shoots eat your recovery days and your form dips.', tone: 'bad', fx: { reputation: 3, form: -6 } }
    },
    {
      label: 'Turn it down',
      stake: { p: 0.75, up: 1, down: -1 },
      sub: 'Football first',
      resolve: () => ({ text: 'You keep your diary clear and your mind on the pitch.', tone: 'neutral', fx: { form: 2 } })
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
      stake: { p: 0.5, up: 3, down: -3 },
      sub: 'Stand your ground',
      resolve: () => chance(0.5)
        ? { text: 'The squad respects that you did not back down. The air is cleared.', tone: 'good', fx: { morale: 6, reputation: 1 } }
        : { text: 'It turns into a training-ground scuffle. Both of you are fined.', tone: 'bad', fx: { morale: -5, reputation: -3 } }
    },
    {
      label: 'Let your football answer',
      stake: { p: 0.75, up: 2, down: -1 },
      sub: 'Rise above it',
      resolve: () => ({ text: 'You respond with performances. The row fizzles out.', tone: 'good', fx: { form: 4 } })
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
      stake: { p: 0.55, up: 4, down: -3 },
      sub: 'Glory or misery',
      resolve: (c) => chance(0.55 + c.player.ability / 400)
        ? { text: 'Ice in your veins — you convert the big ones all season.', tone: 'gold', fx: { form: 7, reputation: 4, bonusGoals: 4 } }
        : { text: 'A decisive miss haunts your season.', tone: 'bad', fx: { form: -6, morale: -7 } }
    },
    {
      label: 'Keep your head down',
      stake: { p: 0.65, up: 1, down: -1 },
      sub: 'Not your job',
      resolve: () => ({ text: 'Someone else steps up. No risk, no reward.', tone: 'neutral', fx: {} })
    }
  ]
});

E.push({
  id: 'international-window',
  weight: (c) => (c.player.caps === 0 && c.player.reputation >= 20 ? 2 : 0),
  title: 'A call from home',
  text: (c) => `Whispers say the ${c.nationName} selectors are watching you ahead of the next squad announcement.`,
  choices: [
    {
      label: 'Go public with your dream',
      stake: { p: 0.6, up: 3, down: -2 },
      sub: 'Declare for the shirt',
      resolve: () => ({ text: 'Your passion plays well at home. The selectors have you firmly on the list.', tone: 'good', fx: { reputation: 3, intlBoost: 8 } })
    },
    {
      label: 'Let your club form decide',
      stake: { p: 0.75, up: 2, down: -1 },
      sub: 'Quiet confidence',
      resolve: () => ({ text: 'You focus on your club and let the call come when it comes.', tone: 'neutral', fx: { form: 2 } })
    }
  ]
});

E.push({
  id: 'rough-tackler',
  weight: () => 1.3,
  title: 'A marked man',
  text: () => 'Word is out that opponents rattle you early with rough treatment.',
  choices: [
    {
      label: 'Give as good as you get',
      stake: { p: 0.5, up: 3, down: -3 },
      sub: 'Cards will come',
      resolve: () => chance(0.5)
        ? { text: 'Opponents learn to leave you alone. Respect earned the hard way.', tone: 'good', fx: { form: 4, reputation: 2 } }
        : { text: 'A red card and a three-match ban. The manager is furious.', tone: 'bad', fx: { form: -5, reputation: -3, morale: -4 } }
    },
    {
      label: 'Play through it cleverly',
      stake: { p: 0.6, up: 3, down: -2 },
      sub: 'Move the ball quicker',
      resolve: (c) => chance(0.3 + c.player.injuryProne * 0.35)
        ? { text: 'A late lunge catches you anyway — ankle ligaments, six weeks out.', tone: 'bad', fx: { injuryWeeks: 6, form: -4 } }
        : { text: 'You adapt your game and the kicks stop finding you.', tone: 'good', fx: { form: 4 } }
    }
  ]
});

E.push({
  id: 'gaffer-fallout',
  weight: (c) => (c.player.morale < 45 ? 2.2 : 0.7),
  title: 'Out of favour',
  text: () => 'You have slipped down the pecking order and the manager avoids your eye in training.',
  choices: [
    {
      label: 'Demand answers in his office',
      stake: { p: 0.45, up: 4, down: -4 },
      sub: 'Clear the air or burn it down',
      resolve: () => chance(0.45)
        ? { text: 'A frank conversation resets your standing. You are back in the side.', tone: 'good', fx: { morale: 8, form: 5 } }
        : { text: 'The meeting goes badly. You are training with the reserves.', tone: 'bad', fx: { morale: -8, form: -6, listed: true } }
    },
    {
      label: 'Ask to be listed',
      stake: { p: 0.6, up: 2, down: -2 },
      sub: 'Force a move',
      resolve: () => ({ text: 'The club quietly makes you available. Suitors will call in the summer.', tone: 'neutral', fx: { listed: true, morale: 2 } })
    },
    {
      label: 'Fight for your place silently',
      stake: { p: 0.6, up: 3, down: -2 },
      sub: 'Let training talk',
      resolve: () => chance(0.55)
        ? { text: 'Your application wins the staff over again.', tone: 'good', fx: { form: 6, morale: 5 } }
        : { text: 'Nothing changes. A frustrating season of bench splinters.', tone: 'bad', fx: { morale: -5, form: -3 } }
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
      stake: { p: 0.6, up: 2, down: -2 },
      sub: 'Open the door to romantic offers',
      resolve: () => ({ text: 'Word spreads that you are open to one last great story. Unexpected phone calls follow.', tone: 'good', fx: { adventure: true, listed: true, morale: 5 } })
    },
    {
      label: 'Finish at your level',
      stake: { p: 0.7, up: 2, down: -1 },
      sub: 'Pride in the standard you set',
      resolve: () => ({ text: 'You intend to bow out where you belong — at the top of your game.', tone: 'neutral', fx: { form: 2 } })
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
