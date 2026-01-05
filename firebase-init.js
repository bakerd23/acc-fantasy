// Firebase Initialization Script
const admin = require('firebase-admin');
const fs = require('fs');
const csv = require('csv-parser');

// Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Roster data
const rosters = {
  pizza: {
    teamName: "Pizza",
    owner: "Pizza",
    roster: {
      G1: "5311829", // Neo Avdalas
      G2: "5105552", // BJ Edwards
      F1: "5061585", // Isaiah Evans
      F2: "4873145", // Donnie Freeman
      FC: "5041935",  // Cameron Boozer (F/C flex spot)
      Bench: null,
      IR: "5101761"  // Mikel Brown Jr.
    }
  },
  dean: {
    teamName: "Dean",
    owner: "Dean",
    roster: {
      G1: "4837356", // Tre Donaldson
      G2: "5107157", // Ryan Conwell
      F1: "4873151", // Paul McNeil Jr.
      F2: "5095151", // Caleb Wilson
      FC: "5311844",  // Johann Grunloh (F/C flex spot)
      Bench: "5150404", // Chance Mallory
      IR: null
    }
  },
  richie: {
    teamName: "Richie",
    owner: "Richie",
    roster: {
      G1: "4685802", // Robert McCray V
      G2: "4894452", // Myles Colvin
      F1: "4703115", // Jaron Pierre Jr.
      F2: "4684155", // John Camden
      FC: "4685673",  // Amani Hansberry (F/C flex spot)
      Bench: "4683757", // Kowacie Reeves Jr.
      IR: null
    }
  },
  aaron: {
    teamName: "Aaron",
    owner: "Aaron",
    roster: {
      G1: "5258459", // Ebuka Okorie
      G2: "4683697", // J.J. Starling
      F1: "5311846", // Thijs De Ridder
      F2: "4937074", // Darrion Williams
      FC: "4873209",  // Patrick Ngongba II (F/C flex spot)
      Bench: "4683758", // Malik Thomas
      IR: "5106040"  // Tobi Lawal
    }
  },
  isaac: {
    teamName: "Isaac",
    owner: "Isaac",
    roster: {
      G1: "4845373", // Dai Dai Ames
      G2: "4898283", // Boopie Miller
      F1: "5312258", // Jalen Haralson
      F2: "5105798", // Malik Reneau
      FC: "5238184",  // Samet Yigitoglu (F/C flex spot)
      Bench: null,
      IR: "5101623"  // Markus Burton
    }
  },
  baker: {
    teamName: "Baker",
    owner: "Baker",
    roster: {
      G1: "4683629", // Donald Hand Jr.
      G2: "5196370", // Justin Pippen
      F1: "5142609", // Juke Harris
      F2: "4684745", // Chisom Okpara
      FC: "5105571",  // Henri Veesaar (F/C flex spot)
      Bench: null,
      IR: null
    }
  }
};

// Matchup schedule (weeks 1-5 repeat as 6-8, weeks 9-10 are playoffs)
const matchupSchedule = [
  { week: 1, team1: "aaron", team2: "isaac" },
  { week: 1, team1: "dean", team2: "richie" },
  { week: 1, team1: "baker", team2: "pizza" },
  { week: 2, team1: "isaac", team2: "pizza" },
  { week: 2, team1: "aaron", team2: "pizza" },
  { week: 2, team1: "baker", team2: "dean" },
  { week: 3, team1: "dean", team2: "isaac" },
  { week: 3, team1: "baker", team2: "richie" },
  { week: 3, team1: "aaron", team2: "pizza" },
  { week: 4, team1: "isaac", team2: "richie" },
  { week: 4, team1: "aaron", team2: "baker" },
  { week: 4, team1: "dean", team2: "pizza" },
  { week: 5, team1: "aaron", team2: "dean" },
  { week: 5, team1: "pizza", team2: "richie" },
  { week: 5, team1: "baker", team2: "isaac" },
];

// Weeks 6-8 repeat weeks 1-3
const regularSeasonSchedule = [
  ...matchupSchedule,
  ...matchupSchedule.slice(0, 9).map(m => ({ ...m, week: m.week + 5 })) // Only repeat weeks 1-3
];

// Weeks 9-10 are playoffs (will be determined based on standings)

async function initializeTeams() {
  console.log('Initializing teams collection...');
  
  const batch = db.batch();
  
  for (const [teamId, teamData] of Object.entries(rosters)) {
    const docRef = db.collection('teams').doc(teamId);
    batch.set(docRef, {
      teamId: teamId,
      ...teamData,
      record: {
        wins: 0,
        losses: 0,
        ties: 0
      }
    });
  }
  
  await batch.commit();
  console.log('✓ Initialized 6 teams');
}

async function initializeMatchups() {
  console.log('Initializing matchups collection (regular season only)...');
  
  const batch = db.batch();
  
  regularSeasonSchedule.forEach(matchup => {
    const matchupId = `${matchup.week}_${matchup.team1}_${matchup.team2}`;
    const docRef = db.collection('matchups').doc(matchupId);
    
    batch.set(docRef, {
      matchupId: matchupId,
      week: matchup.week,
      team1: matchup.team1,
      team2: matchup.team2,
      team1Points: 0,
      team2Points: 0,
      winner: null,
      completed: false,
      team1Roster: rosters[matchup.team1].roster,
      team2Roster: rosters[matchup.team2].roster
    });
  });
  
  await batch.commit();
  console.log(`✓ Initialized ${regularSeasonSchedule.length} matchups (weeks 1-8, playoffs to be scheduled)`);
}

async function initializeLeague() {
  console.log('Initializing league settings...');
  
  await db.collection('league').doc('main').set({
    leagueId: 'main',
    currentWeek: 1,
    season: '2025-26',
    scoringFormula: {
      points: 1,
      rebounds: 1.5,
      assists: 1.5,
      fieldGoalPercentage: 10,
      steals: 2,
      blocks: 2,
      threePointers: 0.5,
      turnovers: -2,
      fouls: -1
    },
    weekDates: [
      { week: 1, startDate: "2025-12-30", endDate: "2026-01-04" },
      { week: 2, startDate: "2026-01-05", endDate: "2026-01-11" },
      { week: 3, startDate: "2026-01-12", endDate: "2026-01-18" },
      { week: 4, startDate: "2026-01-19", endDate: "2026-01-25" },
      { week: 5, startDate: "2026-01-26", endDate: "2026-02-01" },
      { week: 6, startDate: "2026-02-02", endDate: "2026-02-08" },
      { week: 7, startDate: "2026-02-09", endDate: "2026-02-15" },
      { week: 8, startDate: "2026-02-16", endDate: "2026-02-22" },
      { week: 9, startDate: "2026-02-23", endDate: "2026-03-01", playoffs: true },
      { week: 10, startDate: "2026-03-02", endDate: "2026-03-08", playoffs: true }
    ],
    playoffFormat: {
      week9: "Semifinals (1v4, 2v3, 5v6)",
      week10: "Finals & Consolation"
    }
  });
  
  console.log('✓ Initialized league settings');
}

async function initializeFirebase() {
  try {
    console.log('Starting Firebase initialization...\n');
    
    await initializeTeams();
    await initializeMatchups();
    await initializeLeague();
    
    console.log('\n✓ Firebase initialization complete!');
    console.log('\nNote: Roster format is now 2G, 2F, 1 F/C flex');
    console.log('Weeks 9-10 are playoffs (matchups TBD based on standings)');
    console.log('\nNext: I will provide player and games data files.');
    process.exit(0);
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    process.exit(1);
  }
}

initializeFirebase();