/**
 * ==========================================================================
 * IGNITE MUSIC — js/app.js
 * Local Audio Import Engine, Real Playback, Shuffle/Repeat & Windows Client
 * ==========================================================================
 */

(function () {
  'use strict';

  // Default Featured Library Tracks
  const defaultTracks = [
    {
      id: "demo-1",
      title: "Inferno Nights",
      artist: "Aarav Sen & Divine Pulse",
      album: "Neon Flame EP",
      duration: "3:42",
      thumb: "assets/images/album_1.jpg",
      plays: "2.4M",
      format: "FLAC",
      isLocal: false,
      chords: [261.63, 329.63, 392.00, 523.25]
    },
    {
      id: "demo-2",
      title: "Midnight Chai Lo-Fi",
      artist: "Tara Krishnan",
      album: "Monsoon Melodies",
      duration: "2:54",
      thumb: "assets/images/album_2.jpg",
      plays: "1.8M",
      format: "320K",
      isLocal: false,
      chords: [220.00, 261.63, 329.63, 440.00]
    },
    {
      id: "demo-3",
      title: "Deccan Drift",
      artist: "Rishi & The Circuit",
      album: "Cyber Hyderabad",
      duration: "4:15",
      thumb: "assets/images/album_3.jpg",
      plays: "3.1M",
      format: "WAV",
      isLocal: false,
      chords: [174.61, 220.00, 261.63, 349.23]
    },
    {
      id: "demo-4",
      title: "Solar Flare Anthem",
      artist: "DJ Agni & Nova",
      album: "Ignite Volume 1",
      duration: "3:10",
      thumb: "assets/images/album_4.jpg",
      plays: "4.7M",
      format: "FLAC",
      isLocal: false,
      chords: [196.00, 246.94, 293.66, 392.00]
    },
    {
      id: "demo-5",
      title: "Lost in Bengaluru",
      artist: "Aditi Rao",
      album: "Silicone Horizons",
      duration: "3:30",
      thumb: "assets/images/playlist_2.jpg",
      plays: "940K",
      format: "MP3",
      isLocal: false,
      chords: [293.66, 349.23, 440.00, 587.33]
    },
    {
      id: "demo-6",
      title: "Varanasi Raga Electro",
      artist: "Pandit Anand & SynthCore",
      album: "Ancient Currents",
      duration: "5:02",
      thumb: "assets/images/playlist_1.jpg",
      plays: "1.5M",
      format: "FLAC",
      isLocal: false,
      chords: [261.63, 311.13, 392.00, 466.16]
    }
  ];

  // Active Playback State
  let activePlaylist = [...defaultTracks];
  let currentTrackIndex = 0;
  let isPlaying = false;
  let currentTime = 0;
  let totalDuration = 222;
  let timerInterval = null;

  // Player Modes
  let isShuffle = false;
  let repeatMode = 'off'; // 'off' | 'all' | 'one'
  const playbackRates = [1.0, 1.25, 1.5, 2.0, 0.75];
  let currentRateIndex = 0;

  // Real HTML5 Audio Element for imported local audio files
  const htmlAudio = new Audio();
  htmlAudio.preload = "auto";

  // Web Audio Context for synthetic fallback tones
  let audioCtx = null;
  let masterGain = null;
  let activeNodes = [];

  function initWebAudio() {
    if (audioCtx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();
      masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      masterGain.connect(audioCtx.destination);
    } catch (e) {
      console.warn("Web Audio not supported", e);
    }
  }

  function playSynthTones(freqs) {
    if (!audioCtx) initWebAudio();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    stopSynthTones();

    freqs.forEach((freq, idx) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

      gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.025, audioCtx.currentTime + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 3.0);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start();
      activeNodes.push(osc);
    });
  }

  function stopSynthTones() {
    activeNodes.forEach((node) => {
      try {
        node.stop();
        node.disconnect();
      } catch (e) {}
    });
    activeNodes = [];
  }

  // Format seconds to mm:ss
  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  // Load Track into Player
  function loadTrack(index) {
    if (index < 0 || index >= activePlaylist.length) return;
    currentTrackIndex = index;
    const track = activePlaylist[index];

    const pThumb = document.getElementById('player-thumb-img');
    const pTitle = document.getElementById('player-title');
    const pArtist = document.getElementById('player-artist');
    const pTotalTime = document.getElementById('player-total-time');
    const pCurTime = document.getElementById('player-current-time');
    const pFill = document.getElementById('player-seek-fill');
    const pBadge = document.getElementById('player-format-badge');

    if (pThumb) pThumb.src = track.thumb || "assets/images/album_1.jpg";
    if (pTitle) pTitle.textContent = track.title;
    if (pArtist) pArtist.textContent = track.artist;
    if (pBadge) pBadge.textContent = track.format || "LOCAL";

    currentTime = 0;

    if (track.isLocal && track.audioUrl) {
      // Real HTML5 Audio
      stopSynthTones();
      htmlAudio.src = track.audioUrl;
      htmlAudio.playbackRate = playbackRates[currentRateIndex];
      htmlAudio.load();

      htmlAudio.onloadedmetadata = function () {
        totalDuration = htmlAudio.duration;
        if (pTotalTime) pTotalTime.textContent = formatTime(totalDuration);
      };

      if (isPlaying) {
        htmlAudio.play().catch(e => console.log("Autoplay policy:", e));
      }
    } else {
      // Demo Synthetic Track
      htmlAudio.pause();
      htmlAudio.src = "";
      const parts = (track.duration || "3:30").split(':').map(Number);
      totalDuration = parts[0] * 60 + parts[1];
      if (pTotalTime) pTotalTime.textContent = track.duration;

      if (isPlaying) {
        playSynthTones(track.chords || [261.63, 329.63, 392.00]);
      }
    }

    if (pCurTime) pCurTime.textContent = "0:00";
    if (pFill) pFill.style.width = "0%";

    // Highlight row in tables
    updateRowHighlights();
  }

  function updateRowHighlights() {
    document.querySelectorAll('.track-row').forEach((row) => {
      const idx = parseInt(row.getAttribute('data-track-idx'), 10);
      if (idx === currentTrackIndex) row.classList.add('active');
      else row.classList.remove('active');
    });

    document.querySelectorAll('.imported-track-row').forEach((row) => {
      const idx = parseInt(row.getAttribute('data-imported-idx'), 10);
      if (idx === currentTrackIndex) row.classList.add('active');
      else row.classList.remove('active');
    });
  }

  // Toggle Play / Pause
  function togglePlay() {
    isPlaying = !isPlaying;
    const playBtn = document.getElementById('player-play-btn');
    const playIcon = playBtn ? playBtn.querySelector('i') : null;
    const visualizer = document.getElementById('audio-visualizer');

    const track = activePlaylist[currentTrackIndex];

    if (isPlaying) {
      if (playIcon) playIcon.setAttribute('data-lucide', 'pause');
      if (visualizer) visualizer.classList.add('active');

      if (track && track.isLocal && track.audioUrl) {
        htmlAudio.play().catch(e => console.log("Play failed:", e));
      } else if (track) {
        playSynthTones(track.chords || [261.63, 329.63, 392.00]);
        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
          currentTime++;
          if (currentTime >= totalDuration) {
            handleTrackEnd();
            return;
          }
          updateTimeUI();
        }, 1000);
      }
    } else {
      if (playIcon) playIcon.setAttribute('data-lucide', 'play');
      if (visualizer) visualizer.classList.remove('active');

      if (track && track.isLocal) {
        htmlAudio.pause();
      } else {
        stopSynthTones();
        clearInterval(timerInterval);
      }
    }

    if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
      lucide.createIcons();
    }
  }

  function handleTrackEnd() {
    if (repeatMode === 'one') {
      currentTime = 0;
      if (activePlaylist[currentTrackIndex].isLocal) {
        htmlAudio.currentTime = 0;
        htmlAudio.play();
      } else {
        playSynthTones(activePlaylist[currentTrackIndex].chords || [261.63, 329.63, 392.00]);
      }
    } else if (repeatMode === 'all') {
      nextTrack();
    } else {
      // Repeat off
      if (currentTrackIndex < activePlaylist.length - 1) {
        nextTrack();
      } else {
        // End of playlist
        isPlaying = false;
        const playBtn = document.getElementById('player-play-btn');
        const playIcon = playBtn ? playBtn.querySelector('i') : null;
        if (playIcon) playIcon.setAttribute('data-lucide', 'play');
        const visualizer = document.getElementById('audio-visualizer');
        if (visualizer) visualizer.classList.remove('active');
        if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
          lucide.createIcons();
        }
      }
    }
  }

  function nextTrack() {
    if (activePlaylist.length === 0) return;
    let nextIdx;
    if (isShuffle && activePlaylist.length > 1) {
      do {
        nextIdx = Math.floor(Math.random() * activePlaylist.length);
      } while (nextIdx === currentTrackIndex);
    } else {
      nextIdx = (currentTrackIndex + 1) % activePlaylist.length;
    }
    loadTrack(nextIdx);
    if (!isPlaying) togglePlay();
  }

  function prevTrack() {
    if (activePlaylist.length === 0) return;
    let prevIdx;
    if (isShuffle && activePlaylist.length > 1) {
      do {
        prevIdx = Math.floor(Math.random() * activePlaylist.length);
      } while (prevIdx === currentTrackIndex);
    } else {
      prevIdx = (currentTrackIndex - 1 + activePlaylist.length) % activePlaylist.length;
    }
    loadTrack(prevIdx);
    if (!isPlaying) togglePlay();
  }

  function toggleShuffle() {
    isShuffle = !isShuffle;
    const shuffleBtn = document.getElementById('player-shuffle-btn');
    if (shuffleBtn) {
      if (isShuffle) {
        shuffleBtn.classList.add('active');
        showToast("Shuffle Mode: Enabled");
      } else {
        shuffleBtn.classList.remove('active');
        showToast("Shuffle Mode: Disabled");
      }
    }
  }

  function cycleRepeat() {
    const repeatBtn = document.getElementById('player-repeat-btn');
    const badge = document.getElementById('repeat-badge');

    if (repeatMode === 'off') {
      repeatMode = 'all';
      if (repeatBtn) repeatBtn.classList.add('active');
      if (badge) { badge.textContent = "ALL"; badge.style.display = "inline-block"; }
      showToast("Repeat: All Tracks");
    } else if (repeatMode === 'all') {
      repeatMode = 'one';
      if (repeatBtn) repeatBtn.classList.add('active');
      if (badge) { badge.textContent = "1"; badge.style.display = "inline-block"; }
      showToast("Repeat: Current Track");
    } else {
      repeatMode = 'off';
      if (repeatBtn) repeatBtn.classList.remove('active');
      if (badge) { badge.style.display = "none"; }
      showToast("Repeat: Off");
    }
  }

  function cycleSpeed() {
    currentRateIndex = (currentRateIndex + 1) % playbackRates.length;
    const newRate = playbackRates[currentRateIndex];
    htmlAudio.playbackRate = newRate;

    const speedBtn = document.getElementById('player-speed-btn');
    if (speedBtn) speedBtn.textContent = `${newRate}x`;
    showToast(`Playback Speed: ${newRate}x`);
  }

  function updateTimeUI() {
    const pCurTime = document.getElementById('player-current-time');
    const pFill = document.getElementById('player-seek-fill');

    if (pCurTime) pCurTime.textContent = formatTime(currentTime);
    if (pFill && totalDuration > 0) {
      const pct = (currentTime / totalDuration) * 100;
      pFill.style.width = `${Math.min(100, pct)}%`;
    }
  }

  // HTML5 Audio Event Listeners
  htmlAudio.addEventListener('timeupdate', () => {
    if (activePlaylist[currentTrackIndex] && activePlaylist[currentTrackIndex].isLocal) {
      currentTime = htmlAudio.currentTime;
      updateTimeUI();
    }
  });

  htmlAudio.addEventListener('ended', () => {
    handleTrackEnd();
  });

  // Local File System Audio Import
  function handleFiles(files) {
    if (!files || files.length === 0) return;

    let newlyImported = [];

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('audio/') && !/\.(mp3|wav|flac|ogg|m4a|aac)$/i.test(file.name)) {
        return;
      }

      const cleanTitle = file.name.replace(/\.[^/.]+$/, "");
      const ext = file.name.split('.').pop().toUpperCase();
      const objectUrl = URL.createObjectURL(file);
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1) + " MB";

      const newTrack = {
        id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        title: cleanTitle,
        artist: "Imported Local Audio",
        album: "Local Storage",
        duration: "--:--",
        thumb: "assets/images/album_1.jpg",
        format: ext,
        size: sizeMb,
        isLocal: true,
        audioUrl: objectUrl
      };

      // Probe duration
      const tempAudio = new Audio();
      tempAudio.src = objectUrl;
      tempAudio.onloadedmetadata = () => {
        newTrack.duration = formatTime(tempAudio.duration);
        renderImportedList();
      };

      newlyImported.push(newTrack);
    });

    if (newlyImported.length > 0) {
      // Insert at the front of active playlist
      activePlaylist = [...newlyImported, ...activePlaylist];
      renderImportedList();
      loadTrack(0);
      if (!isPlaying) togglePlay();
      showToast(`Successfully imported ${newlyImported.length} track(s) from system!`);

      // Scroll smoothly to imported section
      const importedSec = document.getElementById('imported-section');
      if (importedSec) {
        importedSec.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }

  function renderImportedList() {
    const listContainer = document.getElementById('imported-tracks-list');
    const emptyState = document.getElementById('imported-empty-state');
    const countBadge = document.getElementById('imported-count-badge');

    const importedTracks = activePlaylist.filter(t => t.isLocal);

    if (countBadge) countBadge.textContent = `${importedTracks.length} TRACKS`;

    if (importedTracks.length === 0) {
      if (emptyState) emptyState.style.display = 'block';
      if (listContainer) listContainer.style.display = 'none';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (listContainer) {
      listContainer.style.display = 'block';
      listContainer.innerHTML = '';

      importedTracks.forEach((track, localIdx) => {
        const globalIdx = activePlaylist.indexOf(track);
        const row = document.createElement('div');
        row.className = `imported-track-row ${globalIdx === currentTrackIndex ? 'active' : ''}`;
        row.setAttribute('data-imported-idx', globalIdx);

        row.innerHTML = `
          <div class="imported-row-num">${String(localIdx + 1).padStart(2, '0')}</div>
          <button class="imported-play-btn" type="button" aria-label="Play ${track.title}">
            <i data-lucide="${globalIdx === currentTrackIndex && isPlaying ? 'pause' : 'play'}" class="icon-sm"></i>
          </button>
          <div class="imported-meta">
            <div class="imported-title">${escapeHtml(track.title)}</div>
            <div class="imported-subtitle">System File &bull; ${track.size || 'Local Audio'}</div>
          </div>
          <div class="imported-badge-pill">${track.format || 'AUDIO'}</div>
          <div class="imported-dur">${track.duration}</div>
          <button class="imported-delete-btn" data-del-id="${track.id}" type="button" title="Remove from list">
            <i data-lucide="trash-2" class="icon-sm"></i>
          </button>
        `;

        row.addEventListener('click', (e) => {
          if (e.target.closest('.imported-delete-btn')) return;
          loadTrack(globalIdx);
          if (!isPlaying) togglePlay();
        });

        const delBtn = row.querySelector('.imported-delete-btn');
        if (delBtn) {
          delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeTrack(track.id);
          });
        }

        listContainer.appendChild(row);
      });

      if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
        lucide.createIcons();
      }
    }
  }

  function removeTrack(trackId) {
    const idx = activePlaylist.findIndex(t => t.id === trackId);
    if (idx !== -1) {
      const removed = activePlaylist[idx];
      if (removed.audioUrl) URL.revokeObjectURL(removed.audioUrl);
      activePlaylist.splice(idx, 1);

      if (idx === currentTrackIndex) {
        if (activePlaylist.length > 0) {
          loadTrack(Math.min(idx, activePlaylist.length - 1));
        } else {
          isPlaying = false;
        }
      } else if (idx < currentTrackIndex) {
        currentTrackIndex--;
      }
      renderImportedList();
      showToast("Track removed from local queue.");
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Windows Client Download Simulation
  function triggerWindowsDownload() {
    showToast("Starting download: WindowsMusicWorkspace-v2.4-Setup.exe (64-bit)...");

    // Create a real downloadable file blob so Windows prompts download
    const dummyExeContent = "MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xFF\xFF\x00\x00WINDOWS_MUSIC_WORKSPACE_CLIENT_v2.4.0";
    const blob = new Blob([dummyExeContent], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "WindowsMusicWorkspace-v2.4-Setup.exe";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);

    setTimeout(() => {
      showToast("Download Complete: Run WindowsMusicWorkspace-v2.4-Setup.exe to install!");
    }, 1500);
  }

  // Toast Notifications
  function showToast(message) {
    let toast = document.getElementById('ignite-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'ignite-toast';
      toast.className = 'ignite-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 3200);
  }

  function initPlayerEvents() {
    const playBtn = document.getElementById('player-play-btn');
    const nextBtn = document.getElementById('player-next-btn');
    const prevBtn = document.getElementById('player-prev-btn');
    const shuffleBtn = document.getElementById('player-shuffle-btn');
    const repeatBtn = document.getElementById('player-repeat-btn');
    const speedBtn = document.getElementById('player-speed-btn');

    if (playBtn) playBtn.addEventListener('click', togglePlay);
    if (nextBtn) nextBtn.addEventListener('click', nextTrack);
    if (prevBtn) prevBtn.addEventListener('click', prevTrack);
    if (shuffleBtn) shuffleBtn.addEventListener('click', toggleShuffle);
    if (repeatBtn) repeatBtn.addEventListener('click', cycleRepeat);
    if (speedBtn) speedBtn.addEventListener('click', cycleSpeed);

    // Hero Play button
    const heroPlay = document.getElementById('hero-play-featured');
    if (heroPlay) {
      heroPlay.addEventListener('click', () => {
        loadTrack(0);
        if (!isPlaying) togglePlay();
      });
    }

    // Windows Download buttons
    document.querySelectorAll('.btn-download-win').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        triggerWindowsDownload();
      });
    });

    // File Input import
    const fileInput = document.getElementById('local-audio-input');
    const importBtns = document.querySelectorAll('.btn-trigger-import');

    importBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (fileInput) fileInput.click();
      });
    });

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
        fileInput.value = "";
      });
    }

    // Drag and Drop Zone
    const dropZone = document.getElementById('import-dropzone');
    if (dropZone) {
      ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropZone.classList.add('dragover');
        });
      });

      ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropZone.classList.remove('dragover');
        });
      });

      dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
      });
    }

    // Seek Bar Scrub
    const seekBar = document.getElementById('player-seek-bar');
    if (seekBar) {
      seekBar.addEventListener('click', function (e) {
        const rect = this.getBoundingClientRect();
        const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        currentTime = Math.floor(pos * totalDuration);

        if (activePlaylist[currentTrackIndex] && activePlaylist[currentTrackIndex].isLocal) {
          htmlAudio.currentTime = currentTime;
        }
        updateTimeUI();
      });
    }

    // Master Volume & SmoothUI Exposure Slider Integration
    let lastVolume = 0.8;
    let playerSlider = null;
    let workspaceSlider = null;

    function setVolume(val, syncSliders = false) {
      val = Math.max(0, Math.min(1, val));
      htmlAudio.volume = val;
      if (masterGain && audioCtx) {
        masterGain.gain.setValueAtTime(val * 0.1, audioCtx.currentTime);
      }
      if (syncSliders) {
        const intVal = Math.round(val * 100);
        if (playerSlider && playerSlider.value !== intVal) playerSlider.setValue(intVal);
        if (workspaceSlider && workspaceSlider.value !== intVal) workspaceSlider.setValue(intVal);
      }
    }

    if (typeof window.ExposureSlider === 'function') {
      const playerEl = document.getElementById('player-exposure-slider');
      const workspaceEl = document.getElementById('workspace-exposure-slider');

      if (playerEl) {
        playerSlider = new window.ExposureSlider(playerEl, {
          min: 0,
          max: 100,
          step: 1,
          defaultValue: 80,
          unit: '%',
          pixelsPerUnit: 3.8,
          notchInterval: 2,
          majorInterval: 20,
          onChange: (val) => {
            setVolume(val / 100, false);
            if (workspaceSlider && workspaceSlider.value !== val) {
              workspaceSlider.setValue(val);
            }
          }
        });
      }

      if (workspaceEl) {
        workspaceSlider = new window.ExposureSlider(workspaceEl, {
          min: 0,
          max: 100,
          step: 1,
          defaultValue: 80,
          unit: '%',
          pixelsPerUnit: 5.8,
          notchInterval: 2,
          majorInterval: 10,
          onChange: (val) => {
            setVolume(val / 100, false);
            if (playerSlider && playerSlider.value !== val) {
              playerSlider.setValue(val);
            }
          }
        });
      }
    }

    // Track rows
    document.querySelectorAll('.track-row').forEach((row) => {
      row.addEventListener('click', function (e) {
        if (e.target.closest('.track-like')) return;
        const idx = parseInt(this.getAttribute('data-track-idx'), 10);
        if (!isNaN(idx)) {
          loadTrack(idx);
          if (!isPlaying) togglePlay();
        }
      });
    });

    // Like buttons
    document.querySelectorAll('.track-like').forEach((btn) => {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        this.classList.toggle('liked');
        const icon = this.querySelector('i');
        if (icon) {
          const isLiked = this.classList.contains('liked');
          icon.style.fill = isLiked ? '#FF2A2A' : 'none';
          icon.style.color = isLiked ? '#FF2A2A' : '';
        }
      });
    });

    // Follow buttons
    document.querySelectorAll('.btn-follow').forEach((btn) => {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (this.textContent.trim() === 'Follow') {
          this.textContent = 'Following';
          this.style.background = '#FF5500';
          this.style.color = '#FFFFFF';
        } else {
          this.textContent = 'Follow';
          this.style.background = '';
          this.style.color = '';
        }
      });
    });
  }

  function initSmoothNav() {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener('click', function (e) {
        const id = this.getAttribute('href');
        if (id && id !== '#') {
          const target = document.querySelector(id);
          if (target) {
            e.preventDefault();
            const y = target.getBoundingClientRect().top + window.pageYOffset - 70;
            window.scrollTo({ top: y, behavior: 'smooth' });
          }
        }
      });
    });
  }

  function init() {
    if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
      lucide.createIcons();
    }

    initSmoothNav();
    loadTrack(0);
    initPlayerEvents();
    renderImportedList();

    // Start Procedural Ascii Flame
    if (typeof window.initAsciiFlame === 'function') {
      window.initAsciiFlame();
    }

    // Start Scramble Text on Nagendra Varma attribution
    if (typeof window.initScrambleText === 'function') {
      window.initScrambleText();
    }

    setTimeout(() => {
      if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
        lucide.createIcons();
      }
    }, 150);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
