// Gera um plano de fundo sutil com nos e conexoes, remetendo ao icone da logo.
// Puramente decorativo, estatico (sem animacao pesada) e de baixo contraste.
(function () {
  const container = document.getElementById('networkBg');
  if (!container) return;

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.setAttribute('preserveAspectRatio', 'none');

  const w = 1600, h = 900;
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

  const rand = (min, max) => Math.random() * (max - min) + min;

  const pointCount = 22;
  const points = [];
  for (let i = 0; i < pointCount; i++) {
    points.push({ x: rand(0, w), y: rand(0, h), r: rand(2, 4) });
  }

  // conecta cada ponto aos 2 mais proximos
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  const lines = [];
  points.forEach((p, i) => {
    const others = points
      .map((q, j) => ({ q, j, d: dist(p, q) }))
      .filter(o => o.j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, 2);
    others.forEach(o => lines.push([p, o.q]));
  });

  const gradId = 'netgrad-' + Math.random().toString(36).slice(2);
  const defs = document.createElementNS(NS, 'defs');
  const grad = document.createElementNS(NS, 'linearGradient');
  grad.setAttribute('id', gradId);
  grad.setAttribute('x1', '0%'); grad.setAttribute('y1', '0%');
  grad.setAttribute('x2', '100%'); grad.setAttribute('y2', '100%');
  const stop1 = document.createElementNS(NS, 'stop');
  stop1.setAttribute('offset', '0%');
  stop1.setAttribute('stop-color', 'var(--accent-1)');
  const stop2 = document.createElementNS(NS, 'stop');
  stop2.setAttribute('offset', '100%');
  stop2.setAttribute('stop-color', 'var(--accent-2)');
  grad.appendChild(stop1); grad.appendChild(stop2);
  defs.appendChild(grad);
  svg.appendChild(defs);

  lines.forEach(([a, b]) => {
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
    line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
    line.setAttribute('stroke', `url(#${gradId})`);
    line.setAttribute('stroke-width', '1');
    line.setAttribute('stroke-opacity', '0.35');
    svg.appendChild(line);
  });

  points.forEach(p => {
    const circle = document.createElementNS(NS, 'circle');
    circle.setAttribute('cx', p.x); circle.setAttribute('cy', p.y);
    circle.setAttribute('r', p.r);
    circle.setAttribute('fill', `url(#${gradId})`);
    svg.appendChild(circle);
  });

  container.appendChild(svg);
})();
