/* =========================================================
   FAIR TEAMS — app logic
   ========================================================= */

(function(){
  "use strict";

  /* ---------- STATE ---------- */
  let state = {
    players: [],          // [{id, name, playing}]  order = rank order (0 = best)
    pairingEnabled: true,
    pairs: [],            // [[id, id|null], ...]  manual overrides live here
    leftoverId: null,      // id of player sitting out of pairs (odd count)
    teams: null            // {a:[ids], b:[ids]} last generated
  };

  let coinState = {
    headsImage: '',
    tailsImage: '',
    headsProbability: 50,
    lastResult: null
  };

  let uid = 1;
  function nextId(){ return 'p' + (uid++); }

  /* ---------- DOM REFS ---------- */
  const $ = (sel) => document.querySelector(sel);
  const $all = (sel) => Array.from(document.querySelectorAll(sel));

  const stageEls = { 1: $('#stage1'), 2: $('#stage2'), 3: $('#stage3') };
  const stageDots = $all('.stage-dot');
  const railFill = $('#railFill');
  const railFill2 = $('#railFill2');

  const addPlayerForm = $('#addPlayerForm');
  const playerNameInput = $('#playerNameInput');
  const playerList = $('#playerList');
  const playerCount = $('#playerCount');
  const playingCount = $('#playingCount');
  const clearAllBtn = $('#clearAllBtn');
  const toStage2Btn = $('#toStage2Btn');

  const pairingToggle = $('#pairingToggle');
  const toggleDesc = $('#toggleDesc');
  const pairList = $('#pairList');
  const leftoverZone = $('#leftoverZone');
  const leftoverRow = $('#leftoverRow');
  const backTo1Btn = $('#backTo1Btn');
  const toStage3Btn = $('#toStage3Btn');

  const teamARoster = $('#teamARoster');
  const teamBRoster = $('#teamBRoster');
  const teamATally = $('#teamATally');
  const teamBTally = $('#teamBTally');
  const shuffleBtn = $('#shuffleBtn');
  const backTo2Btn = $('#backTo2Btn');
  const savePresetBtn = $('#savePresetBtn');

  const presetsFab = $('#presetsFab');
  const drawerOverlay = $('#drawerOverlay');
  const presetsDrawer = $('#presetsDrawer');
  const closeDrawerBtn = $('#closeDrawerBtn');
  const presetList = $('#presetList');

  const coinFab = $('#coinFab');
  const coinPage = $('#coinPage');
  const coinBackBtn = $('#coinBackBtn');
  const coin3d = $('#coin3d');
  const coinHeadsFace = $('#coinHeadsFace');
  const coinTailsFace = $('#coinTailsFace');
  const coinResult = $('#coinResult');
  const flipCoinBtn = $('#flipCoinBtn');
  const headsImageInput = $('#headsImageInput');
  const tailsImageInput = $('#tailsImageInput');
  const headsProbability = $('#headsProbability');
  const headsProbabilityLabel = $('#headsProbabilityLabel');
  const tailsProbabilityLabel = $('#tailsProbabilityLabel');
  const coinPresetNameInput = $('#coinPresetNameInput');
  const saveCoinPresetBtn = $('#saveCoinPresetBtn');
  const coinPresetList = $('#coinPresetList');

  const cropModalOverlay = $('#cropModalOverlay');
  const cropModalTitle = $('#cropModalTitle');
  const cropWorkspace = $('#cropWorkspace');
  const cropCanvas = $('#cropCanvas');
  const cropZoom = $('#cropZoom');
  const cancelCropBtn = $('#cancelCropBtn');
  const applyCropBtn = $('#applyCropBtn');

  const saveModalOverlay = $('#saveModalOverlay');
  const presetNameInput = $('#presetNameInput');
  const cancelSaveBtn = $('#cancelSaveBtn');
  const confirmSaveBtn = $('#confirmSaveBtn');

  const confirmModalOverlay = $('#confirmModalOverlay');
  const confirmModalTitle = $('#confirmModalTitle');
  const confirmModalSub = $('#confirmModalSub');
  const confirmModalCancel = $('#confirmModalCancel');
  const confirmModalOk = $('#confirmModalOk');

  const toastEl = $('#toast');

  let currentStage = 1;
  let cropSession = null;

  /* ---------- TOAST ---------- */
  let toastTimer = null;
  function showToast(msg){
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=> toastEl.classList.remove('show'), 2200);
  }

  /* =========================================================
     COIN FLIP
     ========================================================= */

  function normaliseProbability(value){
    const n = parseInt(value, 10);
    if(Number.isNaN(n)) return 50;
    return Math.max(0, Math.min(100, n));
  }

  function applyCoinFace(face, image, fallback){
    face.classList.toggle('has-image', !!image);
    face.style.backgroundImage = image ? `url("${image}")` : '';
    const label = face.querySelector('span');
    if(label) label.textContent = fallback;
  }

  function renderCoin(){
    coinState.headsProbability = normaliseProbability(coinState.headsProbability);
    const tails = 100 - coinState.headsProbability;
    headsProbability.value = coinState.headsProbability;
    headsProbabilityLabel.textContent = `${coinState.headsProbability}%`;
    tailsProbabilityLabel.textContent = `Tails ${tails}%`;
    applyCoinFace(coinHeadsFace, coinState.headsImage, 'H');
    applyCoinFace(coinTailsFace, coinState.tailsImage, 'T');
    coinResult.textContent = coinState.lastResult ? coinState.lastResult : 'Ready';
  }

  function persistCoinDraft(){
    if(!hasLocalStorage) return;
    try{
      window.localStorage.setItem(COIN_DRAFT_KEY, JSON.stringify(coinState));
    } catch(err){ showToast('Coin image is too large to save'); }
  }

  function restoreCoinDraft(){
    if(!hasLocalStorage){ renderCoin(); return; }
    try{
      const raw = window.localStorage.getItem(COIN_DRAFT_KEY);
      if(raw){
        const parsed = JSON.parse(raw);
        coinState = {
          headsImage: parsed.headsImage || '',
          tailsImage: parsed.tailsImage || '',
          headsProbability: normaliseProbability(parsed.headsProbability),
          lastResult: parsed.lastResult || null
        };
      }
    } catch(err){ /* corrupt coin draft: keep defaults */ }
    renderCoin();
  }

  function openCoinPage(){
    renderCoin();
    renderCoinPresetList();
    coinPage.classList.add('show');
    coinPage.setAttribute('aria-hidden', 'false');
  }

  function closeCoinPage(){
    coinPage.classList.remove('show');
    coinPage.setAttribute('aria-hidden', 'true');
  }

  function clamp(value, min, max){
    return Math.max(min, Math.min(max, value));
  }

  function imageToDataUrl(file){
    return new Promise((resolve, reject)=>{
      const reader = new FileReader();
      reader.onload = ()=> resolve(String(reader.result || ''));
      reader.onerror = ()=> reject(new Error('Could not read image'));
      reader.readAsDataURL(file);
    });
  }

  function loadImage(src){
    return new Promise((resolve, reject)=>{
      const img = new Image();
      img.onload = ()=> resolve(img);
      img.onerror = ()=> reject(new Error('Could not decode image'));
      img.src = src;
    });
  }

  function getCropBounds(){
    if(!cropSession) return { minX:0, maxX:0, minY:0, maxY:0 };
    const size = cropCanvas.width;
    const drawW = cropSession.baseWidth * cropSession.zoom;
    const drawH = cropSession.baseHeight * cropSession.zoom;
    return {
      minX: Math.min(0, size - drawW),
      maxX: Math.max(0, size - drawW),
      minY: Math.min(0, size - drawH),
      maxY: Math.max(0, size - drawH)
    };
  }

  function clampCropOffset(){
    if(!cropSession) return;
    const bounds = getCropBounds();
    cropSession.x = clamp(cropSession.x, bounds.minX, bounds.maxX);
    cropSession.y = clamp(cropSession.y, bounds.minY, bounds.maxY);
  }

  function drawCropPreview(){
    if(!cropSession) return;
    const ctx = cropCanvas.getContext('2d');
    const size = cropCanvas.width;
    const drawW = cropSession.baseWidth * cropSession.zoom;
    const drawH = cropSession.baseHeight * cropSession.zoom;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#080A0F';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(cropSession.image, cropSession.x, cropSession.y, drawW, drawH);
  }

  async function openCropModal(file, side){
    const dataUrl = await imageToDataUrl(file);
    const image = await loadImage(dataUrl);
    const size = cropCanvas.width;
    const coverScale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
    const baseWidth = image.naturalWidth * coverScale;
    const baseHeight = image.naturalHeight * coverScale;
    cropSession = {
      side,
      image,
      baseWidth,
      baseHeight,
      zoom: 1,
      x: (size - baseWidth) / 2,
      y: (size - baseHeight) / 2,
      drag: null
    };
    cropZoom.value = '1';
    cropModalTitle.textContent = `Crop ${side === 'heads' ? 'heads' : 'tails'} picture`;
    clampCropOffset();
    drawCropPreview();
    cropModalOverlay.classList.add('show');
  }

  function closeCropModal(){
    cropModalOverlay.classList.remove('show');
    cropWorkspace.classList.remove('dragging');
    cropSession = null;
  }

  function applyCrop(){
    if(!cropSession) return;
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = 512;
    outputCanvas.height = 512;
    const outputCtx = outputCanvas.getContext('2d');
    outputCtx.fillStyle = '#080A0F';
    outputCtx.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
    outputCtx.drawImage(cropCanvas, 0, 0);
    const cropped = outputCanvas.toDataURL('image/jpeg', 0.88);
    if(cropSession.side === 'heads') coinState.headsImage = cropped;
    else coinState.tailsImage = cropped;
    coinState.lastResult = null;
    coin3d.style.transform = cropSession.side === 'heads' ? 'rotateY(0deg) rotateX(0deg)' : 'rotateY(180deg) rotateX(0deg)';
    renderCoin();
    persistCoinDraft();
    closeCropModal();
  }

  async function readImageFile(input, side){
    const file = input.files && input.files[0];
    if(!file) return;
    try{
      await openCropModal(file, side);
    } catch(err){
      showToast('This image could not be opened');
    } finally {
      input.value = '';
    }
  }

  function flipCoin(){
    if(coin3d.classList.contains('flipping')) return;
    const isHeads = Math.random() * 100 < coinState.headsProbability;
    const result = isHeads ? 'Heads' : 'Tails';
    const startRotation = coinState.lastResult === 'Tails' ? 180 : 0;
    const targetRotation = isHeads ? 0 : 180;
    const targetDelta = (targetRotation - startRotation + 360) % 360;
    const turns = 7 + Math.floor(Math.random() * 2);
    const finalRotation = startRotation + (turns * 360) + targetDelta;
    const totalTravel = finalRotation - startRotation;
    const midRotation = startRotation + (totalTravel * 0.38);
    const lateRotation = startRotation + (totalTravel * 0.72);
    coinState.lastResult = result;

    coinResult.textContent = 'Flipping...';
    flipCoinBtn.disabled = true;
    coin3d.classList.remove('flipping');
    coin3d.style.transform = `rotateY(${startRotation}deg) rotateX(0deg)`;
    coin3d.style.setProperty('--start-rotation', `${startRotation}deg`);
    coin3d.style.setProperty('--mid-rotation', `${midRotation}deg`);
    coin3d.style.setProperty('--late-rotation', `${lateRotation}deg`);
    coin3d.style.setProperty('--final-rotation', `${finalRotation}deg`);
    void coin3d.offsetWidth;
    coin3d.classList.add('flipping');

    window.setTimeout(()=>{
      coin3d.classList.remove('flipping');
      coin3d.style.transform = `rotateY(${finalRotation}deg) rotateX(0deg)`;
      coinResult.textContent = result;
      flipCoinBtn.disabled = false;
      persistCoinDraft();
    }, 1750);
  }

  function readCoinPresetsRaw(){
    if(!hasLocalStorage) return [];
    try{
      const raw = window.localStorage.getItem(COIN_PRESETS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch(err){ return []; }
  }

  function writeCoinPresetsRaw(arr){
    if(!hasLocalStorage) return false;
    try{
      window.localStorage.setItem(COIN_PRESETS_KEY, JSON.stringify(arr));
      return true;
    } catch(err){ return false; }
  }

  function listCoinPresets(){
    return readCoinPresetsRaw().sort((a,b)=> (b.savedAt||0) - (a.savedAt||0));
  }

  function saveCoinPreset(name){
    const data = {
      id: 'coin' + Date.now(),
      name,
      savedAt: Date.now(),
      headsImage: coinState.headsImage,
      tailsImage: coinState.tailsImage,
      headsProbability: coinState.headsProbability
    };
    const arr = readCoinPresetsRaw();
    arr.push(data);
    if(writeCoinPresetsRaw(arr)){
      coinPresetNameInput.value = '';
      renderCoinPresetList();
      showToast('Coin preset saved');
    } else {
      showToast('Could not save coin preset');
    }
  }

  function loadCoinPreset(id){
    const preset = listCoinPresets().find(p=>p.id === id);
    if(!preset) return;
    coinState.headsImage = preset.headsImage || '';
    coinState.tailsImage = preset.tailsImage || '';
    coinState.headsProbability = normaliseProbability(preset.headsProbability);
    coinState.lastResult = null;
    coin3d.style.transform = 'rotateY(0deg) rotateX(0deg)';
    renderCoin();
    persistCoinDraft();
    showToast(`Loaded "${preset.name}"`);
  }

  async function deleteCoinPreset(id){
    const arr = readCoinPresetsRaw().filter(p=>p.id !== id);
    writeCoinPresetsRaw(arr);
    renderCoinPresetList();
    showToast('Coin preset deleted');
  }

  function renderCoinPresetList(){
    const presets = listCoinPresets();
    coinPresetList.innerHTML = '';
    presets.forEach(p=>{
      const item = document.createElement('div');
      item.className = 'coin-preset-item';
      const date = new Date(p.savedAt);
      const dateStr = date.toLocaleDateString(undefined, {month:'short', day:'numeric'});
      const previewStyle = p.headsImage ? `style="background-image:url('${p.headsImage}')"` : '';
      item.innerHTML = `
        <div class="coin-preset-preview">
          <span class="coin-mini" ${previewStyle}></span>
          <div class="coin-preset-copy">
            <span class="coin-preset-name">${escapeHtml(p.name)}</span>
            <span class="coin-preset-meta">Heads ${normaliseProbability(p.headsProbability)}% &middot; ${dateStr}</span>
          </div>
        </div>
        <div class="coin-preset-actions">
          <button class="preset-load-btn" type="button">Use</button>
          <button class="preset-del-btn" type="button" aria-label="Delete coin preset">
            <svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6"/></svg>
          </button>
        </div>
      `;
      item.querySelector('.preset-load-btn').addEventListener('click', ()=> loadCoinPreset(p.id));
      item.querySelector('.preset-del-btn').addEventListener('click', async ()=>{
        const ok = await confirmDialog('Delete this coin preset?', `"${p.name}" will be removed for good.`);
        if(ok) deleteCoinPreset(p.id);
      });
      coinPresetList.appendChild(item);
    });
  }

  /* ---------- CONFIRM MODAL (promise-based) ---------- */
  function confirmDialog(title, sub){
    return new Promise((resolve)=>{
      confirmModalTitle.textContent = title;
      confirmModalSub.textContent = sub;
      confirmModalOverlay.classList.add('show');
      function cleanup(result){
        confirmModalOverlay.classList.remove('show');
        confirmModalOk.removeEventListener('click', onOk);
        confirmModalCancel.removeEventListener('click', onCancel);
        resolve(result);
      }
      function onOk(){ cleanup(true); }
      function onCancel(){ cleanup(false); }
      confirmModalOk.addEventListener('click', onOk);
      confirmModalCancel.addEventListener('click', onCancel);
    });
  }

  /* =========================================================
     STAGE NAVIGATION
     ========================================================= */
  function goToStage(n, opts){
    opts = opts || {};
    if(n === 2 && !opts.force){
      buildPairsUI(true);
    }
    if(n === 3 && !opts.skipGenerate){
      generateTeams();
    }
    currentStage = n;

    [1,2,3].forEach(i=>{
      const el = stageEls[i];
      el.classList.remove('active','prev');
      if(i === n) el.classList.add('active');
      else if(i < n) el.classList.add('prev');
    });

    stageDots.forEach(dot=>{
      const ds = parseInt(dot.dataset.stage,10);
      dot.classList.remove('active','complete');
      if(ds === n) dot.classList.add('active');
      else if(ds < n) dot.classList.add('complete');
      dot.disabled = ds > n;
    });

    railFill.style.width = n >= 2 ? '100%' : '0%';
    railFill2.style.width = n >= 3 ? '100%' : '0%';

    window.scrollTo(0,0);
  }

  stageDots.forEach(dot=>{
    dot.addEventListener('click', ()=>{
      const ds = parseInt(dot.dataset.stage,10);
      if(ds < currentStage) goToStage(ds, {skipGenerate:true, force:true});
    });
  });

  /* =========================================================
     STAGE 1 — ROSTER
     ========================================================= */

  function addPlayer(name){
    name = name.trim();
    if(!name) return;
    state.players.push({ id: nextId(), name, playing: true });
    renderPlayerList();
    persistDraft();
  }

  addPlayerForm.addEventListener('submit', (e)=>{
    e.preventDefault();
    addPlayer(playerNameInput.value);
    playerNameInput.value = '';
    playerNameInput.focus();
  });

  clearAllBtn.addEventListener('click', async ()=>{
    if(state.players.length === 0) return;
    const ok = await confirmDialog('Clear entire roster?', 'This removes every player and ranking. This can\'t be undone.');
    if(ok){
      state.players = [];
      renderPlayerList();
      persistDraft();
    }
  });

  function renderPlayerList(){
    playerList.innerHTML = '';
    state.players.forEach((p, idx)=>{
      const li = document.createElement('li');
      li.className = 'player-row' + (p.playing ? '' : ' unselected');
      li.draggable = false;
      li.dataset.id = p.id;

      li.innerHTML = `
        <span class="rank-badge">#${idx+1}</span>
        <button class="drag-handle" aria-label="Drag to reorder" type="button">
          <svg viewBox="0 0 24 24"><circle cx="9" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.4" fill="currentColor" stroke="none"/></svg>
        </button>
        <span class="player-name-text">${escapeHtml(p.name)}</span>
        <button class="play-toggle ${p.playing ? 'checked' : ''}" aria-label="Playing this game" type="button">
          <svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
        </button>
        <button class="delete-x" aria-label="Remove player" type="button">
          <svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      `;
      playerList.appendChild(li);

      li.querySelector('.play-toggle').addEventListener('click', ()=>{
        p.playing = !p.playing;
        renderPlayerList();
        persistDraft();
      });
      li.querySelector('.delete-x').addEventListener('click', ()=>{
        state.players = state.players.filter(x=>x.id !== p.id);
        renderPlayerList();
        persistDraft();
      });

      initDragHandle(li.querySelector('.drag-handle'), li);
    });

    updateStage1Footer();
  }

  function updateStage1Footer(){
    const total = state.players.length;
    const playing = state.players.filter(p=>p.playing).length;
    playerCount.textContent = `${total} player${total===1?'':'s'}`;
    playingCount.textContent = `${playing} of ${total} selected to play`;
    toStage2Btn.disabled = playing < 2;
  }

  /* ----- drag to reorder (pointer-based, mobile friendly) ----- */
  function initDragHandle(handle, row){
    let startY = 0;
    let dragging = false;
    let rowHeight = 0;

    handle.addEventListener('pointerdown', (e)=>{
      e.preventDefault();
      startY = e.clientY;
      dragging = true;
      rowHeight = row.offsetHeight;
      row.classList.add('dragging');
      row.style.position = 'relative';
      row.style.zIndex = '50';
      handle.setPointerCapture(e.pointerId);

      const onMove = (ev)=>{
        if(!dragging) return;
        const dy = ev.clientY - startY;
        row.style.transform = `translateY(${dy}px)`;

        const siblings = Array.from(playerList.children).filter(c=>c!==row);
        const rowMidY = row.getBoundingClientRect().top + rowHeight/2;
        siblings.forEach(sib=> sib.classList.remove('drag-over-above','drag-over-below'));
        for(const sib of siblings){
          const r = sib.getBoundingClientRect();
          if(rowMidY > r.top && rowMidY < r.bottom){
            if(rowMidY < r.top + r.height/2) sib.classList.add('drag-over-above');
            else sib.classList.add('drag-over-below');
          }
        }
      };

      const onUp = (ev)=>{
        if(!dragging) return;
        dragging = false;
        handle.releasePointerCapture(ev.pointerId);
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);

        row.classList.remove('dragging');
        row.style.transform = '';
        row.style.position = '';
        row.style.zIndex = '';

        const siblings = Array.from(playerList.children).filter(c=>c!==row);
        let found = null;
        for(const sib of siblings){
          if(sib.classList.contains('drag-over-above')){ found = {id: sib.dataset.id, after:false}; }
          if(sib.classList.contains('drag-over-below')){ found = {id: sib.dataset.id, after:true}; }
          sib.classList.remove('drag-over-above','drag-over-below');
        }

        if(found){
          const movingId = row.dataset.id;
          const movingIdx = state.players.findIndex(p=>p.id===movingId);
          const moving = state.players.splice(movingIdx,1)[0];
          let targetIdx = state.players.findIndex(p=>p.id===found.id);
          if(found.after) targetIdx += 1;
          state.players.splice(targetIdx, 0, moving);
          persistDraft();
        }
        renderPlayerList();
      };

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    });
  }

  function escapeHtml(str){
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  toStage2Btn.addEventListener('click', ()=>{
    goToStage(2);
  });

  /* =========================================================
     STAGE 2 — PAIRS
     ========================================================= */

  function getPlayingPlayersRanked(){
    return state.players.filter(p=>p.playing);
  }

  let lastPairSignature = null;

  function buildPairsUI(checkRegenerate){
    const playing = getPlayingPlayersRanked();
    const signature = playing.map(p=>p.id).join(',') + '|' + state.pairingEnabled;

    if(checkRegenerate && signature !== lastPairSignature){
      autoGeneratePairs();
    }
    lastPairSignature = signature;

    pairingToggle.setAttribute('aria-checked', state.pairingEnabled ? 'true' : 'false');
    toggleDesc.textContent = state.pairingEnabled
      ? 'Pairs are matched by rank'
      : 'Off — teams will be fully random';

    renderPairsUI();
  }

  function autoGeneratePairs(){
    const playing = getPlayingPlayersRanked();
    state.pairs = [];
    state.leftoverId = null;

    let ids = playing.map(p=>p.id);
    if(ids.length % 2 !== 0){
      state.leftoverId = ids[ids.length-1];
      ids = ids.slice(0, -1);
    }
    for(let i=0;i<ids.length;i+=2){
      state.pairs.push([ids[i], ids[i+1]]);
    }
  }

  function playerById(id){
    return state.players.find(p=>p.id===id);
  }

  function renderPairsUI(){
    pairList.innerHTML = '';
    pairList.classList.toggle('random-mode', !state.pairingEnabled);

    state.pairs.forEach((pair, idx)=>{
      const card = document.createElement('div');
      card.className = 'pair-card';
      card.dataset.pairIdx = idx;
      card.innerHTML = `
        <div class="pair-card-label">Matchup ${idx+1}</div>
        <div class="pair-slots">
          ${renderSlot(pair[0], idx, 0)}
          <span class="pair-vs">vs</span>
          ${renderSlot(pair[1], idx, 1)}
        </div>
      `;
      pairList.appendChild(card);
    });

    if(state.leftoverId){
      leftoverZone.style.display = '';
      leftoverRow.innerHTML = `<div class="pair-slot" data-pair="-1" data-slot="-1" style="flex:0 0 auto; min-width:140px;">${renderChip(state.leftoverId, -1, -1)}</div>`;
    } else {
      leftoverZone.style.display = 'none';
      leftoverRow.innerHTML = `<div class="pair-slot" data-pair="-1" data-slot="-1" style="flex:1; min-width:100px;"><span class="pair-slot-empty">empty</span></div>`;
    }

    initAllPairDrag();
  }

  function renderSlot(playerId, pairIdx, slotIdx){
    if(!playerId){
      return `<div class="pair-slot" data-pair="${pairIdx}" data-slot="${slotIdx}"><span class="pair-slot-empty">empty</span></div>`;
    }
    return `<div class="pair-slot" data-pair="${pairIdx}" data-slot="${slotIdx}">${renderChip(playerId, pairIdx, slotIdx)}</div>`;
  }

  function renderChip(playerId, pairIdx, slotIdx){
    const p = playerById(playerId);
    if(!p) return '';
    const rank = state.players.findIndex(x=>x.id===playerId) + 1;
    return `<div class="pair-chip" data-id="${playerId}" data-pair="${pairIdx}" data-slot="${slotIdx}">
      <span class="pair-chip-rank">#${rank}</span>
      <span class="pair-chip-name">${escapeHtml(p.name)}</span>
    </div>`;
  }

  /* ----- drag chips between slots (pointer based) ----- */
  function initAllPairDrag(){
    const chips = $all('.pair-chip');
    chips.forEach(chip=>{
      let dragging = false;
      let ghost = null;
      let startX, startY;

      chip.addEventListener('pointerdown', (e)=>{
        e.preventDefault();
        startX = e.clientX; startY = e.clientY;
        dragging = false;
        chip.setPointerCapture(e.pointerId);

        const onMove = (ev)=>{
          const dx = ev.clientX - startX, dy = ev.clientY - startY;
          if(!dragging && (Math.abs(dx) > 6 || Math.abs(dy) > 6)){
            dragging = true;
            const rect = chip.getBoundingClientRect();
            ghost = chip.cloneNode(true);
            ghost.style.position='fixed';
            ghost.style.left = rect.left+'px';
            ghost.style.top = rect.top+'px';
            ghost.style.width = rect.width+'px';
            ghost.style.background = 'var(--card-hi)';
            ghost.style.borderRadius = '10px';
            ghost.style.padding = '6px 8px';
            ghost.style.boxShadow = '0 10px 28px rgba(0,0,0,0.4)';
            ghost.style.zIndex = '999';
            ghost.style.pointerEvents = 'none';
            ghost.style.opacity = '0.95';
            document.body.appendChild(ghost);
            chip.closest('.pair-slot').classList.add('dragging-chip');
          }
          if(dragging && ghost){
            ghost.style.left = (ev.clientX - rect_w(ghost)/2) + 'px';
            ghost.style.top = (ev.clientY - 20) + 'px';

            $all('.pair-slot').forEach(slot=> slot.classList.remove('drag-target'));
            const target = findSlotUnder(ev.clientX, ev.clientY);
            if(target) target.classList.add('drag-target');
          }
        };

        function rect_w(el){ return el.getBoundingClientRect().width; }

        const onUp = (ev)=>{
          chip.releasePointerCapture(ev.pointerId);
          document.removeEventListener('pointermove', onMove);
          document.removeEventListener('pointerup', onUp);
          $all('.pair-slot').forEach(slot=> slot.classList.remove('drag-target'));
          if(ghost) ghost.remove();
          const sourceSlot = chip.closest('.pair-slot');
          if(sourceSlot) sourceSlot.classList.remove('dragging-chip');

          if(dragging){
            const target = findSlotUnder(ev.clientX, ev.clientY);
            if(target){
              swapChips(chip.dataset.pair, chip.dataset.slot, target.dataset.pair, target.dataset.slot);
            }
          }
          dragging = false;
        };

        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
      });
    });
  }

  function findSlotUnder(x, y){
    const slots = $all('.pair-slot');
    for(const slot of slots){
      const r = slot.getBoundingClientRect();
      if(x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return slot;
    }
    return null;
  }

  function getSlotValue(pairIdx, slotIdx){
    if(pairIdx === -1) return state.leftoverId;
    return state.pairs[pairIdx][slotIdx];
  }
  function setSlotValue(pairIdx, slotIdx, val){
    if(pairIdx === -1) { state.leftoverId = val; return; }
    state.pairs[pairIdx][slotIdx] = val;
  }

  function swapChips(srcPair, srcSlot, tgtPair, tgtSlot){
    srcPair = parseInt(srcPair,10);
    tgtPair = parseInt(tgtPair,10);
    srcSlot = parseInt(srcSlot,10);
    tgtSlot = parseInt(tgtSlot,10);
    if(srcPair === tgtPair && srcSlot === tgtSlot) return;

    const a = getSlotValue(srcPair, srcSlot);
    const b = getSlotValue(tgtPair, tgtSlot);
    setSlotValue(srcPair, srcSlot, b);
    setSlotValue(tgtPair, tgtSlot, a);
    renderPairsUI();
    persistDraft();
  }

  pairingToggle.addEventListener('click', ()=>{
    state.pairingEnabled = !state.pairingEnabled;
    autoGeneratePairs();
    buildPairsUI(false);
    persistDraft();
  });

  backTo1Btn.addEventListener('click', ()=> goToStage(1, {skipGenerate:true}));
  backTo2Btn.addEventListener('click', ()=> goToStage(2, {skipGenerate:true, force:true}));
  toStage3Btn.addEventListener('click', ()=> goToStage(3));

  /* =========================================================
     STAGE 3 — TEAM GENERATION
     ========================================================= */

  function shuffle(arr){
    const a = arr.slice();
    for(let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [a[i],a[j]] = [a[j],a[i]];
    }
    return a;
  }

  function generateTeams(){
    const teamA = [];
    const teamB = [];

    if(state.pairingEnabled){
      state.pairs.forEach(pair=>{
        const [x,y] = pair;
        if(x==null && y==null) return;
        if(x==null){ (Math.random()<0.5?teamA:teamB).push(y); return; }
        if(y==null){ (Math.random()<0.5?teamA:teamB).push(x); return; }
        if(Math.random() < 0.5){ teamA.push(x); teamB.push(y); }
        else { teamA.push(y); teamB.push(x); }
      });
      if(state.leftoverId){
        (Math.random()<0.5?teamA:teamB).push(state.leftoverId);
      }
    } else {
      const playing = getPlayingPlayersRanked().map(p=>p.id);
      const shuffled = shuffle(playing);
      const half = Math.ceil(shuffled.length/2);
      shuffled.forEach((id, i)=>{
        (i < half ? teamA : teamB).push(id);
      });
      while(teamA.length - teamB.length > 1){ teamB.push(teamA.pop()); }
      while(teamB.length - teamA.length > 1){ teamA.push(teamB.pop()); }
    }

    state.teams = { a: teamA, b: teamB };
    renderTeams();
  }

  function renderTeams(){
    teamARoster.innerHTML = '';
    teamBRoster.innerHTML = '';
    if(!state.teams) return;

    state.teams.a.forEach((id, i)=>{
      teamARoster.appendChild(makeJerseyCard(id, i));
    });
    state.teams.b.forEach((id, i)=>{
      teamBRoster.appendChild(makeJerseyCard(id, i));
    });
    teamATally.textContent = state.teams.a.length;
    teamBTally.textContent = state.teams.b.length;
  }

  function makeJerseyCard(id, i){
    const p = playerById(id);
    const li = document.createElement('li');
    li.className = 'jersey-card';
    li.style.animationDelay = (i*70) + 'ms';
    const rank = state.players.findIndex(x=>x.id===id) + 1;
    li.innerHTML = `<span class="jersey-num">#${rank}</span><span class="jersey-name">${escapeHtml(p ? p.name : '?')}</span>`;
    return li;
  }

  shuffleBtn.addEventListener('click', ()=>{
    generateTeams();
    shuffleBtn.style.transform = 'scale(0.96)';
    setTimeout(()=> shuffleBtn.style.transform = '', 150);
  });

  /* =========================================================
     PRESETS — persisted via localStorage so they survive reloads
     in a real mobile browser. This is a standalone saved file
     opened directly in the browser, so we use the standard web
     storage API rather than any sandbox-only storage bridge.
     ========================================================= */

  const DRAFT_KEY = 'fairteams:draft-state';
  const PRESETS_KEY = 'fairteams:presets';
  const COIN_DRAFT_KEY = 'fairteams:coin-draft';
  const COIN_PRESETS_KEY = 'fairteams:coin-presets';
  const hasLocalStorage = (function(){
    try{
      const k = '__ft_test__';
      window.localStorage.setItem(k,'1');
      window.localStorage.removeItem(k);
      return true;
    } catch(e){ return false; }
  })();

  async function persistDraft(){
    if(!hasLocalStorage) return;
    try{
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
    } catch(err){ /* non-fatal, e.g. storage full or private mode */ }
  }

  async function restoreDraft(){
    if(!hasLocalStorage){ renderPlayerList(); return; }
    try{
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if(raw){
        const parsed = JSON.parse(raw);
        if(parsed && Array.isArray(parsed.players)){
          state.players = parsed.players;
          state.pairingEnabled = parsed.pairingEnabled !== false;
          state.pairs = parsed.pairs || [];
          state.leftoverId = parsed.leftoverId || null;
          let maxNum = 0;
          parsed.players.forEach(p=>{
            const m = /^p(\d+)$/.exec(p.id);
            if(m) maxNum = Math.max(maxNum, parseInt(m[1],10));
          });
          uid = maxNum + 1;
        }
      }
    } catch(err){ /* no draft yet, or corrupt — start fresh */ }
    renderPlayerList();
  }

  function readPresetsRaw(){
    if(!hasLocalStorage) return [];
    try{
      const raw = window.localStorage.getItem(PRESETS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch(err){ return []; }
  }
  function writePresetsRaw(arr){
    if(!hasLocalStorage) return false;
    try{
      window.localStorage.setItem(PRESETS_KEY, JSON.stringify(arr));
      return true;
    } catch(err){ return false; }
  }

  async function listPresets(){
    return readPresetsRaw().sort((a,b)=> (b.savedAt||0) - (a.savedAt||0));
  }

  async function savePreset(name){
    const id = 'pr' + Date.now();
    const playingCt = state.players.filter(p=>p.playing).length;
    const data = {
      id, name,
      savedAt: Date.now(),
      players: state.players,
      pairingEnabled: state.pairingEnabled,
      playerCount: state.players.length,
      playingCount: playingCt
    };
    const arr = readPresetsRaw();
    arr.push(data);
    const ok = writePresetsRaw(arr);
    if(ok){
      showToast('Preset saved');
      await renderPresetList();
    } else {
      showToast('Could not save preset');
    }
  }

  async function deletePreset(id){
    const arr = readPresetsRaw().filter(p=>p.id !== id);
    writePresetsRaw(arr);
    await renderPresetList();
    showToast('Preset deleted');
  }

  async function loadPreset(id){
    const presets = await listPresets();
    const preset = presets.find(p=>p.id===id);
    if(!preset) return;
    state.players = preset.players.map(p=>({...p}));
    state.pairingEnabled = preset.pairingEnabled !== false;
    state.pairs = [];
    state.leftoverId = null;
    state.teams = null;
    let maxNum = 0;
    state.players.forEach(p=>{
      const m = /^p(\d+)$/.exec(p.id);
      if(m) maxNum = Math.max(maxNum, parseInt(m[1],10));
    });
    uid = maxNum + 1;
    renderPlayerList();
    persistDraft();
    closeDrawer();
    goToStage(1, {skipGenerate:true, force:true});
    showToast(`Loaded "${preset.name}"`);
  }

  async function renderPresetList(){
    const presets = await listPresets();
    presetList.innerHTML = '';
    presets.forEach(p=>{
      const item = document.createElement('div');
      item.className = 'preset-item';
      const date = new Date(p.savedAt);
      const dateStr = date.toLocaleDateString(undefined, {month:'short', day:'numeric'});
      item.innerHTML = `
        <div class="preset-info">
          <span class="preset-name">${escapeHtml(p.name)}</span>
          <span class="preset-meta">${p.playingCount} of ${p.playerCount} playing &middot; ${dateStr}</span>
        </div>
        <div class="preset-actions">
          <button class="preset-load-btn" type="button">Use</button>
          <button class="preset-del-btn" type="button" aria-label="Delete preset">
            <svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6"/></svg>
          </button>
        </div>
      `;
      item.querySelector('.preset-load-btn').addEventListener('click', ()=> loadPreset(p.id));
      item.querySelector('.preset-del-btn').addEventListener('click', async ()=>{
        const ok = await confirmDialog('Delete this preset?', `"${p.name}" will be removed for good.`);
        if(ok) deletePreset(p.id);
      });
      presetList.appendChild(item);
    });
  }

  /* ----- drawer open/close ----- */
  function openDrawer(){
    renderPresetList();
    drawerOverlay.classList.add('show');
    presetsDrawer.classList.add('show');
  }
  function closeDrawer(){
    drawerOverlay.classList.remove('show');
    presetsDrawer.classList.remove('show');
  }
  presetsFab.addEventListener('click', openDrawer);
  closeDrawerBtn.addEventListener('click', closeDrawer);
  drawerOverlay.addEventListener('click', closeDrawer);

  /* ----- coin page controls ----- */
  coinFab.addEventListener('click', openCoinPage);
  coinBackBtn.addEventListener('click', closeCoinPage);
  flipCoinBtn.addEventListener('click', flipCoin);
  headsImageInput.addEventListener('change', ()=> readImageFile(headsImageInput, 'heads'));
  tailsImageInput.addEventListener('change', ()=> readImageFile(tailsImageInput, 'tails'));
  cropZoom.addEventListener('input', ()=>{
    if(!cropSession) return;
    const prevZoom = cropSession.zoom;
    const nextZoom = parseFloat(cropZoom.value) || 1;
    const center = cropCanvas.width / 2;
    cropSession.x = center - ((center - cropSession.x) * nextZoom / prevZoom);
    cropSession.y = center - ((center - cropSession.y) * nextZoom / prevZoom);
    cropSession.zoom = nextZoom;
    clampCropOffset();
    drawCropPreview();
  });
  cropWorkspace.addEventListener('pointerdown', (e)=>{
    if(!cropSession) return;
    e.preventDefault();
    cropWorkspace.classList.add('dragging');
    cropWorkspace.setPointerCapture(e.pointerId);
    cropSession.drag = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: cropSession.x,
      originY: cropSession.y
    };
  });
  cropWorkspace.addEventListener('pointermove', (e)=>{
    if(!cropSession || !cropSession.drag || cropSession.drag.pointerId !== e.pointerId) return;
    const rect = cropWorkspace.getBoundingClientRect();
    const scale = cropCanvas.width / rect.width;
    cropSession.x = cropSession.drag.originX + ((e.clientX - cropSession.drag.startX) * scale);
    cropSession.y = cropSession.drag.originY + ((e.clientY - cropSession.drag.startY) * scale);
    clampCropOffset();
    drawCropPreview();
  });
  function endCropDrag(e){
    if(!cropSession || !cropSession.drag || cropSession.drag.pointerId !== e.pointerId) return;
    cropWorkspace.releasePointerCapture(e.pointerId);
    cropWorkspace.classList.remove('dragging');
    cropSession.drag = null;
  }
  cropWorkspace.addEventListener('pointerup', endCropDrag);
  cropWorkspace.addEventListener('pointercancel', endCropDrag);
  cancelCropBtn.addEventListener('click', closeCropModal);
  cropModalOverlay.addEventListener('click', (e)=>{
    if(e.target === cropModalOverlay) closeCropModal();
  });
  applyCropBtn.addEventListener('click', applyCrop);
  headsProbability.addEventListener('input', ()=>{
    coinState.headsProbability = normaliseProbability(headsProbability.value);
    renderCoin();
    persistCoinDraft();
  });
  saveCoinPresetBtn.addEventListener('click', ()=>{
    const name = coinPresetNameInput.value.trim();
    if(!name){ coinPresetNameInput.focus(); return; }
    saveCoinPreset(name);
  });
  coinPresetNameInput.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter'){ e.preventDefault(); saveCoinPresetBtn.click(); }
  });

  /* ----- save modal ----- */
  function openSaveModal(){
    presetNameInput.value = '';
    saveModalOverlay.classList.add('show');
    setTimeout(()=> presetNameInput.focus(), 200);
  }
  function closeSaveModal(){ saveModalOverlay.classList.remove('show'); }

  savePresetBtn.addEventListener('click', openSaveModal);
  const savePresetFromRosterBtn = $('#savePresetFromRosterBtn');
  if(savePresetFromRosterBtn){
    savePresetFromRosterBtn.addEventListener('click', ()=>{
      if(state.players.length === 0){ showToast('Add some players first'); return; }
      openSaveModal();
    });
  }
  cancelSaveBtn.addEventListener('click', closeSaveModal);
  confirmSaveBtn.addEventListener('click', ()=>{
    const name = presetNameInput.value.trim();
    if(!name){ presetNameInput.focus(); return; }
    savePreset(name);
    closeSaveModal();
  });
  presetNameInput.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter'){ e.preventDefault(); confirmSaveBtn.click(); }
  });

  /* =========================================================
     INIT
     ========================================================= */
  async function init(){
    await restoreDraft();
    restoreCoinDraft();
    goToStage(1, {skipGenerate:true, force:true});
  }

  init();

})();
