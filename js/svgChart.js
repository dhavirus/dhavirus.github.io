const SVG_NS = "http://www.w3.org/2000/svg";

function el(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

// Renders a simple horizontal-scale bar chart into `svgEl`.
// bars: [{ label, value, colorVar, unit }]
// opts: { max } — shared scale ceiling; defaults to 1.15x the largest value.
export function barChart(svgEl, bars, opts = {}) {
  svgEl.innerHTML = "";
  svgEl.classList.add("bar-chart");

  const max = opts.max ?? Math.max(...bars.map((b) => b.value), 1) * 1.15;
  const width = 280;
  const barHeight = 24;
  const gap = 12;
  const labelWidth = 90;
  const chartWidth = width - labelWidth - 8;
  const height = bars.length * (barHeight + gap);

  svgEl.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svgEl.setAttribute("width", "100%");
  svgEl.setAttribute("role", "img");

  bars.forEach((bar, i) => {
    const y = i * (barHeight + gap);
    const barWidth = Math.max((bar.value / max) * chartWidth, 0);

    const label = el("text", { x: 0, y: y + barHeight / 2 + 4, "text-anchor": "start" });
    label.textContent = bar.label;
    svgEl.appendChild(label);

    const rect = el("rect", {
      x: labelWidth,
      y,
      width: barWidth,
      height: barHeight,
      fill: `var(${bar.colorVar})`,
      rx: 3,
    });
    const title = el("title", {});
    title.textContent = `${bar.label}: ${Math.round(bar.value)}${bar.unit || ""}`;
    rect.appendChild(title);
    svgEl.appendChild(rect);

    const valueText = el("text", {
      x: labelWidth + barWidth + 6,
      y: y + barHeight / 2 + 4,
      "text-anchor": "start",
    });
    valueText.textContent = `${Math.round(bar.value)}${bar.unit || ""}`;
    svgEl.appendChild(valueText);
  });
}

// Renders a pie chart into `svgEl`. slices: [{ label, value, colorVar, unit }]
// Color alone doesn't carry the meaning here — pair it with renderLegend().
export function pieChart(svgEl, slices) {
  svgEl.innerHTML = "";
  svgEl.classList.add("pie-chart");

  const size = 160;
  const r = 70;
  const cx = size / 2;
  const cy = size / 2;
  svgEl.setAttribute("viewBox", `0 0 ${size} ${size}`);
  svgEl.setAttribute("width", "100%");
  svgEl.setAttribute("role", "img");

  const total = slices.reduce((sum, s) => sum + s.value, 0) || 1;
  let angle = -Math.PI / 2;

  slices.forEach((slice) => {
    const fraction = slice.value / total;
    const endAngle = angle + fraction * Math.PI * 2;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = fraction > 0.5 ? 1 : 0;

    const path = el("path", {
      d: `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2} Z`,
      fill: `var(${slice.colorVar})`,
    });
    const title = el("title", {});
    title.textContent = `${slice.label}: ${Math.round(slice.value)}${slice.unit || ""} (${Math.round(fraction * 100)}%)`;
    path.appendChild(title);
    svgEl.appendChild(path);

    angle = endAngle;
  });
}

// A text legend to go with pieChart() — never rely on pie-slice color alone.
export function renderLegend(containerEl, slices) {
  const total = slices.reduce((sum, s) => sum + s.value, 0) || 1;
  containerEl.innerHTML = slices
    .map((s) => {
      const pct = Math.round((s.value / total) * 100);
      return `
        <div class="legend-row">
          <span class="legend-swatch" style="background: var(${s.colorVar})"></span>
          <span class="legend-label">${s.label}</span>
          <span class="legend-value">${Math.round(s.value)}${s.unit || ""} (${pct}%)</span>
        </div>
      `;
    })
    .join("");
}
