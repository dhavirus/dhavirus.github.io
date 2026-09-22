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
      rx: 2,
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
