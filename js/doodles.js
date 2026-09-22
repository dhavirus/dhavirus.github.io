const SVG_NS = "http://www.w3.org/2000/svg";

// Scatters `count` random doodles (picked with repetition from `templates`)
// across `container` at random position/size/rotation. Repetition of a
// small motif set is the point — it's a wallpaper pattern, not 100 unique
// drawings.
export function scatterDoodles(container, templates, count) {
  for (let i = 0; i < count; i++) {
    const t = templates[Math.floor(Math.random() * templates.length)];
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", t.viewBox);
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2.5");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.classList.add("doodle");
    svg.innerHTML = t.inner;

    const size = 30 + Math.random() * 45;
    const top = (Math.random() * 98).toFixed(1);
    const left = (Math.random() * 96).toFixed(1);
    const rotate = (Math.random() * 360).toFixed(0);
    svg.style.cssText = `top:${top}%; left:${left}%; width:${size.toFixed(0)}px; transform:rotate(${rotate}deg);`;

    container.appendChild(svg);
  }
}

export const FOOD_DOODLES = [
  {
    viewBox: "0 0 100 100",
    inner: `<path d="M20,50 C10,30 30,10 50,15 C70,10 95,25 90,50 C95,75 70,90 50,85 C25,92 5,72 20,50 Z" /><circle cx="52" cy="50" r="18" />`,
  },
  {
    viewBox: "0 0 100 100",
    inner: `<path d="M15,55 Q50,90 85,55" /><line x1="20" y1="53" x2="85" y2="53" /><line x1="55" y1="20" x2="75" y2="55" /><line x1="62" y1="18" x2="82" y2="53" />`,
  },
  {
    viewBox: "0 0 60 100",
    inner: `<path d="M30,90 L30,20" /><path d="M30,60 C10,55 5,35 20,25 C30,35 30,50 30,60 Z" /><path d="M30,45 C50,40 55,20 40,10 C30,20 30,35 30,45 Z" />`,
  },
  {
    viewBox: "0 0 100 100",
    inner: `<line x1="20" y1="10" x2="20" y2="35" /><line x1="26" y1="10" x2="26" y2="35" /><line x1="32" y1="10" x2="32" y2="35" /><line x1="26" y1="35" x2="26" y2="90" /><path d="M70,10 L74,10 L74,45 C74,50 70,50 70,45 Z" /><line x1="72" y1="50" x2="72" y2="90" />`,
  },
  {
    viewBox: "0 0 80 80",
    inner: `<path d="M15,30 L15,60 C15,70 25,75 35,75 C45,75 55,70 55,60 L55,30 Z" /><path d="M55,35 C68,35 68,55 55,55" /><line x1="15" y1="30" x2="55" y2="30" /><path d="M25,15 C22,20 28,22 25,27" /><path d="M35,12 C32,17 38,19 35,24" />`,
  },
  {
    viewBox: "0 0 80 90",
    inner: `<path d="M40,25 C20,20 10,45 15,60 C20,78 35,85 40,80 C45,85 60,78 65,60 C70,45 60,20 40,25 Z" /><path d="M40,25 C38,15 40,10 45,8" /><path d="M45,10 C50,5 58,8 55,15 C50,15 47,13 45,10 Z" />`,
  },
  {
    viewBox: "0 0 80 80",
    inner: `<path d="M15,75 L15,40 C15,15 65,15 65,40 L65,75 Z" /><path d="M25,75 L25,45 C25,28 55,28 55,45 L55,75" />`,
  },
  {
    viewBox: "0 0 100 60",
    inner: `<ellipse cx="45" cy="30" rx="35" ry="18" /><path d="M78,30 L98,15 L98,45 Z" /><circle cx="20" cy="27" r="2.5" fill="currentColor" stroke="none" />`,
  },
  {
    viewBox: "0 0 60 100",
    inner: `<path d="M35,10 C25,15 30,20 25,25" /><path d="M25,25 C10,35 10,70 25,85 C35,95 45,85 40,65 C50,45 45,25 25,25 Z" />`,
  },
];

export const DIARY_DOODLES = [
  {
    viewBox: "0 0 100 30",
    inner: `<line x1="10" y1="15" x2="80" y2="15" /><path d="M80,8 L95,15 L80,22 Z" /><line x1="15" y1="8" x2="15" y2="22" />`,
  },
  {
    viewBox: "0 0 60 60",
    inner: `<path d="M30,5 L36,22 L54,22 L39,33 L45,50 L30,39 L15,50 L21,33 L6,22 L24,22 Z" />`,
  },
  {
    viewBox: "0 0 60 54",
    inner: `<path d="M30,50 C10,35 5,15 20,8 C28,4 30,12 30,15 C30,12 32,4 40,8 C55,15 50,35 30,50 Z" />`,
  },
  {
    viewBox: "0 0 80 80",
    inner: `<path d="M15,30 L15,60 C15,70 25,75 35,75 C45,75 55,70 55,60 L55,30 Z" /><path d="M55,35 C68,35 68,55 55,55" /><line x1="15" y1="30" x2="55" y2="30" /><path d="M25,15 C22,20 28,22 25,27" /><path d="M35,12 C32,17 38,19 35,24" />`,
  },
  {
    viewBox: "0 0 80 60",
    inner: `<path d="M10,15 L38,10 L38,50 L10,55 Z" /><path d="M42,10 L70,15 L70,55 L42,50 Z" /><line x1="16" y1="20" x2="32" y2="17" /><line x1="16" y1="28" x2="32" y2="25" />`,
  },
  {
    viewBox: "0 0 40 80",
    inner: `<path d="M20,10 C35,10 35,30 20,30 L20,60 C20,68 30,68 30,60 L30,20" />`,
  },
  {
    viewBox: "0 0 90 50",
    inner: `<path d="M20,40 C5,40 5,20 20,20 C20,8 40,5 45,15 C55,5 75,10 70,22 C85,22 85,40 70,40 Z" />`,
  },
];
