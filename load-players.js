const admin = require('firebase-admin');
const fs = require('fs');
const csv = require('csv-parser');

// Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Roster mappings to determine player status
const rosters = {
  pizza: {
    G1: "5311829", G2: "5105552", F1: "5061585", F2: "4873145", FC: "5041935",
    Bench: null, IR: "5101761"
  },
  dean: {
    G1: "4837356", G2: "5107157", F1: "4873151", F2: "5095151", FC: "5311844",
    Bench: "5150404", IR: null
  },
  richie: {
    G1: "4685802", G2: "4894452", F1: "4703115", F2: "4684155", FC: "4685673",
    Bench: "4683757", IR: null
  },
  aaron: {
    G1: "5258459", G2: "4683697", F1: "5311846", F2: "4937074", FC: "4873209",
    Bench: "4683758", IR: "5106040"
  },
  isaac: {
    G1: "4845373", G2: "4898283", F1: "5312258", F2: "5105798", FC: "5238184",
    Bench: null, IR: "5101623"
  },
  baker: {
    G1: "4683629", G2: "5196370", F1: "5142609", F2: "4684745", FC: "5105571",
    Bench: null, IR: null
  }
};

async function loadPlayers() {
  console.log('Loading players from CSV...\n');
  
  const players = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream('complete_player_data.csv')
      .pipe(csv())
      .on('data', (row) => {
        const playerId = row.athlete_id;
        
        // Find if player is rostered
        let fantasyTeam = null;
        let rosterSpot = null;
        
        for (const [teamId, roster] of Object.entries(rosters)) {
          for (const [spot, rosteredPlayerId] of Object.entries(roster)) {
            if (rosteredPlayerId === playerId) {
              fantasyTeam = teamId;
              rosterSpot = spot;
              break;
            }
          }
          if (fantasyTeam) break;
        }
        
        players.push({
          playerId: playerId,
          name: row.athlete_display_name,
          espnId: parseInt(row.athlete_id),
          teamId: parseInt(row.team_id),
          position: row.position,
          status: fantasyTeam ? 'rostered' : 'free_agent',
          fantasyTeam: fantasyTeam,
          rosterSpot: rosterSpot
        });
      })
      .on('end', async () => {
        console.log(`Loaded ${players.length} players from CSV`);
        
        // Upload to Firebase in batches
        const batchSize = 500;
        let uploaded = 0;
        
        for (let i = 0; i < players.length; i += batchSize) {
          const batch = db.batch();
          const batchPlayers = players.slice(i, i + batchSize);
          
          batchPlayers.forEach(player => {
            const docRef = db.collection('players').doc(player.playerId);
            batch.set(docRef, player);
          });
          
          await batch.commit();
          uploaded += batchPlayers.length;
          console.log(`  Uploaded ${uploaded}/${players.length} players...`);
        }
        
        // Summary
        const rostered = players.filter(p => p.status === 'rostered').length;
        const freeAgents = players.filter(p => p.status === 'free_agent').length;
        
        console.log(`\n✓ Successfully loaded ${players.length} players to Firebase`);
        console.log(`  - Rostered: ${rostered}`);
        console.log(`  - Free Agents: ${freeAgents}`);
        
        resolve();
      })
      .on('error', reject);
  });
}

loadPlayers()
  .then(() => {
    console.log('\n✓ Player loading complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error loading players:', error);
    process.exit(1);
  });