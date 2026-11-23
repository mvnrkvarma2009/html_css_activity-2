/**
 * ==========================================================================
 * IGNITE MUSIC — js/app.js
 * Music Player Engine, Web Audio Synthesizer & INR Checkout Controller
 * ==========================================================================
 */

(function () {
  'use strict';

  // Sample Track Database
  const trackDB = [
    {
      id: 1,
      title: "Inferno Nights",
      artist: "Aarav Sen & Divine Pulse",
      album: "Neon Flame EP",
      duration: "3:42",
      thumb: "assets/images/album_1.jpg",
      plays: "2.4M",
      bpm: 124,
      chords: [261.63, 329.63, 392.00, 523.25] // C maj
    },
    {
      id: 2,
      title: "Midnight Chai Lo-Fi",
      artist: "Tara Krishnan",
      album: "Monsoon Melodies",
      duration: "2:54",
      thumb: "assets/images/album_2.jpg",
      plays: "1.8M",
      bpm: 85,
      chords: [220.00, 261.63, 329.63, 440.00] // A min
    },
    {
      id: 3,
      title: "Deccan Drift",
      artist: "Rishi & The Circuit",
      album: "Cyber Hyderabad",
      duration: "4:15",
      thumb: "assets/images/album_3.jpg",
      plays: "3.1M",
      bpm: 110,
      chords: [174.61, 220.00, 261.63, 349.23] // F maj
    },
    {
      id: 4,
      title: "Solar Flare Anthem",
      artist: "DJ Agni & Nova",
      album: "Ignite Volume 1",
      duration: "3:10",
      thumb: "assets/images/album_4.jpg",
      plays: "4.7M",
      bpm: 128,
      chords: [196.00, 246.94, 293.66, 392.00] // G maj
    },
    {
      id: 5,
      title: "Lost in Bengaluru",
      artist: "Aditi Rao",
      album: "Silicone Horizons",
      duration: "3:30",
      thumb: "assets/images/playlist_2.jpg",
      plays: "940K",
      bpm: 96,
      chords: [293.66, 349.23, 440.00, 587.33] // D min
    },
    {
      id: 6,
      title: "Varanasi Raga Electro",
      artist: "Pandit Anand & SynthCore",
      album: "Ancient Currents",
      duration: "5:02",
      thumb: "assets/images/playlist_1.jpg",
      plays: "1.5M",
      bpm: 104,
      chords: [261.63, 311.13, 392.00, 466.16] // C min7
    }
  ];

  let currentTrackIndex = 0;
  let isPlaying = false;
  let currentTime = 45; // seconds
  let totalTime = 222; // 3:42
  let timerInterval = null;

  // Web Audio Context for realistic synth chords
  let audioCtx = null;
  let masterGain = null;
  let activeNodes = [];

  function initAudioEngine() {
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

  function playSynthChord(freqs) {
    if (!audioCtx) initAudioEngine();
    if (!audioCtx) return;

    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    // Stop previous nodes
    activeNodes.forEach((node) => {
      try {
        node.stop();
        node.disconnect();
      } catch (e) {}
    });
    activeNodes = [];

    freqs.forEach((freq, idx) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

      gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.03, audioCtx.currentTime + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.015, audioCtx.currentTime + 2.5);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start();
      activeNodes.push(osc);
    });
  }

  function stopSynth() {
    if (masterGain && audioCtx) {
      masterGain.gain.setValueAtTime(masterGain.gain.value, audioCtx.currentTime);
      masterGain.gain.linearRampToValueAtTime(0.0001, audioCtx.currentTime + 0.3);
      setTimeout(() => {
        if (masterGain && audioCtx) {
          masterGain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        }
      }, 350);
    }
  }

  function loadTrack(index) {
    currentTrackIndex = index;
    const track = trackDB[index];

    const pThumb = document.getElementById('player-thumb-img');
    const pTitle = document.getElementById('player-title');
    const pArtist = document.getElementById('player-artist');
    const pTotalTime = document.getElementById('player-total-time');
    const pCurTime = document.getElementById('player-current-time');
    const pFill = document.getElementById('player-seek-fill');

    if (pThumb) pThumb.src = track.thumb;
    if (pTitle) pTitle.textContent = track.title;
    if (pArtist) pArtist.textContent = track.artist;
    if (pTotalTime) pTotalTime.textContent = track.duration;

    // Reset progress
    currentTime = 0;
    const [m, s] = track.duration.split(':').map(Number);
    totalTime = m * 60 + s;
    if (pCurTime) pCurTime.textContent = "0:00";
    if (pFill) pFill.style.width = "0%";

    // Highlight active row in table
    document.querySelectorAll('.track-row').forEach((row, rIdx) => {
      if (rIdx === index) row.classList.add('active');
      else row.classList.remove('active');
    });

    if (isPlaying) {
      playSynthChord(track.chords);
    }
  }

  function togglePlay() {
    isPlaying = !isPlaying;
    const playBtn = document.getElementById('player-play-btn');
    const playIcon = playBtn ? playBtn.querySelector('i') : null;

    if (isPlaying) {
      if (playIcon) playIcon.setAttribute('data-lucide', 'pause');
      playSynthChord(trackDB[currentTrackIndex].chords);

      clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        currentTime++;
        if (currentTime >= totalTime) {
          nextTrack();
          return;
        }
        updateTimeUI();
      }, 1000);
    } else {
      if (playIcon) playIcon.setAttribute('data-lucide', 'play');
      stopSynth();
      clearInterval(timerInterval);
    }

    if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
      lucide.createIcons();
    }
  }

  function nextTrack() {
    const nextIdx = (currentTrackIndex + 1) % trackDB.length;
    loadTrack(nextIdx);
    if (!isPlaying) togglePlay();
  }

  function prevTrack() {
    const prevIdx = (currentTrackIndex - 1 + trackDB.length) % trackDB.length;
    loadTrack(prevIdx);
    if (!isPlaying) togglePlay();
  }

  function updateTimeUI() {
    const pCurTime = document.getElementById('player-current-time');
    const pFill = document.getElementById('player-seek-fill');

    const mins = Math.floor(currentTime / 60);
    const secs = currentTime % 60;
    const formatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

    if (pCurTime) pCurTime.textContent = formatted;
    if (pFill) {
      const pct = (currentTime / totalTime) * 100;
      pFill.style.width = `${pct}%`;
    }
  }

  function initPlayerEvents() {
    const playBtn = document.getElementById('player-play-btn');
    const nextBtn = document.getElementById('player-next-btn');
    const prevBtn = document.getElementById('player-prev-btn');

    if (playBtn) playBtn.addEventListener('click', togglePlay);
    if (nextBtn) nextBtn.addEventListener('click', nextTrack);
    if (prevBtn) prevBtn.addEventListener('click', prevTrack);

    // Hero Play button
    const heroPlay = document.getElementById('hero-play-featured');
    if (heroPlay) {
      heroPlay.addEventListener('click', () => {
        loadTrack(0);
        if (!isPlaying) togglePlay();
      });
    }

    // Popular track rows
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

    // Seek bar jump
    const seekBar = document.getElementById('player-seek-bar');
    if (seekBar) {
      seekBar.addEventListener('click', function (e) {
        const rect = this.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        currentTime = Math.floor(pos * totalTime);
        updateTimeUI();
      });
    }
  }

  /**
   * Indian Currency (₹ INR) Subscription Modal
   */
  function initSubscriptionCheckout() {
    const planButtons = document.querySelectorAll('.btn-select-plan');
    const modal = document.getElementById('sub-modal');
    const modalPlanName = document.getElementById('modal-plan-name');
    const modalPlanPrice = document.getElementById('modal-plan-price');
    const closeModalBtn = document.getElementById('close-sub-modal');
    const confirmBtn = document.getElementById('confirm-sub-btn');

    planButtons.forEach((btn) => {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        const plan = this.getAttribute('data-plan') || "Individual VIP";
        const price = this.getAttribute('data-price') || "₹99";
        const period = this.getAttribute('data-period') || "/ month";

        if (modalPlanName) modalPlanName.textContent = plan;
        if (modalPlanPrice) modalPlanPrice.textContent = `${price} ${period}`;

        if (modal) {
          modal.classList.add('active');
          document.body.style.overflow = 'hidden';
        }
      });
    });

    function closeModal() {
      if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
      }
    }

    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        alert("Payment verified successfully! Welcome to IGNITE MUSIC Premium.");
        closeModal();
      });
    }
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
    }
  }

  function initNav() {
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

    initNav();
    loadTrack(0);
    initPlayerEvents();
    initSubscriptionCheckout();

    if (typeof window.initAsciiFlame === 'function') {
      window.initAsciiFlame();
    }

    setTimeout(() => {
      if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
        lucide.createIcons();
      }
    }, 120);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
