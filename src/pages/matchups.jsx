import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import "./matchups.css";

const SLOT_ORDER = ["G1", "G2", "F1", "F2", "FC", "Bench", "IR"];

function fmtPts(x) {
  const n = Number(x) || 0;
  return n.toFixed(2);
}

function fmtStat(x) {
  const n = Number(x) || 0;
  return n.toFixed(1);
}

export default function Matchups() {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  const [currentWeek, setCurrentWeek] = useState(1);
  const [selectedWeek, setSelectedWeek] = useState(1);

  const [teamsById, setTeamsById] = useState({});
  const [playersById, setPlayersById] = useState({});
  const [playerWeek, setPlayerWeek] = useState({}); // { [playerId]: { pts, gp, reb, ast, stl, blk, to, fgPct, tpm, fouls } }
  const [gamesByNcaateamWeek, setGamesByNcaateamWeek] = useState({}); // { [teamIdNum]: scheduledCount }
  const [matchups, setMatchups] = useState([]);

  useEffect(() => {
    let alive = true;

    async function loadBase() {
      setStatus("loading");
      setError("");

      try {
        const leagueSnap = await getDoc(doc(db, "league", "main"));
        const leagueData = leagueSnap.data() || {};
        const cw = Number(leagueData.currentWeek) || 1;

        const [teamsSnap, playersSnap] = await Promise.all([
          getDocs(collection(db, "teams")),
          getDocs(collection(db, "players")),
        ]);

        const tmap = {};
        teamsSnap.docs.forEach((d) => {
          const v = d.data() || {};
          const key = v.teamId || d.id;
          tmap[key] = {
            id: d.id,
            teamId: key,
            name: v.teamName || v.owner || key,
            roster: v.roster || {},
          };
        });

        const pmap = {};
        playersSnap.docs.forEach((d) => {
          const v = d.data() || {};
          const pid = String(v.playerId || d.id);
          pmap[pid] = {
            playerId: pid,
            name: v.name || pid,
            teamId: v.teamId ?? null, // NCAA teamId (number)
          };
        });

        if (!alive) return;
        setCurrentWeek(cw);
        setSelectedWeek(cw);
        setTeamsById(tmap);
        setPlayersById(pmap);
        setStatus("success");
      } catch (e) {
        if (!alive) return;
        setError(e?.message || "Failed to load matchups.");
        setStatus("error");
      }
    }

    loadBase();
    return () => {
      alive = false;
    };
  }, []);

  const weekOptions = useMemo(() => {
    const maxWeek = 10;
    return Array.from({ length: maxWeek }, (_, i) => i + 1);
  }, []);

  useEffect(() => {
    if (status !== "success") return;

    const run = async () => {
      try {
        const [matchupsSnap, weeklySnap, gamesSnap, teamsSnap] = await Promise.all([
          getDocs(query(collection(db, "matchups"), where("week", "==", selectedWeek))),
          getDocs(query(collection(db, "weeklyStats"), where("week", "==", selectedWeek))),
          getDocs(query(collection(db, "games"), where("week", "==", selectedWeek))),
          getDocs(collection(db, "teams")),
        ]);

        const tmap = {};
        teamsSnap.docs.forEach((d) => {
          const v = d.data() || {};
          const key = v.teamId || d.id;
          tmap[key] = {
            id: d.id,
            teamId: key,
            name: v.teamName || v.owner || key,
            roster: v.roster || {},
          };
        });
        setTeamsById(tmap);

        const weekMatchups = matchupsSnap.docs
          .map((d) => d.data() || {})
          .sort((a, b) =>
            String(a.matchupId || "").localeCompare(String(b.matchupId || ""))
          );
        setMatchups(weekMatchups);

        const pw = {};
        weeklySnap.docs.forEach((d) => {
          const v = d.data() || {};
          const pid = String(v.playerId || "");
          if (!pid) return;
          
          // Initialize if doesn't exist
          if (!pw[pid]) {
            pw[pid] = {
              pts: 0,
              gp: 0,
              points: 0,
              reb: 0,
              ast: 0,
              stl: 0,
              blk: 0,
              to: 0,
              fouls: 0,
              tpm: 0,
              fgMade: 0,
              fgAttempted: 0
            };
          }
          
          // ACCUMULATE stats
          pw[pid].pts += Number(v.totalFantasyPoints) || 0;
          pw[pid].gp += Number(v.gamesPlayed) || 0;
          pw[pid].points += Number(v.totalPoints) || 0;
          pw[pid].reb += Number(v.totalRebounds) || 0;
          pw[pid].ast += Number(v.totalAssists) || 0;
          pw[pid].stl += Number(v.totalSteals) || 0;
          pw[pid].blk += Number(v.totalBlocks) || 0;
          pw[pid].to += Number(v.totalTurnovers) || 0;
          pw[pid].fouls += Number(v.totalFouls) || 0;
          pw[pid].tpm += Number(v.threePointsMade) || 0;
          pw[pid].fgMade += Number(v.fieldGoalsMade) || 0;
          pw[pid].fgAttempted += Number(v.fieldGoalsAttempted) || 0;
        });

        // Calculate FG% after accumulation
        Object.keys(pw).forEach(pid => {
          const fgMade = pw[pid].fgMade;
          const fgAttempted = pw[pid].fgAttempted;
          pw[pid].fgPct = fgAttempted > 0 ? ((fgMade / fgAttempted) * 100).toFixed(1) : "0.0";
        });
        setPlayerWeek(pw);

        const scheduled = {};
        gamesSnap.docs.forEach((d) => {
          const g = d.data() || {};
          const h = g.homeTeamId;
          const a = g.awayTeamId;
          if (typeof h === "number") scheduled[h] = (scheduled[h] || 0) + 1;
          if (typeof a === "number") scheduled[a] = (scheduled[a] || 0) + 1;
        });
        setGamesByNcaateamWeek(scheduled);
      } catch (e) {
        setError(e?.message || "Failed to load matchups.");
        setStatus("error");
      }
    };

    run();
  }, [selectedWeek, status]);

  const getPlayerName = (pid) => {
    if (!pid) return "—";
    const key = String(pid);
    return playersById[key]?.name || key;
  };

  const getPlayerStats = (pid) => {
    if (!pid) return null;
    const key = String(pid);
    return playerWeek[key] || null;
  };

  const getPlayerNcaateamId = (pid) => {
    if (!pid) return null;
    const key = String(pid);
    const t = playersById[key]?.teamId;
    return typeof t === "number" ? t : null;
  };

  const getPlayerGamesRemaining = (pid) => {
    if (!pid) return 0;
    const ncaateam = getPlayerNcaateamId(pid);
    if (ncaateam == null) return 0;
    
    const sched = Number(gamesByNcaateamWeek[ncaateam]) || 0;
    const stats = getPlayerStats(pid);
    const gp = stats?.gp || 0;
    return Math.max(0, sched - gp);
  };

  const teamGamesRemaining = (rosterMap) => {
    const r = rosterMap || {};
    let rem = 0;
    const startingSlots = ["G1", "G2", "F1", "F2", "FC"];

    startingSlots.forEach((slot) => {
      const pid = r[slot];
      if (!pid) return;
      rem += getPlayerGamesRemaining(pid);
    });

    return rem;
  };

  return (
    <div className="matchups-page">
      <div className="matchups-header">
        <h2>Matchups</h2>

        <div className="week-select">
          <span>Week</span>
          <select value={selectedWeek} onChange={(e) => setSelectedWeek(Number(e.target.value))}>
            {weekOptions.map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </div>
      </div>

      {status === "loading" && <div className="state">Loading…</div>}

      {status === "error" && (
        <div className="state error">
          Failed to load matchups.
          <div className="error-detail">{error}</div>
        </div>
      )}

      {status === "success" && matchups.length === 0 && (
        <div className="state">No matchups for week {selectedWeek}.</div>
      )}

      {status === "success" &&
        matchups.map((m) => {
          const t1 = String(m.team1 || "");
          const t2 = String(m.team2 || "");

          const leftTeam = teamsById[t1];
          const rightTeam = teamsById[t2];

          const leftName = leftTeam?.name || t1;
          const rightName = rightTeam?.name || t2;

          const leftRoster = leftTeam?.roster || {};
          const rightRoster = rightTeam?.roster || {};

          const leftPtsTotal = Number(m.team1Points) || 0;
          const rightPtsTotal = Number(m.team2Points) || 0;

          const winner = String(m.winner || "");
          const leftWin = winner && winner === t1;
          const rightWin = winner && winner === t2;

          const leftGR = teamGamesRemaining(leftRoster);
          const rightGR = teamGamesRemaining(rightRoster);

          return (
            <div className="matchup-card" key={m.matchupId || `${t1}_${t2}_${m.week}`}>
              <div className="matchup-top">
                <div className={`team-name ${leftWin ? "winner" : ""}`}>
                  {leftName}
                  <div className="subline">GR: {leftGR}</div>
                </div>

                <div className="score">
                  {fmtPts(leftPtsTotal)} - {fmtPts(rightPtsTotal)}
                </div>

                <div className={`team-name right ${rightWin ? "winner" : ""}`}>
                  {rightName}
                  <div className="subline right">GR: {rightGR}</div>
                </div>
              </div>

              <div className="slot-header">
                <div className="pos">POS</div>
                <div className="player left">PLAYER</div>
                <div className="gr">GR</div>
                <div className="gp">GP</div>
                <div className="stats">STATS</div>
                <div className="pts">PTS</div>
                <div className="pts">PTS</div>
                <div className="stats">STATS</div>
                <div className="gp">GP</div>
                <div className="gr">GR</div>
                <div className="player right">PLAYER</div>
                <div className="pos">POS</div>
              </div>

              {SLOT_ORDER.map((slot) => {
                const lp = leftRoster[slot];
                const rp = rightRoster[slot];

                const lstats = getPlayerStats(lp);
                const rstats = getPlayerStats(rp);

                const lStatLine = lstats 
                  ? `${Math.round(lstats.points)}P ${Math.round(lstats.reb)}R ${Math.round(lstats.ast)}A ${Math.round(lstats.stl)}S ${Math.round(lstats.blk)}B ${lstats.fgPct}% ${Math.round(lstats.tpm)}3 ${Math.round(lstats.fouls)}F ${Math.round(lstats.to)}T`
                  : "—";
                const rStatLine = rstats 
                  ? `${Math.round(rstats.points)}P ${Math.round(rstats.reb)}R ${Math.round(rstats.ast)}A ${Math.round(rstats.stl)}S ${Math.round(rstats.blk)}B ${rstats.fgPct}% ${Math.round(rstats.tpm)}3 ${Math.round(rstats.fouls)}F ${Math.round(rstats.to)}T`
                  : "—";

                return (
                  <div className="slot-row" key={`${m.matchupId || "m"}_${slot}`}>
                    <div className="pos">{slot}</div>
                    <div className="player left">{getPlayerName(lp)}</div>
                    <div className="gr">{getPlayerGamesRemaining(lp)}</div>
                    <div className="gp">{lstats?.gp || 0}</div>
                    <div className="stats left">{lStatLine}</div>
                    <div className="pts">{fmtPts(lstats?.pts || 0)}</div>
                    <div className="pts">{fmtPts(rstats?.pts || 0)}</div>
                    <div className="stats right">{rStatLine}</div>
                    <div className="gp">{rstats?.gp || 0}</div>
                    <div className="gr">{getPlayerGamesRemaining(rp)}</div>
                    <div className="player right">{getPlayerName(rp)}</div>
                    <div className="pos">{slot}</div>
                  </div>
                );
              })}
            </div>
          );
        })}
    </div>
  );
}