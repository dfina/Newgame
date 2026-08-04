// Season decision cards.
//
// Every choice is resolved by a single roll against `odds` — the same number
// the card shows before you commit. `good` tells the story when it lands and
// `bad` when it does not, and the OVR swing in `ovr: [won, lost]` is bound to
// that same branch. A card can therefore never report a triumph while docking
// your rating, or console you while handing you a rise.
//
// Every card offers exactly two choices, and they are meant to be a real
// decision: one side gambles for a swing worth having, the other is the
// steady road. A choice with no `odds` is a certainty — only `good` is told.
//
// Cards are rare (see cardChance in career.js): a career turns on a handful of
// them, not on one every August. Because they are rare, the swings are large
// enough to matter, while a career's rating still comes mostly from football.
//
// `art` names the illustration drawn on the option (see ui/cardart.js).
// `fx` keys: form, morale, reputation, ability, wageMult, wageBonus, fitness,
// injuryWeeks, listed, captain, retrain, agent, bonusGoals, intlBoost,
// forceOffers (offers guaranteed next window), bigMove / adventure (which way
// those offers lean).
import { chance, rand } from './rng.js';
import { retrainTarget, roleName } from './positions.js';

const E = [];

E.push({
  id: 'training-focus',
  weight: (c) => (c.player.age <= 24 ? 3 : 1.2),
  title: 'Training focus',
  text: (c) => `The coaching staff ask how you want to shape your extra sessions this season at ${c.club.name}.`,
  choices: [
    {
      label: 'Push your physical limits',
      art: 'gym',
      odds: (c) => 0.68 - c.player.injuryProne * 0.35,
      ovr: [4, -3],
      good: () => ({ text: 'You come out of pre-season stronger and quicker than you have ever been.', tone: 'good', fx: { form: 8, fitness: 7 } }),
      bad: () => ({ text: 'You overdo it in the gym and tear a hamstring — three weeks out, and months of catching up.', tone: 'bad', fx: { injuryWeeks: 3, form: -8 } })
    },
    {
      label: 'Stick to the programme',
      art: 'training',
      good: () => ({ text: 'You do the work everyone does, and the season starts the way it always does.', tone: 'neutral', fx: { form: 2 } })
    }
  ]
});

E.push({
  id: 'nutrition-plan',
  weight: () => 1.6,
  title: 'Nutrition plan',
  text: () => 'A nutritionist suggests changing your diet. It could boost your performance or backfire.',
  choices: [
    {
      label: 'Follow the plan',
      art: 'nutrition',
      odds: 0.6,
      ovr: [3, -2],
      good: () => ({ text: 'You are lighter, sharper and still going strong in the last twenty minutes.', tone: 'good', fx: { fitness: 8, form: 6 } }),
      bad: () => ({ text: 'The regime leaves you drained through the winter, and it shows in your legs.', tone: 'bad', fx: { fitness: -6, form: -6 } })
    },
    {
      label: 'Keep your diet',
      art: 'burger',
      good: () => ({ text: 'You eat as you always have. Nothing changes, for better or worse.', tone: 'neutral', fx: {} })
    }
  ]
});

E.push({
  id: 'extra-camp',
  weight: (c) => (c.player.age <= 30 ? 1.6 : 0.6),
  title: 'Extra camp',
  text: () => 'A special camp can boost you, but the extra effort may take its toll.',
  choices: [
    {
      label: 'Attend',
      art: 'cones',
      odds: (c) => 0.65 - c.player.injuryProne * 0.15,
      ovr: [4, -3],
      good: () => ({ text: 'Three weeks of specialist coaching sharpen parts of your game you did not know were blunt.', tone: 'gold', fx: { form: 8, morale: 4 } }),
      bad: () => ({ text: 'You report back for pre-season already tired, and never quite get going.', tone: 'bad', fx: { form: -8, fitness: -5 } })
    },
    {
      label: 'Usual preparation',
      art: 'beach',
      good: () => ({ text: 'A proper summer off. You come back rested, if no better than you left.', tone: 'neutral', fx: { morale: 4 } })
    }
  ]
});

