const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function recalculateScores() {
  try {
    console.log('Recalculating Week 1 scores based on matchup rosters...\n');

    // Get Week 1 weekly stats
    const statsSnap = await db.collection('weeklyStats')
      .where('week', '==', 1)
      .get();
    
    const playerPoints = {};
    statsSnap.docs.forEach(d => {
      const v = d.data();
      playerPoints[v.playerId] = v.totalFantasyPoints || 0;
    });

    console.log(`Loaded stats for ${Object.keys(playerPoints).length} players\n`);

    // Get Week 1 matchups
    const matchupsSnap = await db.collection('matchups')
      .where('week', '==', 1)
      .get();

    // Recalculate each matchup based on existing rosters
    for (const matchupDoc of matchupsSnap.docs) {
      const matchup = matchupDoc.data();
      
      const team1Roster = matchup.team1Roster || {};
      const team2Roster = matchup.team2Roster || {};

      // Calculate team1 points (only starting 5: G1, G2, F1, F2, FC)
      let team1Points = 0;
      const team1Breakdown = [];
      ['G1', 'G2', 'F1', 'F2', 'FC'].forEach(slot => {
        const pid = team1Roster[slot];
        const pts = pid ? (playerPoints[pid] || 0) : 0;
        team1Points += pts;
        if (pid) {
          team1Breakdown.push(`  ${slot}: ${pid} = ${pts.toFixed(2)} pts`);
        }
      });

      // Calculate team2 points
      let team2Points = 0;
      const team2Breakdown = [];
      ['G1', 'G2', 'F1', 'F2', 'FC'].forEach(slot => {
        const pid = team2Roster[slot];
        const pts = pid ? (playerPoints[pid] || 0) : 0;
        team2Points += pts;
        if (pid) {
          team2Breakdown.push(`  ${slot}: ${pid} = ${pts.toFixed(2)} pts`);
        }
      });

      // Determine winner
      let winner = null;
      if (team1Points > team2Points) winner = matchup.team1;
      else if (team2Points > team1Points) winner = matchup.team2;
      else winner = 'tie';

      // Update matchup
      await matchupDoc.ref.update({
        team1Points: Math.round(team1Points * 100) / 100,
        team2Points: Math.round(team2Points * 100) / 100,
        winner: winner,
        completed: true
      });

      console.log(`${matchup.team1} vs ${matchup.team2}`);
      console.log(team1Breakdown.join('\n'));
      console.log(`  TOTAL: ${team1Points.toFixed(2)}`);
      console.log(team2Breakdown.join('\n'));
      console.log(`  TOTAL: ${team2Points.toFixed(2)}`);
      console.log(`Winner: ${winner}\n`);
    }

    console.log('✓ Week 1 scores recalculated');
    
    // Update team records
    await updateTeamRecords();
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

async function updateTeamRecords() {
  console.log('\nUpdating team records...');
  
  const matchupsSnap = await db.collection('matchups')
    .where('completed', '==', true)
    .get();
  
  const teamRecords = {};
  
  matchupsSnap.docs.forEach(doc => {
    const matchup = doc.data();
    
    if (!teamRecords[matchup.team1]) {
      teamRecords[matchup.team1] = { wins: 0, losses: 0, ties: 0 };
    }
    if (!teamRecords[matchup.team2]) {
      teamRecords[matchup.team2] = { wins: 0, losses: 0, ties: 0 };
    }
    
    const team1Record = teamRecords[matchup.team1];
    const team2Record = teamRecords[matchup.team2];
    
    if (matchup.winner === matchup.team1) {
      team1Record.wins++;
      team2Record.losses++;
    } else if (matchup.winner === matchup.team2) {
      team2Record.wins++;
      team1Record.losses++;
    } else {
      team1Record.ties++;
      team2Record.ties++;
    }
  });
  
  // Update team documents
  for (const [teamId, record] of Object.entries(teamRecords)) {
    await db.collection('teams').doc(teamId).update({ record });
  }
  
  console.log('✓ Updated team records\n');
  
  for (const [teamId, record] of Object.entries(teamRecords)) {
    console.log(`  ${teamId}: ${record.wins}-${record.losses}-${record.ties}`);
  }
}

recalculateScores();