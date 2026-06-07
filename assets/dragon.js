(function () {
  // Only show the flying dragon on the home page.
  var path = location.pathname.replace(/\/index\.html$/, '/');
  if (path !== '/') return;

  var container = document.createElement('div');
  container.className = 'dragon-wrap';
  container.id = 'dragon';
  container.setAttribute('aria-hidden', 'true');

  var img = document.createElement('img');
  img.src = '/assets/dragon.png';
  img.alt = '';
  img.draggable = false;
  img.className = 'dragon-img';
  container.appendChild(img);

  var sparkles = document.createElement('div');
  sparkles.className = 'dragon-sparkles';
  for (var i = 0; i < 6; i++) {
    var s = document.createElement('span');
    s.className = 'dragon-sparkle';
    s.style.animationDelay = (i * 0.4) + 's';
    s.style.left = (Math.random() * 100) + '%';
    s.style.top = (Math.random() * 100) + '%';
    sparkles.appendChild(s);
  }
  container.appendChild(sparkles);

  document.body.appendChild(container);

  var d = container;
  var x = Math.random() * (window.innerWidth - 160);
  var y = 20 + Math.random() * (window.innerHeight / 3);
  var vx = (0.8 + Math.random() * 0.6) * (Math.random() < 0.5 ? 1 : -1);
  var vy = 0.3 + Math.random() * 0.3;
  var ax = 0, ay = 0;
  var time = 0;
  var flipScale = vx > 0 ? 1 : -1;
  var tilt = 0;
  var targetTilt = 0;

  var state = 'fly';
  var stateTimer = 200 + Math.floor(Math.random() * 300);

  function pickState() {
    var r = Math.random();
    if (r < 0.35) {
      state = 'glide';
      stateTimer = 120 + Math.floor(Math.random() * 180);
    } else if (r < 0.55) {
      state = 'dive';
      stateTimer = 60 + Math.floor(Math.random() * 80);
    } else if (r < 0.7) {
      state = 'circle';
      stateTimer = 150 + Math.floor(Math.random() * 200);
    } else {
      state = 'fly';
      stateTimer = 200 + Math.floor(Math.random() * 400);
    }
  }

  function frame() {
    time++;
    stateTimer--;

    if (stateTimer <= 0) pickState();

    if (state === 'fly') {
      ax += (Math.random() - 0.5) * 0.04;
      ay += (Math.random() - 0.5) * 0.03;
      ay += Math.sin(time * 0.012) * 0.02;
    } else if (state === 'glide') {
      ax *= 0.98;
      ay = Math.sin(time * 0.008) * 0.015;
    } else if (state === 'dive') {
      ay += 0.03;
      ax += (Math.random() - 0.5) * 0.02;
    } else if (state === 'circle') {
      var circleSpeed = 0.02;
      ax = Math.cos(time * circleSpeed) * 0.08;
      ay = Math.sin(time * circleSpeed) * 0.06;
    }

    ax = Math.max(-0.12, Math.min(0.12, ax));
    ay = Math.max(-0.08, Math.min(0.08, ay));

    vx += ax;
    vy += ay;

    var maxVx = state === 'glide' ? 1.8 : 2.8;
    var maxVy = state === 'dive' ? 2.5 : 1.6;
    vx = Math.max(-maxVx, Math.min(maxVx, vx));
    vy = Math.max(-maxVy, Math.min(maxVy, vy));

    x += vx;
    y += vy;

    var w = window.innerWidth;
    var h = window.innerHeight;
    if (x > w - 140) { x = w - 140; vx = -Math.abs(vx) * 0.7; ax = -0.05; }
    if (x < -20) { x = -20; vx = Math.abs(vx) * 0.7; ax = 0.05; }
    if (y < -10) { y = -10; vy = Math.abs(vy) * 0.5; ay = 0.03; state = 'fly'; }
    if (y > h * 0.65) { vy = -Math.abs(vy) * 0.6; ay = -0.03; if (state === 'dive') { state = 'fly'; stateTimer = 100; } }

    var newFlip = vx > 0.15 ? 1 : vx < -0.15 ? -1 : flipScale;
    flipScale += (newFlip - flipScale) * 0.08;

    targetTilt = vy * 3;
    targetTilt = Math.max(-12, Math.min(12, targetTilt));
    tilt += (targetTilt - tilt) * 0.06;

    d.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) scaleX(' + flipScale.toFixed(3) + ') rotate(' + tilt.toFixed(1) + 'deg)';
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

(function () {
  if (sessionStorage.getItem('_v')) return;
  sessionStorage.setItem('_v', '1');
  var img = new Image();
  img.src = '/api/track?path=' + encodeURIComponent(location.pathname);
})();
