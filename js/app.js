/**
 * WINDOWS MUSIC WORKSPACE — js/app.js
 * Compact, bit-perfect local audio engine
 */

(function () {
  'use strict';

  // State
  let allTracks = [];
  let favorites = new Set();
  let playlists = [];
  let currentView = 'all'; // 'all', 'favorites', or playlist ID
  let currentIndex = -1;
  let isPlaying = false;
  let isShuffled = false;
  let repeatMode = 0; // 0: off, 1: all, 2: one
  let playbackSpeed = 1.0;

  // Audio Object
  const audio = new Audio();
  audio.preload = 'metadata';
  audio.volume = 0.8;

  // DOM Elements
  const fileInput = document.getElementById('audio-file-input');
  const dropzone = document.getElementById('dropzone');
  const trackRows = document.getElementById('track-rows');
  const emptyState = document.getElementById('empty-state');
  const countAll = document.getElementById('count-all');
  const countFav = document.getElementById('count-fav');
  const playlistPills = document.getElementById('playlist-pills');
  const playerDock = document.getElementById('player-dock');
  const playerTitle = document.getElementById('player-title');
  const playerArtist = document.getElementById('player-artist');
  const playerFormat = document.getElementById('player-format');
  const btnPlay = document.getElementById('btn-play');
  const playIcon = document.getElementById('play-icon');
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  const btnShuffle = document.getElementById('btn-shuffle');
  const btnRepeat = document.getElementById('btn-repeat');
  const repeatBadge = document.getElementById('repeat-badge');
  const btnSpeed = document.getElementById('btn-speed');
  const seekTrack = document.getElementById('seek-track');
  const seekFill = document.getElementById('seek-fill');
  const timeCurrent = document.getElementById('time-current');
  const timeTotal = document.getElementById('time-total');
  const toast = document.getElementById('toast');
  const playlistModal = document.getElementById('playlist-modal');
  const playlistNameInput = document.getElementById('playlist-name-input');

  // Format seconds to mm:ss
  function formatTime(sec) {
    if (isNaN(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  // Toast
  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('is-open');
    setTimeout(() => toast.classList.remove('is-open'), 2500);
  }

  // File Handling
  function handleFiles(files) {
    if (!files || files.length === 0) return;
    let added = 0;

    Array.from(files).forEach((file) => {
      const ext = file.name.split('.').pop().toUpperCase();
      const cleanName = file.name.replace(/\.[^/.]+$/, '');
      const parts = cleanName.split(' - ');
      let artist = 'Local File';
      let title = cleanName;
      if (parts.length >= 2) {
        artist = parts[0].trim();
        title = parts.slice(1).join(' - ').trim();
      }

      const track = {
        id: `track-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        title: title,
        artist: artist,
        format: ext || 'AUDIO',
        durationSec: 0,
        durationStr: '--:--',
        url: URL.createObjectURL(file),
        file: file
      };

      // Probe duration
      const probe = new Audio(track.url);
      probe.addEventListener('loadedmetadata', () => {
        if (probe.duration && probe.duration > 0) {
          track.durationSec = probe.duration;
          track.durationStr = formatTime(probe.duration);
          renderTracks();
          if (currentIndex !== -1 && allTracks[currentIndex]?.id === track.id) {
            timeTotal.textContent = track.durationStr;
          }
        }
      });

      allTracks.unshift(track);
      added++;
    });

    if (added > 0) {
      showToast(`Imported ${added} audio track${added > 1 ? 's' : ''}`);
      renderTracks();
      if (currentIndex === -1) {
        loadTrack(0);
        playTrack();
      }
    }
  }

  // Filtered tracks
  function getFilteredTracks() {
    if (currentView === 'all') return allTracks;
    if (currentView === 'favorites') return allTracks.filter(t => favorites.has(t.id));
    const pl = playlists.find(p => p.id === currentView);
    return pl ? allTracks.filter(t => pl.trackIds.includes(t.id)) : allTracks;
  }

  // Render Track List
  function renderTracks() {
    const tracks = getFilteredTracks();
    countAll.textContent = allTracks.length;
    countFav.textContent = favorites.size;

    if (tracks.length === 0) {
      trackRows.innerHTML = '';
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';
    trackRows.innerHTML = '';

    tracks.forEach((track, idx) => {
      const isCurrent = currentIndex >= 0 && allTracks[currentIndex]?.id === track.id;
      const isFav = favorites.has(track.id);

      const row = document.createElement('div');
      row.className = `track-row ${isCurrent ? 'active' : ''}`;
      row.innerHTML = `
        <div class="col-num">${idx + 1}</div>
        <div class="col-title track-title-wrap">
          <div class="track-thumb-box">
            <i data-lucide="${isCurrent && isPlaying ? 'volume-2' : 'music'}" class="icon-sm"></i>
          </div>
          <div class="track-name-box">
            <span class="track-title-text">${escapeHtml(track.title)}</span>
            <span class="track-artist-text">${escapeHtml(track.artist)}</span>
          </div>
        </div>
        <div class="col-format">
          <span class="format-pill">${track.format}</span>
        </div>
        <div class="col-dur">${track.durationStr}</div>
        <div class="col-actions">
          <button type="button" class="btn-row-action fav ${isFav ? 'active' : ''}" title="${isFav ? 'Remove Favorite' : 'Add Favorite'}">
            <i data-lucide="heart" class="icon-xs"></i>
          </button>
          <button type="button" class="btn-row-action remove" title="Remove Track">
            <i data-lucide="trash-2" class="icon-xs"></i>
          </button>
        </div>
      `;

      // Click to play
      row.addEventListener('click', (e) => {
        if (e.target.closest('.btn-row-action')) return;
        const globalIdx = allTracks.findIndex(t => t.id === track.id);
        if (globalIdx !== -1) {
          if (currentIndex === globalIdx) {
            togglePlay();
          } else {
            loadTrack(globalIdx);
            playTrack();
          }
        }
      });

      // Favorite toggle
      row.querySelector('.btn-row-action.fav').addEventListener('click', (e) => {
        e.stopPropagation();
        if (favorites.has(track.id)) {
          favorites.delete(track.id);
          showToast('Removed from favorites');
        } else {
          favorites.add(track.id);
          showToast('Added to favorites');
        }
        renderTracks();
      });

      // Remove track
      row.querySelector('.btn-row-action.remove').addEventListener('click', (e) => {
        e.stopPropagation();
        const globalIdx = allTracks.findIndex(t => t.id === track.id);
        if (globalIdx !== -1) {
          allTracks.splice(globalIdx, 1);
          if (currentIndex === globalIdx) {
            audio.pause();
            if (allTracks.length > 0) {
              loadTrack(Math.min(currentIndex, allTracks.length - 1));
            } else {
              resetPlayer();
            }
          } else if (currentIndex > globalIdx) {
            currentIndex--;
          }
          renderTracks();
          showToast('Track removed');
        }
      });

      trackRows.appendChild(row);
    });

    if (window.lucide) window.lucide.createIcons();
  }

  // Load Track into Player
  function loadTrack(index) {
    if (index < 0 || index >= allTracks.length) {
      resetPlayer();
      return;
    }
    currentIndex = index;
    const track = allTracks[currentIndex];

    audio.src = track.url;
    audio.playbackRate = playbackSpeed;

    playerTitle.textContent = track.title;
    playerArtist.textContent = track.artist;
    playerFormat.textContent = track.format;
    timeTotal.textContent = track.durationStr;
    timeCurrent.textContent = '0:00';
    seekFill.style.width = '0%';

    // Slide up player dock
    playerDock.classList.add('is-active');
    document.body.classList.add('has-player');

    renderTracks();
  }

  function playTrack() {
    if (currentIndex === -1 && allTracks.length > 0) loadTrack(0);
    audio.play().then(() => {
      isPlaying = true;
      updatePlayBtnUI();
      renderTracks();
    }).catch(() => {});
  }

  function pauseTrack() {
    audio.pause();
    isPlaying = false;
    updatePlayBtnUI();
    renderTracks();
  }

  function togglePlay() {
    if (isPlaying) pauseTrack();
    else playTrack();
  }

  function resetPlayer() {
    audio.pause();
    audio.src = '';
    currentIndex = -1;
    isPlaying = false;
    updatePlayBtnUI();
    playerDock.classList.remove('is-active');
    document.body.classList.remove('has-player');
  }

  function updatePlayBtnUI() {
    if (!playIcon) return;
    playIcon.setAttribute('data-lucide', isPlaying ? 'pause' : 'play');
    if (window.lucide) window.lucide.createIcons();
  }

  // Next / Previous
  function nextTrack() {
    if (allTracks.length === 0) return;
    if (isShuffled) {
      const rnd = Math.floor(Math.random() * allTracks.length);
      loadTrack(rnd);
    } else {
      let nextIdx = currentIndex + 1;
      if (nextIdx >= allTracks.length) nextIdx = 0;
      loadTrack(nextIdx);
    }
    playTrack();
  }

  function prevTrack() {
    if (allTracks.length === 0) return;
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    let prevIdx = currentIndex - 1;
    if (prevIdx < 0) prevIdx = allTracks.length - 1;
    loadTrack(prevIdx);
    playTrack();
  }

  // Audio Progress
  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    timeCurrent.textContent = formatTime(audio.currentTime);
    const pct = (audio.currentTime / audio.duration) * 100;
    seekFill.style.width = `${pct}%`;
  });

  audio.addEventListener('ended', () => {
    if (repeatMode === 2) {
      // Repeat one
      audio.currentTime = 0;
      audio.play();
    } else if (repeatMode === 1 || currentIndex < allTracks.length - 1) {
      nextTrack();
    } else {
      pauseTrack();
    }
  });

  // Seek bar click
  if (seekTrack) {
    seekTrack.addEventListener('click', (e) => {
      if (!audio.duration) return;
      const rect = seekTrack.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      audio.currentTime = pos * audio.duration;
    });
  }

  // Control Buttons
  if (btnPlay) btnPlay.addEventListener('click', togglePlay);
  if (btnNext) btnNext.addEventListener('click', nextTrack);
  if (btnPrev) btnPrev.addEventListener('click', prevTrack);

  if (btnShuffle) {
    btnShuffle.addEventListener('click', () => {
      isShuffled = !isShuffled;
      btnShuffle.classList.toggle('active', isShuffled);
      showToast(isShuffled ? 'Shuffle ON' : 'Shuffle OFF');
    });
  }

  if (btnRepeat) {
    btnRepeat.addEventListener('click', () => {
      repeatMode = (repeatMode + 1) % 3;
      if (repeatMode === 0) {
        btnRepeat.classList.remove('active');
        repeatBadge.style.display = 'none';
        showToast('Repeat OFF');
      } else if (repeatMode === 1) {
        btnRepeat.classList.add('active');
        repeatBadge.style.display = 'none';
        showToast('Repeat ALL');
      } else {
        btnRepeat.classList.add('active');
        repeatBadge.style.display = 'grid';
        showToast('Repeat ONE');
      }
    });
  }

  if (btnSpeed) {
    const speeds = [1.0, 1.25, 1.5, 2.0, 0.75];
    let speedIdx = 0;
    btnSpeed.addEventListener('click', () => {
      speedIdx = (speedIdx + 1) % speeds.length;
      playbackSpeed = speeds[speedIdx];
      audio.playbackRate = playbackSpeed;
      btnSpeed.textContent = `${playbackSpeed}x`;
      showToast(`Speed: ${playbackSpeed}x`);
    });
  }

  // Dropzone and File Trigger Bindings
  const openTriggers = [
    document.getElementById('btn-import-top'),
    document.getElementById('btn-dropzone-open')
  ];
  openTriggers.forEach(btn => {
    if (btn) btn.addEventListener('click', () => fileInput.click());
  });

  if (fileInput) {
    fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
  }

  if (dropzone) {
    ['dragenter', 'dragover'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
    });
    ['dragleave', 'drop'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
      });
    });
    dropzone.addEventListener('drop', (e) => {
      if (e.dataTransfer?.files?.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    });
  }

  // Windows Download Button Handler
  const winBtns = [
    document.getElementById('btn-download-win')
  ];
  winBtns.forEach(btn => {
    if (btn) {
      btn.addEventListener('click', () => {
        showToast('Windows client download starting...');
        const a = document.createElement('a');
        a.href = '#';
        a.download = 'Windows-Music-Workspace-x64.exe';
        showToast('Downloaded Windows desktop client installer (mock)');
      });
    }
  });

  // Modal & Playlist logic
  const btnNewPlTriggers = [
    document.getElementById('btn-new-playlist-hero'),
    document.getElementById('btn-add-playlist')
  ];
  btnNewPlTriggers.forEach(btn => {
    if (btn) btn.addEventListener('click', () => {
      playlistModal.classList.add('is-open');
      playlistNameInput.value = '';
      playlistNameInput.focus();
    });
  });

  const closeModal = () => playlistModal.classList.remove('is-open');
  document.getElementById('btn-close-modal')?.addEventListener('click', closeModal);
  document.getElementById('btn-cancel-modal')?.addEventListener('click', closeModal);

  document.getElementById('btn-confirm-playlist')?.addEventListener('click', () => {
    const name = playlistNameInput.value.trim();
    if (!name) return;
    const pl = { id: `pl-${Date.now()}`, name: name, trackIds: [] };
    playlists.push(pl);
    closeModal();
    renderPlaylistPills();
    switchPlaylistView(pl.id);
    showToast(`Playlist "${name}" created!`);
  });

  function renderPlaylistPills() {
    // Keep base pills
    const customPills = playlistPills.querySelectorAll('.pill-custom');
    customPills.forEach(p => p.remove());

    playlists.forEach(pl => {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = `pill pill-custom ${currentView === pl.id ? 'active' : ''}`;
      pill.innerHTML = `<i data-lucide="list-music" class="icon-xs"></i><span>${escapeHtml(pl.name)} (${pl.trackIds.length})</span>`;
      pill.addEventListener('click', () => switchPlaylistView(pl.id));
      playlistPills.appendChild(pill);
    });

    if (window.lucide) window.lucide.createIcons();
  }

  function switchPlaylistView(viewId) {
    currentView = viewId;
    playlistPills.querySelectorAll('.pill').forEach(p => {
      if (p.getAttribute('data-view') === viewId || (p.classList.contains('pill-custom') && viewId !== 'all' && viewId !== 'favorites')) {
        p.classList.add('active');
      } else {
        p.classList.remove('active');
      }
    });
    renderTracks();
  }

  playlistPills.querySelectorAll('.pill:not(.pill-custom)').forEach(p => {
    p.addEventListener('click', function () {
      switchPlaylistView(this.getAttribute('data-view'));
    });
  });

  // Scramble Text Attribution
  function initScramble() {
    const el = document.getElementById('nagendra-scramble');
    if (!el) return;
    const chars = '0123456789ABCDEF!@#$%^&*';
    const target = el.getAttribute('data-text') || 'NAGENDRA VARMA';
    let iter = 0;

    const interval = setInterval(() => {
      el.textContent = target.split('').map((letter, idx) => {
        if (idx < iter) return target[idx];
        return chars[Math.floor(Math.random() * chars.length)];
      }).join('');

      if (iter >= target.length) clearInterval(interval);
      iter += 1 / 2;
    }, 40);
  }

  // SmoothUI Exposure Slider Mount
  function initSlider() {
    const mount = document.getElementById('player-exposure-slider');
    if (mount && window.ExposureSlider) {
      window.exposureSliderInstance = new window.ExposureSlider(mount, {
        min: 0,
        max: 100,
        defaultValue: 80,
        unit: '%',
        onChange: (val) => {
          audio.volume = Math.max(0, Math.min(1, val / 100));
        }
      });
    }
  }

  function escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, (m) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[m]);
  }

  // Global exports for verification
  window.allTracks = allTracks;
  window.loadTrack = loadTrack;
  window.playTrack = playTrack;
  window.resetPlayer = resetPlayer;
  window.renderTracks = renderTracks;

  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    if (window.lucide) window.lucide.createIcons();
    initScramble();
    initSlider();
    renderTracks();
  });

})();
