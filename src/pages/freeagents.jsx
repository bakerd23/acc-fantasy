import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import "./freeagents.css";

export default function FreeAgents() {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  const [currentWeek, setCurrentWeek] = useState(1);
  const [selectedWeek, setSelectedWeek] = useState(1);

  const [allPlayers, setAllPlayers] = useState([]);
  const [playerWeekStats, setPlayerWeekStats] = useState({});

  const [searchTerm, setSearchTerm] = useState("");
  const [positionFilter, setPositionFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");

  useEffect(() => {
    let alive = true;

    async function loadData() {
      setStatus("loading");
      setError("");

      try {
        const [leagueSnap, teamsSnap, playersSnap] = await Promise.all([
          getDoc(doc(db, "league", "main")),
          getDocs(collection(db, "teams")),
          getDocs(collection(db, "players")),
        ]);

        const cw = Number(leagueSnap.data()?.currentWeek) || 1;

        // Build set of rostered player IDs
        const rosteredIds = new Set();
        teamsSnap.docs.forEach((d) => {
          const roster = d.data()?.roster || {};
          Object.values(roster).forEach((pid) => {
            if (pid) rosteredIds.add(String(pid));
          });
        });

        const playersList = playersSnap.docs.map((d) => {
          const v = d.data() || {};
          const pid = String(v.playerId || d.id);
          return {
            playerId: pid,
            name: v.name || pid,
            position: v.position || "?",
            teamId: v.teamId ?? null,
            isRostered: rosteredIds.has(pid),
          };
        });

        if (!alive) return;
        setCurrentWeek(cw);
        setSelectedWeek(cw);
        setAllPlayers(playersList);
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

  const weekOptions = useMemo(() => {
    const n = Math.max(1, currentWeek);
    return Array.from({ length: n }, (_, i) => i + 1);
  }, [currentWeek]);

  useEffect(() => {
    if (status !== "success") return;

    const run = async () => {
      try {
        const statsSnap = await getDocs(
          query(collection(db, "weeklyStats"), where("week", "==", selectedWeek))
        );

        const statsMap = {};
        statsSnap.docs.forEach((d) => {
          const v = d.data() || {};
          const pid = String(v.playerId || "");
          if (!pid) return;

          if (!statsMap[pid]) {
            statsMap[pid] = {
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
              threePointsMade: 0,
            };
          }

          statsMap[pid].gamesPlayed += Number(v.gamesPlayed) || 1;
          statsMap[pid].totalFantasyPoints += Number(v.totalFantasyPoints) || 0;
          statsMap[pid].totalPoints += Number(v.totalPoints) || 0;
          statsMap[pid].totalRebounds += Number(v.totalRebounds) || 0;
          statsMap[pid].totalAssists += Number(v.totalAssists) || 0;
          statsMap[pid].totalSteals += Number(v.totalSteals) || 0;
          statsMap[pid].totalBlocks += Number(v.totalBlocks) || 0;
          statsMap[pid].totalTurnovers += Number(v.totalTurnovers) || 0;
          statsMap[pid].totalFouls += Number(v.totalFouls) || 0;
          statsMap[pid].fieldGoalsMade += Number(v.fieldGoalsMade) || 0;
          statsMap[pid].fieldGoalsAttempted += Number(v.fieldGoalsAttempted) || 0;
          statsMap[pid].threePointsMade += Number(v.threePointsMade) || 0;
        });

        setPlayerWeekStats(statsMap);
      } catch (e) {
        console.error("Error loading stats:", e);
      }
    };

    run();
  }, [selectedWeek, status]);

  const freeAgents = useMemo(() => {
    return allPlayers.filter((p) => !p.isRostered);
  }, [allPlayers]);

  const filteredPlayers = useMemo(() => {
    let result = freeAgents;

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(lower));
    }

    if (positionFilter !== "ALL") {
      result = result.filter((p) => p.position === positionFilter);
    }

    result = result.map((p) => {
      const stats = playerWeekStats[p.playerId] || null;
      return { ...p, stats };
    });

    result.sort((a, b) => {
      let valA, valB;

      switch (sortBy) {
        case "name":
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
          break;
        case "position":
          valA = a.position;
          valB = b.position;
          break;
        case "fpts":
          valA = a.stats?.totalFantasyPoints || 0;
          valB = b.stats?.totalFantasyPoints || 0;
          break;
        case "gp":
          valA = a.stats?.gamesPlayed || 0;
          valB = b.stats?.gamesPlayed || 0;
          break;
        default:
          valA = 0;
          valB = 0;
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [freeAgents, searchTerm, positionFilter, sortBy, sortOrder, playerWeekStats]);

  const handleSort = (key) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(key);
      setSortOrder("desc");
    }
  };

  const formatStat = (val) => {
    return val ? val.toFixed(1) : "0.0";
  };

  const formatPct = (made, attempted) => {
    if (!attempted) return ".000";
    return (made / attempted).toFixed(3);
  };

  const hasPlayedThisWeek = (playerId) => {
    const stats = playerWeekStats[playerId];
    return stats && stats.gamesPlayed > 0;
  };

  return (
    <div className="free-agents-page">
      <div className="free-agents-header">
        <h2>Free Agents</h2>

        <div className="week-select">
          <span>Week</span>
          <select
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(Number(e.target.value))}
          >
            {weekOptions.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="filters">
        <input
          type="text"
          placeholder="Search players..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />

        <select
          value={positionFilter}
          onChange={(e) => setPositionFilter(e.target.value)}
          className="position-filter"
        >
          <option value="ALL">All Positions</option>
          <option value="G">Guards</option>
          <option value="F">Forwards</option>
          <option value="C">Centers</option>
        </select>
      </div>

      {status === "loading" && <div className="state">Loading…</div>}

      {status === "error" && (
        <div className="state error">
          Failed to load free agents.
          <div className="error-detail">{error}</div>
        </div>
      )}

      {status === "success" && (
        <div className="table-container">
          <table className="free-agents-table">
            <thead>
              <tr>
                <th onClick={() => handleSort("name")} className="sortable">
                  NAME {sortBy === "name" && (sortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th onClick={() => handleSort("position")} className="sortable">
                  POS {sortBy === "position" && (sortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th>PTS</th>
                <th>REB</th>
                <th>AST</th>
                <th>STL</th>
                <th>BLK</th>
                <th>FG%</th>
                <th>3PM</th>
                <th>TO</th>
                <th>FOUL</th>
                <th onClick={() => handleSort("fpts")} className="sortable">
                  FPTS {sortBy === "fpts" && (sortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th onClick={() => handleSort("gp")} className="sortable">
                  GP {sortBy === "gp" && (sortOrder === "asc" ? "↑" : "↓")}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredPlayers.map((player) => {
                const stats = player.stats;
                const hasPlayed = hasPlayedThisWeek(player.playerId);

                return (
                  <tr 
                    key={player.playerId}
                    className={hasPlayed ? "has-played" : ""}
                  >
                    <td className="name-cell">{player.name}</td>
                    <td className="pos-cell">{player.position}</td>
                    <td>{stats ? formatStat(stats.totalPoints) : "—"}</td>
                    <td>{stats ? formatStat(stats.totalRebounds) : "—"}</td>
                    <td>{stats ? formatStat(stats.totalAssists) : "—"}</td>
                    <td>{stats ? formatStat(stats.totalSteals) : "—"}</td>
                    <td>{stats ? formatStat(stats.totalBlocks) : "—"}</td>
                    <td>
                      {stats
                        ? formatPct(stats.fieldGoalsMade, stats.fieldGoalsAttempted)
                        : "—"}
                    </td>
                    <td>{stats ? formatStat(stats.threePointsMade) : "—"}</td>
                    <td>{stats ? formatStat(stats.totalTurnovers) : "—"}</td>
                    <td>{stats ? formatStat(stats.totalFouls) : "—"}</td>
                    <td className="fpts-cell">
                      {stats ? formatStat(stats.totalFantasyPoints) : "—"}
                    </td>
                    <td>{stats ? stats.gamesPlayed : "0"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredPlayers.length === 0 && (
            <div className="no-results">No players found</div>
          )}
        </div>
      )}
    </div>
  );
}