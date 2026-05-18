(function () {
  var container = document.createElement('div');
  container.className = 'dragon-wrap';
  container.id = 'dragon';
  container.setAttribute('aria-hidden', 'true');

  var img = document.createElement('img');
  img.src = '/assets/baby-dragon.png';
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
  var x = Math.random() * (window.innerWidth - 140);
  var y = 20 + Math.random() * (window.innerHeight / 3);
  var vx = (0.5 + Math.random() * 0.4) * (Math.random() < 0.5 ? 1 : -1);
  var vy = 0.2 + Math.random() * 0.2;
  var ax = 0, ay = 0;
  var time = 0;
  var tilt = 0;
  var targetTilt = 0;

  var state = 'float';
  var stateTimer = 200 + Math.floor(Math.random() * 300);

  function pickState() {
    var r = Math.random();
    if (r < 0.4) {
      state = 'drift';
      stateTimer = 150 + Math.floor(Math.random() * 200);
    } else if (r < 0.6) {
      state = 'circle';
      stateTimer = 180 + Math.floor(Math.random() * 220);
    } else if (r < 0.75) {
      state = 'swoop';
      stateTimer = 60 + Math.floor(Math.random() * 80);
    } else {
      state = 'float';
      stateTimer = 200 + Math.floor(Math.random() * 400);
    }
  }

  function frame() {
    time++;
    stateTimer--;

    if (stateTimer <= 0) pickState();

    if (state === 'float') {
      ax += (Math.random() - 0.5) * 0.025;
      ay += (Math.random() - 0.5) * 0.02;
      ay += Math.sin(time * 0.01) * 0.015;
    } else if (state === 'drift') {
      ax *= 0.98;
      ay = Math.sin(time * 0.008) * 0.012;
    } else if (state === 'swoop') {
      ay += 0.02;
      ax += (Math.random() - 0.5) * 0.015;
    } else if (state === 'circle') {
      var circleSpeed = 0.018;
      ax = Math.cos(time * circleSpeed) * 0.06;
      ay = Math.sin(time * circleSpeed) * 0.045;
    }

    ax = Math.max(-0.08, Math.min(0.08, ax));
    ay = Math.max(-0.06, Math.min(0.06, ay));

    vx += ax;
    vy += ay;

    var maxVx = state === 'drift' ? 1.2 : 2.0;
    var maxVy = state === 'swoop' ? 1.8 : 1.2;
    vx = Math.max(-maxVx, Math.min(maxVx, vx));
    vy = Math.max(-maxVy, Math.min(maxVy, vy));

    x += vx;
    y += vy;

    var w = window.innerWidth;
    var h = window.innerHeight;
    if (x > w - 130) { x = w - 130; vx = -Math.abs(vx) * 0.7; ax = -0.04; }
    if (x < -10) { x = -10; vx = Math.abs(vx) * 0.7; ax = 0.04; }
    if (y < -10) { y = -10; vy = Math.abs(vy) * 0.5; ay = 0.02; state = 'float'; }
    if (y > h * 0.6) { vy = -Math.abs(vy) * 0.6; ay = -0.02; if (state === 'swoop') { state = 'float'; stateTimer = 100; } }

    targetTilt = vy * 2.5;
    targetTilt = Math.max(-8, Math.min(8, targetTilt));
    tilt += (targetTilt - tilt) * 0.05;

    d.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) rotate(' + tilt.toFixed(1) + 'deg)';
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
