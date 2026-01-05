const admin = require('firebase-admin');
const fs = require('fs');

// Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function uploadStats() {
  try {
    // Read scraped stats
    const scrapedData = JSON.parse(fs.readFileSync('week1_stats.json', 'utf8'));
    
    console.log(`Uploading Week 1 stats...`);
    console.log(`Games: ${scrapedData.game_count}`);
    console.log(`Player stats: ${scrapedData.player_stats_count}\n`);
    
    if (!scrapedData.stats || scrapedData.stats.length === 0) {
      console.log('No stats to upload');
      return;
    }
    
    // Upload to gameStats collection
    const batch = db.batch();
    let count = 0;
    
    for (const stat of scrapedData.stats) {
      const docId = `${stat.game_id}_${stat.athlete_id}`;
      const docRef = db.collection('gameStats').doc(docId);
      
      batch.set(docRef, {
        gameId: stat.game_id.toString(),
        week: stat.week,
        playerId: stat.athlete_id.toString(),
        playerName: stat.athlete_display_name,
        teamId: stat.team_id,
        stats: {
          fieldGoalsMade: stat.field_goals_made || 0,
          fieldGoalsAttempted: stat.field_goals_attempted || 0,
          fieldGoalPercentage: stat.field_goal_percentage || 0,
          threePointFieldGoalsMade: stat.three_point_field_goals_made || 0,
          rebounds: stat.rebounds || 0,
          assists: stat.assists || 0,
          steals: stat.steals || 0,
          blocks: stat.blocks || 0,
          turnovers: stat.turnovers || 0,
          fouls: stat.fouls || 0,
          points: stat.points || 0
        },
        fantasyPoints: stat.fantasy_points || 0,
        scrapedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      count++;
      
      // Firestore has a 500 operation limit per batch
      if (count % 500 === 0) {
        await batch.commit();
        console.log(`  Uploaded ${count} stats...`);
      }
    }
    
    // Commit remaining operations
    if (count % 500 !== 0) {
      await batch.commit();
    }
    
    console.log(`✓ Uploaded ${count} player stats to Firebase\n`);
    
    // Mark games as scraped
    const uniqueGameIds = [...new Set(scrapedData.stats.map(s => s.game_id.toString()))];
    const gameBatch = db.batch();
    
    for (const gameId of uniqueGameIds) {
      const gameRef = db.collection('games').doc(gameId);
      gameBatch.update(gameRef, {
        scraped: true,
        scrapedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    
    await gameBatch.commit();
    console.log(`✓ Marked ${uniqueGameIds.length} games as scraped\n`);
    
    // Aggregate weekly stats for Week 1
    console.log('Aggregating Week 1 stats...');
    await aggregateWeeklyStats(1);
    
  } catch (error) {
    console.error('Error uploading stats:', error);
    process.exit(1);
  }
}

async function aggregateWeeklyStats(week) {
  console.log(`  Processing week ${week}...`);
  
  try {
    // Get all game stats for this week
    const gameStatsSnapshot = await db.collection('gameStats')
      .where('week', '==', week)
      .get();
    
    // Group by player
    const playerStats = new Map();
    
    gameStatsSnapshot.forEach(doc => {
      const data = doc.data();
      const playerId = data.playerId;
      
      if (!playerStats.has(playerId)) {
        playerStats.set(playerId, {
          playerId: playerId,
          playerName: data.playerName,
          gamesPlayed: 0,
          totalFantasyPoints: 0,
          stats: {
            fieldGoalsMade: 0,
            fieldGoalsAttempted: 0,
            threePointFieldGoalsMade: 0,
            rebounds: 0,
            assists: 0,
            steals: 0,
            blocks: 0,
            turnovers: 0,
            fouls: 0,
            points: 0
          }
        });
      }
      
      const player = playerStats.get(playerId);
      player.gamesPlayed++;
      player.totalFantasyPoints += data.fantasyPoints;
      
      // Aggregate stats
      for (const [key, value] of Object.entries(data.stats)) {
        if (key !== 'fieldGoalPercentage') {
          player.stats[key] += value;
        }
      }
    });
    
    // Calculate field goal percentage and write to weeklyStats
    const batch = db.batch();
    
    for (const [playerId, data] of playerStats.entries()) {
      const weeklyStatId = `${week}_${playerId}`;
      const docRef = db.collection('weeklyStats').doc(weeklyStatId);
      
      // Calculate weighted FG%
      const fgPct = data.stats.fieldGoalsAttempted > 0 
        ? data.stats.fieldGoalsMade / data.stats.fieldGoalsAttempted 
        : 0;
      
      batch.set(docRef, {
        weeklyStatId: weeklyStatId,
        week: week,
        playerId: playerId,
        playerName: data.playerName,
        gamesPlayed: data.gamesPlayed,
        aggregatedStats: {
          ...data.stats,
          fieldGoalPercentage: fgPct
        },
        totalFantasyPoints: data.totalFantasyPoints,
        aggregatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    
    await batch.commit();
    console.log(`  ✓ Aggregated stats for ${playerStats.size} players\n`);
    
    // Update matchups with team totals
    await updateMatchupScores(week);
    
  } catch (error) {
    console.error('Error aggregating weekly stats:', error);
  }
}

async function updateMatchupScores(week) {
  console.log(`Updating matchup scores for week ${week}...`);
  
  try {
    // Get all matchups for this week
    const matchupsSnapshot = await db.collection('matchups')
      .where('week', '==', week)
      .get();
    
    // Get all weekly stats
    const weeklyStatsSnapshot = await db.collection('weeklyStats')
      .where('week', '==', week)
      .get();
    
    const playerPoints = new Map();
    weeklyStatsSnapshot.forEach(doc => {
      const data = doc.data();
      playerPoints.set(data.playerId, data.totalFantasyPoints);
    });
    
    // Update each matchup
    for (const matchupDoc of matchupsSnapshot.docs) {
      const matchup = matchupDoc.data();
      
      // Calculate team1 points (only starting 5: G1, G2, F1, F2, FC)
      let team1Points = 0;
      for (const [spot, playerId] of Object.entries(matchup.team1Roster)) {
        if (spot !== 'Bench' && spot !== 'IR' && playerId) {
          team1Points += playerPoints.get(playerId) || 0;
        }
      }
      
      // Calculate team2 points (only starting 5: G1, G2, F1, F2, FC)
      let team2Points = 0;
      for (const [spot, playerId] of Object.entries(matchup.team2Roster)) {
        if (spot !== 'Bench' && spot !== 'IR' && playerId) {
          team2Points += playerPoints.get(playerId) || 0;
        }
      }
      
      // Determine winner
      let winner = null;
      if (team1Points > team2Points) {
        winner = matchup.team1;
      } else if (team2Points > team1Points) {
        winner = matchup.team2;
      } else {
        winner = 'tie';
      }
      
      // Update matchup
      await matchupDoc.ref.update({
        team1Points: Math.round(team1Points * 100) / 100,
        team2Points: Math.round(team2Points * 100) / 100,
        winner: winner,
        completed: true,
        completedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`  ${matchup.team1} ${team1Points.toFixed(2)} - ${team2Points.toFixed(2)} ${matchup.team2} (Winner: ${winner})`);
    }
    
    console.log(`\n✓ Updated ${matchupsSnapshot.size} matchups\n`);
    
    // Update team records
    await updateTeamRecords();
    
  } catch (error) {
    console.error('Error updating matchup scores:', error);
  }
}

async function updateTeamRecords() {
  console.log('Updating team records...');
  
  try {
    const matchupsSnapshot = await db.collection('matchups')
      .where('completed', '==', true)
      .get();
    
    const teamRecords = new Map();
    
    matchupsSnapshot.forEach(doc => {
      const matchup = doc.data();
      
      // Initialize records if needed
      if (!teamRecords.has(matchup.team1)) {
        teamRecords.set(matchup.team1, { wins: 0, losses: 0, ties: 0 });
      }
      if (!teamRecords.has(matchup.team2)) {
        teamRecords.set(matchup.team2, { wins: 0, losses: 0, ties: 0 });
      }
      
      const team1Record = teamRecords.get(matchup.team1);
      const team2Record = teamRecords.get(matchup.team2);
      
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
    const batch = db.batch();
    
    for (const [teamId, record] of teamRecords.entries()) {
      const teamRef = db.collection('teams').doc(teamId);
      batch.update(teamRef, { record: record });
    }
    
    await batch.commit();
    
    console.log('✓ Updated records for all teams\n');
    
    // Display standings
    console.log('Current Standings:');
    for (const [teamId, record] of teamRecords.entries()) {
      console.log(`  ${teamId}: ${record.wins}-${record.losses}-${record.ties}`);
    }
    
  } catch (error) {
    console.error('Error updating team records:', error);
  }
}

// Run the upload
uploadStats()
  .then(() => {
    console.log('\n✓ All Week 1 stats uploaded and processed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });