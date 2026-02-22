// ==============================
// CORE-MATRIX ENGINE vX.224
// ==============================

let neural_visualizers = { hist: null, poly: null, ogive: null, pareto: null };

// --- SYSTEM SYNC ---
function syncSystem() {
  const feed = document.getElementById("mainBuffer").value;
  const stream = feed.replace(/\n/g, " ").replace(/,/g, " ").split(" ").map(s => s.trim()).filter(Boolean).map(Number).filter(Number.isFinite);
  const width = Number(document.getElementById("qWidth").value);

  const status = document.getElementById("statusPulse");
  if (stream.length < 20) {
    status.textContent = "Error: Mínimo 20 datos";
    status.style.color = "#ff4d4d";
    return;
  }
  status.textContent = "Estado: Sincronizado";
  status.style.color = "#bcff00";

  const mn = Math.min(...stream), mx = Math.max(...stream), n = stream.length;

  // KPIs
  document.getElementById("vMin").textContent = mn;
  document.getElementById("vMax").textContent = mx;
  document.getElementById("vRange").textContent = mx - mn;
  document.getElementById("vN").textContent = n;
  
  const avg = stream.reduce((a, b) => a + b, 0) / n;
  const med = (() => {
    const a = [...stream].sort((x, y) => x - y);
    return n % 2 === 1 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2;
  })();
  const mod = (() => {
    const m = new Map(); stream.forEach(x => m.set(x, (m.get(x) || 0) + 1));
    let b = null, bc = 0;
    for (const [k, v] of m.entries()) { if (v > bc) { b = k; bc = v; } }
    return bc === 1 ? "N/A" : b;
  })();

  document.getElementById("vExtra").textContent = `Media=${avg.toFixed(2)}, Mediana=${med}, Moda=${mod}`;

  // Logica de Textos
  document.getElementById("logUniverse").textContent = `Universo: todos los posibles valores de la variable que estudias.\nPoblación: el conjunto total de elementos de interés.\nMuestra: los ${n} datos capturados en esta web.\n\nTus datos van desde ${mn} hasta ${mx}.`;
  document.getElementById("logCensus").textContent = `Censo: cuando se mide TODA la población.\nMuestreo: cuando se toma una parte.\n\nAquí normalmente es muestreo (muestra de ${n}).`;

  // Tallo y Hoja
  const stems = new Map();
  stream.forEach(v => {
    const s = Math.floor(v / 10), l = v % 10;
    if (!stems.has(s)) stems.set(s, []);
    stems.get(s).push(l);
  });
  let sl = "Tallo | Hojas\n-------------\n";
  [...stems.keys()].sort((a,b)=>a-b).forEach(s => {
    sl += `${String(s).padStart(5, " ")} | ${stems.get(s).sort((a,b)=>a-b).join(" ")}\n`;
  });
  document.getElementById("vStem").textContent = sl;

  // Matrix Generator (Frecuencias)
  const matrix = matrixGenerator(stream, width);
  let html = "<table><thead><tr><th>Clase</th><th>Punto medio</th><th>fi</th><th>fr</th><th>Fi</th><th>Fr</th></tr></thead><tbody>";
  matrix.forEach(f => {
    html += `<tr><td>${f.label}</td><td>${f.mid.toFixed(2)}</td><td>${f.fi}</td><td>${(f.fr * 100).toFixed(2)}%</td><td>${f.Fi}</td><td>${(f.Fr * 100).toFixed(2)}%</td></tr>`;
  });
  document.getElementById("vTable").innerHTML = html + "</tbody></table>";

  // Visualizers
  updateVisualizers(matrix, stream);
  
  // Probabilidad
  const unique = [...new Set(stream)].sort((a, b) => a - b);
  document.getElementById("vExp").textContent = `Experimento: seleccionar 1 dato al azar de la muestra.\nEspacio muestral (valores únicos observados):\n${unique.join(", ")}\n\nDefine un evento y calcula su probabilidad empírica.`;
}

function matrixGenerator(data, w) {
  const mn = Math.min(...data), mx = Math.max(...data), classes = [];
  let a = mn;
  while (a <= mx) { classes.push({ a, b: a + w, fi: 0 }); a += w; }
  for (const x of data) {
    for (let i = 0; i < classes.length; i++) {
      const c = classes[i];
      if (x >= c.a && (x < c.b || (i === classes.length - 1 && x <= c.b))) {
        c.fi++; break;
      }
    }
  }
  const n = data.length;
  let cum = 0;
  return classes.map(c => {
    cum += c.fi;
    return { label: `[${c.a}-${c.b})`, mid: (c.a + c.b) / 2, fi: c.fi, fr: c.fi / n, Fi: cum, Fr: cum / n, b: c.b };
  });
}

