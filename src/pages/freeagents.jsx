import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, doc, updateDoc, addDoc, query, where, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import "./freeagents.css";

export default function FreeAgents() {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  const [currentWeek, setCurrentWeek] = useState(1);
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [playersMap, setPlayersMap] = useState({});
  const [weeklyStats, setWeeklyStats] = useState({});
  const [currentWeekStats, setCurrentWeekStats] = useState({});
  const [gamesScheduled, setGamesScheduled] = useState({});

  const [positionFilter, setPositionFilter] = useState("All");
  const [sortBy, setSortBy] = useState("ppg");
  const [sortDir, setSortDir] = useState("desc");

  const [showModal, setShowModal] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [playerToDrop, setPlayerToDrop] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;

    async function loadData() {
      setStatus("loading");
      setError("");

      try {
        // Get current week
        const leagueSnap = await getDoc(doc(db, "league", "main"));
        const cw = Number(leagueSnap.data()?.currentWeek) || 1;

        const [teamsSnap, playersSnap, statsSnap, currentWeekStatsSnap, gamesSnap] = await Promise.all([
          getDocs(collection(db, "teams")),
          getDocs(collection(db, "players")),
          getDocs(collection(db, "weeklyStats")),
          getDocs(query(collection(db, "weeklyStats"), where("week", "==", cw))),
          getDocs(query(collection(db, "games"), where("week", "==", cw))),
        ]);

        const teamsList = teamsSnap.docs
          .map((d) => {
            const v = d.data() || {};
            return {
              id: d.id,
              teamId: v.teamId || d.id,
              name: v.teamName || v.owner || d.id,
              roster: v.roster || {},
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name));

        const pmap = {};
        const playersList = playersSnap.docs.map((d) => {
          const v = d.data() || {};
          const pid = String(v.playerId || d.id);
          const p = {
            id: d.id,
            playerId: pid,
            name: v.name || "Unknown",
            position: v.position || "?",
            ncaaTeamId: v.teamId ?? null,
            status: v.status || "free_agent",
            fantasyTeam: v.fantasyTeam || null,
          };
          pmap[pid] = p;
          return p;
        });

        // Aggregate all weekly stats for each player (season totals)
        const statsMap = {};
        statsSnap.docs.forEach((d) => {
          const v = d.data() || {};
          const pid = String(v.playerId || "");
          if (!pid) return;

          if (!statsMap[pid]) {
            statsMap[pid] = {
              totalGames: 0,
              totalPoints: 0,
              totalRebounds: 0,
              totalAssists: 0,
              totalSteals: 0,
              totalBlocks: 0,
              totalTurnovers: 0,
              totalFouls: 0,
              totalFGM: 0,
              totalFGA: 0,
              total3PM: 0,
              totalFantasyPoints: 0,
            };
          }

          statsMap[pid].totalGames += Number(v.gamesPlayed) || 0;
          statsMap[pid].totalPoints += Number(v.totalPoints) || 0;
          statsMap[pid].totalRebounds += Number(v.totalRebounds) || 0;
          statsMap[pid].totalAssists += Number(v.totalAssists) || 0;
          statsMap[pid].totalSteals += Number(v.totalSteals) || 0;
          statsMap[pid].totalBlocks += Number(v.totalBlocks) || 0;
          statsMap[pid].totalTurnovers += Number(v.totalTurnovers) || 0;
          statsMap[pid].totalFouls += Number(v.totalFouls) || 0;
          statsMap[pid].totalFGM += Number(v.fieldGoalsMade) || 0;
          statsMap[pid].totalFGA += Number(v.fieldGoalsAttempted) || 0;
          statsMap[pid].total3PM += Number(v.threePointsMade) || 0;
          statsMap[pid].totalFantasyPoints += Number(v.totalFantasyPoints) || 0;
        });

        // Current week stats (for graying out)
        const currentWeekMap = {};
        currentWeekStatsSnap.docs.forEach((d) => {
          const v = d.data() || {};
          const pid = String(v.playerId || "");
          if (!pid) return;
          currentWeekMap[pid] = {
            gamesPlayed: Number(v.gamesPlayed) || 0,
          };
        });

        // Games scheduled this week (for GR calculation)
        const scheduled = {};
        gamesSnap.docs.forEach((d) => {
          const g = d.data() || {};
          const h = g.homeTeamId;
          const a = g.awayTeamId;
          if (typeof h === "number") scheduled[h] = (scheduled[h] || 0) + 1;
          if (typeof a === "number") scheduled[a] = (scheduled[a] || 0) + 1;
        });

        if (!alive) return;
        setCurrentWeek(cw);
        setTeams(teamsList);
        setPlayers(playersList);
        setPlayersMap(pmap);
        setWeeklyStats(statsMap);
        setCurrentWeekStats(currentWeekMap);
        setGamesScheduled(scheduled);
        setStatus("success");
      } catch (e) {
        if (!alive) return;
        setError(e?.message || "Failed to load free agents.");
        setStatus("error");
      }
    }

    loadData();
    return () => {
      alive = false;
    };
  }, []);

  const hasPlayedThisWeek = (playerId) => {
    const stats = currentWeekStats[playerId];
    return stats && stats.gamesPlayed > 0;
  };

  const getGamesRemaining = (playerId) => {
    const player = playersMap[playerId];
    if (!player || player.ncaaTeamId == null) return 0;
    
    const scheduled = gamesScheduled[player.ncaaTeamId] || 0;
    const stats = currentWeekStats[playerId];
    const played = stats?.gamesPlayed || 0;
    
    return Math.max(0, scheduled - played);
  };

  const freeAgents = useMemo(() => {
    return players.filter((p) => p.status === "free_agent");
  }, [players]);

  const filteredPlayers = useMemo(() => {
    let filtered = freeAgents;

    if (positionFilter !== "All") {
      filtered = filtered.filter((p) => p.position === positionFilter);
    }

    return filtered;
  }, [freeAgents, positionFilter]);

  const sortedPlayers = useMemo(() => {
    const sorted = [...filteredPlayers];

    sorted.sort((a, b) => {
      const aStats = weeklyStats[a.playerId] || {};
      const bStats = weeklyStats[b.playerId] || {};

      const aGames = aStats.totalGames || 0;
      const bGames = bStats.totalGames || 0;

      let aVal, bVal;

      switch (sortBy) {
        case "name":
          return sortDir === "asc"
            ? a.name.localeCompare(b.name)
            : b.name.localeCompare(a.name);
        case "position":
          return sortDir === "asc"
            ? a.position.localeCompare(b.position)
            : b.position.localeCompare(a.position);
        case "gr":
          aVal = getGamesRemaining(a.playerId);
          bVal = getGamesRemaining(b.playerId);
          break;
        case "ppg":
          aVal = aGames > 0 ? aStats.totalPoints / aGames : 0;
          bVal = bGames > 0 ? bStats.totalPoints / bGames : 0;
          break;
        case "rpg":
          aVal = aGames > 0 ? aStats.totalRebounds / aGames : 0;
          bVal = bGames > 0 ? bStats.totalRebounds / bGames : 0;
          break;
        case "apg":
          aVal = aGames > 0 ? aStats.totalAssists / aGames : 0;
          bVal = bGames > 0 ? bStats.totalAssists / bGames : 0;
          break;
        case "spg":
          aVal = aGames > 0 ? aStats.totalSteals / aGames : 0;
          bVal = bGames > 0 ? bStats.totalSteals / bGames : 0;
          break;
        case "bpg":
          aVal = aGames > 0 ? aStats.totalBlocks / aGames : 0;
          bVal = bGames > 0 ? bStats.totalBlocks / bGames : 0;
          break;
        case "fgpct":
          aVal = aStats.totalFGA > 0 ? aStats.totalFGM / aStats.totalFGA : 0;
          bVal = bStats.totalFGA > 0 ? bStats.totalFGM / bStats.totalFGA : 0;
          break;
        case "3pmpg":
          aVal = aGames > 0 ? aStats.total3PM / aGames : 0;
          bVal = bGames > 0 ? bStats.total3PM / bGames : 0;
          break;
        case "topg":
          aVal = aGames > 0 ? aStats.totalTurnovers / aGames : 0;
          bVal = bGames > 0 ? bStats.totalTurnovers / bGames : 0;
          break;
        case "fpg":
          aVal = aGames > 0 ? aStats.totalFouls / aGames : 0;
          bVal = bGames > 0 ? bStats.totalFouls / bGames : 0;
          break;
        default:
          return 0;
      }

      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });

    return sorted;
  }, [filteredPlayers, sortBy, sortDir, weeklyStats, playersMap, currentWeekStats, gamesScheduled]);

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortDir("desc");
    }
  };

  const handleAddClick = (player) => {
    setSelectedPlayer(player);
    setSelectedTeam("");
    setPlayerToDrop("");
    setShowModal(true);
  };

  const handleAddPlayer = async () => {
    if (!selectedTeam || !selectedPlayer) {
      alert("Please select a team.");
      return;
    }

    const team = teams.find((t) => t.teamId === selectedTeam);
    if (!team) return;

    const roster = team.roster || {};
    const activeSlots = ["G1", "G2", "F1", "F2", "FC", "Bench"];
    const activePlayers = activeSlots.filter((slot) => roster[slot]).length;

    if (activePlayers >= 6 && !playerToDrop) {
      alert("You must drop a player first.");
      return;
    }

    if (activePlayers >= 6 && playerToDrop === "none") {
      alert("You must drop a player first.");
      return;
    }

    setSaving(true);

    try {
      // Find first empty slot
      let emptySlot = null;
      for (const slot of activeSlots) {
        if (!roster[slot]) {
          emptySlot = slot;
          break;
        }
      }

      // If dropping a player, find their slot
      let dropSlot = null;
      if (playerToDrop && playerToDrop !== "none") {
        for (const slot of activeSlots) {
          if (roster[slot] === playerToDrop) {
            dropSlot = slot;
            break;
          }
        }
      }

      const slotToUse = dropSlot || emptySlot;

      if (!slotToUse) {
        alert("No available roster spot.");
        setSaving(false);
        return;
      }

      // Update team roster
      const newRoster = { ...roster };
      newRoster[slotToUse] = selectedPlayer.playerId;

      await updateDoc(doc(db, "teams", team.id), {
        roster: newRoster,
      });

      // Update added player status
      await updateDoc(doc(db, "players", selectedPlayer.id), {
        status: "rostered",
        fantasyTeam: selectedTeam,
        rosterSpot: slotToUse,
      });

      // Update dropped player status and get name (if any)
      let droppedPlayerName = null;
      if (playerToDrop && playerToDrop !== "none") {
        const droppedPlayer = players.find((p) => p.playerId === playerToDrop);
        if (droppedPlayer) {
          droppedPlayerName = droppedPlayer.name;
          await updateDoc(doc(db, "players", droppedPlayer.id), {
            status: "free_agent",
            fantasyTeam: null,
            rosterSpot: null,
          });
        }
      }

      // Log transaction
      await addDoc(collection(db, "transactions"), {
        type: "add",
        teamId: selectedTeam,
        teamName: team.name,
        playerAdded: selectedPlayer.name,
        playerAddedId: selectedPlayer.playerId,
        playerDropped: droppedPlayerName,
        playerDroppedId: playerToDrop && playerToDrop !== "none" ? playerToDrop : null,
        timestamp: new Date(),
      });

      // Refresh data
      const leagueSnap = await getDoc(doc(db, "league", "main"));
      const cw = Number(leagueSnap.data()?.currentWeek) || 1;

      const [teamsSnap, playersSnap, currentWeekStatsSnap, gamesSnap] = await Promise.all([
        getDocs(collection(db, "teams")),
        getDocs(collection(db, "players")),
        getDocs(query(collection(db, "weeklyStats"), where("week", "==", cw))),
        getDocs(query(collection(db, "games"), where("week", "==", cw))),
      ]);

      const teamsList = teamsSnap.docs
        .map((d) => {
          const v = d.data() || {};
          return {
            id: d.id,
            teamId: v.teamId || d.id,
            name: v.teamName || v.owner || d.id,
            roster: v.roster || {},
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      const pmap = {};
      const playersList = playersSnap.docs.map((d) => {
        const v = d.data() || {};
        const pid = String(v.playerId || d.id);
        const p = {
          id: d.id,
          playerId: pid,
          name: v.name || "Unknown",
          position: v.position || "?",
          ncaaTeamId: v.teamId ?? null,
          status: v.status || "free_agent",
          fantasyTeam: v.fantasyTeam || null,
        };
        pmap[pid] = p;
        return p;
      });

      const currentWeekMap = {};
      currentWeekStatsSnap.docs.forEach((d) => {
        const v = d.data() || {};
        const pid = String(v.playerId || "");
        if (!pid) return;
        currentWeekMap[pid] = {
          gamesPlayed: Number(v.gamesPlayed) || 0,
        };
      });

      const scheduled = {};
      gamesSnap.docs.forEach((d) => {
        const g = d.data() || {};
        const h = g.homeTeamId;
        const a = g.awayTeamId;
        if (typeof h === "number") scheduled[h] = (scheduled[h] || 0) + 1;
        if (typeof a === "number") scheduled[a] = (scheduled[a] || 0) + 1;
      });

      setTeams(teamsList);
      setPlayers(playersList);
      setPlayersMap(pmap);
      setCurrentWeekStats(currentWeekMap);
      setGamesScheduled(scheduled);
      setShowModal(false);
      setSelectedPlayer(null);
      setSelectedTeam("");
      setPlayerToDrop("");
    } catch (e) {
      alert("Error adding player: " + e.message);
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

  const getDroppablePlayers = () => {
    if (!selectedTeam) return [];

    const team = teams.find((t) => t.teamId === selectedTeam);
    if (!team) return [];

    const roster = team.roster || {};
    const activeSlots = ["G1", "G2", "F1", "F2", "FC", "Bench"];

    return activeSlots
      .map((slot) => {
        const pid = roster[slot];
        if (!pid) return null;
        const player = players.find((p) => p.playerId === pid);
        // Don't allow dropping players who have already played this week
        if (player && hasPlayedThisWeek(pid)) return null;
        return player ? { ...player, slot } : null;
      })
      .filter(Boolean);
  };

  const droppablePlayers = getDroppablePlayers();
  const needsToDrop = selectedTeam && droppablePlayers.length >= 6;

  return (
    <div className="free-agents-page">
      <div className="fa-header">
        <h2>Free Agents</h2>

        <div className="fa-filters">
          <label>
            Position:
            <select
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value)}
            >
              <option value="All">All</option>
              <option value="G">G</option>
              <option value="F">F</option>
              <option value="C">C</option>
            </select>
          </label>
        </div>
      </div>

      {status === "loading" && <div className="state">Loading…</div>}

      {status === "error" && (
        <div className="state error">
          Failed to load free agents.
          <div className="error-detail">{error}</div>
        </div>
      )}

      {status === "success" && (
        <div className="fa-table-container">
          <table className="fa-table">
            <thead>
              <tr>
                <th className="add-col"></th>
                <th onClick={() => handleSort("name")} className="sortable">
                  Name {sortBy === "name" && (sortDir === "asc" ? "▲" : "▼")}
                </th>
                <th onClick={() => handleSort("position")} className="sortable">
                  Pos {sortBy === "position" && (sortDir === "asc" ? "▲" : "▼")}
                </th>
                <th onClick={() => handleSort("gr")} className="sortable">
                  GR {sortBy === "gr" && (sortDir === "asc" ? "▲" : "▼")}
                </th>
                <th onClick={() => handleSort("ppg")} className="sortable">
                  PPG {sortBy === "ppg" && (sortDir === "asc" ? "▲" : "▼")}
                </th>
                <th onClick={() => handleSort("rpg")} className="sortable">
                  RPG {sortBy === "rpg" && (sortDir === "asc" ? "▲" : "▼")}
                </th>
                <th onClick={() => handleSort("apg")} className="sortable">
                  APG {sortBy === "apg" && (sortDir === "asc" ? "▲" : "▼")}
                </th>
                <th onClick={() => handleSort("spg")} className="sortable">
                  SPG {sortBy === "spg" && (sortDir === "asc" ? "▲" : "▼")}
                </th>
                <th onClick={() => handleSort("bpg")} className="sortable">
                  BPG {sortBy === "bpg" && (sortDir === "asc" ? "▲" : "▼")}
                </th>
                <th onClick={() => handleSort("fgpct")} className="sortable">
                  FG% {sortBy === "fgpct" && (sortDir === "asc" ? "▲" : "▼")}
                </th>
                <th onClick={() => handleSort("3pmpg")} className="sortable">
                  3PMPG {sortBy === "3pmpg" && (sortDir === "asc" ? "▲" : "▼")}
                </th>
                <th onClick={() => handleSort("topg")} className="sortable">
                  TOPG {sortBy === "topg" && (sortDir === "asc" ? "▲" : "▼")}
                </th>
                <th onClick={() => handleSort("fpg")} className="sortable">
                  FPG {sortBy === "fpg" && (sortDir === "asc" ? "▲" : "▼")}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedPlayers.map((player) => {
                const stats = weeklyStats[player.playerId] || {};
                const gp = stats.totalGames || 0;
                const hasPlayed = hasPlayedThisWeek(player.playerId);
                const gr = getGamesRemaining(player.playerId);

                const ppg = gp > 0 ? stats.totalPoints / gp : 0;
                const rpg = gp > 0 ? stats.totalRebounds / gp : 0;
                const apg = gp > 0 ? stats.totalAssists / gp : 0;
                const spg = gp > 0 ? stats.totalSteals / gp : 0;
                const bpg = gp > 0 ? stats.totalBlocks / gp : 0;
                const fgpct =
                  stats.totalFGA > 0 ? stats.totalFGM / stats.totalFGA : 0;
                const tpmpg = gp > 0 ? stats.total3PM / gp : 0;
                const topg = gp > 0 ? stats.totalTurnovers / gp : 0;
                const fpg = gp > 0 ? stats.totalFouls / gp : 0;

                return (
                  <tr key={player.playerId} className={hasPlayed ? "has-played" : ""}>
                    <td className="add-col">
                      <button
                        className="add-btn"
                        onClick={() => handleAddClick(player)}
                        title="Add player"
                      >
                        +
                      </button>
                    </td>
                    <td className="name-cell">{player.name}</td>
                    <td>{player.position}</td>
                    <td>{gr}</td>
                    <td>{formatStat(ppg)}</td>
                    <td>{formatStat(rpg)}</td>
                    <td>{formatStat(apg)}</td>
                    <td>{formatStat(spg)}</td>
                    <td>{formatStat(bpg)}</td>
                    <td>{formatPct(stats.totalFGM, stats.totalFGA)}</td>
                    <td>{formatStat(tpmpg)}</td>
                    <td>{formatStat(topg)}</td>
                    <td>{formatStat(fpg)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && selectedPlayer && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Add {selectedPlayer.name}</h3>

            <div className="modal-field">
              <label>Select Team:</label>
              <select
                value={selectedTeam}
                onChange={(e) => {
                  setSelectedTeam(e.target.value);
                  setPlayerToDrop("");
                }}
              >
                <option value="">-- Select Team --</option>
                {teams.map((team) => (
                  <option key={team.teamId} value={team.teamId}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedTeam && (
              <div className="modal-field">
                <label>
                  {needsToDrop ? "Drop Player:" : "Drop Player (optional):"}
                </label>
                <select
                  value={playerToDrop}
                  onChange={(e) => setPlayerToDrop(e.target.value)}
                >
                  <option value="">-- Select --</option>
                  {!needsToDrop && <option value="none">Don't drop anyone</option>}
                  {droppablePlayers.map((p) => (
                    <option key={p.playerId} value={p.playerId}>
                      {p.name} ({p.slot})
                    </option>
                  ))}
                </select>
                {selectedTeam && droppablePlayers.length === 0 && (
                  <div style={{color: '#d32f2f', fontSize: '0.9rem', marginTop: '0.5rem'}}>
                    All players have already played this week and cannot be dropped
                  </div>
                )}
              </div>
            )}

            <div className="modal-actions">
              <button
                className="btn-cancel"
                onClick={() => setShowModal(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className="btn-confirm"
                onClick={handleAddPlayer}
                disabled={saving || !selectedTeam || (needsToDrop && !playerToDrop)}
              >
                {saving ? "Adding..." : "Add Player"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}