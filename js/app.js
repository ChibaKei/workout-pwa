/**
 * Workout PWA — Application Controller
 * 部位や目安時間の手動入力なし、URL貼付によるタイトル・再生時間自動取得
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

  const videoDuration = document.getElementById('videoDuration');
  const videoTitle = document.getElementById('videoTitle');
  const playerHost = document.getElementById('playerHost');

  const playlistCount = document.getElementById('playlistCount');
  const playlistItemsContainer = document.getElementById('playlistItems');

  // DOM Elements - Management Modal
  const btnOpenManageModal = document.getElementById('btnOpenManageModal');
  const manageModal = document.getElementById('manageModal');
  const modalBackdrop = document.getElementById('modalBackdrop');
  const btnCloseManageModal = document.getElementById('btnCloseManageModal');

  const addVideoForm = document.getElementById('addVideoForm');
  const inputVideoUrl = document.getElementById('inputVideoUrl');
  const btnPasteUrl = document.getElementById('btnPasteUrl');
  const urlFeedback = document.getElementById('urlFeedback');
  const inputVideoTitle = document.getElementById('inputVideoTitle');

  const manageListTitle = document.getElementById('manageListTitle');
  const manageVideoList = document.getElementById('manageVideoList');
  const btnResetVideos = document.getElementById('btnResetVideos');

  // Backup & Import
  const btnExportData = document.getElementById('btnExportData');
  const btnToggleImport = document.getElementById('btnToggleImport');
  const importArea = document.getElementById('importArea');
  const importTextarea = document.getElementById('importTextarea');
  const btnExecuteImport = document.getElementById('btnExecuteImport');

  let currentVideoId = null;
  let isShuffling = false;
  let videos = [];

  let ytPlayer = null;
  let isYtApiReady = false;

  let fetchTitleAbortController = null;
  let deleteConfirmIndex = null;
  let deleteConfirmTimeout = null;
  let resetConfirming = false;
  let resetConfirmTimeout = null;

  /**
   * YouTube IFrame API Ready Callback
   */
  window.onYouTubeIframeAPIReady = function() {
    isYtApiReady = true;
    if (currentVideoId && !ytPlayer) {
      createYtPlayer(currentVideoId);
    }
  };

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
   * Load Videos from LocalStorage
   */
  function loadVideosFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Normalize: remove unused category
          videos = parsed.map(v => ({
            id: v.id,
            title: v.title || `動画 (${v.id})`,
            duration: v.duration || extractDurationFromTitle(v.title) || ''
          }));
          return;
        }
      }
    } catch (e) {
      console.warn('[Storage] Failed to read localStorage:', e);
    }

    const defaultPreset = window.DEFAULT_WORKOUT_VIDEOS || window.WORKOUT_VIDEOS || [];
    videos = defaultPreset.map(v => ({
      id: v.id,
      title: v.title,
      duration: v.duration || extractDurationFromTitle(v.title) || ''
    }));
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
   * Extract YouTube Video ID
   */
  function extractYouTubeId(urlOrId) {
    if (!urlOrId) return null;
    const trimmed = urlOrId.trim();

    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
      return trimmed;
    }

    const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  }

  /**
   * Extract duration from title text (e.g., "【5分】", "4分間", "10 min")
   */
  function extractDurationFromTitle(title) {
    if (!title) return '';
    const match = title.match(/(?:【|\[|\s|^|約)?(\d+)\s*(?:分|分間|min|mins)(?:】|\]|\s|$)/i);
    return match ? `${match[1]}分` : '';
  }

  /**
   * Format seconds to "M分S秒" or "M分"
   */
  function formatSecondsToDuration(seconds) {
    if (!seconds || isNaN(seconds) || seconds <= 0) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (secs === 0) {
      return `${mins}分`;
    }
    return `${mins}分${secs}秒`;
  }

  /**
   * Fetch Video Title automatically from oEmbed
   */
  async function fetchVideoDetails(videoId) {
    if (!videoId) return;

    if (fetchTitleAbortController) {
      fetchTitleAbortController.abort();
    }
    fetchTitleAbortController = new AbortController();

    if (urlFeedback) {
      urlFeedback.className = 'url-feedback';
      urlFeedback.textContent = '⏳ タイトルを取得中...';
      urlFeedback.classList.remove('hidden');
    }

    const targetUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const oembedEndpoint = `https://noembed.com/embed?url=${encodeURIComponent(targetUrl)}`;

    try {
      const response = await fetch(oembedEndpoint, {
        signal: fetchTitleAbortController.signal
      });

      if (!response.ok) throw new Error('Network error');
      const data = await response.json();

      if (data && data.title) {
        inputVideoTitle.value = data.title;
        inputVideoTitle.dataset.autoFetched = data.title;

        const guessedDuration = extractDurationFromTitle(data.title);
        const durationText = guessedDuration ? ` (再生時間目安: ${guessedDuration})` : '';

        if (urlFeedback) {
          urlFeedback.className = 'url-feedback is-success';
          urlFeedback.textContent = `✓ 「${data.title}」を取得${durationText}`;
        }
      } else {
        if (urlFeedback) {
          urlFeedback.className = 'url-feedback';
          urlFeedback.textContent = 'IDを認識しました';
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (urlFeedback) {
        urlFeedback.className = 'url-feedback';
        urlFeedback.textContent = 'IDを認識しました（タイトルは手動編集可能です）';
      }
    }
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
        <span class="playlist-item-duration">${escapeHtml(video.duration ? `⏱️ ${video.duration}` : '')}</span>
      `;
      btn.addEventListener('click', () => {
        selectVideo(video);
      });
      playlistItemsContainer.appendChild(btn);
    });
  }

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
      const thumbUrl = `https://img.youtube.com/vi/${video.id}/mqdefault.jpg`;
      const durationBadge = video.duration ? `<span>⏱️ ${escapeHtml(video.duration)}</span>` : '';

      item.innerHTML = `
        <img class="manage-video-thumb" src="${thumbUrl}" alt="" loading="lazy" onerror="this.style.display='none'">
        <div class="manage-video-info">
          <span class="manage-video-title" title="${escapeHtml(video.title)}">${index + 1}. ${escapeHtml(video.title)}</span>
          <div class="manage-video-meta">
            ${durationBadge}
          </div>
        </div>
        <div class="manage-video-actions">
          <button type="button" class="btn-action-play" title="この動画を今すぐ再生">▶ 再生</button>
          <button type="button" class="btn-action-edit" title="タイトルを編集">✏️</button>
          <button type="button" class="btn-delete-video ${isConfirming ? 'is-confirming' : ''}" data-index="${index}" title="削除">
            ${isConfirming ? '本当に削除？' : '削除'}
          </button>
        </div>
      `;

      // Quick Play
      const playBtn = item.querySelector('.btn-action-play');
      playBtn.addEventListener('click', () => {
        selectVideo(video);
        closeModal();
      });

      // Quick Edit Title
      const editBtn = item.querySelector('.btn-action-edit');
      editBtn.addEventListener('click', () => {
        const newTitle = prompt('動画タイトルを編集:', video.title);
        if (newTitle !== null && newTitle.trim() !== '') {
          video.title = newTitle.trim();
          if (!video.duration) {
            video.duration = extractDurationFromTitle(video.title);
          }
          saveVideosToStorage();
          renderManageList();
          renderPlaylistAccordion();
          if (currentVideoId === video.id) {
            selectVideo(video);
          }
        }
      });

      // Delete action with confirmation
      const deleteBtn = item.querySelector('.btn-delete-video');
      deleteBtn.addEventListener('click', () => {
        if (deleteConfirmIndex === index) {
          clearTimeout(deleteConfirmTimeout);
          deleteConfirmIndex = null;
          performDeleteVideo(index);
        } else {
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
   * Handle URL input change/paste
   */
  function handleUrlInput() {
    const raw = inputVideoUrl.value;
    const videoId = extractYouTubeId(raw);
    if (videoId) {
      fetchVideoDetails(videoId);
    } else {
      if (urlFeedback) {
        urlFeedback.classList.add('hidden');
      }
    }
  }

  /**
   * Handle Clipboard Paste Button
   */
  async function handlePasteUrl() {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          inputVideoUrl.value = text.trim();
          handleUrlInput();
          return;
        }
      }
    } catch (e) {
      console.warn('[Clipboard] Could not read clipboard automatically:', e);
    }
    inputVideoUrl.focus();
    inputVideoUrl.select();
  }

  /**
   * Add New Video
   */
  function handleAddVideo(e) {
    e.preventDefault();

    const rawUrl = inputVideoUrl.value;
    const videoId = extractYouTubeId(rawUrl);

    if (!videoId) {
      alert('有効なYouTubeのURLを入力してください。');
      inputVideoUrl.focus();
      return;
    }

    if (videos.some(v => v.id === videoId)) {
      alert('この動画は既に登録されています。');
      return;
    }

    let title = inputVideoTitle.value.trim();
    if (!title) {
      title = `動画 (${videoId})`;
    }

    const duration = extractDurationFromTitle(title);

    const newVideo = {
      id: videoId,
      title: title,
      duration: duration
    };

    videos.unshift(newVideo);
    saveVideosToStorage();

    // Reset Form
    addVideoForm.reset();
    delete inputVideoTitle.dataset.autoFetched;
    if (urlFeedback) {
      urlFeedback.classList.add('hidden');
    }

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

    if (currentVideoId === deletedId) {
      if (videos.length > 0) {
        selectVideo(videos[0]);
      } else {
        currentVideoId = null;
        if (playerHost) playerHost.innerHTML = '';
        if (videoStage) videoStage.classList.add('hidden');
        if (emptyState) emptyState.classList.remove('hidden');
      }
    }

    renderManageList();
    renderPlaylistAccordion();
  }

  /**
   * Reset Videos to Default
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

    resetConfirming = false;
    clearTimeout(resetConfirmTimeout);
    btnResetVideos.textContent = '初期リストに戻す';
    btnResetVideos.style.color = '';

    const defaultPreset = window.DEFAULT_WORKOUT_VIDEOS || window.WORKOUT_VIDEOS || [];
    videos = defaultPreset.map(v => ({
      id: v.id,
      title: v.title,
      duration: v.duration || extractDurationFromTitle(v.title) || ''
    }));
    saveVideosToStorage();

    renderManageList();
    renderPlaylistAccordion();
  }

  /**
   * Export Data to Clipboard
   */
  async function handleExportData() {
    const exportList = videos.map(v => ({
      url: `https://www.youtube.com/watch?v=${v.id}`,
      title: v.title,
      duration: v.duration || ''
    }));
    const jsonStr = JSON.stringify(exportList, null, 2);

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(jsonStr);
        const originalText = btnExportData.innerHTML;
        btnExportData.innerHTML = '<span>✓ コピー完了！</span>';
        setTimeout(() => {
          btnExportData.innerHTML = originalText;
        }, 2000);
        return;
      }
    } catch (e) {
      console.warn('[Clipboard] write failed:', e);
    }
    prompt('以下のデータをコピーして保存してください:', jsonStr);
  }

  /**
   * Toggle Import Area
   */
  function handleToggleImport() {
    if (!importArea) return;
    const isHidden = importArea.classList.toggle('hidden');
    if (!isHidden && importTextarea) {
      importTextarea.focus();
    }
  }

  /**
   * Execute Import (JSON or newline-separated URLs)
   */
  function handleExecuteImport() {
    if (!importTextarea) return;
    const text = importTextarea.value.trim();
    if (!text) {
      alert('取り込むテキストを入力してください。');
      return;
    }

    let importedCount = 0;

    // 1. Try parsing JSON
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        parsed.forEach(item => {
          const id = item.id || extractYouTubeId(item.url);
          if (id && !videos.some(v => v.id === id)) {
            const title = item.title || `動画 (${id})`;
            videos.push({
              id: id,
              title: title,
              duration: item.duration || extractDurationFromTitle(title) || ''
            });
            importedCount++;
          }
        });

        if (importedCount > 0) {
          saveVideosToStorage();
          renderManageList();
          renderPlaylistAccordion();
          importTextarea.value = '';
          importArea.classList.add('hidden');
          alert(`${importedCount}件の動画を取り込みました！`);
          return;
        } else {
          alert('新しい動画が見つかりませんでした（重複または形式エラー）。');
          return;
        }
      }
    } catch (e) {
      // Continue to line parsing
    }

    // 2. Line-by-line URL parsing
    const lines = text.split(/\r?\n/);
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const id = extractYouTubeId(trimmed);
      if (id && !videos.some(v => v.id === id)) {
        videos.push({
          id: id,
          title: `YouTube動画 (${id})`,
          duration: ''
        });
        importedCount++;
      }
    });

    if (importedCount > 0) {
      saveVideosToStorage();
      renderManageList();
      renderPlaylistAccordion();
      importTextarea.value = '';
      importArea.classList.add('hidden');
      alert(`${importedCount}件の動画URLを取り込みました！`);
    } else {
      alert('有効なYouTubeのURLまたはJSONが見つかりませんでした。');
    }
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
    if (btnPickInitial) {
      btnPickInitial.addEventListener('click', () => triggerRandomPick());
    }
    if (btnPickAgain) {
      btnPickAgain.addEventListener('click', () => triggerRandomPick());
    }

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

    if (inputVideoUrl) {
      inputVideoUrl.addEventListener('input', handleUrlInput);
      inputVideoUrl.addEventListener('change', handleUrlInput);
    }
    if (btnPasteUrl) {
      btnPasteUrl.addEventListener('click', handlePasteUrl);
    }
    if (addVideoForm) {
      addVideoForm.addEventListener('submit', handleAddVideo);
    }
    if (btnResetVideos) {
      btnResetVideos.addEventListener('click', handleResetVideos);
    }

    if (btnExportData) {
      btnExportData.addEventListener('click', handleExportData);
    }
    if (btnToggleImport) {
      btnToggleImport.addEventListener('click', handleToggleImport);
    }
    if (btnExecuteImport) {
      btnExecuteImport.addEventListener('click', handleExecuteImport);
    }
  }

  /**
   * Trigger Random Selection
   */
  function triggerRandomPick() {
    if (isShuffling || videos.length === 0) {
      if (videos.length === 0) {
        alert('動画リストが空です。「動画を管理」から動画を追加してください。');
      }
      return;
    }

    const candidates = videos.length > 1
      ? videos.filter(v => v.id !== currentVideoId)
      : videos;

    const chosenVideo = candidates[Math.floor(Math.random() * candidates.length)];

    isShuffling = true;
    rouletteOverlay.classList.remove('hidden');

    let counter = 0;
    const totalTicks = 8;
    const intervalTime = 70;

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
   * Create or update YouTube player and auto-sync duration
   */
  function createYtPlayer(videoId) {
    if (!playerHost) return;

    if (window.YT && window.YT.Player) {
      if (ytPlayer && ytPlayer.loadVideoById) {
        ytPlayer.loadVideoById({
          videoId: videoId,
          startSeconds: 0
        });
      } else {
        playerHost.innerHTML = '<div id="ytIframe"></div>';
        ytPlayer = new window.YT.Player('ytIframe', {
          width: '100%',
          height: '100%',
          videoId: videoId,
          playerVars: {
            autoplay: 1,
            playsinline: 1,
            rel: 0,
            modestbranding: 1
          },
          events: {
            onReady: onPlayerReady,
            onStateChange: onPlayerStateChange
          }
        });
      }
    } else {
      // Fallback standard iframe
      playerHost.innerHTML = `
        <iframe
          src="https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1"
          title="YouTube video player"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen
          loading="lazy"
          style="width: 100%; height: 100%; border: 0;"
        ></iframe>
      `;
    }
  }

  function onPlayerReady(event) {
    syncDurationFromPlayer();
  }

  function onPlayerStateChange(event) {
    // When playing or buffering, getDuration becomes available
    syncDurationFromPlayer();
  }

  /**
   * Automatically detect exact duration from YouTube player and update storage
   */
  function syncDurationFromPlayer() {
    if (!ytPlayer || !ytPlayer.getDuration || !currentVideoId) return;
    try {
      const sec = ytPlayer.getDuration();
      if (sec && sec > 0) {
        const formatted = formatSecondsToDuration(sec);
        const currentItem = videos.find(v => v.id === currentVideoId);
        if (currentItem && (!currentItem.duration || currentItem.duration !== formatted)) {
          currentItem.duration = formatted;
          saveVideosToStorage();
          if (videoDuration) {
            videoDuration.textContent = `⏱️ ${formatted}`;
          }
          renderPlaylistAccordion();
        }
      }
    } catch (e) {
      // Ignore cross-origin or player not ready errors
    }
  }

  /**
   * Apply Chosen Video to UI & Player
   */
  function selectVideo(video) {
    if (!video) return;

    currentVideoId = video.id;

    // Display duration badge
    if (videoDuration) {
      videoDuration.textContent = video.duration ? `⏱️ ${video.duration}` : '⏱️ 再生中...';
    }

    if (videoTitle) {
      videoTitle.textContent = video.title;
    }

    // Embed Player
    createYtPlayer(video.id);

    // YouTube App Link
    if (linkOpenYoutube) {
      linkOpenYoutube.href = `https://www.youtube.com/watch?v=${video.id}`;
    }

    emptyState.classList.add('hidden');
    videoStage.classList.remove('hidden');

    if (playlistItemsContainer) {
      const allItems = playlistItemsContainer.querySelectorAll('.playlist-item');
      allItems.forEach(item => {
        if (item.dataset.id === video.id) {
          item.classList.add('is-active');
        } else {
          item.classList.remove('is-active');
        }
      });
    }

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