E.push({
  id: 'media-interview',
  weight: (c) => (c.player.reputation > 25 ? 1.8 : 0.5),
  title: 'Television interview',
  text: () => 'A national broadcaster wants a sit-down interview about your season.',
  choices: [
    {
      label: 'Talk yourself up',
      art: 'media',
      odds: (c) => 0.45 + c.player.form / 400,
      ovr: [4, -3],
      good: () => ({ text: 'Your confidence electrifies the fanbase, and you play like a man who meant every word.', tone: 'gold', fx: { reputation: 8, morale: 5, form: 7 } }),
      bad: () => ({ text: 'The quotes look arrogant in print. Away ends have a new chant about you, and it gets in your head.', tone: 'bad', fx: { reputation: -5, morale: -8, form: -6 } })
    },
    {
      label: 'Speak with humility',
      art: 'quiet',
      good: () => ({ text: 'The pundits praise your level-headedness. Neutrals warm to you.', tone: 'good', fx: { reputation: 3, morale: 3 } })
    }
  ]
});

E.push({
  id: 'derby-week',
  weight: (c) => (c.rival ? 2.2 : 0),
  title: 'Derby week',
  text: (c) => `It is derby week against ${c.rival}. The city talks about nothing else.`,
  choices: [
    {
      label: 'Fire up the fans',
      art: 'derby',
      odds: (c) => 0.4 + c.player.ability / 320,
      ovr: [4, -3],
      good: (c) => ({ text: `You score in a famous win over ${c.rival}. Legend status with this crowd, earned in ninety minutes.`, tone: 'gold', fx: { reputation: 9, morale: 10, form: 9, fanFavourite: true } }),
      bad: (c) => ({ text: `${c.rival} win it, and your quotes are pinned to their dressing-room wall. The stick never stops.`, tone: 'bad', fx: { reputation: -5, morale: -9, form: -7 } })
    },
    {
      label: 'Keep it professional',
      art: 'pitch',
      good: () => ({ text: 'You say nothing all week and play the game, not the occasion.', tone: 'neutral', fx: { form: 3 } })
    }
  ]
});

E.push({
  id: 'captaincy-offer',
  weight: (c) => (!c.player.captain && c.player.age >= 24 && c.yearsAtClub >= 2 && c.player.reputation > 30 ? 2.2 : 0),
  title: 'The armband',
  text: (c) => `The manager pulls you aside: the dressing room respects you. He offers you the captaincy of ${c.club.name}.`,
  choices: [
    {
      label: 'Accept the armband',
      art: 'armband',
      odds: 0.7,
      ovr: [3, -2],
      good: () => ({ text: 'You are the new club captain, and the responsibility sits well on your shoulders.', tone: 'gold', fx: { captain: true, reputation: 7, morale: 9 } }),
      bad: () => ({ text: 'The armband weighs on you. Your own game suffers while you carry everyone else’s.', tone: 'bad', fx: { captain: true, reputation: 2, form: -8, morale: -5 } })
    },
    {
      label: 'Decline politely',
      art: 'quiet',
      good: () => ({ text: 'You stay in the ranks and concentrate on your own game.', tone: 'neutral', fx: { form: 3 } })
    }
  ]
});

E.push({
  id: 'agent-pitch',
  weight: (c) => (c.player.agent === 'none' && c.player.reputation > 12 ? 2 : 0),
  title: 'Choosing representation',
  text: () => 'Two agents court you. One is a respected veteran; the other a notorious dealmaker with premium contacts.',
  choices: [
    {
      label: 'Sign with the shark',
      art: 'money',
      odds: 0.55,
      ovr: [3, -2],
      good: () => ({ text: 'The shark goes to work. Doors open that were not even doors before.', tone: 'gold', fx: { agent: 'shark', reputation: 6, wageBonus: 1500 } }),
      bad: () => ({ text: 'Your name spends the season in gossip columns, attached to moves that never happen. It unsettles you.', tone: 'bad', fx: { agent: 'shark', morale: -7, form: -5 } })
    },
    {
      label: 'Sign with the veteran',
      art: 'handshake',
      good: () => ({ text: 'A safe pair of hands now guides your career.', tone: 'good', fx: { agent: 'honest', morale: 5 } })
    }
  ]
});

