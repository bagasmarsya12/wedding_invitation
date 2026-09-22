(() => {
  const root = document.querySelector('.world-garden');
  if (!root || root.dataset.worldReady) return;
  root.dataset.worldReady = 'true';
  const hero = root.querySelector('.story-cover');
  const passage = root.querySelector('.garden-passage');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const precise = matchMedia('(hover: hover) and (pointer: fine)');
  const light = root.querySelector('.light-control');
  if (light) {
    light.hidden = false;
    light.querySelector('input').addEventListener('input', event => {
      hero.style.setProperty('--light', Number(event.target.value) / 100);
    });
  }
  // Only visible scenes are measured. No perpetual frame loop or scroll hijack.
  const visible = new Set();
  let frame = 0, last = 0;
  let targetX = 0, targetY = 0, x = 0, y = 0, p = 0;
  const clamp = n => Math.max(0, Math.min(1, n));
  const schedule = () => {
    if (!frame && !document.hidden && !reduced.matches && visible.size) frame = requestAnimationFrame(tick);
  };
  function tick(now) {
    frame = 0;
    if (document.hidden || reduced.matches) return;
    const factor = 1 - Math.exp(-Math.min(now - (last || now - 16), 64) / 160);
    last = now;
    let moving = false;
    if (visible.has(hero)) {
      x += (targetX - x) * factor;
      y += (targetY - y) * factor;
      hero.style.setProperty('--px', x.toFixed(4));
      hero.style.setProperty('--py', y.toFixed(4));
      hero.style.setProperty('--travel', clamp(-hero.getBoundingClientRect().top / innerHeight).toFixed(4));
      moving = Math.abs(targetX-x) + Math.abs(targetY-y) > .001;
    }
    if (visible.has(passage)) {
      const rect = passage.getBoundingClientRect();
      const target = clamp((innerHeight - rect.top) / (rect.height + innerHeight));
      p += (target - p) * factor;
      passage.style.setProperty('--passage', p.toFixed(4));
      moving ||= Math.abs(target-p) > .001;
    }
    if (moving) schedule();
  }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => entry.isIntersecting ? visible.add(entry.target) : visible.delete(entry.target));
    schedule();
  }, {rootMargin:'60px'});
  [hero,passage].filter(Boolean).forEach(scene => observer.observe(scene));
  addEventListener('scroll', schedule, {passive:true});
  addEventListener('resize', schedule, {passive:true});
  hero.addEventListener('pointermove', event => {
    if (!precise.matches || reduced.matches) return;
    const rect = hero.getBoundingClientRect();
    targetX = ((event.clientX-rect.left)/rect.width-.5)*2;
    targetY = ((event.clientY-rect.top)/rect.height-.5)*2;
    schedule();
  }, {passive:true});
  hero.addEventListener('pointerleave', () => {targetX=0;targetY=0;schedule();});
  function resetMotion() {
    cancelAnimationFrame(frame);frame=0;last=0;
    if (reduced.matches) {
      x=y=targetX=targetY=0;
      hero.style.setProperty('--px','0');
      hero.style.setProperty('--py','0');
      hero.style.setProperty('--travel','0');
      passage.style.setProperty('--passage','.5');
    } else schedule();
  }
  reduced.addEventListener('change', resetMotion);
  document.addEventListener('visibilitychange', resetMotion);
  resetMotion();
  const context = document.querySelector('#invite-context');
  if (context?.dataset.token) {
    root.querySelectorAll('[data-invite-path="mark"]').forEach(link => link.textContent='Leave a mark');
    const note = root.querySelector('.postcard-placeholder small');
    if (note) note.textContent='Pesan dan gambar tampil setelah disetujui.';
    const formNote = root.querySelector('.form-preview-note');
    if (formNote) {
      formNote.querySelector('strong').textContent='Your invitation';
      formNote.querySelector('span').textContent='Konfirmasi kehadiran tersimpan untuk undangan Anda.';
    }
  }
})();
