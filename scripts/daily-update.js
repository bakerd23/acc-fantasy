async function uploadStats() {
  if (!existsSync('daily_stats.json')) {
    console.log('No stats file found - no games to upload\n');
    return false;
  }

  const data = JSON.parse(readFileSync('daily_stats.json', 'utf8'));
  
  console.log(`\nAggregating and uploading player stats for Week ${data.week}...\n`);
  
  // First, aggregate stats by player
  const playerStats = {};
  
  for (const stat of data.stats) {
    const pid = String(stat.athlete_id);
    
    if (!playerStats[pid]) {
      playerStats[pid] = {
        playerId: pid,
        week: data.week,
        gamesPlayed: 0,
        totalFantasyPoints: 0,
        totalPoints: 0,
        totalRebounds: 0,
        totalAssists: 0,
        totalSteals: 0,
        totalBlocks: 0,
        totalTurnovers: 0,
        totalFouls: 0,
        fieldGoalsMade: 0,
        fieldGoalsAttempted: 0,
        threePointsMade: 0
      };
    }
    
    playerStats[pid].gamesPlayed += 1;
    playerStats[pid].totalFantasyPoints += stat.fantasy_points;
    playerStats[pid].totalPoints += stat.points;
    playerStats[pid].totalRebounds += stat.rebounds;
    playerStats[pid].totalAssists += stat.assists;
    playerStats[pid].totalSteals += stat.steals;
    playerStats[pid].totalBlocks += stat.blocks;
    playerStats[pid].totalTurnovers += stat.turnovers;
    playerStats[pid].totalFouls += stat.fouls;
    playerStats[pid].fieldGoalsMade += stat.field_goals_made;
    playerStats[pid].fieldGoalsAttempted += stat.field_goals_attempted;
    playerStats[pid].threePointsMade += stat.three_point_field_goals_made;
  }
  
  const batch = db.batch();
  let count = 0;
  
  for (const pid in playerStats) {
    const docId = `${data.week}_${pid}`;
    const docRef = db.collection('weeklyStats').doc(docId);
    
    batch.set(docRef, playerStats[pid], { merge: true }); // Use merge to add to existing
    
    count++;
    
    if (count % 500 === 0) {
      await batch.commit();
      console.log(`✓ Committed batch of ${count} players`);
    }
  }
  
  if (count % 500 !== 0) {
    await batch.commit();
  }
  
  console.log(`✓ Successfully uploaded ${count} player weekly stats\n`);
  return true;
}