E.push({
  id: 'contract-talks',
  weight: (c) => (c.player.contractYears === 1 ? 3.5 : 0),
  title: 'Contract talks',
  text: (c) => `Your deal at ${c.club.name} expires next summer. The club opens renewal talks.`,
  choices: [
    {
      label: 'Push hard for more money',
      art: 'money',
      odds: (c) => 0.45 + (c.player.agent === 'shark' ? 0.25 : c.player.agent === 'honest' ? 0.12 : 0) + c.player.form / 500,
      ovr: [3, -3],
      good: (c) => ({ text: 'The club blinks first. A handsome new deal is signed, and you play like a man vindicated.', tone: 'gold', fx: { wageMult: c.player.agent === 'shark' ? 1.75 : 1.5, contractYears: 3, morale: 8, form: 5 } }),
      bad: () => ({ text: 'Talks collapse. You will run your contract down, and the stands know exactly what that means.', tone: 'bad', fx: { morale: -8, form: -6, listed: true } })
    },
    {
      label: 'Sign a fair extension',
      art: 'contract',
      good: () => ({ text: 'A sensible extension keeps everyone happy and your mind on the football.', tone: 'good', fx: { wageMult: 1.2, contractYears: 3, morale: 5 } })
    }
  ]
});

E.push({
  id: 'transfer-ultimatum',
  weight: (c) => (c.player.reputation > 35 && c.yearsAtClub >= 2 ? 2.4 : 0),
  title: 'A bigger club calls',
  text: (c) => `A club several levels above ${c.club.name} has made an approach. Your own club refuses to negotiate and wants you to sign a new deal instead.`,
  choices: [
    {
      label: 'Force the move',
      art: 'plane',
      odds: 0.5,
      ovr: [4, -3],
      good: () => ({ text: 'You hand in the request and hold your nerve. The move is agreed, and a bigger stage is waiting.', tone: 'gold', fx: { forceOffers: true, bigMove: true, listed: true, reputation: 6, morale: 6 } }),
      bad: () => ({ text: 'The move collapses in the final week and you are left in a dressing room that watched you try to leave.', tone: 'bad', fx: { forceOffers: true, listed: true, morale: -10, form: -8, reputation: -3 } })
    },
    {
      label: 'Sign the new deal',
      art: 'contract',
      good: () => ({ text: 'You commit, and the club rewards you for it. The interest will come round again.', tone: 'good', fx: { wageMult: 1.35, contractYears: 3, morale: 5 } })
    }
  ]
});

E.push({
  id: 'loan-or-fight',
  weight: (c) => (c.player.age <= 24 && c.player.reputation < 45 ? 2.6 : 0),
  title: 'Third choice',
  text: (c) => `You are behind two others in the pecking order at ${c.club.name}. A smaller club would take you on loan and play you every week.`,
  choices: [
    {
      label: 'Take the loan',
      art: 'loan',
      odds: 0.72,
      ovr: [3, -1],
      good: () => ({ text: 'Forty games in a season where you matter. You come back a different player.', tone: 'gold', fx: { forceOffers: true, form: 8, morale: 7 } }),
      bad: () => ({ text: 'The loan club sign someone else in January and you spend half a year on another bench.', tone: 'bad', fx: { forceOffers: true, morale: -7, form: -5 } })
    },
    {
      label: 'Stay and fight for it',
      art: 'training',
      odds: 0.42,
      ovr: [4, -4],
      good: () => ({ text: 'An injury ahead of you opens the door and you never give the shirt back.', tone: 'gold', fx: { form: 9, morale: 8, reputation: 4 } }),
      bad: () => ({ text: 'You train hard and play nothing. A season of your career, spent watching.', tone: 'bad', fx: { morale: -9, form: -7 } })
    }
  ]
});

E.push({
  id: 'foreign-offer',
  weight: (c) => (c.player.age >= 23 && c.player.reputation > 28 ? 2 : 0),
  title: 'An offer from abroad',
  text: () => 'A club in a country you have never played in wants you: a different league, a different language, a different life.',
  choices: [
    {
      label: 'Take the leap',
      art: 'plane',
      odds: 0.58,
      ovr: [4, -3],
      good: () => ({ text: 'The move remakes you. New football, new demands, and you meet all of them.', tone: 'gold', fx: { forceOffers: true, adventure: true, reputation: 5, morale: 6 } }),
      bad: () => ({ text: 'You never settle. The football is a language you cannot quite speak, and the season drifts.', tone: 'bad', fx: { forceOffers: true, adventure: true, morale: -9, form: -7 } })
    },
    {
      label: 'Stay where you are understood',
      art: 'home',
      good: () => ({ text: 'You know this league, this dressing room, this city. That is worth something.', tone: 'neutral', fx: { morale: 4, form: 2 } })
    }
  ]
});

E.push({
  id: 'nightlife',
  weight: (c) => (c.player.age <= 27 ? 1.5 : 0.4),
  title: 'The wrong headlines',
  text: () => 'Team-mates invite you out midweek. Paparazzi haunt that part of town.',
  choices: [
    {
      label: 'Go out with the lads',
      art: 'nightlife',
      odds: 0.55,
      ovr: [1, -4],
      good: () => ({ text: 'A good night out, no cameras, and a dressing room that pulls tighter together.', tone: 'good', fx: { morale: 9 } }),
      bad: () => ({ text: 'Photographs of you at 3am make the front pages. The manager fines you and drops you for a fortnight.', tone: 'bad', fx: { reputation: -6, form: -9, morale: -5 } })
    },
    {
      label: 'Stay home',
      art: 'home',
      good: () => ({ text: 'Early night, extra recovery. The staff notice the habits as much as the football.', tone: 'good', fx: { form: 4, fitness: 4 } })
    }
  ]
});

E.push({
  id: 'position-retrain',
  weight: (c) => (!c.player.retrained && c.player.age >= 28 && c.player.position !== 'GK' ? 1.6 : 0),
  title: 'A tactical reinvention',
  text: (c) => `The manager believes your reading of the game now suits ${roleName(retrainTarget(c.player.position)).toLowerCase()} more than ${roleName(c.player.position).toLowerCase()}, as your legs change.`,
  choices: [
    {
      label: 'Embrace the new role',
      art: 'tactics',
      odds: 0.75,
      ovr: [3, -2],
      good: (c) => ({ text: `You retrain diligently and look like you have played ${roleName(retrainTarget(c.player.position)).toLowerCase()} all your life.`, tone: 'good', fx: { retrain: retrainTarget(c.player.position), form: 6, morale: 5 } }),
      bad: () => ({ text: 'The new position never feels like yours. Some weeks you look lost in it.', tone: 'bad', fx: { form: -7, morale: -5 } })
    },
    {
      label: 'Back yourself where you are',
      art: 'pitch',
      odds: (c) => (c.player.ability > 70 ? 0.55 : 0.35),
      ovr: [4, -4],
      good: () => ({ text: 'You prove the doubters wrong in your natural position, and the manager quietly drops the idea.', tone: 'good', fx: { form: 8, morale: 6 } }),
      bad: () => ({ text: 'Your minutes dwindle as the manager builds the system he wanted without you in it.', tone: 'bad', fx: { form: -9, morale: -8 } })
    }
  ]
});

E.push({
  id: 'boot-deal',
  weight: (c) => (c.player.reputation > 40 ? 1.4 : 0),
  title: 'Sponsorship offer',
  text: () => 'A sportswear giant offers a boot deal — with heavy promotional commitments.',
  choices: [
    {
      label: 'Sign the deal',
      art: 'boot',
      odds: 0.62,
      ovr: [2, -3],
      good: () => ({ text: 'Billboards, adverts, a signature boot. Your profile soars and your football never dips.', tone: 'gold', fx: { reputation: 7, wageBonus: 2500 } }),
      bad: () => ({ text: 'The shoots eat your recovery days, and it shows on Saturdays.', tone: 'bad', fx: { reputation: 3, wageBonus: 2500, form: -8 } })
    },
    {
      label: 'Football first',
      art: 'training',
      good: () => ({ text: 'You keep your diary clear and your mind on the pitch.', tone: 'neutral', fx: { form: 3 } })
    }
  ]
});

