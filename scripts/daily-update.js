import admin from 'firebase-admin';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';

// Initialize Firebase
const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Check which games need stats
async function getGamesNeedingStats() {
  console.log('\nChecking for games needing stats...\n');
  
  // Get current week
  const leagueDoc = await db.collection('league').doc('main').get();
  const currentWeek = leagueDoc.data()?.currentWeek || 1;
  
  console.log(`Current week: ${currentWeek}`);
  
  // Get all games for current week
  const gamesSnapshot = await db.collection('games')
    .where('week', '==', currentWeek)
    .get();
  
  console.log(`Total games scheduled for Week ${currentWeek}: ${gamesSnapshot.size}`);
  
  const allGameIds = [];
  gamesSnapshot.forEach(doc => {
    allGameIds.push(doc.data().gameId);
  });
  
  // Check which games don't have stats yet
  // We'll check if ANY stats exist for this week for these games
  const statsSnapshot = await db.collection('weeklyStats')
    .where('week', '==', currentWeek)
    .get();
  
  const gamesWithStats = new Set();
  const statsData = JSON.parse(existsSync('daily_stats.json') ? readFileSync('daily_stats.json', 'utf8') : '{"stats":[]}');
  
  // Track which games we've already processed from previous runs
  statsSnapshot.forEach(doc => {
    // We can't directly know gameId, but if we have stats for this week, we've processed some games
  });
  
  // For simplicity, we'll try to scrape all games and let R handle duplicates
  // Or we can be smarter about it
  const gamesNeedingStats = allGameIds; // Scrape all, R will handle it
  
  return { games: gamesNeedingStats, week: currentWeek, totalGames: allGameIds.length };
}

// Create R script to scrape games
function createScrapeScript(gameIds, week) {
  const rScript = `
#!/usr/bin/env Rscript

library(hoopR)
library(tidyverse)
library(jsonlite)

calculate_fantasy_points <- function(game_box) {
  game_box %>%
    mutate(
      field_goal_percentage = ifelse(
        field_goals_attempted > 0,
        field_goals_made / field_goals_attempted,
        0
      )
    ) %>%
    select(
      game_id, athlete_id, athlete_display_name, team_id,
      field_goals_made, field_goals_attempted, field_goal_percentage,
      three_point_field_goals_made, rebounds, assists, steals, blocks,
      turnovers, fouls, points
    ) %>%
    mutate(
      fantasy_points = points + 
        1.5 * rebounds + 
        1.5 * assists +
        10 * field_goal_percentage + 
        2 * steals + 
        2 * blocks +
        three_point_field_goals_made / 2 - 
        2 * turnovers - 
        fouls
    ) %>%
    mutate(across(everything(), ~replace_na(.x, 0)))
}

games <- c(${gameIds.map(id => `"${id}"`).join(', ')})

cat("Scraping", length(games), "games...\\n\\n")

all_game_stats <- list()

for (i in seq_along(games)) {
  game_id <- games[i]
  
  cat(sprintf("[%d/%d] Scraping game %s...\\n", i, length(games), game_id))
  
  tryCatch({
    box_score <- hoopR::espn_mbb_player_box(game_id = game_id)
    
    if (!is.null(box_score) && nrow(box_score) > 0) {
      game_stats <- calculate_fantasy_points(box_score) %>%
        mutate(
          game_id = game_id,
          week = ${week}
        )
      
      all_game_stats[[i]] <- game_stats
      
      cat("  ✓ Scraped", nrow(game_stats), "player stats\\n")
    } else {
      cat("  ✗ No box score data available\\n")
    }
    
    Sys.sleep(2)
    
  }, error = function(e) {
    cat("  ✗ Error scraping game:", game_id, "-", e$message, "\\n")
  })
}

if (length(all_game_stats) > 0) {
  combined_stats <- bind_rows(all_game_stats)
  
  output_data <- list(
    week = ${week},
    scrape_date = format(Sys.Date()),
    game_count = length(games),
    player_stats_count = nrow(combined_stats),
    stats = combined_stats %>%
      mutate(across(where(is.numeric), ~replace_na(.x, 0))) %>%
      mutate(across(where(is.numeric), ~round(.x, 3)))
  )
  
  write_json(output_data, "daily_stats.json", auto_unbox = TRUE, pretty = TRUE)
  
  cat("\\n✓ Stats saved to daily_stats.json\\n")
} else {
  cat("\\nNo stats were successfully scraped.\\n")
}
`;

  writeFileSync('scrape_daily.R', rScript);
}

// Upload stats to Firebase
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

// Update matchup scores
async function updateMatchupScores(week) {
  console.log(`Updating Week ${week} matchup scores...\n`);
  
  const matchupsSnapshot = await db.collection('matchups')
    .where('week', '==', week)
    .get();
  
  for (const matchupDoc of matchupsSnapshot.docs) {
    const matchup = matchupDoc.data();
    
    // Get rosters
    const team1Doc = await db.collection('teams').doc(matchup.team1).get();
    const team2Doc = await db.collection('teams').doc(matchup.team2).get();
    
    const team1Roster = team1Doc.data()?.roster || {};
    const team2Roster = team2Doc.data()?.roster || {};
    
    // Calculate scores
    const startingPositions = ['G1', 'G2', 'F1', 'F2', 'FC'];
    
    let team1Points = 0;
    for (const pos of startingPositions) {
      const playerId = team1Roster[pos];
      if (playerId) {
        const statsSnapshot = await db.collection('weeklyStats')
          .where('playerId', '==', String(playerId))
          .where('week', '==', week)
          .get();
        
        statsSnapshot.forEach(doc => {
          team1Points += doc.data().totalFantasyPoints || 0;
        });
      }
    }
    
    let team2Points = 0;
    for (const pos of startingPositions) {
      const playerId = team2Roster[pos];
      if (playerId) {
        const statsSnapshot = await db.collection('weeklyStats')
          .where('playerId', '==', String(playerId))
          .where('week', '==', week)
          .get();
        
        statsSnapshot.forEach(doc => {
          team2Points += doc.data().totalFantasyPoints || 0;
        });
      }
    }
    
    // Update matchup
    await db.collection('matchups').doc(matchupDoc.id).update({
      team1Points: team1Points,
      team2Points: team2Points
    });
    
    console.log(`  ${matchup.team1}: ${team1Points.toFixed(2)} vs ${matchup.team2}: ${team2Points.toFixed(2)}`);
  }
  
  console.log('✓ Matchup scores updated\n');
}