function updateVisualizers(matrix, stream) {
  const isDark = document.documentElement.getAttribute("data-mode") === "dark";
  const colors = {
    p: isDark ? "#bcff00" : "#2563eb",
    pS: isDark ? "rgba(188, 255, 0, 0.4)" : "rgba(37, 99, 235, 0.4)",
    s: isDark ? "#ff4d4d" : "#ef4444",
    t: isDark ? "#f0fdf4" : "#1e293b",
    g: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)"
  };

  const opt = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: colors.t, font: { family: 'Rajdhani' } } } },
    scales: {
      x: { grid: { color: colors.g }, ticks: { color: colors.t } },
      y: { grid: { color: colors.g }, ticks: { color: colors.t } }
    }
  };

  const draw = (id, type, data, special = {}) => {
    if (neural_visualizers[id]) neural_visualizers[id].destroy();
    neural_visualizers[id] = new Chart(document.getElementById("c" + id.charAt(0).toUpperCase() + id.slice(1)).getContext("2d"), {
      type, data, options: { ...opt, ...special }
    });
  };

  draw("hist", "bar", { labels: matrix.map(m => m.label), datasets: [{ label: "fi", data: matrix.map(m => m.fi), backgroundColor: colors.pS, borderColor: colors.p, borderWidth: 1 }] });
  draw("poly", "line", { labels: matrix.map(m => m.mid.toFixed(1)), datasets: [{ label: "Polígono", data: matrix.map(m => m.fi), borderColor: colors.p, tension: 0.3, fill: true, backgroundColor: colors.pS }] });
  draw("ogive", "line", { labels: matrix.map(m => m.b), datasets: [{ label: "Fi", data: matrix.map(m => m.Fi), borderColor: colors.s, backgroundColor: "transparent", pointRadius: 5 }] });

  const counts = new Map(); stream.forEach(x => counts.set(x, (counts.get(x) || 0) + 1));
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  let acc = 0;
  draw("pareto", "bar", {
    labels: sorted.map(s => s[0]),
    datasets: [
      { label: "fi", data: sorted.map(s => s[1]), backgroundColor: colors.pS, yAxisID: "y" },
      { label: "% Acum", type: "line", data: sorted.map(s => { acc += s[1]; return (acc / stream.length) * 100; }), borderColor: colors.s, yAxisID: "y1" }
    ]
  }, { scales: { y: { position: "left", ticks: { color: colors.t } }, y1: { position: "right", min: 0, max: 100, ticks: { color: colors.s } } } });
}

// --- MODULES ---
function matrixSets() {
  const get = (id) => new Set(document.getElementById(id).value.split(",").map(s => s.trim()).filter(Boolean));
  const A = get("iSetA"), B = get("iSetB");
  const u = new Set([...A, ...B]), i = new Set([...A].filter(x => B.has(x)));
  const da = new Set([...A].filter(x => !B.has(x))), db = new Set([...B].filter(x => !A.has(x)));
  const fmt = (s) => `{ ${[...s].sort((a,b)=>String(a).localeCompare(String(b))).join(", ")} }`;
  document.getElementById("oSet").textContent = `A = ${fmt(A)}\nB = ${fmt(B)}\n\nA ∪ B = ${fmt(u)}\nA ∩ B = ${fmt(i)}\nA − B = ${fmt(da)}\nB − A = ${fmt(db)}`;
}

function matrixProb() {
  const feed = document.getElementById("mainBuffer").value.replace(/\n/g, " ").replace(/,/g, " ").split(" ").map(s => s.trim()).filter(Boolean).map(Number).filter(Number.isFinite);
  if (feed.length < 20) return;
  const t = document.getElementById("iEvType").value, k = Number(document.getElementById("iEvK").value);
  const f = feed.filter(x => (t === "ge" ? x >= k : t === "le" ? x <= k : x === k)).length;
  const p = f / feed.length;
  document.getElementById("oProb").textContent = `Evento E: ${t} con k=${k}\nFavorables: ${f}\nTotal: ${feed.length}\nP(E) = ${f}/${feed.length} = ${p.toFixed(4)} (${(p * 100).toFixed(2)}%)`;
}