E.push({
  id: 'dressing-room-row',
  weight: () => 1.1,
  title: 'Dressing-room row',
  text: () => 'A senior team-mate publicly blames you for a costly defeat.',
  choices: [
    {
      label: 'Confront him',
      art: 'row',
      odds: 0.5,
      ovr: [3, -3],
      good: () => ({ text: 'The squad respects that you did not back down, and the air is cleared for good.', tone: 'good', fx: { morale: 8, reputation: 3 } }),
      bad: () => ({ text: 'It turns into a training-ground scuffle. Both of you are fined and the story leaks.', tone: 'bad', fx: { morale: -7, reputation: -5, form: -5 } })
    },
    {
      label: 'Let your football answer',
      art: 'pitch',
      odds: 0.75,
      ovr: [2, -1],
      good: () => ({ text: 'You respond with performances, and the row fizzles out on its own.', tone: 'good', fx: { form: 6 } }),
      bad: () => ({ text: 'The silence festers. Training is a cold place for months.', tone: 'bad', fx: { morale: -5 } })
    }
  ]
});

E.push({
  id: 'penalty-duty',
  weight: (c) => (c.player.position !== 'GK' ? 1.3 : 0),
  title: 'Penalty duty',
  text: () => 'The regular taker is injured. The manager looks around the room for a volunteer.',
  choices: [
    {
      label: 'Take the responsibility',
      art: 'penalty',
      odds: (c) => 0.5 + c.player.ability / 400,
      ovr: [3, -2],
      good: () => ({ text: 'Ice in your veins — you convert the big ones all season long.', tone: 'gold', fx: { form: 8, reputation: 5, bonusGoals: 5 } }),
      bad: () => ({ text: 'A decisive miss in front of the away end haunts the rest of your season.', tone: 'bad', fx: { form: -8, morale: -9 } })
    },
    {
      label: 'Keep your head down',
      art: 'quiet',
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
      label: 'Declare for the shirt',
      art: 'flag',
      odds: 0.7,
      ovr: [2, -1],
      good: () => ({ text: 'Your passion plays well at home. The selectors have you firmly on the list.', tone: 'good', fx: { reputation: 5, intlBoost: 10 } }),
      bad: () => ({ text: 'The declaration reads as presumptuous, and the call does not come.', tone: 'bad', fx: { reputation: -2, morale: -5 } })
    },
    {
      label: 'Let your club form decide',
      art: 'pitch',
      good: () => ({ text: 'You focus on your club and let the call come when it comes.', tone: 'neutral', fx: { form: 3 } })
    }
  ]
});

E.push({
  id: 'rough-tackler',
  weight: () => 1.1,
  title: 'A marked man',
  text: () => 'Word is out that opponents can rattle you with rough treatment early on.',
  choices: [
    {
      label: 'Give as good as you get',
      art: 'row',
      odds: 0.5,
      ovr: [3, -3],
      good: () => ({ text: 'Opponents learn to leave you alone. Respect, earned the hard way.', tone: 'good', fx: { form: 6, reputation: 3 } }),
      bad: () => ({ text: 'A red card and a three-match ban. The manager is furious, and you lose your rhythm.', tone: 'bad', fx: { form: -7, reputation: -4, morale: -6 } })
    },
    {
      label: 'Play through it cleverly',
      art: 'tactics',
      odds: (c) => 0.72 - c.player.injuryProne * 0.35,
      ovr: [2, -2],
      good: () => ({ text: 'You adapt your game, release the ball earlier, and the kicks stop finding you.', tone: 'good', fx: { form: 5 } }),
      bad: () => ({ text: 'A late lunge catches you anyway — ankle ligaments, six weeks out.', tone: 'bad', fx: { injuryWeeks: 6, form: -5 } })
    }
  ]
});

E.push({
  id: 'gaffer-fallout',
  weight: (c) => (c.player.morale < 45 ? 2.4 : 0.5),
  title: 'Out of favour',
  text: () => 'You have slipped down the pecking order, and the manager avoids your eye in training.',
  choices: [
    {
      label: 'Demand answers',
      art: 'row',
      odds: 0.45,
      ovr: [3, -4],
      good: () => ({ text: 'A frank conversation resets your standing entirely. You are back in the side on Saturday.', tone: 'good', fx: { morale: 10, form: 8 } }),
      bad: () => ({ text: 'The meeting goes badly. You are training with the reserves by the end of the week.', tone: 'bad', fx: { morale: -10, form: -9, listed: true } })
    },
    {
      label: 'Ask to be listed',
      art: 'loan',
      good: () => ({ text: 'The club quietly makes you available. Suitors will call once the season ends.', tone: 'neutral', fx: { listed: true, forceOffers: true, morale: 3 } })
    }
  ]
});

E.push({
  id: 'last-adventure',
  weight: (c) => (c.player.age >= 32 ? 2 : 0),
  title: 'One last adventure',
  text: () => 'Your agent floats an idea over dinner: a final chapter somewhere unexpected — a lower division that would worship you, or an emerging league far from home.',
  choices: [
    {
      label: 'Chase the adventure',
      art: 'plane',
      good: () => ({ text: 'Word spreads that you are open to one last great story. Unexpected phone calls follow.', tone: 'good', fx: { adventure: true, forceOffers: true, listed: true, morale: 7 } })
    },
    {
      label: 'Finish at your level',
      art: 'pitch',
      good: () => ({ text: 'You intend to bow out where you belong — at the top of your game.', tone: 'neutral', fx: { form: 3 } })
    }
  ]
});

E.push({
  id: 'fitness-regime',
  weight: (c) => (c.player.age >= 29 ? 2 : 0),
  title: 'The long game',
  text: () => 'A specialist offers to rebuild your conditioning around your thirties: diet, sleep, a private coach, every day of the off-season.',
  choices: [
    {
      label: 'Commit to the programme',
      art: 'gym',
      odds: 0.72,
      ovr: [4, -1],
      good: () => ({ text: 'You report back in the best shape of the squad. Younger team-mates ask what you are doing.', tone: 'gold', fx: { fitness: 14, form: 7, morale: 5 } }),
      bad: () => ({ text: 'The regime is punishing and the gains never really come. A long, flat summer.', tone: 'neutral', fx: { fitness: 3 } })
    },
    {
      label: 'Rest properly instead',
      art: 'beach',
      good: () => ({ text: 'A proper break clears your head, if not the miles in your legs.', tone: 'neutral', fx: { morale: 7, fitness: 4 } })
    }
  ]
});

E.push({
  id: 'youth-mentor',
  weight: (c) => (c.player.age >= 27 && c.player.reputation > 25 ? 1.2 : 0),
  title: 'The kid in the corner',
  text: (c) => `A sixteen-year-old has been training with the ${c.club.name} first team all week, and nobody has spoken to him.`,
  choices: [
    {
      label: 'Take him under your wing',
      art: 'youth',
      good: () => ({ text: 'You bring him into everything. The staff notice the kind of professional you have become.', tone: 'good', fx: { reputation: 5, morale: 6 } })
    },
    {
      label: 'Leave him to find his way',
      art: 'quiet',
      good: () => ({ text: 'He sinks or swims on his own, as you once did.', tone: 'neutral', fx: {} })
    }
  ]
});

E.push({
  id: 'charity-gala',
  weight: () => 0.9,
  title: 'Community day',
  text: () => 'The club foundation asks you to front a children’s hospital campaign.',
  choices: [
    {
      label: 'Give it your full weight',
      art: 'charity',
      good: () => ({ text: 'The campaign raises a fortune, and the city adores you for it.', tone: 'gold', fx: { reputation: 6, morale: 7 } })
    },
    {
      label: 'Make a brief appearance',
      art: 'quiet',
      good: () => ({ text: 'You show your face, sign a few shirts and slip away early.', tone: 'neutral', fx: { reputation: 1 } })
    }
  ]
});

export function drawSeasonEvents(career, count) {
  const pool = E.filter((e) => e.weight(career) > 0);
  const drawn = [];
  const used = new Set(career.usedEventIds || []);
  for (let i = 0; i < count && pool.length; i++) {
    let avail = pool.filter((e) => !drawn.includes(e) && !(used.has(e.id) && chance(0.8)));
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
