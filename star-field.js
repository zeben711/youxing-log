export function createStarField(canvas) {
  const context = canvas.getContext('2d');
  if (!context) return {setActive() {}, setAccents() {}};

  let seed = 123;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  const stars = Array.from({length: 248}, (_, index) => {
    const bright = index % 5 === 0;
    const x = random();
    const y = random();
    return {
      x: index % 3 === 0 ? x : (x + (random() + random()) / 2) / 2,
      y: index % 3 === 0 ? y : (y * 2 + random() + random()) / 4,
      size: bright ? .98 + random() * .58 : .36 + random() * .52,
      brightness: bright ? .81 + random() * .19 : .26 + random() * .46,
      tone: index % 17 === 0 ? '#dec2a8' : bright ? '#e7effb' : '#bacde7',
      phase: random(),
      twinkle: random(),
      life: 12 + random() * 16,
      period: (bright ? 2.7 : 4.5) + random() * 4.8,
      dx: (random() - .6) * (bright ? 90 : 40),
      dy: (random() - .45) * (bright ? 78 : 30),
      rays: index % 25 === 0,
      bright,
    };
  });

  const halo = document.createElement('canvas');
  halo.width = halo.height = 32;
  const haloContext = halo.getContext('2d');
  if (haloContext) {
    const falloff = haloContext.createRadialGradient(16, 16, 0, 16, 16, 16);
    falloff.addColorStop(0, '#d4e5ff8c');
    falloff.addColorStop(.28, '#a9c4ef42');
    falloff.addColorStop(1, '#a9c4ef00');
    haloContext.fillStyle = falloff;
    haloContext.fillRect(0, 0, 32, 32);
  }

  const glint = document.createElement('canvas');
  glint.width = glint.height = 40;
  const glintContext = glint.getContext('2d');
  if (glintContext) {
    for (const [x1, y1, x2, y2] of [[0, 20, 40, 20], [20, 8, 20, 32]]) {
      const beam = glintContext.createLinearGradient(x1, y1, x2, y2);
      beam.addColorStop(0, '#d2e2fc00');
      beam.addColorStop(.37, '#bdd5f34c');
      beam.addColorStop(.5, '#eef5fff0');
      beam.addColorStop(.63, '#bdd5f34c');
      beam.addColorStop(1, '#d2e2fc00');
      glintContext.strokeStyle = beam;
      glintContext.lineWidth = 3;
      glintContext.beginPath();
      glintContext.moveTo(x1, y1);
      glintContext.lineTo(x2, y2);
      glintContext.stroke();
    }
  }

  let width = 0, height = 0, count = 0;
  let running = false, frame = 0, last = 0, seconds = 0, accents = 0;

  function paint() {
    context.clearRect(0, 0, width, height);
    for (let index = 0; index < count; index++) {
      const star = stars[index];
      const life = (star.phase + seconds / star.life) % 1;
      const fade = Math.min(1, life * 7, (1 - life) * 7);
      const shimmer = .5 + .5 * Math.sin((star.twinkle + seconds / star.period) * 2 * Math.PI);
      const low = star.bright ? .5 : .38;
      const opacity = star.brightness * fade * (low + (1 - low) * shimmer ** 1.7);
      const x = star.x * width + (life - .5) * star.dx;
      const y = star.y * height + (life - .5) * star.dy;
      if (haloContext && star.bright && opacity > .35) {
        const radius = star.size * 3.9;
        context.globalAlpha = opacity * .8;
        context.drawImage(halo, x - radius, y - radius, 2 * radius, 2 * radius);
      }
      if (glintContext && star.rays && accents > 0) {
        const radius = 4.6 + 2.1 * shimmer;
        context.globalAlpha = opacity * accents * (.3 + .7 * shimmer ** 2);
        context.drawImage(glint, x - radius, y - radius, radius * 2, radius * 2);
      }
      context.globalAlpha = opacity;
      context.fillStyle = star.tone;
      context.beginPath();
      context.arc(x, y, star.size * (.88 + .12 * shimmer), 0, 2 * Math.PI);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  new ResizeObserver(([entry]) => {
    ({width, height} = entry.contentRect);
    if (!width || !height) return;
    const ratio = Math.min(devicePixelRatio, 1.5, Math.sqrt(1_450_000 / (width * height)));
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    count = Math.min(stars.length, Math.max(80, Math.round(width * height / 5150)));
    paint();
  }).observe(canvas);

  function render(now) {
    // A slower refresh is sufficient for drifting lights and leaves room for the camera transitions.
    if (now - last >= 30) {
      seconds += Math.min(90, now - last) / 1000;
      last = now;
      paint();
    }
    frame = requestAnimationFrame(render);
  }

  return {
    setActive(active) {
      if (active === running) return;
      running = active;
      if (active) {
        last = performance.now();
        frame = requestAnimationFrame(render);
      } else cancelAnimationFrame(frame);
    },
    setAccents(amount) {
      if (amount === accents) return;
      accents = amount;
      if (!running) paint();
    },
  };
}