function matrixTree() {
  const get = (id) => document.getElementById(id).value.trim();
  const opts = (id) => get(id).split(",").map(s => s.trim()).filter(Boolean);
  const s1 = opts("tO1"), s2 = opts("tO2"), s3 = opts("tO3");
  const n1 = get("tN1"), n2 = get("tN2"), n3 = get("tN3");

  if (!s1.length || !s2.length) return;
  const tot = s1.length * s2.length * (s3.length || 1);
  let out = `1) Identifica los pasos del proceso:\n- ${n1}\n- ${n2}\n${s3.length ? "- "+n3+"\n" : ""}`;
  out += `\n2) Cuenta opciones en cada paso:\n- ${n1}: ${s1.length} opciones\n- ${n2}: ${s2.length} opciones\n${s3.length ? "- "+n3+": "+s3.length+" opciones\n" : ""}`;
  out += `\n3) Multiplica:\nTotal = ${s1.length} × ${s2.length}${s3.length ? " × "+s3.length : ""} = ${tot}\n\nDiagrama de árbol:\nInicio\n`;

  s1.forEach((o1, i1) => {
    const l1 = i1 === s1.length - 1;
    out += ` ${l1 ? "└─" : "├─"} ${o1}\n`;
    s2.forEach((o2, i2) => {
      const l2 = i2 === s2.length - 1;
      const p2 = l1 ? "   " : " │ ";
      out += `${p2}${l2 ? "└─" : "├─"} ${o2}\n`;
      if (s3.length) s3.forEach((o3, i3) => {
        const l3 = i3 === s3.length - 1;
        const p3 = p2 + (l2 ? "   " : " │ ");
        out += `${p3}${l3 ? "└─" : "├─"} ${o3}\n`;
      });
    });
  });
  document.getElementById("oTree").textContent = out;
}

function matrixCombi() {
  const n = Number(document.getElementById("iN").value), r = Number(document.getElementById("iR").value);
  if (n < r || n < 0 || r < 0) { document.getElementById("oCombi").textContent = "ERR: N < R"; return; }
  const f = (n) => { let r = 1n; for (let i = 2n; i <= BigInt(n); i++) r *= i; return r; };
  const p = (() => { let p = 1n; for (let i = 0n; i < BigInt(r); i++) p *= (BigInt(n) - i); return p; })();
  const c = p / f(r);
  document.getElementById("oCombi").textContent = `${n}! = ${f(n)}\nP(${n},${r}) = ${p}\nC(${n},${r}) = ${c}`;
}

// --- INIT ---
document.addEventListener("DOMContentLoaded", () => {
  const ev = (id, fn) => document.getElementById(id).addEventListener("click", fn);
  
  ev("toggleVision", () => {
    const h = document.documentElement;
    const m = h.getAttribute("data-mode") === "dark" ? "light" : "dark";
    h.setAttribute("data-mode", m);
    document.getElementById("visionMode").textContent = m.toUpperCase();
    syncSystem();
  });

  ev("execSync", syncSystem);
  ev("loadX", () => {
    document.getElementById("mainBuffer").value = "105, 112, 115, 115, 118, 122, 125, 128, 132, 135, 136, 138, 138, 140, 140, 142, 145, 148, 148, 155, 158, 160, 162, 162, 165, 168, 170, 170, 128";
    document.getElementById("qWidth").value = 10;
    syncSystem(); matrixSets(); matrixProb(); matrixCombi(); matrixTree();
  });

  ev("rndFeed", () => {
    document.getElementById("mainBuffer").value = Array.from({length: 30}, () => Math.floor(Math.random() * 200) + 100).join(", ");
    syncSystem();
  });

  ev("execSet", matrixSets);
  ev("rndSet", () => {
    document.getElementById("iSetA").value = Array.from({length: 6}, () => Math.floor(Math.random() * 50)).join(",");
    document.getElementById("iSetB").value = Array.from({length: 6}, () => Math.floor(Math.random() * 50) + 20).join(",");
    matrixSets();
  });

  ev("execProb", matrixProb);
  ev("rndProb", () => {
    document.getElementById("iEvK").value = Math.floor(Math.random() * 100) + 100;
    matrixProb();
  });

  ev("execTree", matrixTree);
  ev("rndTree", () => {
    const opts = () => Array.from({length: 2}, (_, i) => "NODE_" + Math.floor(Math.random() * 99)).join(",");
    document.getElementById("tO1").value = opts();
    document.getElementById("tO2").value = opts();
    document.getElementById("tO3").value = Math.random() > 0.5 ? opts() : "";
    matrixTree();
  });

  ev("execCombi", matrixCombi);
  ev("rndCombi", () => {
    const n = Math.floor(Math.random() * 10) + 10;
    document.getElementById("iN").value = n;
    document.getElementById("iR").value = Math.floor(Math.random() * n);
    matrixCombi();
  });

  syncSystem(); matrixSets(); matrixTree(); matrixCombi();
});
