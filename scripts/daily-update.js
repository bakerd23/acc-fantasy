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
  const gamesNeedingStats = [];
  
  for (const gameId of allGameIds) {
    const statsSnapshot = await db.collection('weeklyStats')
      .where('gameId', '==', String(gameId))
      .where('week', '==', currentWeek)
      .limit(1)
      .get();
    
    if (statsSnapshot.empty) {
      gamesNeedingStats.push(gameId);
    }
  }
  
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
  
  console.log(`\nUploading ${data.player_stats_count} player stats...\n`);
  
  const batch = db.batch();
  let count = 0;
  
  for (const stat of data.stats) {
    const docId = `${data.week}_${stat.athlete_id}_${stat.game_id}`;
    const docRef = db.collection('weeklyStats').doc(docId);
    
    batch.set(docRef, {
      playerId: String(stat.athlete_id),
      week: data.week,
      gameId: String(stat.game_id),
      gamesPlayed: 1,
      totalFantasyPoints: stat.fantasy_points,
      totalPoints: stat.points,
      totalRebounds: stat.rebounds,
      totalAssists: stat.assists,
      totalSteals: stat.steals,
      totalBlocks: stat.blocks,
      totalTurnovers: stat.turnovers,
      totalFouls: stat.fouls,
      fieldGoalsMade: stat.field_goals_made,
      fieldGoalsAttempted: stat.field_goals_attempted,
      threePointsMade: stat.three_point_field_goals_made
    });
    
    count++;
    
    if (count % 500 === 0) {
      await batch.commit();
      console.log(`✓ Committed batch of ${count} stats`);
    }
  }
  
  if (count % 500 !== 0) {
    await batch.commit();
  }
  
  console.log(`✓ Successfully uploaded ${count} player stats\n`);
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

// Check if week is complete and advance if needed
async function checkAndAdvanceWeek() {
  console.log('Checking if week is complete...\n');
  
  const leagueDoc = await db.collection('league').doc('main').get();
  const currentWeek = leagueDoc.data()?.currentWeek || 1;
  
  // Get all games for current week
  const gamesSnapshot = await db.collection('games')
    .where('week', '==', currentWeek)
    .get();
  
  const totalGames = gamesSnapshot.size;
  
  // Check how many games have stats
  let gamesWithStats = 0;
  const gameIds = [];
  
  gamesSnapshot.forEach(doc => {
    gameIds.push(doc.data().gameId);
  });
  
  for (const gameId of gameIds) {
    const statsSnapshot = await db.collection('weeklyStats')
      .where('gameId', '==', String(gameId))
      .where('week', '==', currentWeek)
      .limit(1)
      .get();
    
    if (!statsSnapshot.empty) {
      gamesWithStats++;
    }
  }
  
  console.log(`Games with stats: ${gamesWithStats}/${totalGames}`);
  
  // If all games have stats, week is complete
  if (gamesWithStats === totalGames && totalGames > 0) {
    console.log('\n✓ Week is complete! Finalizing matchups and advancing...\n');
    
    // Finalize matchups - set winners
    const matchupsSnapshot = await db.collection('matchups')
      .where('week', '==', currentWeek)
      .get();
    
    const batch = db.batch();
    
    matchupsSnapshot.forEach(doc => {
      const matchup = doc.data();
      const team1Points = matchup.team1Points || 0;
      const team2Points = matchup.team2Points || 0;
      
      batch.update(doc.ref, {
        completed: true,
        winner: team1Points > team2Points ? matchup.team1 : matchup.team2
      });
      
      console.log(`  Finalized: ${matchup.team1} vs ${matchup.team2} - Winner: ${team1Points > team2Points ? matchup.team1 : matchup.team2}`);
    });
    
    await batch.commit();
    
    // Advance to next week
    await db.collection('league').doc('main').update({
      currentWeek: currentWeek + 1
    });
    
    console.log(`\n✓ Advanced to Week ${currentWeek + 1}\n`);
    
    return true;
  } else {
    console.log('\nWeek is still in progress\n');
    return false;
  }
}

// Main function
async function main() {
  try {
    console.log('='.repeat(60));
    console.log('DAILY STATS UPDATE');
    console.log('='.repeat(60));
    
    // Get games needing stats
    const { games, week, totalGames } = await getGamesNeedingStats();
    
    if (games.length === 0) {
      console.log('All games already have stats uploaded\n');
      await checkAndAdvanceWeek();
      return;
    }
    
    console.log(`Found ${games.length} games needing stats out of ${totalGames} total`);
    console.log('Game IDs:', games.join(', '), '\n');
    
    // Create and run R scrape script
    createScrapeScript(games, week);
    
    console.log('Running R scrape script...\n');
    execSync('Rscript scrape_daily.R', { stdio: 'inherit' });
    
    // Upload stats
    const uploaded = await uploadStats();
    
    if (uploaded) {
      // Update matchup scores
      await updateMatchupScores(week);
    }
    
    // Check if week is complete
    await checkAndAdvanceWeek();
    
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