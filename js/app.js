/**
 * ==========================================================================
 * WINDOWS MUSIC WORKSPACE — js/app.js
 * Spotify Desktop Experience Engine:
 * - Real Local Audio Import & Playback
 * - Custom Playlist Creation & Management
 * - Spotify Track Table & Interactive Views
 * - SmoothUI Spring-Physics Exposure Slider Volume Sync
 * ==========================================================================
 */

(function () {
  'use strict';

  // --------------------------------------------------------------------------
  // 1. DATA MODELS & STATE
  // --------------------------------------------------------------------------

  // Initial Reference Tracks — completely empty default per user instructions (all songs imported from PC)
  const INITIAL_REFERENCE_TRACKS = [];

  let allTracks = [];
  let favoriteTrackIds = new Set();
  let currentView = "all"; // "all" | "local" | "favorites" | custom playlist ID
  let currentTrackIndex = -1;
  let isPlaying = false;
  let isShuffled = false;
  let repeatMode = 0; // 0: Off, 1: All, 2: One
  let playbackSpeed = 1.0;
  let currentTime = 0;
  let totalDuration = 0;

  // Custom User Playlists
  const PLAYLISTS_STORAGE_KEY = "wmw_custom_playlists";
  let customPlaylists = [];

  function loadPlaylists() {
    try {
      const stored = localStorage.getItem(PLAYLISTS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Completely purge any old dummy default playlists
        customPlaylists = Array.isArray(parsed) ? parsed.filter(pl => 
          pl.name !== "Late Night Coding" && 
          pl.name !== "High Focus Session" &&
          pl.id !== "pl-chill" &&
          pl.id !== "pl-synth"
        ) : [];
        savePlaylists();
      } else {
        customPlaylists = [];
      }
    } catch (e) {
      customPlaylists = [];
    }
  }

  function savePlaylists() {
    try {
      localStorage.setItem(PLAYLISTS_STORAGE_KEY, JSON.stringify(customPlaylists));
    } catch (e) {}
  }

  // --------------------------------------------------------------------------
  // 2. AUDIO ENGINE & SYNTHESIZER
  // --------------------------------------------------------------------------
  let htmlAudio = document.querySelector("audio");
  if (!htmlAudio) {
    htmlAudio = document.createElement("audio");
    htmlAudio.id = "html-audio-player";
    htmlAudio.preload = "metadata";
    document.body.appendChild(htmlAudio);
  }
  htmlAudio.volume = 0.8;

  let audioCtx = null;
  let masterGain = null;
  let synthTimer = null;

  function initAudioContext() {
    if (!audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        audioCtx = new AudioCtx();
        masterGain = audioCtx.createGain();
        masterGain.gain.setValueAtTime(htmlAudio.volume * 0.15, audioCtx.currentTime);
        masterGain.connect(audioCtx.destination);
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  }

  function startSynthPlayback(track) {
    stopSynthPlayback();
    initAudioContext();
    if (!audioCtx || !masterGain) return;

    const chords = track.chords || [261.63, 329.63, 392.00, 523.25];
    let step = 0;

    function playNote() {
      if (!isPlaying) return;
      const freq = chords[step % chords.length];
      step++;

      const osc = audioCtx.createOscillator();
      const noteGain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

      noteGain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
      noteGain.gain.linearRampToValueAtTime(0.12, audioCtx.currentTime + 0.08);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.55);

      osc.connect(noteGain);
      noteGain.connect(masterGain);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.6);

      synthTimer = setTimeout(playNote, 600);
    }

    playNote();
  }

  function stopSynthPlayback() {
    if (synthTimer) {
      clearTimeout(synthTimer);
      synthTimer = null;
    }
  }

  // --------------------------------------------------------------------------
  // 3. PLAYLIST FILTERING & VIEWS
  // --------------------------------------------------------------------------
  function getTracksForCurrentView() {
    let tracks = [];
    if (currentView === "all") {
      tracks = allTracks;
    } else if (currentView === "local") {
      tracks = allTracks.filter(t => t.isLocal);
    } else if (currentView === "favorites") {
      tracks = allTracks.filter(t => favoriteTrackIds.has(t.id));
    } else {
      const pl = customPlaylists.find(p => p.id === currentView);
      if (pl) {
        tracks = allTracks.filter(t => pl.trackIds.includes(t.id));
      } else {
        tracks = allTracks;
      }
    }

    // Filter by search query if any
    const searchInput = document.getElementById("search-tracks-input");
    const query = (searchInput ? searchInput.value : "").trim().toLowerCase();
    if (query) {
      tracks = tracks.filter(t => 
        (t.title && t.title.toLowerCase().includes(query)) ||
        (t.artist && t.artist.toLowerCase().includes(query)) ||
        (t.album && t.album.toLowerCase().includes(query)) ||
        (t.format && t.format.toLowerCase().includes(query))
      );
    }

    return tracks;
  }

  function renderViewHeader() {
    const titleEl = document.getElementById("current-view-title");
    const countEl = document.getElementById("current-view-count");
    const tracks = getTracksForCurrentView();

    let titleText = "All Songs";

    if (currentView === "local") {
      titleText = "Local Files";
    } else if (currentView === "favorites") {
      titleText = "Favorites";
    } else {
      const pl = customPlaylists.find(p => p.id === currentView);
      if (pl) {
        titleText = pl.name;
      }
    }

    if (titleEl) titleEl.textContent = titleText;
    if (countEl) countEl.textContent = `${tracks.length} ${tracks.length === 1 ? 'song' : 'songs'}`;
  }

  function renderSidebarPlaylists() {
    const listEl = document.getElementById("sidebar-playlists-list");
    if (!listEl) return;

    listEl.innerHTML = "";

    if (customPlaylists.length === 0) {
      listEl.innerHTML = `<div class="sidebar-empty-hint">No custom playlists yet</div>`;
      return;
    }

    customPlaylists.forEach(pl => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = `sidebar-playlist-item ${currentView === pl.id ? 'active' : ''}`;
      item.setAttribute("data-view", pl.id);

      item.innerHTML = `
        <i data-lucide="list-music" class="icon-sm" aria-hidden="true"></i>
        <span class="pl-name">${escapeHtml(pl.name)}</span>
        <span class="pl-count">${pl.trackIds.length}</span>
      `;

      item.addEventListener("click", () => {
        switchView(pl.id);
      });

      listEl.appendChild(item);
    });

    if (typeof lucide !== "undefined") lucide.createIcons();
  }

  function renderPlaylistFilterTabs() {
    const container = document.getElementById("playlist-filter-tabs");
    if (!container) return;

    container.innerHTML = `
      <button type="button" class="playlist-tab-pill ${currentView === 'all' ? 'active' : ''}" data-view="all">
        <i data-lucide="layers" class="icon-xs" aria-hidden="true"></i>
        <span>All Songs</span>
      </button>
      <button type="button" class="playlist-tab-pill ${currentView === 'local' ? 'active' : ''}" data-view="local">
        <i data-lucide="hard-drive" class="icon-xs" aria-hidden="true"></i>
        <span>Local Files</span>
      </button>
      <button type="button" class="playlist-tab-pill ${currentView === 'favorites' ? 'active' : ''}" data-view="favorites">
        <i data-lucide="heart" class="icon-xs" aria-hidden="true"></i>
        <span>Favorites</span>
      </button>
    `;

    customPlaylists.forEach(pl => {
      const pill = document.createElement("button");
      pill.type = "button";
      pill.className = `playlist-tab-pill ${currentView === pl.id ? 'active' : ''}`;
      pill.setAttribute("data-view", pl.id);

      pill.innerHTML = `
        <i data-lucide="list-music" class="icon-xs" aria-hidden="true"></i>
        <span>${escapeHtml(pl.name)}</span>
      `;

      pill.addEventListener("click", () => {
        switchView(pl.id);
      });

      container.appendChild(pill);
    });

    // Re-bind base pills
    container.querySelectorAll(".playlist-tab-pill").forEach(p => {
      p.addEventListener("click", function () {
        const view = this.getAttribute("data-view");
        if (view) switchView(view);
      });
    });

    if (typeof lucide !== "undefined") lucide.createIcons();
  }

  function switchView(viewId) {
    currentView = viewId;

    // Highlight sidebar home if all
    const navHome = document.getElementById("nav-home");
    if (navHome) {
      if (viewId === "all") navHome.classList.add("active");
      else navHome.classList.remove("active");
    }

    renderViewHeader();
    renderSidebarPlaylists();
    renderPlaylistFilterTabs();
    renderTrackTable();
  }

  // --------------------------------------------------------------------------
  // 4. SPOTIFY TRACK TABLE RENDERING
  // --------------------------------------------------------------------------
  function renderTrackTable() {
    const rowsContainer = document.getElementById("spotify-track-rows");
    const emptyState = document.getElementById("spotify-empty-state");
    const tableContainer = document.getElementById("spotify-table-container");

    if (!rowsContainer) return;
    rowsContainer.innerHTML = "";

    const tracks = getTracksForCurrentView();

    if (tracks.length === 0) {
      if (emptyState) emptyState.style.display = "flex";
      if (tableContainer) tableContainer.style.display = "none";
      return;
    } else {
      if (emptyState) emptyState.style.display = "none";
      if (tableContainer) tableContainer.style.display = "block";
    }

    const currentTrack = allTracks[currentTrackIndex];

    tracks.forEach((track, idx) => {
      const row = document.createElement("div");
      const isCurrent = currentTrack && currentTrack.id === track.id;
      row.className = `spotify-track-row ${isCurrent ? 'track-row--active' : ''} ${isCurrent && isPlaying ? 'track-row--playing' : ''}`;
      row.setAttribute("data-track-id", track.id);
      row.setAttribute("tabindex", "0");

      const isFav = favoriteTrackIds.has(track.id);

      row.innerHTML = `
        <div class="col-num">
          <span class="track-index">${idx + 1}</span>
          <button type="button" class="row-play-btn" aria-label="Play ${escapeHtml(track.title)}">
            <i data-lucide="${isCurrent && isPlaying ? 'pause' : 'play'}" class="row-play-icon icon-xs" aria-hidden="true"></i>
          </button>
        </div>
        <div class="col-title">
          <img src="${track.thumb || 'assets/images/album_1.jpg'}" alt="" class="track-thumb" width="40" height="40" loading="lazy">
          <div class="track-name-artist">
            <span class="track-primary-title ${isCurrent ? 'title--active' : ''}">${escapeHtml(track.title)}</span>
            <span class="track-artist-sub">${escapeHtml(track.artist)}</span>
          </div>
        </div>
        <div class="col-album">${escapeHtml(track.album || 'Single')}</div>
        <div class="col-format">
          <span class="format-pill ${track.isLocal ? 'format-pill--local' : ''}">
            ${track.format || (track.isLocal ? 'LOCAL' : 'FLAC')}
          </span>
        </div>
        <div class="col-dur">${track.duration || '3:30'}</div>
        <div class="col-actions">
          <button type="button" class="action-btn track-like-btn ${isFav ? 'active' : ''}" aria-label="Favorite" title="${isFav ? 'Remove Favorite' : 'Save to Favorites'}">
            <i data-lucide="heart" class="icon-sm ${isFav ? 'fill-heart' : ''}" aria-hidden="true"></i>
          </button>
          <button type="button" class="action-btn track-add-pl-btn" title="Add to Playlist" aria-label="Add to Playlist">
            <i data-lucide="list-plus" class="icon-sm" aria-hidden="true"></i>
          </button>
        </div>
      `;

      // Click row to play
      row.addEventListener("click", (e) => {
        if (e.target.closest(".action-btn")) return;
        playTrackById(track.id);
      });

      // Like toggle
      const likeBtn = row.querySelector(".track-like-btn");
      if (likeBtn) {
        likeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          toggleFavorite(track.id);
        });
      }

      // Add to playlist modal
      const addPlBtn = row.querySelector(".track-add-pl-btn");
      if (addPlBtn) {
        addPlBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          openAddToPlaylistModal(track.id);
        });
      }

      rowsContainer.appendChild(row);
    });

    if (typeof lucide !== "undefined") lucide.createIcons();
  }

  function playTrackById(trackId) {
    const globalIdx = allTracks.findIndex(t => t.id === trackId);
    if (globalIdx !== -1) {
      if (currentTrackIndex === globalIdx && isPlaying) {
        togglePlay();
      } else {
        loadTrack(globalIdx);
        if (!isPlaying) togglePlay();
      }
    }
  }

  function toggleFavorite(trackId) {
    if (favoriteTrackIds.has(trackId)) {
      favoriteTrackIds.delete(trackId);
      showToast("Removed from Favorites");
    } else {
      favoriteTrackIds.add(trackId);
      showToast("Added to Favorites");
    }
    renderTrackTable();
    renderViewHeader();
  }

  // --------------------------------------------------------------------------
  // 5. LOCAL AUDIO FILE IMPORT
  // --------------------------------------------------------------------------
  function initFileImport() {
    const fileInput = document.getElementById("local-audio-input");
    const triggerBtns = document.querySelectorAll(".btn-trigger-import");
    const dropzone = document.getElementById("import-dropzone");

    triggerBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        if (fileInput) fileInput.click();
      });
    });

    if (fileInput) {
      fileInput.addEventListener("change", (e) => {
        handleFiles(e.target.files);
      });
    }

    if (dropzone) {
      ["dragenter", "dragover"].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          dropzone.classList.add("drag-over");
        });
      });

      ["dragleave", "drop"].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          dropzone.classList.remove("drag-over");
        });
      });

      dropzone.addEventListener("drop", (e) => {
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
          handleFiles(files);
        }
      });
    }
  }

  function handleFiles(files) {
    if (!files || files.length === 0) return;

    let addedCount = 0;
    Array.from(files).forEach((file, i) => {
      const ext = file.name.split('.').pop().toUpperCase();
      const cleanName = file.name.replace(/\.[^/.]+$/, "");
      const parts = cleanName.split(" - ");
      let title = cleanName;
      let artist = "Local Artist";

      if (parts.length >= 2) {
        artist = parts[0].trim();
        title = parts.slice(1).join(" - ").trim();
      }

      const fileUrl = URL.createObjectURL(file);
      const newTrack = {
        id: `local-${Date.now()}-${i}`,
        title: title,
        artist: artist,
        album: "Local PC Drive",
        format: ext || "AUDIO",
        duration: "3:15",
        durationSec: 195,
        thumb: "assets/images/album_4.jpg",
        isLocal: true,
        fileUrl: fileUrl,
        file: file
      };

      allTracks.unshift(newTrack);
      addedCount++;
    });

    if (addedCount > 0) {
      showToast(`Imported ${addedCount} local track${addedCount === 1 ? '' : 's'}`);
      switchView("local");
      playTrackById(allTracks[0].id);
    }
  }

  // --------------------------------------------------------------------------
  // 6. CREATE PLAYLIST & ADD TO PLAYLIST MODALS
  // --------------------------------------------------------------------------
  function initModals() {
    const createModal = document.getElementById("create-playlist-modal");
    const nameInput = document.getElementById("new-playlist-input");
    const btnOpenTriggers = document.querySelectorAll(".btn-open-create-playlist");
    const btnCloseX = document.getElementById("close-playlist-modal");
    const btnConfirm = document.getElementById("confirm-create-playlist");

    function openCreateModal() {
      if (!createModal) return;
      createModal.classList.add("active");
      if (nameInput) {
        nameInput.value = "";
        nameInput.focus();
      }
    }

    function closeCreateModal() {
      if (createModal) createModal.classList.remove("active");
    }

    btnOpenTriggers.forEach(btn => btn.addEventListener("click", openCreateModal));
    if (btnCloseX) btnCloseX.addEventListener("click", closeCreateModal);

    function submitNewPlaylist() {
      const name = (nameInput?.value || "").trim();
      if (!name) return;

      const newPl = {
        id: `pl-${Date.now()}`,
        name: name,
        trackIds: []
      };

      customPlaylists.push(newPl);
      savePlaylists();
      closeCreateModal();
      showToast(`Playlist "${name}" created!`);
      switchView(newPl.id);
    }

    if (btnConfirm) btnConfirm.addEventListener("click", submitNewPlaylist);
    if (nameInput) {
      nameInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          submitNewPlaylist();
        }
      });
    }

    if (createModal) {
      createModal.addEventListener("click", (e) => {
        if (e.target === createModal) closeCreateModal();
      });
    }
  }

  function openAddToPlaylistModal(trackId) {
    const track = allTracks.find(t => t.id === trackId);
    if (!track) return;

    if (customPlaylists.length === 0) {
      showToast("Create a playlist first!");
      const createModal = document.getElementById("create-playlist-modal");
      if (createModal) createModal.classList.add("active");
      return;
    }

    // Quick cycle or toggle into the first/active playlist
    let targetPl = customPlaylists.find(p => p.id === currentView) || customPlaylists[0];
    if (targetPl) {
      if (!targetPl.trackIds.includes(trackId)) {
        targetPl.trackIds.push(trackId);
        savePlaylists();
        renderSidebarPlaylists();
        renderViewHeader();
        showToast(`Added to "${targetPl.name}"`);
      } else {
        showToast(`Already in "${targetPl.name}"`);
      }
    }
  }

  // --------------------------------------------------------------------------
  // 7. PLAYBACK CONTROLLER
  // --------------------------------------------------------------------------
  let playbackInterval = null;

  function resetPlayerToEmpty() {
    currentTrackIndex = -1;
    isPlaying = false;
    if (playbackInterval) clearInterval(playbackInterval);
    stopSynthPlayback();

    const playerDock = document.querySelector(".player-dock");
    if (playerDock) {
      playerDock.classList.remove("is-active");
    }
    document.body.classList.remove("has-active-player");
  }

  function loadTrack(index) {
    if (index < 0 || index >= allTracks.length) {
      resetPlayerToEmpty();
      return;
    }
    currentTrackIndex = index;
    const track = allTracks[currentTrackIndex];

    const playerDock = document.querySelector(".player-dock");
    if (playerDock) {
      playerDock.classList.add("is-active");
    }
    document.body.classList.add("has-active-player");

    const thumb = document.getElementById("player-thumb-img");
    const title = document.getElementById("player-title");
    const artist = document.getElementById("player-artist");
    const formatBadge = document.getElementById("player-format-badge");
    const totalTimeEl = document.getElementById("player-total-time");
    const currentTimeEl = document.getElementById("player-current-time");
    const seekFill = document.getElementById("player-seek-fill");

    if (thumb) {
      if (track.thumb) {
        thumb.innerHTML = `<img src="${escapeHtml(track.thumb)}" alt="${escapeHtml(track.title)}" width="52" height="52">`;
      } else {
        thumb.innerHTML = `<i data-lucide="music" class="icon-sm" aria-hidden="true"></i>`;
      }
    }
    if (title) title.textContent = track.title;
    if (artist) artist.textContent = track.artist;
    if (formatBadge) formatBadge.textContent = track.format || "LOCAL";
    if (totalTimeEl) totalTimeEl.textContent = track.duration || "0:00";
    if (currentTimeEl) currentTimeEl.textContent = "0:00";
    if (seekFill) seekFill.style.width = "0%";

    currentTime = 0;
    totalDuration = track.durationSec || 180;

    if (track.isLocal && track.fileUrl) {
      htmlAudio.src = track.fileUrl;
      htmlAudio.playbackRate = playbackSpeed;
    } else {
      htmlAudio.src = "";
    }

    if (typeof lucide !== "undefined") lucide.createIcons();
    renderTrackTable();
  }

  function togglePlay() {
    if (allTracks.length === 0 || currentTrackIndex === -1) {
      showToast("Please import audio files from your PC first");
      const fileInput = document.getElementById("local-audio-input");
      if (fileInput) fileInput.click();
      return;
    }

    initAudioContext();
    const track = allTracks[currentTrackIndex];
    if (!track) return;

    const playBtn = document.getElementById("player-play-btn");
    const playIcon = playBtn ? playBtn.querySelector("i") : null;
    const visualizer = document.getElementById("audio-visualizer");

    if (isPlaying) {
      // Pause
      isPlaying = false;
      if (track.isLocal && htmlAudio.src) {
        htmlAudio.pause();
      } else {
        stopSynthPlayback();
      }
      clearInterval(playbackInterval);
      if (playIcon) playIcon.setAttribute("data-lucide", "play");
      if (visualizer) visualizer.classList.remove("active");
    } else {
      // Play
      isPlaying = true;
      if (track.isLocal && htmlAudio.src) {
        htmlAudio.play().catch(() => {});
      } else {
        startSynthPlayback(track);
      }

      playbackInterval = setInterval(updateProgress, 1000);
      if (playIcon) playIcon.setAttribute("data-lucide", "pause");
      if (visualizer) visualizer.classList.add("active");
    }

    if (typeof lucide !== "undefined") lucide.createIcons();
    renderTrackTable();
  }

  function updateProgress() {
    if (!isPlaying) return;
    const track = allTracks[currentTrackIndex];

    if (track && track.isLocal && htmlAudio.duration) {
      currentTime = Math.floor(htmlAudio.currentTime);
      totalDuration = Math.floor(htmlAudio.duration);
    } else {
      currentTime++;
      if (currentTime >= totalDuration) {
        handleTrackEnd();
        return;
      }
    }

    updateTimeUI();
  }

  function updateTimeUI() {
    const curTimeEl = document.getElementById("player-current-time");
    const totalTimeEl = document.getElementById("player-total-time");
    const seekFill = document.getElementById("player-seek-fill");

    if (curTimeEl) curTimeEl.textContent = formatTime(currentTime);
    if (totalTimeEl && totalDuration) totalTimeEl.textContent = formatTime(totalDuration);

    if (seekFill && totalDuration > 0) {
      const pct = Math.min(100, (currentTime / totalDuration) * 100);
      seekFill.style.width = `${pct}%`;
    }
  }

  function handleTrackEnd() {
    if (repeatMode === 2) {
      // Repeat current track
      currentTime = 0;
      if (allTracks[currentTrackIndex].isLocal) htmlAudio.currentTime = 0;
      loadTrack(currentTrackIndex);
      if (!isPlaying) togglePlay();
    } else if (repeatMode === 1 || currentTrackIndex < allTracks.length - 1) {
      nextTrack();
    } else {
      isPlaying = false;
      clearInterval(playbackInterval);
      stopSynthPlayback();
      const playBtn = document.getElementById("player-play-btn");
      const playIcon = playBtn ? playBtn.querySelector("i") : null;
      if (playIcon) playIcon.setAttribute("data-lucide", "play");
      renderTrackTable();
    }
  }

  function nextTrack() {
    const tracks = getTracksForCurrentView();
    if (tracks.length === 0) return;

    if (isShuffled) {
      const randIdx = Math.floor(Math.random() * tracks.length);
      playTrackById(tracks[randIdx].id);
    } else {
      const currentTrack = allTracks[currentTrackIndex];
      const curViewIdx = tracks.findIndex(t => t.id === currentTrack?.id);
      const nextViewIdx = (curViewIdx + 1) % tracks.length;
      playTrackById(tracks[nextViewIdx].id);
    }
  }

  function prevTrack() {
    const tracks = getTracksForCurrentView();
    if (tracks.length === 0) return;

    if (currentTime > 4) {
      currentTime = 0;
      if (allTracks[currentTrackIndex].isLocal) htmlAudio.currentTime = 0;
      updateTimeUI();
      return;
    }

    const currentTrack = allTracks[currentTrackIndex];
    const curViewIdx = tracks.findIndex(t => t.id === currentTrack?.id);
    const prevViewIdx = (curViewIdx - 1 + tracks.length) % tracks.length;
    playTrackById(tracks[prevViewIdx].id);
  }

  function formatTime(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function showToast(msg) {
    const toast = document.getElementById("ignite-toast");
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("active");
    setTimeout(() => {
      toast.classList.remove("active");
    }, 2400);
  }

  // --------------------------------------------------------------------------
  // 8. CONTROLLER EVENTS & EXPOSURE SLIDER MOUNTING
  // --------------------------------------------------------------------------
  function initPlayerEvents() {
    const playBtn = document.getElementById("player-play-btn");
    const nextBtn = document.getElementById("player-next-btn");
    const prevBtn = document.getElementById("player-prev-btn");
    const shuffleBtn = document.getElementById("player-shuffle-btn");
    const repeatBtn = document.getElementById("player-repeat-btn");
    const repeatBadge = document.getElementById("repeat-badge");
    const speedBtn = document.getElementById("player-speed-btn");
    const searchInput = document.getElementById("search-tracks-input");
    const seekBar = document.getElementById("player-seek-bar");

    if (playBtn) playBtn.addEventListener("click", togglePlay);
    if (nextBtn) nextBtn.addEventListener("click", nextTrack);
    if (prevBtn) prevBtn.addEventListener("click", prevTrack);

    if (shuffleBtn) {
      shuffleBtn.addEventListener("click", () => {
        isShuffled = !isShuffled;
        shuffleBtn.classList.toggle("active", isShuffled);
      });
    }

    if (repeatBtn) {
      repeatBtn.addEventListener("click", () => {
        repeatMode = (repeatMode + 1) % 3;
        repeatBtn.classList.toggle("active", repeatMode > 0);
        if (repeatBadge) repeatBadge.style.display = repeatMode === 2 ? "inline" : "none";
      });
    }

    if (speedBtn) {
      const speeds = [1.0, 1.25, 1.5, 2.0, 0.75];
      let sIdx = 0;
      speedBtn.addEventListener("click", () => {
        sIdx = (sIdx + 1) % speeds.length;
        playbackSpeed = speeds[sIdx];
        speedBtn.textContent = `${playbackSpeed}x`;
        htmlAudio.playbackRate = playbackSpeed;
      });
    }

    if (searchInput) {
      searchInput.addEventListener("input", () => {
        renderTrackTable();
      });
    }

    if (seekBar) {
      seekBar.addEventListener("click", function (e) {
        const rect = this.getBoundingClientRect();
        const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        currentTime = Math.floor(pos * totalDuration);

        if (allTracks[currentTrackIndex]?.isLocal && htmlAudio.duration) {
          htmlAudio.currentTime = currentTime;
        }
        updateTimeUI();
      });
    }

    // Sidebar home link
    const navHome = document.getElementById("nav-home");
    if (navHome) {
      navHome.addEventListener("click", (e) => {
        e.preventDefault();
        switchView("all");
      });
    }

    // SmoothUI Exposure Slider Integration (Player Dock)
    let playerSlider = null;

    function setVolume(val, syncSliders = false) {
      val = Math.max(0, Math.min(1, val));
      htmlAudio.volume = val;
      if (masterGain && audioCtx) {
        masterGain.gain.setValueAtTime(val * 0.15, audioCtx.currentTime);
      }
      if (syncSliders) {
        const intVal = Math.round(val * 100);
        if (playerSlider && playerSlider.value !== intVal) playerSlider.setValue(intVal);
      }
    }

    if (typeof window.ExposureSlider === "function") {
      const playerEl = document.getElementById("player-exposure-slider");

      if (playerEl) {
        playerSlider = new window.ExposureSlider(playerEl, {
          min: 0,
          max: 100,
          step: 1,
          defaultValue: 80,
          unit: "%",
          pixelsPerUnit: 3.8,
          notchInterval: 2,
          majorInterval: 20,
          onChange: (val) => {
            setVolume(val / 100, false);
          }
        });
        window.playerExposureSlider = playerSlider;
      }

      // Initial volume synchronization
      setVolume(0.8, false);
    }
    // Expose helpers for external triggers & automated verification
    window.allTracks = allTracks;
    window.loadTrack = loadTrack;
    window.togglePlay = togglePlay;
    window.resetPlayerToEmpty = resetPlayerToEmpty;
    window.handleAudioFiles = handleFiles;
    window.renderTracks = renderTrackTable;
    window.customPlaylists = customPlaylists;
    window.switchView = switchView;
  }

  // --------------------------------------------------------------------------
  // 9. DOM INITIALIZATION
  // --------------------------------------------------------------------------
  function init() {
    loadPlaylists();
    initFileImport();
    initModals();
    initPlayerEvents();
    resetPlayerToEmpty();

    renderViewHeader();
    renderSidebarPlaylists();
    renderPlaylistFilterTabs();
    renderTrackTable();

    // Start Procedural Ascii Flame
    if (typeof window.initAsciiFlame === "function") {
      window.initAsciiFlame();
    }

    // Start Scramble Text on Nagendra Varma attribution
    if (typeof window.initScrambleText === "function") {
      window.initScrambleText();
    }

    if (typeof lucide !== "undefined" && typeof lucide.createIcons === "function") {
      lucide.createIcons();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