// Check if week should advance based on calendar
async function checkAndAdvanceWeek() {
  console.log('Checking if week should advance...\n');
  
  const leagueDoc = await db.collection('league').doc('main').get();
  const leagueData = leagueDoc.data();
  const currentWeek = leagueData?.currentWeek || 1;
  const seasonStartDate = leagueData?.seasonStartDate; // Expected format: "2025-01-13" (YYYY-MM-DD)
  
  if (!seasonStartDate) {
    console.log('⚠️  No seasonStartDate found in league document. Cannot determine week advancement.');
    console.log('Please add seasonStartDate to your league/main document in format YYYY-MM-DD\n');
    return false;
  }
  
  // Get current date in EST
  const now = new Date();
  const estOffset = -5; // EST is UTC-5
  const utcDate = new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
  const estDate = new Date(utcDate.getTime() + (estOffset * 3600000));
  
  // Parse season start date
  const seasonStart = new Date(seasonStartDate + 'T00:00:00-05:00'); // EST
  
  // Calculate days since season start
  const daysSinceStart = Math.floor((estDate - seasonStart) / (1000 * 60 * 60 * 24));
  
  // Calculate expected week (weeks start on Monday, so we use 7-day periods)
  const expectedWeek = Math.floor(daysSinceStart / 7) + 1;
  
  console.log(`Season started: ${seasonStartDate}`);
  console.log(`Current date (EST): ${estDate.toISOString().split('T')[0]}`);
  console.log(`Days since season start: ${daysSinceStart}`);
  console.log(`Current week in DB: ${currentWeek}`);
  console.log(`Expected week based on calendar: ${expectedWeek}`);
  
  if (expectedWeek > currentWeek) {
    console.log('\n✓ New week has started! Finalizing previous week and advancing...\n');
    
    // Update matchup scores for the PREVIOUS week (the one that just ended)
    await updateMatchupScores(currentWeek);
    
    // Finalize matchups for the previous week - set winners
    const matchupsSnapshot = await db.collection('matchups')
      .where('week', '==', currentWeek)
      .get();
    
    const batch = db.batch();
    
    matchupsSnapshot.forEach(doc => {
      const matchup = doc.data();
      const team1Points = matchup.team1Points || 0;
      const team2Points = matchup.team2Points || 0;
      
      let winner = null;
      if (team1Points > team2Points) {
        winner = matchup.team1;
      } else if (team2Points > team1Points) {
        winner = matchup.team2;
      }
      // If tied, winner stays null
      
      batch.update(doc.ref, {
        completed: true,
        winner: winner
      });
      
      console.log(`  Finalized: ${matchup.team1} (${team1Points.toFixed(2)}) vs ${matchup.team2} (${team2Points.toFixed(2)}) - Winner: ${winner || 'TIE'}`);
    });
    
    await batch.commit();
    
    // Advance to next week
    await db.collection('league').doc('main').update({
      currentWeek: expectedWeek
    });
    
    console.log(`\n✓ Advanced from Week ${currentWeek} to Week ${expectedWeek}\n`);
    
    return true;
  } else if (expectedWeek < currentWeek) {
    console.log(`\n⚠️  Warning: Expected week (${expectedWeek}) is behind current week (${currentWeek})`);
    console.log('This might indicate an issue with your seasonStartDate\n');
    return false;
  } else {
    console.log(`\nWeek ${currentWeek} is still in progress\n`);
    return false;
  }
}

// Main function
async function main() {
  try {
    console.log('='.repeat(60));
    console.log('DAILY STATS UPDATE');
    console.log('='.repeat(60));
    
    // First, check if we need to advance the week
    // This runs BEFORE scraping to ensure we're scraping for the correct week
    const advanced = await checkAndAdvanceWeek();
    
    if (advanced) {
      console.log('Week was advanced. Stats will be collected for the new week.\n');
    }
    
    // Get games needing stats (for current week, which may have just been updated)
    const { games, week, totalGames } = await getGamesNeedingStats();
    
    if (games.length === 0) {
      console.log('No games scheduled for this week yet, or all stats already collected\n');
    } else {
      console.log(`Found ${games.length} games to scrape for Week ${week}`);
      console.log('Game IDs:', games.join(', '), '\n');
      
      // Create and run R scrape script
      createScrapeScript(games, week);
      
      console.log('Running R scrape script...\n');
      execSync('Rscript scrape_daily.R', { stdio: 'inherit' });
      
      // Upload stats
      const uploaded = await uploadStats();
      
      if (uploaded) {
        // Update matchup scores for CURRENT week
        await updateMatchupScores(week);
      }
    }
    
    console.log('='.repeat(60));
    console.log('DAILY UPDATE COMPLETE');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('Error in daily update:', error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });