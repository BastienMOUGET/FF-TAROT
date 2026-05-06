function getSpecialNote(codif, role) {
  const table = {
    '*4': { A: 40, D: 60 },
    '*6': { A: 60, D: 40 },
    '*8': { A: 60, D: 0 },
    '*7': { A: 0, D: 60 },
    '*5': { A: 40, D: 40 },
    '*1': { A: 0, D: 0 },
    '*2': { A: 0, D: 0 },
    '*9': { A: 0, D: 0 },
    '*0': { A: 0, D: 0 }
  };

  return table[codif]?.[role] ?? null;
}

function computeTopage(scores) {
  const valid = scores.filter(s => !getSpecialNote(s.codif, 'A'));

  valid.sort((a, b) => b.score - a.score);

  let place = 1;
  for (let i = 0; i < valid.length; i++) {
    if (i > 0 && valid[i].score < valid[i - 1].score) {
      place = i + 1;
    }
    valid[i].place = place;
  }

  const n = valid.length;

  valid.forEach((v, i) => {
    let idx = (n - 1) - i;
    v.note = n > 1 ? (idx / (n - 1)) * 100 : 0;
  });

  const groups = {};
  valid.forEach(v => {
    if (!groups[v.place]) groups[v.place] = [];
    groups[v.place].push(v);
  });

  Object.values(groups).forEach(group => {
    const avg = group.reduce((s, g) => s + g.note, 0) / group.length;
    group.forEach(g => g.note = avg);
  });

  return scores.map(s => {
    const v = valid.find(x => x.player_id === s.player_id);

    if (v) return { ...s, note: v.note };

    return {
      ...s,
      note: getSpecialNote(s.codif, s.role)
    };
  });
}

function computePlayerScore(notes, penalties = 0, coef = 1, previous = 0) {
  const valid = notes.filter(n => n !== null);

  const avg = valid.length
    ? valid.reduce((a, b) => a + b, 0) / valid.length
    : 0;

  const session = avg - penalties;
  const total = session * coef;

  return {
    session,
    total,
    general: previous + total
  };
}

module.exports = {
  computeTopage,
  computePlayerScore
};