import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "../firebase";
import "./standings.css";

const PLAYOFF_CUT = 4;

export default function Standings() {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  const [currentWeek, setCurrentWeek] = useState(1);
  const [selectedWeek, setSelectedWeek] = useState(1);

  const [teams, setTeams] = useState([]);
  const [matchups, setMatchups] = useState([]);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    let alive = true;

    async function load() {
      setStatus("loading");
      setError("");

      try {
        const leagueSnap = await getDoc(doc(db, "league", "main"));
        const cw = Number(leagueSnap.data()?.currentWeek) || 1;

        const [teamsSnap, matchupsSnap, transactionsSnap] = await Promise.all([
          getDocs(collection(db, "teams")),
          getDocs(collection(db, "matchups")),
          getDocs(query(collection(db, "transactions"), orderBy("timestamp", "desc"), limit(50))),
        ]);

        const teamList = teamsSnap.docs.map((d) => {
          const v = d.data() || {};
          return {
            id: d.id,
            teamId: v.teamId || d.id,
            name: v.teamName || v.owner || v.teamId || d.id,
          };
        });

        const matchupList = matchupsSnap.docs.map((d) => d.data() || {});
        
        const transactionList = transactionsSnap.docs.map((d) => ({
          id: d.id,
          ...d.data()
        }));

        if (!alive) return;
        setCurrentWeek(cw);
        setSelectedWeek(cw);
        setTeams(teamList);
        setMatchups(matchupList);
        setTransactions(transactionList);
        setStatus("success");
      } catch (e) {
        if (!alive) return;
        setError(e?.message || "Failed to load standings.");
        setStatus("error");
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  const weekOptions = useMemo(() => {
    const n = Math.max(1, currentWeek);
    return Array.from({ length: n }, (_, i) => i + 1);
  }, [currentWeek]);

  const rows = useMemo(() => {
    const stats = {};
    teams.forEach((t) => {
      stats[t.teamId] = { wins: 0, losses: 0, pf: 0, pa: 0 };
    });

    matchups.forEach((m) => {
      const week = Number(m.week) || 0;
      if (week < 1 || week > selectedWeek) return;

      const t1 = m.team1;
      const t2 = m.team2;
      if (!t1 || !t2) return;

      if (!stats[t1]) stats[t1] = { wins: 0, losses: 0, pf: 0, pa: 0 };
      if (!stats[t2]) stats[t2] = { wins: 0, losses: 0, pf: 0, pa: 0 };

      const t1p = Number(m.team1Points) || 0;
      const t2p = Number(m.team2Points) || 0;

      stats[t1].pf += t1p;
      stats[t1].pa += t2p;

      stats[t2].pf += t2p;
      stats[t2].pa += t1p;

      if (m.completed === true && m.winner) {
        const w = String(m.winner);
        const loser = w === t1 ? t2 : w === t2 ? t1 : null;
        if (loser) {
          stats[w].wins += 1;
          stats[loser].losses += 1;
        }
      }
    });

    const list = teams.map((t) => {
      const s = stats[t.teamId] || { wins: 0, losses: 0, pf: 0, pa: 0 };
      const g = s.wins + s.losses;
      const wp = g ? s.wins / g : 0;
      return { ...t, ...s, winPct: wp };
    });

    return list
      .sort((a, b) => {
        if (b.winPct !== a.winPct) return b.winPct - a.winPct;
        if (b.pf !== a.pf) return b.pf - a.pf;
        if (b.pa !== a.pa) return b.pa - a.pa;
        return a.name.localeCompare(b.name);
      })
      .map((t, i) => ({ ...t, rank: i + 1 }));
  }, [teams, matchups, selectedWeek]);

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="standings-page">
      <div className="standings-header">
        <h2>League Standings</h2>

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

      <div className="standings-table">
        <div className="table-header">
          <div>Rank</div>
          <div>Team</div>
          <div>W</div>
          <div>L</div>
          <div>PF</div>
          <div>PA</div>
        </div>

        {status === "loading" && (
          <div className="table-state">Loading…</div>
        )}

        {status === "error" && (
          <div className="table-state error">
            Failed to load standings.
            <div className="error-detail">{error}</div>
          </div>
        )}

        {status === "success" &&
          rows.map((team) => (
            <div key={team.teamId}>
              <div className="table-row">
                <div className="rank">{team.rank}</div>
                <div className="team-name">{team.name}</div>
                <div>{team.wins}</div>
                <div>{team.losses}</div>
                <div>{team.pf.toFixed(2)}</div>
                <div>{team.pa.toFixed(2)}</div>
              </div>

              {team.rank === PLAYOFF_CUT && rows.length > PLAYOFF_CUT && (
                <div className="cutline" />
              )}
            </div>
          ))}
      </div>

      {status === "success" && transactions.length > 0 && (
        <div className="transactions-section">
          <h3>Recent Transactions</h3>
          <div className="transactions-list">
            {transactions.map((txn) => (
              <div key={txn.id} className="transaction-item">
                <span className="txn-time">{formatTimestamp(txn.timestamp)}</span>
                <span className="txn-team">{txn.teamName}</span>
                <span className="txn-action">
                  {txn.type === 'add' && (
                    <>
                      added <strong>{txn.playerAdded}</strong>
                      {txn.playerDropped && (
                        <>, dropped <strong>{txn.playerDropped}</strong></>
                      )}
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}