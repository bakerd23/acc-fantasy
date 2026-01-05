#!/usr/bin/env Rscript

# Initial scrape for Week 1 games (Dec 30 - Jan 4)
# This script scrapes the 16 games that have already been played

library(hoopR)
library(tidyverse)
library(jsonlite)

# Function to calculate fantasy points
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

# Week 1 game IDs (games already played)
week1_games <- c(
  "401820639", "401820637", "401820634", "401820635", # Dec 30
  "401820638", "401820641", "401820640", "401820636", # Dec 31
  "401820643", "401820642",                           # Jan 2
  "401820646", "401820649", "401820647", "401820645", # Jan 3
  "401820648", "401820644"                            # Jan 3
)

cat("Scraping Week 1 stats (16 games)...\n\n")

# Initialize list to store all game stats
all_game_stats <- list()

# Scrape each game
for (i in seq_along(week1_games)) {
  game_id <- week1_games[i]
  
  cat(sprintf("[%d/%d] Scraping game %s...\n", i, length(week1_games), game_id))
  
  tryCatch({
    # Get play-by-play data (which includes box score)
    pbp <- hoopR::espn_mbb_pbp(game_id = game_id)
    
    # Extract box score
    if (!is.null(pbp$box_score)) {
      box_score <- pbp$box_score
      
      # Calculate fantasy points
      game_stats <- calculate_fantasy_points(box_score) %>%
        mutate(
          game_id = game_id,
          week = 1
        )
      
      all_game_stats[[i]] <- game_stats
      
      cat("  ✓ Scraped", nrow(game_stats), "player stats\n")
    } else {
      cat("  ✗ No box score data available\n")
    }
    
    # Be nice to ESPN's servers
    Sys.sleep(2)
    
  }, error = function(e) {
    cat("  ✗ Error scraping game:", game_id, "-", e$message, "\n")
  })
}

# Combine all stats
if (length(all_game_stats) > 0) {
  combined_stats <- bind_rows(all_game_stats)
  
  cat("\n" , "=================================================\n")
  cat("Total player stats scraped:", nrow(combined_stats), "\n")
  cat("=================================================\n\n")
  
  # Save to JSON file for Node.js to upload to Firebase
  output_data <- list(
    week = 1,
    scrape_date = format(Sys.Date()),
    game_count = length(week1_games),
    player_stats_count = nrow(combined_stats),
    stats = combined_stats %>%
      mutate(across(where(is.numeric), ~replace_na(.x, 0))) %>%
      mutate(across(where(is.numeric), ~round(.x, 3)))
  )
  
  write_json(output_data, "week1_stats.json", auto_unbox = TRUE, pretty = TRUE)
  
  cat("✓ Week 1 stats saved to week1_stats.json\n")
  cat("  Next: Run 'node upload_week1_stats.js' to push to Firebase\n\n")
  
  # Show summary of some fantasy players
  cat("Sample stats for rostered players:\n")
  rostered_ids <- c(
    "4683629",  # Donald Hand Jr. (Baker)
    "5311829",  # Neo Avdalas (Pizza)
    "4837356",  # Tre Donaldson (Dean)
    "4685802",  # Robert McCray V (Richie)
    "5258459",  # Ebuka Okorie (Aaron)
    "4845373"   # Dai Dai Ames (Isaac)
  )
  
  sample_stats <- combined_stats %>%
    filter(athlete_id %in% rostered_ids) %>%
    group_by(athlete_id, athlete_display_name) %>%
    summarise(
      games = n(),
      total_pts = sum(points),
      total_fantasy_pts = sum(fantasy_points),
      avg_fantasy_pts = mean(fantasy_points),
      .groups = "drop"
    ) %>%
    arrange(desc(total_fantasy_pts))
  
  print(sample_stats, n = Inf)
  
} else {
  cat("\nNo stats were successfully scraped.\n")
}