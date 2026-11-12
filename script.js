(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const STORAGE_ROOMS = 'faithRoomsSeenV8';
  const STORAGE_SAVE = 'faithPortfolioSaveV8';
  const STORAGE_SOUND = 'faithSoundV8';
  const TOTAL_ROOMS = 6;
  const ROOM_META = [
    { id:'underground', label:'The Underground', href:'index.html#home' },
    { id:'about', label:'Who Fell Down?', href:'index.html#about' },
    { id:'paths', label:'Choose Your Path', href:'index.html#paths' },
    { id:'technology', label:'Information Technology', href:'technology.html#top' },
    { id:'modeling', label:'Modeling + Runway', href:'modeling.html#top' },
    { id:'barrier', label:'The Barrier', href:'index.html#contact' }
  ];
  let roomsModal = null;

  requestAnimationFrame(() => document.body.classList.add('booted'));

  /* ---------- SOUND ---------- */
  let audio = null;
  let soundOn = localStorage.getItem(STORAGE_SOUND) !== 'off';
  function tone(freq, dur=.045, type='square', vol=.025, delay=0) {
    if (!soundOn) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const t = audio.currentTime + delay;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(.0001, t + dur);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start(t);
      osc.stop(t + dur + .02);
    } catch (_) {}
  }
  const sfx = {
    blip: () => tone(370 + Math.random()*45, .035, 'square', .014),
    move: () => tone(860, .035, 'square', .018),
    select: () => { tone(660,.055); tone(990,.08,'square',.025,.055); },
    cancel: () => { tone(300,.05); tone(220,.07,'square',.02,.05); },
    save: () => [523,659,784,1047,1319].forEach((f,i)=>tone(f,.14,'triangle',.045,i*.08))
  };
  const soundBtn = document.getElementById('sound-btn');
  function renderSound() {
    if (!soundBtn) return;
    soundBtn.textContent = `SOUND: ${soundOn ? 'ON' : 'OFF'}`;
    soundBtn.setAttribute('aria-pressed', String(soundOn));
  }
  renderSound();
  if (soundBtn) soundBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    localStorage.setItem(STORAGE_SOUND, soundOn ? 'on' : 'off');
    renderSound();
    if (soundOn) sfx.select();
  });

  /* ---------- TYPEWRITER ---------- */
  let typeTimer = null;
  let typeTarget = null;
  let typeFull = '';
  function typeInto(el, text, withSound=true) {
    if (!el) return;
    clearTimeout(typeTimer);
    typeTimer = null;
    typeTarget = el;
    typeFull = text;
    if (reduced) { el.textContent = text; return; }
    el.textContent = '';
    let i = 0;
    const step = () => {
      i += 1;
      el.textContent = text.slice(0,i);
      const ch = text[i-1];
      if (withSound && ch && ch !== ' ' && i % 2) sfx.blip();
      if (i < text.length) typeTimer = setTimeout(step, /[.,!?]/.test(ch) ? 100 : 18);
      else typeTimer = null;
    };
    step();
  }
  function finishTyping() {
    if (!typeTimer || !typeTarget) return false;
    clearTimeout(typeTimer);
    typeTimer = null;
    typeTarget.textContent = typeFull;
    return true;
  }

  /* ---------- SCROLL REVEALS ---------- */
  const reveals = document.querySelectorAll('.reveal-left,.reveal-right,.reveal-up');
  if ('IntersectionObserver' in window && !reduced) {
    const ro = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('visible');
        ro.unobserve(entry.target);
      });
    }, { threshold: .12, rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(el => ro.observe(el));
  } else reveals.forEach(el => el.classList.add('visible'));

  /* ---------- ROOMS EXPLORED ACROSS PAGES ---------- */
  const roomCount = document.getElementById('rooms-count');
  let seenRooms;
  try { seenRooms = new Set(JSON.parse(localStorage.getItem(STORAGE_ROOMS) || '[]')); }
  catch (_) { seenRooms = new Set(); }
  function renderRooms() {
    if (roomCount) roomCount.textContent = Math.min(seenRooms.size, TOTAL_ROOMS);
    if (roomsModal) renderRoomsModal();
  }
  function markRoom(key) {
    if (!key || seenRooms.has(key)) return false;
    seenRooms.add(key);
    localStorage.setItem(STORAGE_ROOMS, JSON.stringify([...seenRooms]));
    renderRooms();
    return true;
  }
  renderRooms();

  const roomEls = [...document.querySelectorAll('[data-room]')];
  if ('IntersectionObserver' in window) {
    const roomObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const key = entry.target.dataset.room;
        markRoom(key);
      });
    }, { rootMargin: '0px 0px -24% 0px', threshold: .15 });
    roomEls.forEach(el => roomObserver.observe(el));
  } else {
    roomEls.forEach(el => markRoom(el.dataset.room));
  }

  /* ---------- CONFIRM BUTTONS + SOUND BEFORE NAVIGATION ---------- */
  document.querySelectorAll('a[data-confirm]').forEach(el => {
    el.addEventListener('click', e => {
      const href = el.getAttribute('href');
      if (!href || href === '#') {
        sfx.select();
        el.classList.add('confirmed');
        setTimeout(() => el.classList.remove('confirmed'), 300);
        return;
      }
      e.preventDefault();
      sfx.select();
      el.classList.add('confirmed');
      setTimeout(() => {
        el.classList.remove('confirmed');
        if (href.startsWith('#')) {
          const target = document.querySelector(href);
          if (target) target.scrollIntoView({behavior: reduced ? 'auto' : 'smooth', block:'start'});
        } else if (el.getAttribute('target') === '_blank') {
          window.open(href, '_blank', 'noopener');
        } else {
          location.href = href;
        }
      }, soundOn ? 125 : 35);
    });
  });

  /* ---------- SAVE SYSTEM ---------- */
  const toast = document.getElementById('saved-toast');
  const continueBtn = document.getElementById('continue-btn');
  let toastTimer;
  function showToast(msg) {
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.textContent = msg;
    toast.classList.add('show');
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1600);
  }
  function getSave() {
    try { return JSON.parse(localStorage.getItem(STORAGE_SAVE) || 'null'); }
    catch (_) { return null; }
  }
  function refreshContinue() {
    if (continueBtn) continueBtn.classList.toggle('visible', !!getSave());
  }
  refreshContinue();
  const latestSave = getSave();
  document.querySelectorAll('.save-station').forEach(station => {
    const button = station.querySelector('.save-button');
    if (!button) return;

    // Restore the visible saved state when this exact checkpoint is the latest save.
    const stationPage = station.dataset.savePage || location.pathname.split('/').pop() || 'index.html';
    const stationTarget = station.dataset.saveTarget || station.id || 'home';
    if (latestSave && latestSave.page === stationPage && latestSave.target === stationTarget) {
      station.classList.add('saved');
      const existingLabel = station.querySelector('.save-copy strong');
      if (existingLabel) existingLabel.textContent = 'PROGRESS SAVED';
    }

    button.addEventListener('click', () => {
      const saveRoom = station.dataset.saveRoom || station.closest('[data-room]')?.dataset.room || document.querySelector('.route-main[data-room]')?.dataset.room;
      if (saveRoom) markRoom(saveRoom);
      const save = {
        page: station.dataset.savePage || location.pathname.split('/').pop() || 'index.html',
        target: station.dataset.saveTarget || station.id || 'home',
        rooms: [...seenRooms],
        savedAt: Date.now()
      };
      localStorage.setItem(STORAGE_SAVE, JSON.stringify(save));
      station.classList.add('saved');
      const label = station.querySelector('.save-copy strong');
      if (label) label.textContent = 'PROGRESS SAVED';
      sfx.save();
      showToast(`FILE SAVED. ${seenRooms.size}/${TOTAL_ROOMS} ROOMS.`);
      refreshContinue();
    });
  });
  if (continueBtn) continueBtn.addEventListener('click', e => {
    const save = getSave();
    if (!save) return;
    e.preventDefault();
    sfx.select();
    continueBtn.classList.add('confirmed');
    const page = save.page || 'index.html';
    const target = save.target ? `#${save.target}` : '';
    const here = location.pathname.split('/').pop() || 'index.html';
    setTimeout(() => {
      continueBtn.classList.remove('confirmed');
      if (page === here || (page === 'index.html' && here === '')) {
        const el = document.getElementById(save.target);
        if (el) el.scrollIntoView({behavior: reduced ? 'auto':'smooth', block:'start'});
      } else location.href = `${page}${target}`;
    }, soundOn ? 125 : 35);
  });

  /* ---------- ROOMS / CHECKPOINT MAP ---------- */
  function buildRoomsModal() {
    if (document.getElementById('rooms-modal')) return document.getElementById('rooms-modal');
    const back = document.createElement('div');
    back.className = 'modal-backdrop';
    back.id = 'rooms-modal';
    back.setAttribute('aria-hidden','true');
    back.innerHTML = `
      <section class="controls-modal rooms-modal" role="dialog" aria-modal="true" aria-labelledby="rooms-title">
        <div class="modal-head">
          <h2 id="rooms-title">ROOMS / CHECKPOINTS</h2>
          <button class="modal-close" type="button" data-close-modal>CLOSE [X]</button>
        </div>
        <p class="room-map-intro">* Rooms you've reached are marked FOUND. Missing rooms glow brighter.</p>
        <div class="room-map-list" id="room-map-list"></div>
      </section>`;
    document.body.appendChild(back);
    return back;
  }
  function renderRoomsModal() {
    if (!roomsModal) return;
    const list = roomsModal.querySelector('#room-map-list');
    if (!list) return;
    list.innerHTML = '';
    ROOM_META.forEach(room => {
      const found = seenRooms.has(room.id);
      const a = document.createElement('a');
      a.className = `room-map-item ${found ? 'found' : 'missing'}`;
      a.href = room.href;
      a.dataset.confirm = '';
      a.innerHTML = `<span class="room-map-icon" aria-hidden="true"></span><span>${room.label}</span><span class="room-map-status">${found ? 'FOUND' : 'MISSING'}</span>`;
      a.addEventListener('click', e => {
        e.preventDefault();
        sfx.select();
        const href = room.href;
        const here = location.pathname.split('/').pop() || 'index.html';
        const [page, hash=''] = href.split('#');
        const normalizedPage = page || here;
        closeModals(false);
        setTimeout(() => {
          if (normalizedPage === here || (normalizedPage === 'index.html' && here === '')) {
            const target = hash ? document.getElementById(hash) : null;
            if (target) target.scrollIntoView({behavior: reduced ? 'auto' : 'smooth', block:'start'});
          } else {
            location.href = href;
          }
        }, soundOn ? 110 : 20);
      });
      list.appendChild(a);
    });
  }
  roomsModal = buildRoomsModal();
  renderRoomsModal();

  /* ---------- INVENTORY + CONTROLS MODALS ---------- */
  const inventoryModal = document.getElementById('inventory-modal');
  const controlsModal = document.getElementById('controls-modal');
  const roomsTriggers = document.querySelectorAll('[data-open-rooms]');
  const inventoryTriggers = document.querySelectorAll('[data-open-inventory]');
  const controlsTriggers = document.querySelectorAll('[data-open-controls]');
  const slots = [...document.querySelectorAll('.slot')];
  const itemName = document.getElementById('item-name');
  const itemDesc = document.getElementById('item-desc');
  let slotIndex = 0;

  function openModal(modal) {
    if (!modal) return;
    document.querySelectorAll('.modal-backdrop.open').forEach(m => {
      m.classList.remove('open');
      m.setAttribute('aria-hidden','true');
    });
    modal.classList.add('open');
    modal.setAttribute('aria-hidden','false');
    sfx.select();
    const first = modal === roomsModal ? modal.querySelector('.room-map-item') : modal.querySelector('button');
    if (first) first.focus();
  }
  function closeModals(play=true) {
    const open = document.querySelector('.modal-backdrop.open');
    if (!open) return false;
    open.classList.remove('open');
    open.setAttribute('aria-hidden','true');
    if (play) sfx.cancel();
    return true;
  }
  roomsTriggers.forEach(b => b.addEventListener('click', e => { e.preventDefault(); renderRoomsModal(); openModal(roomsModal); }));
  inventoryTriggers.forEach(b => b.addEventListener('click', e => { e.preventDefault(); openModal(inventoryModal); }));
  controlsTriggers.forEach(b => b.addEventListener('click', e => { e.preventDefault(); openModal(controlsModal); }));
  document.querySelectorAll('[data-close-modal]').forEach(b => b.addEventListener('click', () => closeModals()));
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.addEventListener('mousedown', e => {
    if (e.target === backdrop) closeModals();
  }));

  function inspectSlot(i, confirmed=false) {
    if (!slots.length) return;
    slotIndex = (i + slots.length) % slots.length;
    slots.forEach((s,j) => s.classList.toggle('keyboard-focus', j===slotIndex));
    const slot = slots[slotIndex];
    if (itemName) itemName.textContent = slot.dataset.name;
    if (itemDesc) typeInto(itemDesc, slot.dataset.desc);
    if (confirmed) {
      sfx.select();
      slot.classList.add('confirmed');
      setTimeout(() => slot.classList.remove('confirmed'), 260);
    }
  }
  slots.forEach((slot,i) => {
    slot.addEventListener('mouseenter', () => {
      slots.forEach(s => s.classList.remove('keyboard-focus'));
      if (itemName) itemName.textContent = slot.dataset.name;
      if (itemDesc) typeInto(itemDesc, slot.dataset.desc);
    });
    slot.addEventListener('focus', () => inspectSlot(i));
    slot.addEventListener('click', () => inspectSlot(i,true));
  });

  /* ---------- CAREER PATH INFO ---------- */
  const pathInfo = document.getElementById('path-info');
  const pathCards = [...document.querySelectorAll('.path-card')];
  pathCards.forEach(card => {
    const preview = () => typeInto(pathInfo, card.dataset.desc);
    card.addEventListener('mouseenter', preview);
    card.addEventListener('focus', preview);
    card.addEventListener('click', e => {
      e.preventDefault();
      sfx.select();
      card.classList.add('confirmed');
      setTimeout(() => location.href = card.getAttribute('href'), soundOn ? 125 : 35);
    });
  });

  /* ---------- BOTTOM BATTLE MENU ---------- */
  const menuInfo = document.getElementById('menu-info-text');
  const menuButtons = [...document.querySelectorAll('.menu-button')];
  let menuIndex = 0;
  function previewMenu(i, speak=true) {
    if (!menuButtons.length) return;
    menuIndex = (i + menuButtons.length) % menuButtons.length;
    menuButtons.forEach((b,j) => b.classList.toggle('keyboard-focus', j===menuIndex));
    if (speak && menuInfo) typeInto(menuInfo, menuButtons[menuIndex].dataset.desc || '');
  }
  function confirmMenu(btn) {
    sfx.select();
    btn.classList.add('confirmed');
    setTimeout(() => btn.classList.remove('confirmed'), 300);
  }
  menuButtons.forEach((btn,i) => {
    btn.addEventListener('mouseenter', () => {
      menuButtons.forEach(b => b.classList.remove('keyboard-focus'));
      if (menuInfo) typeInto(menuInfo, btn.dataset.desc || '');
    });
    btn.addEventListener('focus', () => previewMenu(i));
    btn.addEventListener('mouseleave', () => {
      if (menuInfo && !btn.matches(':focus-visible')) typeInto(menuInfo, 'Hover over a path to inspect it.', false);
    });
    btn.addEventListener('click', e => {
      confirmMenu(btn);
      if (btn.hasAttribute('data-open-inventory')) {
        e.preventDefault();
        openModal(inventoryModal);
      }
    });
  });

  /* ---------- KEYBOARD CONTROLS ---------- */
  function norm(e) { return e.key.length === 1 ? e.key.toLowerCase() : e.key; }
  document.addEventListener('keydown', e => {
    const key = norm(e);
    if (key === 'c') { if (finishTyping()) e.preventDefault(); return; }

    const openModalEl = document.querySelector('.modal-backdrop.open');
    if (openModalEl) {
      if (key === 'x' || key === 'Escape') { e.preventDefault(); closeModals(); return; }
      if (openModalEl === roomsModal) {
        const roomItems = [...roomsModal.querySelectorAll('.room-map-item')];
        if (roomItems.length) {
          let i = roomItems.indexOf(document.activeElement);
          if (i < 0) i = 0;
          let nextRoom = null;
          if (key === 'ArrowDown' || key === 's' || key === 'ArrowRight' || key === 'd') nextRoom = Math.min(roomItems.length - 1, i + 1);
          if (key === 'ArrowUp' || key === 'w' || key === 'ArrowLeft' || key === 'a') nextRoom = Math.max(0, i - 1);
          if (nextRoom !== null) { e.preventDefault(); sfx.move(); roomItems[nextRoom].focus(); return; }
          if (key === 'z' || key === 'Enter') { e.preventDefault(); roomItems[i].click(); return; }
        }
      }
      if (openModalEl === inventoryModal && slots.length) {
        let next = null;
        if (key === 'ArrowRight' || key === 'd') next = slotIndex + 1;
        if (key === 'ArrowLeft' || key === 'a') next = slotIndex - 1;
        if (key === 'ArrowDown' || key === 's') next = slotIndex + 2;
        if (key === 'ArrowUp' || key === 'w') next = slotIndex - 2;
        if (next !== null) { e.preventDefault(); sfx.move(); inspectSlot(next); slots[slotIndex].focus(); return; }
        if (key === 'z' || key === 'Enter') { e.preventDefault(); inspectSlot(slotIndex,true); return; }
      }
      return;
    }

    if (key === 'x' || key === 'Escape') {
      e.preventDefault();
      sfx.cancel();
      const home = document.body.dataset.home || 'index.html#home';
      if (home.startsWith('#')) {
        const target = document.querySelector(home);
        if (target) target.scrollIntoView({behavior: reduced ? 'auto':'smooth', block:'start'});
      } else location.href = home;
      return;
    }

    let next = null;
    if (key === 'ArrowRight' || key === 'ArrowDown' || key === 'd' || key === 's') next = menuIndex + 1;
    if (key === 'ArrowLeft' || key === 'ArrowUp' || key === 'a' || key === 'w') next = menuIndex - 1;
    if (next !== null && menuButtons.length) {
      e.preventDefault();
      sfx.move();
      previewMenu(next);
      menuButtons[menuIndex].focus({preventScroll:true});
      return;
    }
    if ((key === 'z' || key === 'Enter') && menuButtons.length) {
      const active = document.activeElement;
      if (active && ['A','BUTTON'].includes(active.tagName) && !active.classList.contains('menu-button')) return;
      e.preventDefault();
      const btn = menuButtons[menuIndex];
      confirmMenu(btn);
      if (btn.hasAttribute('data-open-inventory')) openModal(inventoryModal);
      else if (btn.tagName === 'A' && btn.href) location.href = btn.href;
    }
  });


  /* ---------- V6 STORYBOOK AMBIENCE ---------- */
  const LANTERN = [
    '.....XX.....',
    '....X..X....',
    '...X....X...',
    '....XXXX....',
    '...XYYYYX...',
    '..XYYWWYYX..',
    '..XYWWWWYX..',
    '..XYWWWWYX..',
    '..XYYWWYYX..',
    '...XYYYYX...',
    '....XXXX....',
    '...X....X...',
    '..X......X..',
    '..XXXXXXXX..'
  ];
  function pixelSprite(rows, palette) {
    let rects = '';
    rows.forEach((row,y) => {
      let x = 0;
      while (x < row.length) {
        const c = row[x]; let n = 1;
        while (row[x+n] === c) n++;
        if (palette[c]) rects += `<rect x="${x}" y="${y}" width="${n}" height="1" fill="${palette[c]}"/>`;
        x += n;
      }
    });
    return `<svg viewBox="0 0 ${rows[0].length} ${rows.length}" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
  }
  const lanternSvg = pixelSprite(LANTERN, {X:'#946e4b',Y:'#f6c75a',W:'#fff8d8'});
  document.querySelectorAll('[data-lantern]').forEach(el => { el.innerHTML = lanternSvg; });

  // If the user later drops an image at a declared path, it replaces the placeholder automatically.
  document.querySelectorAll('[data-img]').forEach(box => {
    const src = box.dataset.img;
    if (!src) return;
    const img = new Image();
    img.onload = () => {
      img.alt = box.dataset.alt || '';
      box.querySelectorAll('.storybook-placeholder, .path-placeholder').forEach(p => p.remove());
      box.prepend(img);
      box.classList.add('has-image');
    };
    img.src = src;
  });

  // Deterministic golden lights drifting through the story / route pages.
  function seedLights(container, count=26, seedStart=17) {
    if (!container) return;
    let seed = seedStart;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i=0; i<count; i++) {
      const f = document.createElement('i');
      f.className = 'firefly';
      f.style.setProperty('--x', `${(4 + rand()*92).toFixed(2)}%`);
      f.style.setProperty('--y', `${(rand()*96).toFixed(2)}%`);
      f.style.setProperty('--dx', `${(-20 + rand()*40).toFixed(1)}px`);
      f.style.setProperty('--dy', `${(-34 + rand()*46).toFixed(1)}px`);
      f.style.setProperty('--dur', `${(5.8 + rand()*5.4).toFixed(2)}s`);
      f.style.setProperty('--delay', `${(-rand()*7).toFixed(2)}s`);
      const size = rand() > .82 ? 6 : (rand() > .55 ? 4 : 3);
      f.style.width = `${size}px`; f.style.height = `${size}px`;
      container.appendChild(f);
    }
  }
  seedLights(document.querySelector('.story-lights'), 34, 19);
  seedLights(document.querySelector('.route-lights'), 28, document.body.classList.contains('modeling-page') ? 31 : 23);

  // Gentle parallax on storybook art, borrowed from Claude's visual rhythm.
  const parallaxEls = [...document.querySelectorAll('[data-parallax]')];
  let paraTicking = false;
  function updateParallax() {
    paraTicking = false;
    if (reduced) return;
    const mid = innerHeight / 2;
    parallaxEls.forEach(el => {
      if (!el.offsetParent) return;
      const r = el.getBoundingClientRect();
      if (r.bottom < -220 || r.top > innerHeight + 220) return;
      const speed = parseFloat(el.dataset.parallax || 0);
      const y = (r.top + r.height/2 - mid) * -speed;
      el.style.translate = `0 ${y.toFixed(1)}px`;
    });
  }
  if (!reduced && parallaxEls.length) {
    addEventListener('scroll', () => {
      if (!paraTicking) { paraTicking = true; requestAnimationFrame(updateParallax); }
    }, {passive:true});
    updateParallax();
  }

  menuButtons.forEach(b => b.classList.remove('keyboard-focus'));
})();
