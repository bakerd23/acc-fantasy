import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import "./Teams.css";

const STARTING_SLOTS = ["G1", "G2", "F1", "F2", "FC"];
const ALL_SLOTS = ["G1", "G2", "F1", "F2", "FC", "Bench", "IR"];

export default function Teams() {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  const [currentWeek, setCurrentWeek] = useState(1);
  const [selectedWeek, setSelectedWeek] = useState(1);

  const [teams, setTeams] = useState([]);
  const [playersById, setPlayersById] = useState({});
  const [playerWeekStats, setPlayerWeekStats] = useState({});

  const [editingTeam, setEditingTeam] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;

    async function loadData() {
      setStatus("loading");
      setError("");

      try {
        const [leagueSnap, teamsSnap, playersSnap, matchupsSnap] = await Promise.all([
          getDoc(doc(db, "league", "main")),
          getDocs(collection(db, "teams")),
          getDocs(collection(db, "players")),
          getDocs(collection(db, "matchups")),
        ]);

        const cw = Number(leagueSnap.data()?.currentWeek) || 1;

        // Calculate records from matchups
        const records = {};
        matchupsSnap.docs.forEach((d) => {
          const m = d.data() || {};
          if (!m.completed) return;

          const t1 = m.team1;
          const t2 = m.team2;
          
          if (!records[t1]) records[t1] = { wins: 0, losses: 0, ties: 0 };
          if (!records[t2]) records[t2] = { wins: 0, losses: 0, ties: 0 };

          const winner = String(m.winner || "");
          if (winner === t1) {
            records[t1].wins++;
            records[t2].losses++;
          } else if (winner === t2) {
            records[t2].wins++;
            records[t1].losses++;
          } else if (winner === "tie") {
            records[t1].ties++;
            records[t2].ties++;
          }
        });

        const teamsList = teamsSnap.docs.map((d) => {
          const v = d.data() || {};
          const teamId = v.teamId || d.id;
          const record = records[teamId] || { wins: 0, losses: 0, ties: 0 };
          
          return {
            id: d.id,
            teamId: teamId,
            name: v.teamName || v.owner || d.id,
            roster: v.roster || {},
            record: record,
          };
        }).sort((a, b) => a.name.localeCompare(b.name));

        const pmap = {};
        playersSnap.docs.forEach((d) => {
          const v = d.data() || {};
          const pid = String(v.playerId || d.id);
          pmap[pid] = {
            playerId: pid,
            name: v.name || pid,
            position: v.position || "?",
            teamId: v.teamId ?? null,
          };
        });

        if (!alive) return;
        setCurrentWeek(cw);
        setSelectedWeek(cw);
        setTeams(teamsList);
        setPlayersById(pmap);
        setStatus("success");
      } catch (e) {
        if (!alive) return;
        setError(e?.message || "Failed to load teams.");
        setStatus("error");
      }
    }

    loadData();
    return () => {
      alive = false;
    };
  }, []);

  const weekOptions = useMemo(() => {
    const n = Math.max(1, currentWeek);
    return Array.from({ length: n }, (_, i) => i + 1);
  }, [currentWeek]);

  useEffect(() => {
    if (status !== "success") return;

    const run = async () => {
      try {
        const statsSnap = await getDocs(
          query(collection(db, "gameStats"), where("week", "==", selectedWeek))
        );

        const statsMap = {};
        statsSnap.docs.forEach((d) => {
          const v = d.data() || {};
          const pid = String(v.playerId || "");
          if (!pid) return;

          if (!statsMap[pid]) {
            statsMap[pid] = {
              gamesPlayed: 0,
              lastGamePoints: 0,
              totalFantasyPoints: 0,
              stats: {
                points: 0,
                rebounds: 0,
                assists: 0,
                steals: 0,
                blocks: 0,
                turnovers: 0,
                fouls: 0,
                fieldGoalsMade: 0,
                fieldGoalsAttempted: 0,
                threePointFieldGoalsMade: 0,
              },
            };
          }

          statsMap[pid].gamesPlayed += 1;
          statsMap[pid].lastGamePoints = Number(v.fantasyPoints) || 0;
          statsMap[pid].totalFantasyPoints += Number(v.fantasyPoints) || 0;

          const s = v.stats || {};
          statsMap[pid].stats.points += Number(s.points) || 0;
          statsMap[pid].stats.rebounds += Number(s.rebounds) || 0;
          statsMap[pid].stats.assists += Number(s.assists) || 0;
          statsMap[pid].stats.steals += Number(s.steals) || 0;
          statsMap[pid].stats.blocks += Number(s.blocks) || 0;
          statsMap[pid].stats.turnovers += Number(s.turnovers) || 0;
          statsMap[pid].stats.fouls += Number(s.fouls) || 0;
          statsMap[pid].stats.fieldGoalsMade += Number(s.fieldGoalsMade) || 0;
          statsMap[pid].stats.fieldGoalsAttempted += Number(s.fieldGoalsAttempted) || 0;
          statsMap[pid].stats.threePointFieldGoalsMade += Number(s.threePointFieldGoalsMade) || 0;
        });

        setPlayerWeekStats(statsMap);
      } catch (e) {
        console.error("Error loading stats:", e);
      }
    };

    run();
  }, [selectedWeek, status]);

  const canEdit = selectedWeek === currentWeek;

  const getPlayerStats = (pid) => {
    if (!pid) return null;
    return playerWeekStats[String(pid)] || null;
  };

  const hasPlayedThisWeek = (pid) => {
    const stats = getPlayerStats(pid);
    return stats && stats.gamesPlayed > 0;
  };

  const canMoveToIR = (pid) => {
    const stats = getPlayerStats(pid);
    // If no stats this week, allow IR (player didn't play)
    if (!stats) return true;
    // If they played but scored 0, allow IR
    return stats.lastGamePoints === 0;
  };

  const needsToLeaveIR = (pid) => {
    const stats = getPlayerStats(pid);
    return stats && stats.lastGamePoints > 0;
  };

  const isPositionEligible = (slot, position) => {
    if (slot === "Bench" || slot === "IR") return true;
    if (slot === "G1" || slot === "G2") return position === "G";
    if (slot === "F1" || slot === "F2") return position === "F";
    if (slot === "FC") return position === "F" || position === "C";
    return false;
  };

  const handleRowClick = (teamId, slot, playerId) => {
    if (!canEdit) return;
    if (hasPlayedThisWeek(playerId)) return;

    if (editingTeam === teamId && selectedPlayer?.slot === slot) {
      setEditingTeam(null);
      setSelectedPlayer(null);
    } else {
      setEditingTeam(teamId);
      setSelectedPlayer({ slot, playerId });
    }
  };

  const handleSwap = async (teamId, targetSlot, targetPlayerId) => {
    if (!canEdit || !selectedPlayer) return;
    if (saving) return;

    const team = teams.find((t) => t.teamId === teamId);
    if (!team) return;

    const sourceSlot = selectedPlayer.slot;
    const sourcePlayerId = selectedPlayer.playerId;

    if (sourceSlot === targetSlot) {
      setEditingTeam(null);
      setSelectedPlayer(null);
      return;
    }

    // Check if target has played (only if there's a player there)
    if (targetPlayerId && hasPlayedThisWeek(targetPlayerId)) return;

    const sourcePlayer = playersById[sourcePlayerId];
    
    // If target is empty (null), only check source player eligibility for target slot
    if (!targetPlayerId) {
      if (!sourcePlayer) return;
      
      const sourcePos = sourcePlayer.position;
      
      if (!isPositionEligible(targetSlot, sourcePos)) {
        alert(`${sourcePlayer.name} (${sourcePos}) cannot be moved to ${targetSlot}.`);
        return;
      }
      
      // Check IR rules for moving TO IR
      if (targetSlot === "IR" && !canMoveToIR(sourcePlayerId)) {
        alert("Can only move players to IR if they scored 0 in their last game.");
        return;
      }
      
      // Moving source to target, leaving source slot empty
      setSaving(true);
      
      try {
        const newRoster = { ...team.roster };
        newRoster[sourceSlot] = null;
        newRoster[targetSlot] = sourcePlayerId;

        await updateDoc(doc(db, "teams", team.id), {
          roster: newRoster,
        });

        setTeams((prev) =>
          prev.map((t) =>
            t.teamId === teamId ? { ...t, roster: newRoster } : t
          )
        );

        setEditingTeam(null);
        setSelectedPlayer(null);
      } catch (e) {
        alert("Error moving player: " + e.message);
      } finally {
        setSaving(false);
      }
      
      return;
    }

    // If both slots have players, do a swap
    const targetPlayer = playersById[targetPlayerId];
    if (!sourcePlayer || !targetPlayer) return;

    const sourcePos = sourcePlayer.position;
    const targetPos = targetPlayer.position;

    if (!isPositionEligible(targetSlot, sourcePos)) {
      alert(`${sourcePlayer.name} (${sourcePos}) cannot play ${targetSlot}.`);
      return;
    }
    
    if (!isPositionEligible(sourceSlot, targetPos)) {
      alert(`${targetPlayer.name} (${targetPos}) cannot play ${sourceSlot}.`);
      return;
    }

    // Check IR rules
    if (targetSlot === "IR" && !canMoveToIR(sourcePlayerId)) {
      alert("Can only move players to IR if they scored 0 in their last game.");
      return;
    }

    if (sourceSlot === "IR" && !canMoveToIR(targetPlayerId)) {
      alert("Can only move players to IR if they scored 0 in their last game.");
      return;
    }

    setSaving(true);

    try {
      const newRoster = { ...team.roster };
      newRoster[sourceSlot] = targetPlayerId;
      newRoster[targetSlot] = sourcePlayerId;

      await updateDoc(doc(db, "teams", team.id), {
        roster: newRoster,
      });

      setTeams((prev) =>
        prev.map((t) =>
          t.teamId === teamId ? { ...t, roster: newRoster } : t
        )
      );

      setEditingTeam(null);
      setSelectedPlayer(null);
    } catch (e) {
      alert("Error swapping players: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const formatStat = (val) => {
    return val ? val.toFixed(1) : "0.0";
  };

  const formatPct = (made, attempted) => {
    if (!attempted) return ".000";
    return (made / attempted).toFixed(3);
  };

  return (
    <div className="teams-page">
      <div className="teams-header">
        <h2>Team Rosters</h2>

        <div className="week-select">
          <span>Week</span>
          <select
            value={selectedWeek}
            onChange={(e) => {
              setSelectedWeek(Number(e.target.value));
              setEditingTeam(null);
              setSelectedPlayer(null);
            }}
          >
            {weekOptions.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!canEdit && (
        <div className="past-week-notice">
          Viewing past week. Roster changes are disabled.
        </div>
      )}

      {status === "loading" && <div className="state">Loading…</div>}

      {status === "error" && (
        <div className="state error">
          Failed to load teams.
          <div className="error-detail">{error}</div>
        </div>
      )}

      {status === "success" &&
        teams.map((team) => {
          const isEditing = editingTeam === team.teamId;

          return (
            <div key={team.teamId} className="team-section">
              <h3>
                {team.name}
                <span className="team-record">
                  ({team.record.wins}-{team.record.losses}
                  {team.record.ties > 0 && `-${team.record.ties}`})
                </span>
              </h3>

              <div className="roster-table-container">
                <table className="roster-table">
                  <thead>
                    <tr>
                      <th>POS</th>
                      <th className="name-col">NAME</th>
                      <th>PTS</th>
                      <th>REB</th>
                      <th>AST</th>
                      <th>STL</th>
                      <th>BLK</th>
                      <th>FG%</th>
                      <th>3PM</th>
                      <th>TO</th>
                      <th>FOUL</th>
                      <th>FPTS</th>
                      <th>GP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ALL_SLOTS.map((slot) => {
                      const pid = team.roster[slot];
                      const player = pid ? playersById[String(pid)] : null;
                      const stats = getPlayerStats(pid);
                      const hasPlayed = hasPlayedThisWeek(pid);
                      const needsIRMove = slot === "IR" && needsToLeaveIR(pid);

                      const isSelected =
                        isEditing &&
                        selectedPlayer?.slot === slot &&
                        selectedPlayer?.playerId === pid;

                      const isClickable = canEdit && pid && !hasPlayed;

                      const isSwapTarget =
                        isEditing &&
                        selectedPlayer &&
                        selectedPlayer.slot !== slot &&
                        !hasPlayed;

                      const handleClick = () => {
                        if (isSwapTarget) {
                          handleSwap(team.teamId, slot, pid);
                        } else if (isClickable) {
                          handleRowClick(team.teamId, slot, pid);
                        }
                      };

                      const rowClass = `
                        ${!canEdit ? "past-week" : ""}
                        ${hasPlayed ? "has-played" : ""}
                        ${isSelected ? "selected" : ""}
                        ${isSwapTarget ? "swap-target" : ""}
                        ${isClickable || isSwapTarget ? "clickable" : ""}
                        ${needsIRMove ? "needs-ir-move" : ""}
                      `.trim();

                      return (
                        <tr key={slot} className={rowClass} onClick={handleClick}>
                          <td className="pos-cell">{slot}</td>
                          <td className="name-cell">
                            {player ? player.name : "—"}
                          </td>
                          <td>{stats ? formatStat(stats.stats.points) : "—"}</td>
                          <td>{stats ? formatStat(stats.stats.rebounds) : "—"}</td>
                          <td>{stats ? formatStat(stats.stats.assists) : "—"}</td>
                          <td>{stats ? formatStat(stats.stats.steals) : "—"}</td>
                          <td>{stats ? formatStat(stats.stats.blocks) : "—"}</td>
                          <td>
                            {stats
                              ? formatPct(stats.stats.fieldGoalsMade, stats.stats.fieldGoalsAttempted)
                              : "—"}
                          </td>
                          <td>{stats ? formatStat(stats.stats.threePointFieldGoalsMade) : "—"}</td>
                          <td>{stats ? formatStat(stats.stats.turnovers) : "—"}</td>
                          <td>{stats ? formatStat(stats.stats.fouls) : "—"}</td>
                          <td className="fpts-cell">
                            {stats ? formatStat(stats.totalFantasyPoints) : "—"}
                          </td>
                          <td>{stats ? stats.gamesPlayed : "0"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
    </div>
  );
}