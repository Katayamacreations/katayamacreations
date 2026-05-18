(function () {
  var container = document.createElement('div');
  container.className = 'dragon-wrap';
  container.id = 'dragon';
  container.setAttribute('aria-hidden', 'true');
  container.innerHTML =
    '<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg">' +
    '<g class="dragon-body-bob">' +
    '<ellipse class="dragon-scale-shimmer" cx="55" cy="55" rx="22" ry="16" fill="#111117" stroke="#c8ff00" stroke-width="0.5" stroke-opacity="0.3"/>' +
    '<path d="M38,50 Q42,48 48,49 Q54,50 60,49 Q66,48 72,50" fill="none" stroke="#c8ff00" stroke-width="0.25" opacity="0.2"/>' +
    '<path d="M40,54 Q46,52 52,53 Q58,54 64,53 Q70,52 74,54" fill="none" stroke="#c8ff00" stroke-width="0.25" opacity="0.15"/>' +
    '<ellipse cx="55" cy="60" rx="14" ry="9" fill="#1e1e28"/>' +
    '<path d="M44,56 Q50,54 56,55 Q62,56 66,55" fill="none" stroke="#3a3a50" stroke-width="0.3" opacity="0.5"/>' +
    '</g>' +
    '<circle cx="80" cy="42" r="13" fill="#111117" stroke="#c8ff00" stroke-width="0.4" stroke-opacity="0.3"/>' +
    '<path d="M72,37 Q76,35 80,36 Q84,35 88,37" fill="none" stroke="#c8ff00" stroke-width="0.2" opacity="0.15"/>' +
    '<ellipse cx="92" cy="44" rx="7" ry="5" fill="#18181f"/>' +
    '<circle class="dragon-nostril-glow" cx="97" cy="42" r="1.8" fill="#ff6633" opacity="0.7"/>' +
    '<circle class="dragon-nostril-glow" cx="97" cy="46" r="1.8" fill="#ff6633" opacity="0.7" style="animation-delay:0.3s"/>' +
    '<g class="dragon-fire">' +
    '<ellipse cx="108" cy="44" rx="10" ry="3.5" fill="url(#fireGrad)" opacity="0.9"/>' +
    '<ellipse cx="114" cy="44" rx="6" ry="2" fill="#ff4400" opacity="0.7"/>' +
    '<ellipse cx="118" cy="44" rx="3" ry="1" fill="#ffaa00" opacity="0.5"/>' +
    '</g>' +
    '<defs><radialGradient id="fireGrad" cx="30%" cy="50%"><stop offset="0%" stop-color="#ffcc00"/><stop offset="50%" stop-color="#ff6600"/><stop offset="100%" stop-color="#ff2200" stop-opacity="0"/></radialGradient></defs>' +
    '<g class="dragon-eye-blink">' +
    '<circle cx="84" cy="39" r="5" fill="#c8ff00"/>' +
    '<circle cx="84" cy="39" r="2.2" fill="#111"/>' +
    '<circle cx="83" cy="38" r="0.8" fill="#fff" opacity="0.6"/>' +
    '</g>' +
    '<polygon points="76,31 74,20 79,30" fill="#c0c0cc"/>' +
    '<polygon points="82,30 82,18 86,29" fill="#c0c0cc"/>' +
    '<polygon points="73,35 66,27 74,33" fill="#bf5af2" opacity="0.85"/>' +
    '<polygon points="72,38 65,32 73,37" fill="#9b40d0" opacity="0.6"/>' +
    '<g class="dragon-wing-l" style="transform-origin:45px 48px">' +
    '<path d="M45,48 Q20,15 10,30 Q18,35 25,38 Q15,25 22,22 Q28,30 32,36 Q22,18 30,18 Q34,28 38,40 Z" fill="#bf5af2" stroke="#e0a0ff" stroke-width="0.6" opacity="0.85"/>' +
    '<path class="dragon-wing-membrane" d="M25,38 Q22,30 22,22 M32,36 Q28,26 30,18" fill="none" stroke="#d080ff" stroke-width="0.3"/>' +
    '</g>' +
    '<g class="dragon-wing-r" style="transform-origin:50px 45px">' +
    '<path d="M50,45 Q38,12 28,25 Q34,28 38,32 Q30,20 35,18 Q38,26 42,34 Q34,14 40,15 Q42,24 46,38 Z" fill="#bf5af2" stroke="#e0a0ff" stroke-width="0.6" opacity="0.7"/>' +
    '<path class="dragon-wing-membrane" d="M38,32 Q34,24 35,18 M42,34 Q38,22 40,15" fill="none" stroke="#d080ff" stroke-width="0.3"/>' +
    '</g>' +
    '<g fill="#111117">' +
    '<rect x="42" y="66" width="5" height="10" rx="2"/>' +
    '<rect x="60" y="66" width="5" height="10" rx="2"/>' +
    '<circle cx="42" cy="76" r="1.5" fill="#c0c0cc"/>' +
    '<circle cx="47" cy="76" r="1.5" fill="#c0c0cc"/>' +
    '<circle cx="60" cy="76" r="1.5" fill="#c0c0cc"/>' +
    '<circle cx="65" cy="76" r="1.5" fill="#c0c0cc"/>' +
    '</g>' +
    '<g class="dragon-tail">' +
    '<path d="M34,58 Q18,62 8,55 Q4,52 6,48" fill="none" stroke="#111117" stroke-width="5" stroke-linecap="round"/>' +
    '<path d="M34,58 Q18,62 8,55 Q4,52 6,48" fill="none" stroke="#c8ff00" stroke-width="0.6" stroke-linecap="round" opacity="0.25"/>' +
    '<polygon points="6,48 1,42 10,46" fill="#bf5af2"/>' +
    '</g>' +
    '</svg>';

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
  var glideTimer = 0;

  var fireEl = d.querySelector('.dragon-fire');
  var wingL = d.querySelector('.dragon-wing-l');
  var wingR = d.querySelector('.dragon-wing-r');
  var fireTimer = 0;

  function pickState() {
    var r = Math.random();
    if (r < 0.35) {
      state = 'glide';
      stateTimer = 120 + Math.floor(Math.random() * 180);
      if (wingL) { wingL.classList.add('glide'); wingR.classList.add('glide'); }
    } else if (r < 0.55) {
      state = 'dive';
      stateTimer = 60 + Math.floor(Math.random() * 80);
      if (wingL) { wingL.classList.remove('glide'); wingR.classList.remove('glide'); }
    } else if (r < 0.7) {
      state = 'circle';
      stateTimer = 150 + Math.floor(Math.random() * 200);
      if (wingL) { wingL.classList.remove('glide'); wingR.classList.remove('glide'); }
    } else {
      state = 'fly';
      stateTimer = 200 + Math.floor(Math.random() * 400);
      if (wingL) { wingL.classList.remove('glide'); wingR.classList.remove('glide'); }
    }
  }

  function frame() {
    time++;
    stateTimer--;

    if (stateTimer <= 0) pickState();

    if (fireTimer > 0) {
      fireTimer--;
      if (fireTimer <= 0 && fireEl) fireEl.classList.remove('active');
    }
    if (Math.random() < 0.002 && fireTimer <= 0) {
      fireTimer = 15 + Math.floor(Math.random() * 25);
      if (fireEl) fireEl.classList.add('active');
    }

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
