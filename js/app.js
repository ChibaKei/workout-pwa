/**
 * Workout PWA — Application Controller with Video Management
 */

(() => {
  'use strict';

  const STORAGE_KEY = 'workout_pwa_videos_v1';

  // DOM Elements - Main Stage
  const emptyState = document.getElementById('emptyState');
  const videoStage = document.getElementById('videoStage');
  const rouletteOverlay = document.getElementById('rouletteOverlay');
  const rouletteTicker = document.getElementById('rouletteTicker');

  const btnPickInitial = document.getElementById('btnPickInitial');
  const btnPickAgain = document.getElementById('btnPickAgain');
  const linkOpenYoutube = document.getElementById('linkOpenYoutube');

  const videoCategory = document.getElementById('videoCategory');
  const videoDuration = document.getElementById('videoDuration');
  const videoTitle = document.getElementById('videoTitle');
  const youtubePlayer = document.getElementById('youtubePlayer');

  const playlistCount = document.getElementById('playlistCount');
  const playlistItemsContainer = document.getElementById('playlistItems');

  // DOM Elements - Management Modal
  const btnOpenManageModal = document.getElementById('btnOpenManageModal');
  const manageModal = document.getElementById('manageModal');
  const modalBackdrop = document.getElementById('modalBackdrop');
  const btnCloseManageModal = document.getElementById('btnCloseManageModal');

  const addVideoForm = document.getElementById('addVideoForm');
  const inputVideoUrl = document.getElementById('inputVideoUrl');
  const inputVideoTitle = document.getElementById('inputVideoTitle');
  const inputVideoCategory = document.getElementById('inputVideoCategory');
  const inputVideoDuration = document.getElementById('inputVideoDuration');

  const manageListTitle = document.getElementById('manageListTitle');
  const manageVideoList = document.getElementById('manageVideoList');
  const btnResetVideos = document.getElementById('btnResetVideos');

  let currentVideoId = null;
  let isShuffling = false;
  let videos = [];

  /**
   * Initialize App
   */
  function init() {
    loadVideosFromStorage();
    renderPlaylistAccordion();
    attachEventListeners();
    registerServiceWorker();
  }

  /**
   * Load Videos from LocalStorage or Fallback to Default Preset
   */
  function loadVideosFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          videos = parsed;
          return;
        }
      }
    } catch (e) {
      console.warn('[Storage] Failed to read localStorage:', e);
    }

    // Default preset from videos.js
    const defaultPreset = window.DEFAULT_WORKOUT_VIDEOS || window.WORKOUT_VIDEOS || [];
    videos = [...defaultPreset];
    saveVideosToStorage();
  }

  /**
   * Save Videos to LocalStorage
   */
  function saveVideosToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(videos));
    } catch (e) {
      console.warn('[Storage] Failed to write to localStorage:', e);
    }
  }

  /**
   * Extract YouTube 11-character Video ID from URL or Raw String
   */
  function extractYouTubeId(urlOrId) {
    if (!urlOrId) return null;
    const trimmed = urlOrId.trim();

    // Raw 11-char ID
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
      return trimmed;
    }

    // Standard YouTube URL formats
    const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  }

  /**
   * Render Playlist in Accordion Drawer
   */
  function renderPlaylistAccordion() {
    if (playlistCount) {
      playlistCount.textContent = `収録: ${videos.length}本`;
    }

    if (!playlistItemsContainer) return;
    playlistItemsContainer.innerHTML = '';

    if (videos.length === 0) {
      playlistItemsContainer.innerHTML = '<div style="padding: 12px; font-size: 0.85rem; color: var(--text-dim); text-align: center;">動画が登録されていません。「動画を管理」から追加してください。</div>';
      return;
    }

    videos.forEach((video, index) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `playlist-item ${video.id === currentVideoId ? 'is-active' : ''}`;
      btn.dataset.id = video.id;
      btn.innerHTML = `
        <span class="playlist-item-title">${index + 1}. ${escapeHtml(video.title)}</span>
        <span class="playlist-item-duration">${escapeHtml(video.duration || '')}</span>
      `;
      btn.addEventListener('click', () => {
        selectVideo(video);
      });
      playlistItemsContainer.appendChild(btn);
    });
  }

  let deleteConfirmIndex = null;
  let deleteConfirmTimeout = null;
  let resetConfirming = false;
  let resetConfirmTimeout = null;

  /**
   * Render Videos in Management Modal
   */
  function renderManageList() {
    if (manageListTitle) {
      manageListTitle.textContent = `登録中の動画（全${videos.length}本）`;
    }

    if (!manageVideoList) return;
    manageVideoList.innerHTML = '';

    if (videos.length === 0) {
      manageVideoList.innerHTML = '<div style="padding: 16px; font-size: 0.85rem; color: var(--text-dim); text-align: center;">動画がありません。上のフォームから追加してください。</div>';
      return;
    }

    videos.forEach((video, index) => {
      const item = document.createElement('div');
      item.className = 'manage-video-item';
      const isConfirming = deleteConfirmIndex === index;

      item.innerHTML = `
        <div class="manage-video-info">
          <span class="manage-video-title" title="${escapeHtml(video.title)}">${index + 1}. ${escapeHtml(video.title)}</span>
          <div class="manage-video-meta">
            <span>🏷️ ${escapeHtml(video.category || '未設定')}</span>
            <span>⏱️ ${escapeHtml(video.duration || '未設定')}</span>
            <span>ID: ${escapeHtml(video.id)}</span>
          </div>
        </div>
        <button type="button" class="btn-delete-video ${isConfirming ? 'is-confirming' : ''}" data-index="${index}" aria-label="${escapeHtml(video.title)}を削除">
          ${isConfirming ? '本当に削除？' : '削除'}
        </button>
      `;

      // Inline Confirmation Delete action
      const deleteBtn = item.querySelector('.btn-delete-video');
      deleteBtn.addEventListener('click', () => {
        if (deleteConfirmIndex === index) {
          // Confirmed!
          clearTimeout(deleteConfirmTimeout);
          deleteConfirmIndex = null;
          performDeleteVideo(index);
        } else {
          // First tap: prompt confirmation
          clearTimeout(deleteConfirmTimeout);
          deleteConfirmIndex = index;
          renderManageList();
          deleteConfirmTimeout = setTimeout(() => {
            deleteConfirmIndex = null;
            renderManageList();
          }, 3500);
        }
      });

      manageVideoList.appendChild(item);
    });
  }

  /**
   * Add New Video
   */
  function handleAddVideo(e) {
    e.preventDefault();

    const rawUrl = inputVideoUrl.value;
    const videoId = extractYouTubeId(rawUrl);

    if (!videoId) {
      alert('有効なYouTubeのURLまたは動画ID（11桁）を入力してください。');
      inputVideoUrl.focus();
      return;
    }

    // Check duplicate
    if (videos.some(v => v.id === videoId)) {
      alert('この動画は既にリストに登録されています。');
      return;
    }

    const title = inputVideoTitle.value.trim();
    if (!title) {
      alert('動画タイトルを入力してください。');
      inputVideoTitle.focus();
      return;
    }

    const category = inputVideoCategory.value.trim() || '筋トレ';
    const duration = inputVideoDuration.value.trim() || '目安なし';

    const newVideo = {
      id: videoId,
      title: title,
      category: category,
      duration: duration
    };

    videos.push(newVideo);
    saveVideosToStorage();

    // Reset Form
    addVideoForm.reset();

    // Rerender UI
    renderManageList();
    renderPlaylistAccordion();
  }

  /**
   * Perform deletion
   */
  function performDeleteVideo(index) {
    const targetVideo = videos[index];
    if (!targetVideo) return;

    const deletedId = targetVideo.id;
    videos.splice(index, 1);
    saveVideosToStorage();

    // If deleted video was currently displayed
    if (currentVideoId === deletedId) {
      if (videos.length > 0) {
        selectVideo(videos[0]);
      } else {
        currentVideoId = null;
        if (youtubePlayer) youtubePlayer.src = '';
        if (videoStage) videoStage.classList.add('hidden');
        if (emptyState) emptyState.classList.remove('hidden');
      }
    }

    renderManageList();
    renderPlaylistAccordion();
  }

  /**
   * Reset Videos to Default with inline confirmation
   */
  function handleResetVideos() {
    if (!resetConfirming) {
      resetConfirming = true;
      btnResetVideos.textContent = '本当に初期化する？（タップで実行）';
      btnResetVideos.style.color = '#ef4444';
      clearTimeout(resetConfirmTimeout);
      resetConfirmTimeout = setTimeout(() => {
        resetConfirming = false;
        btnResetVideos.textContent = '初期リストに戻す';
        btnResetVideos.style.color = '';
      }, 4000);
      return;
    }

    // Confirmed reset
    resetConfirming = false;
    clearTimeout(resetConfirmTimeout);
    btnResetVideos.textContent = '初期リストに戻す';
    btnResetVideos.style.color = '';

    const defaultPreset = window.DEFAULT_WORKOUT_VIDEOS || window.WORKOUT_VIDEOS || [];
    videos = [...defaultPreset];
    saveVideosToStorage();

    renderManageList();
    renderPlaylistAccordion();
  }

  /**
   * Modal Open / Close
   */
  function openModal() {
    renderManageList();
    manageModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    manageModal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  /**
   * Attach Event Listeners
   */
  function attachEventListeners() {
    // Stage Triggers
    if (btnPickInitial) {
      btnPickInitial.addEventListener('click', () => triggerRandomPick());
    }
    if (btnPickAgain) {
      btnPickAgain.addEventListener('click', () => triggerRandomPick());
    }

    // Modal Triggers
    if (btnOpenManageModal) {
      btnOpenManageModal.addEventListener('click', openModal);
    }
    if (btnCloseManageModal) {
      btnCloseManageModal.addEventListener('click', closeModal);
    }
    if (modalBackdrop) {
      modalBackdrop.addEventListener('click', closeModal);
    }
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !manageModal.classList.contains('hidden')) {
        closeModal();
      }
    });

    // Form Submissions
    if (addVideoForm) {
      addVideoForm.addEventListener('submit', handleAddVideo);
    }
    if (btnResetVideos) {
      btnResetVideos.addEventListener('click', handleResetVideos);
    }
  }

  /**
   * Trigger Random Selection with exciting slot/roulette animation
   */
  function triggerRandomPick() {
    if (isShuffling || videos.length === 0) {
      if (videos.length === 0) {
        alert('動画リストが空です。「動画を管理」から動画を追加してください。');
      }
      return;
    }

    // Filter out current video if more than 1 option exists
    const candidates = videos.length > 1
      ? videos.filter(v => v.id !== currentVideoId)
      : videos;

    const chosenVideo = candidates[Math.floor(Math.random() * candidates.length)];

    isShuffling = true;
    rouletteOverlay.classList.remove('hidden');

    let counter = 0;
    const totalTicks = 8;
    const intervalTime = 70; // ms

    const shuffleTimer = setInterval(() => {
      const randomPreview = videos[Math.floor(Math.random() * videos.length)];
      if (rouletteTicker) {
        rouletteTicker.textContent = randomPreview.title;
      }
      counter++;

      if (counter >= totalTicks) {
        clearInterval(shuffleTimer);
        setTimeout(() => {
          rouletteOverlay.classList.add('hidden');
          isShuffling = false;
          selectVideo(chosenVideo);
        }, 150);
      }
    }, intervalTime);
  }

  /**
   * Apply Chosen Video to UI & Player
   */
  function selectVideo(video) {
    if (!video) return;

    currentVideoId = video.id;

    // Set badges & texts
    if (videoCategory) {
      videoCategory.textContent = video.category || '筋トレ';
    }
    if (videoDuration) {
      videoDuration.textContent = video.duration || '目安なし';
    }
    if (videoTitle) {
      videoTitle.textContent = video.title;
    }

    // Set YouTube Embed Player
    // playsinline=1 is essential for iOS Safari inline playback
    if (youtubePlayer) {
      const embedUrl = `https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;
      youtubePlayer.src = embedUrl;
    }

    // Set External YouTube Link
    if (linkOpenYoutube) {
      linkOpenYoutube.href = `https://www.youtube.com/watch?v=${video.id}`;
    }

    // Toggle States
    emptyState.classList.add('hidden');
    videoStage.classList.remove('hidden');

    // Update active state in playlist items
    const allItems = playlistItemsContainer.querySelectorAll('.playlist-item');
    allItems.forEach(item => {
      if (item.dataset.id === video.id) {
        item.classList.add('is-active');
      } else {
        item.classList.remove('is-active');
      }
    });

    // Smooth scroll if on small device
    if (window.innerWidth < 640) {
      videoStage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  /**
   * HTML escape helper
   */
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * PWA Service Worker Registration
   */
  function registerServiceWorker() {
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then((reg) => {
            console.log('[PWA] ServiceWorker registered with scope:', reg.scope);
          })
          .catch((err) => {
            console.warn('[PWA] ServiceWorker registration failed:', err);
          });
      });
    }
  }

  // Start app
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
