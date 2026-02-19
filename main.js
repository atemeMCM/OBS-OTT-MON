// Application State
let players = [];
let currentProtocol = 'hls';
let currentLayout = '4x4';
let channelConfig = [...CHANNELS]; // Clone from config.js
let healthMonitorInterval = null;

// Load saved configuration from localStorage
function loadSavedConfig() {
    const saved = localStorage.getItem('channelConfig');
    if (saved) {
        try {
            channelConfig = JSON.parse(saved);
            console.log('Loaded saved configuration');
        } catch (e) {
            console.error('Failed to load saved config:', e);
        }
    }
}

// Save configuration to localStorage
function saveConfig() {
    localStorage.setItem('channelConfig', JSON.stringify(channelConfig));
    localStorage.setItem('currentProtocol', currentProtocol);
    console.log('Configuration saved');
}

// Initialize the application
function init() {
    // Check login status
    checkLoginStatus();

    // Setup login event listener
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);

        // Allow Enter key to submit
        const inputs = loginForm.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    document.querySelector('.btn-login').click();
                }
            });
        });
    }

    loadSavedConfig();

    // Load saved protocol preference
    const savedProtocol = localStorage.getItem('currentProtocol');
    if (savedProtocol) {
        currentProtocol = savedProtocol;
        updateProtocolButtons();
    }

    // Load saved layout preference
    const savedLayout = localStorage.getItem('currentLayout');
    if (savedLayout) {
        currentLayout = savedLayout;
        updateLayoutButtons();
    }

    createVideoPlayers();
    createConfigPanel();
    setupEventListeners();

    // Configure DASH.js settings globally before players are initialized
    if (window.videojs && window.videojs.Html5DashJS) {
        window.videojs.Html5DashJS.hook('beforeinitialize', function (player, mediaPlayer) {
            mediaPlayer.updateSettings({
                streaming: {
                    delay: {
                        liveDelay: 4 // Add a 4s delay to stabilize playback
                    },
                    liveCatchup: {
                        enabled: false // Prevent speed changes (chipmunk effect)
                    },
                    buffer: {
                        stableBufferTime: 4,
                        bufferTimeAtTopQuality: 4
                    }
                }
            });
        });
    }

    loadAllStreams();
    setGridLayout(currentLayout);
    startHealthMonitoring();

    // Initialize Audio Context on first interaction
    const resumeAudio = () => {
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        initAudioContext();
    };
    document.addEventListener('click', resumeAudio);
    document.addEventListener('keydown', resumeAudio);
}

// Audio Context State
let audioCtx;
let audioAnalysers = [];
let audioAnimationId;

function initAudioContext() {
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
    } else if (audioCtx.state === 'running') {
        // Even if running, we might need to connect new players
        connectAudioAnalysers();
        return;
    }

    connectAudioAnalysers();

    // Start visual loop
    if (!audioAnimationId) {
        drawAudioMeters();
    }
}

function connectAudioAnalysers() {
    if (!audioCtx) return;

    // Connect all players
    players.forEach(player => {
        const videoEl = player.tech_.el(); // Get raw video element

        try {
            // Create source and analyser
            // Note: MediaElementSourceNode can only be created once per element
            if (!videoEl._audioSource) {
                const source = audioCtx.createMediaElementSource(videoEl);
                videoEl._audioSource = source; // Cache it

                const analyser = audioCtx.createAnalyser();
                analyser.fftSize = 32; // Low resolution for simple meter

                // Connect: Source -> Analyser -> Destination (Out)
                source.connect(analyser);
                analyser.connect(audioCtx.destination);

                // Get clean channel ID from element ID (e.g. player-1_html5_api -> 1)
                const cleanId = videoEl.id.replace('player-', '').replace('_html5_api', '');

                // Remove existing analyser for this channel if it exists
                audioAnalysers = audioAnalysers.filter(a => a.id !== cleanId);

                audioAnalysers.push({
                    analyser: analyser,
                    id: cleanId
                });
            }
        } catch (e) {
            console.warn('Audio setup failed for player:', e);
        }
    });
}

function drawAudioMeters() {
    audioAnimationId = requestAnimationFrame(drawAudioMeters);

    audioAnalysers.forEach(item => {
        const { analyser, id } = item;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        analyser.getByteFrequencyData(dataArray);

        // Calculate average volume
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const percent = Math.min(100, (average / 255) * 100 * 1.5); // 1.5x boost for visibility

        // Update visual bar
        const bar = document.getElementById(`audio-level-${id}`);
        if (bar) {
            bar.style.height = `${percent}%`;
        }
    });
}

// Login System
function checkLoginStatus() {
    const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
    const overlay = document.getElementById('loginOverlay');

    if (overlay) {
        if (isLoggedIn) {
            overlay.classList.add('hidden');
        } else {
            overlay.classList.remove('hidden');
        }
    }
}

function handleLogin(e) {
    e.preventDefault();

    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const errorMsg = document.getElementById('loginError');
    const overlay = document.getElementById('loginOverlay');

    const username = usernameInput.value;
    const password = passwordInput.value;

    // Hardcoded credentials as requested
    if (username === 'ateme' && password === 'Server123!') {
        // Success
        sessionStorage.setItem('isLoggedIn', 'true');
        overlay.classList.add('hidden');
        errorMsg.textContent = '';

        // Clear inputs for security
        usernameInput.value = '';
        passwordInput.value = '';
    } else {
        // Failure
        errorMsg.textContent = 'Invalid credentials';
        passwordInput.value = '';

        // Shake animation effect
        const loginBox = document.querySelector('.login-box');
        loginBox.animate([
            { transform: 'translateX(0)' },
            { transform: 'translateX(-10px)' },
            { transform: 'translateX(10px)' },
            { transform: 'translateX(-10px)' },
            { transform: 'translateX(10px)' },
            { transform: 'translateX(0)' }
        ], {
            duration: 400,
            easing: 'ease-in-out'
        });
    }
}

// Create video player elements
function createVideoPlayers() {
    const grid = document.getElementById('videoGrid');
    grid.innerHTML = '';

    channelConfig.forEach((channel, index) => {
        const container = document.createElement('div');
        container.className = 'video-container';
        container.setAttribute('data-channel-id', channel.id);
        container.innerHTML = `
      <div class="channel-label">${channel.name}</div>
      <div class="status-indicator" id="status-${channel.id}"></div>
      <div class="health-overlay" id="health-${channel.id}">
        <div class="health-stats">
          <div class="health-stat">
            <span class="label">Bitrate</span>
            <span class="value" data-stat="bitrate">-- Mbps</span>
          </div>
          <div class="health-stat">
            <span class="label">Buffer</span>
            <span class="value" data-stat="buffer">-- s</span>
          </div>
          <div class="health-stat">
            <span class="label">Resolution</span>
            <span class="value" data-stat="resolution">--</span>
          </div>
          <div class="health-stat">
            <span class="label">FPS</span>
            <span class="value" data-stat="fps">--</span>
          </div>
        </div>
      </div>
      <div class="audio-meter">
        <div class="audio-level-bar" id="audio-level-${channel.id}"></div>
      </div>
      <video
        id="player-${channel.id}"
        class="video-js vjs-default-skin"
        controls
        preload="auto"
        muted
        playsinline
        crossorigin="anonymous"
      ></video>
    `;
        grid.appendChild(container);
    });
}

// Initialize Video.js players
function loadAllStreams() {
    // Dispose existing players
    players.forEach(player => {
        if (player) {
            try {
                player.dispose();
            } catch (e) {
                console.warn('Error disposing player:', e);
            }
        }
    });
    players = [];

    // Recreate video player elements to ensure clean state
    createVideoPlayers();

    // Small delay to ensure DOM is ready
    setTimeout(() => {
        channelConfig.forEach((channel) => {
            const playerId = `player-${channel.id}`;
            const statusId = `status-${channel.id}`;

            // Get the appropriate URL based on current protocol
            const streamUrl = currentProtocol === 'hls' ? channel.hls : channel.dash;

            // Build player options with strict DASH configuration injected at initialization
            const playerOptions = {
                ...PLAYER_CONFIG,
                html5: {
                    ...PLAYER_CONFIG.html5,
                    dash: {
                        limitBitrateByPortal: true,
                        // Passing raw options to the underlying MediaPlayer
                        setLiveDelay: 4,
                        setLiveCatchup: {
                            enabled: false
                        },
                        setStableBufferTime: 4,
                        setBufferTimeAtTopQuality: 4
                    }
                },
                sources: [{
                    src: streamUrl,
                    type: currentProtocol === 'hls' ? 'application/x-mpegURL' : 'application/dash+xml'
                }]
            };

            // Initialize Video.js player
            const player = videojs(playerId, playerOptions);

            // Update status indicator
            const statusIndicator = document.getElementById(statusId);

            // Event listeners for status
            player.on('loadstart', () => {
                statusIndicator.className = 'status-indicator loading';

                // Force DASH settings application on player initialization
                if (currentProtocol === 'dash' && player.dash && player.dash.mediaPlayer) {
                    player.dash.mediaPlayer.updateSettings({
                        streaming: {
                            delay: { liveDelay: 4 },
                            liveCatchup: { enabled: false },
                            buffer: { stableBufferTime: 4, bufferTimeAtTopQuality: 4 },
                            abr: { limitBitrateByPortal: true }
                        }
                    });
                }
            });

            player.on('playing', () => {
                statusIndicator.className = 'status-indicator playing';

                // Re-apply DASH settings to be absolutely certain (some versions reset on play)
                if (currentProtocol === 'dash' && player.dash && player.dash.mediaPlayer) {
                    player.dash.mediaPlayer.updateSettings({
                        streaming: {
                            delay: { liveDelay: 4 },
                            liveCatchup: { enabled: false },
                            buffer: { stableBufferTime: 4, bufferTimeAtTopQuality: 4 },
                            abr: { limitBitrateByPortal: true }
                        }
                    });
                }

                // Retry audio context if needed
                if (audioCtx && audioCtx.state === 'suspended') {
                    audioCtx.resume();
                } else if (!audioCtx) {
                    initAudioContext();
                }
            });

            // NUCLEAR OPTION: Physically block dash.js from altering the playback speed.
            // This prevents the "Live Catchup" fast-forward/chipmunk effect entirely.
            player.on('ratechange', () => {
                if (player.playbackRate() !== 1) {
                    player.playbackRate(1);
                }
            });

            player.on('error', (e) => {
                statusIndicator.className = 'status-indicator';
                console.error(`Error on ${channel.name}:`, player.error());

                // Auto-retry after 5 seconds
                setTimeout(() => {
                    console.log(`Retrying ${channel.name}...`);
                    player.src({
                        src: streamUrl,
                        type: currentProtocol === 'hls' ? 'application/x-mpegURL' : 'application/dash+xml'
                    });
                    player.load();
                    player.play().catch(e => console.warn('Auto-play failed:', e));
                }, 5000);
            });

            player.on('waiting', () => {
                statusIndicator.className = 'status-indicator loading';
            });

            player.on('pause', () => {
                if (!player.seeking()) {
                    statusIndicator.className = 'status-indicator';
                }
            });

            // Ensure player starts playing
            player.ready(() => {
                player.play().catch(e => {
                    // Auto-play might be blocked, but that's okay for muted videos
                    console.log(`Auto-play for ${channel.name}:`, e.message);
                });
            });

            // Store player reference
            players.push(player);
        });

        // Reset Stop All button state since all players will be playing
        setTimeout(() => {
            const stopBtn = document.getElementById('stopAllBtn');
            if (stopBtn) {
                stopBtn.innerHTML = '<span>⏸️</span> Stop All';
            }

            // Re-initialize audio context connections for new players
            if (audioCtx) {
                initAudioContext();
            }
        }, 1000); // 1s delay to let DOM settle and play start
    }, 100);
}

// Create configuration panel
function createConfigPanel() {
    const configGrid = document.getElementById('configGrid');
    configGrid.innerHTML = '';

    channelConfig.forEach((channel) => {
        const item = document.createElement('div');
        item.className = 'config-item';
        item.innerHTML = `
      <label>${channel.name} - HLS URL</label>
      <input 
        type="text" 
        data-channel="${channel.id}" 
        data-type="hls" 
        value="${channel.hls}"
        placeholder="https://..."
      />
      <label style="margin-top: 0.75rem;">${channel.name} - DASH URL</label>
      <input 
        type="text" 
        data-channel="${channel.id}" 
        data-type="dash" 
        value="${channel.dash}"
        placeholder="http://..."
      />
    `;
        configGrid.appendChild(item);
    });

    // Add Data Management Section
    const dataSection = document.createElement('div');
    dataSection.className = 'config-data-section';
    dataSection.style.gridColumn = '1 / -1';
    dataSection.style.marginTop = '2rem';
    dataSection.style.paddingTop = '1rem';
    dataSection.style.borderTop = '1px solid rgba(255, 255, 255, 0.1)';
    dataSection.style.display = 'flex';
    dataSection.style.gap = '1rem';
    dataSection.style.justifyContent = 'flex-end';

    dataSection.innerHTML = `
        <input type="file" id="importConfigInput" accept=".json" style="display: none;">
        <button id="importConfigBtn" class="btn-secondary" style="background: rgba(255, 152, 0, 0.2); border: 1px solid rgba(255, 152, 0, 0.5); color: #ff9800;">
            <span>📂</span> Import Config
        </button>
        <button id="exportConfigBtn" class="btn-secondary" style="background: rgba(76, 175, 80, 0.2); border: 1px solid rgba(76, 175, 80, 0.5); color: #4caf50;">
            <span>💾</span> Export Config
        </button>
    `;
    configGrid.appendChild(dataSection);

    // Re-attach listeners for new buttons
    const exportBtn = document.getElementById('exportConfigBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportConfig);
    }

    const importBtn = document.getElementById('importConfigBtn');
    const importInput = document.getElementById('importConfigInput');
    if (importBtn && importInput) {
        importBtn.addEventListener('click', () => importInput.click());
        importInput.addEventListener('change', importConfig);
    }
}

// Data Management Functions
function exportConfig() {
    const dataStr = JSON.stringify(channelConfig, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = "obs-player-config.json";
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 0);
}

function importConfig(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);

            // Basic validation
            if (!Array.isArray(data)) throw new Error('Root must be an array');

            // Check first item structure
            if (data.length > 0) {
                const item = data[0];
                if (!item.id || !item.name || !item.hls || !item.dash) {
                    throw new Error('Invalid channel format');
                }
            }

            // Apply config
            channelConfig = data;
            saveConfig();

            // Reload UI
            createVideoPlayers(); // Recreate grid structure
            loadAllStreams();     // Connect players
            createConfigPanel();  // Update inputs
            updateLayoutButtons(); // Update 4xN label

            alert('Configuration imported successfully!');

        } catch (err) {
            console.error('Import failed:', err);
            alert('Failed to import configuration: ' + err.message);
        }

        // Reset input so same file can be selected again
        event.target.value = '';
    };
    reader.readAsText(file);
}

// Setup event listeners
function setupEventListeners() {
    // Protocol selector
    document.querySelectorAll('.protocol-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const protocol = e.target.dataset.protocol;
            if (protocol !== currentProtocol) {
                currentProtocol = protocol;
                updateProtocolButtons();
                saveConfig();
                loadAllStreams();
            }
        });
    });

    // Layout selector
    document.querySelectorAll('.layout-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const layout = e.target.dataset.layout;
            if (layout !== currentLayout) {
                setGridLayout(layout);
            }
        });
    });

    // Initial update for dynamic label
    updateLayoutButtons();

    // Mute all button
    document.getElementById('muteAllBtn').addEventListener('click', () => {
        const btn = document.getElementById('muteAllBtn');
        const allMuted = players.every(p => p.muted());

        players.forEach(player => {
            player.muted(!allMuted);
        });

        btn.innerHTML = allMuted
            ? '<span>🔇</span> Mute All'
            : '<span>🔊</span> Unmute All';
    });

    // Stop all button
    document.getElementById('stopAllBtn').addEventListener('click', () => {
        const btn = document.getElementById('stopAllBtn');
        const allPaused = players.every(p => p.paused());

        players.forEach(player => {
            if (allPaused) {
                player.play().catch(e => console.warn('Play failed:', e));
            } else {
                player.pause();
            }
        });

        btn.innerHTML = allPaused
            ? '<span>⏸️</span> Stop All'
            : '<span>▶️</span> Play All';
    });

    // Reload all button
    document.getElementById('reloadAllBtn').addEventListener('click', () => {
        loadAllStreams();
    });

    // Toggle config panel
    document.getElementById('toggleConfigBtn').addEventListener('click', () => {
        const panel = document.getElementById('configPanel');
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        // Re-create panel to ensure state is fresh (and listeners attached)
        createConfigPanel();
    });

    // Save config button
    document.getElementById('saveConfigBtn').addEventListener('click', () => {
        // Update channelConfig from inputs
        document.querySelectorAll('.config-item input').forEach(input => {
            const channelId = parseInt(input.dataset.channel);
            const type = input.dataset.type;
            const channel = channelConfig.find(c => c.id === channelId);

            if (channel) {
                channel[type] = input.value;
            }
        });

        saveConfig();
        updateLayoutButtons(); // Update label if channel count changed (unlikely here but good practice)
        loadAllStreams();

        // Show feedback
        const btn = document.getElementById('saveConfigBtn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span>✅</span> Saved!';
        setTimeout(() => {
            btn.innerHTML = originalText;
        }, 2000);
    });
}

// Update protocol button states
function updateProtocolButtons() {
    document.querySelectorAll('.protocol-btn').forEach(btn => {
        if (btn.dataset.protocol === currentProtocol) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

function updateLayoutButtons() {
    document.querySelectorAll('.layout-btn').forEach(btn => {
        // Dynamic label for 4x4 button
        if (btn.dataset.layout === '4x4') {
            const rows = Math.ceil(channelConfig.length / 4);
            // Only show dynamic label if rows > 4
            if (rows > 4) {
                btn.innerHTML = `4&times;${rows}`;
            } else {
                btn.innerHTML = `4&times;4`;
            }
        }

        if (btn.dataset.layout === currentLayout) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// Grid Layout Functions
function setGridLayout(layout) {
    currentLayout = layout;
    const grid = document.getElementById('videoGrid');

    // Remove all layout classes
    grid.classList.remove('layout-4x4', 'layout-3x3', 'layout-2x2', 'layout-1x1');

    // Add new layout class
    grid.classList.add(`layout-${layout}`);

    // Show/hide channels based on layout
    const containers = document.querySelectorAll('.video-container');

    let visibleCount;
    if (layout === '4x4') {
        // Show all channels for 4xN layout
        visibleCount = channelConfig.length;
    } else {
        const channelCounts = {
            '3x3': 9,
            '2x2': 4,
            '1x1': 1
        };
        visibleCount = channelCounts[layout];
    }

    containers.forEach((container, index) => {
        if (index < visibleCount) {
            container.classList.remove('hidden');
        } else {
            container.classList.add('hidden');
        }
    });

    // Save preference
    localStorage.setItem('currentLayout', layout);
    updateLayoutButtons();

    // Force DASH.js to re-evaluate portal dimensions after grid geometry changes
    if (typeof currentProtocol !== 'undefined' && currentProtocol === 'dash') {
        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 350); // Wait for the 0.3s CSS transition to finish
    }
}


// Health Monitoring Functions
function startHealthMonitoring() {
    // Clear existing interval
    if (healthMonitorInterval) {
        clearInterval(healthMonitorInterval);
    }

    // Update health stats every 2 seconds
    healthMonitorInterval = setInterval(() => {
        players.forEach((player, index) => {
            if (player && !player.isDisposed()) {
                updateHealthStats(player, channelConfig[index].id);
            }
        });
    }, 2000);
}

function updateHealthStats(player, channelId) {
    const healthOverlay = document.getElementById(`health-${channelId}`);
    if (!healthOverlay) return;

    try {
        // Get bitrate - support both HLS and DASH
        let bitrate = '--';

        // Try HLS (vhs)
        if (player.tech_ && player.tech_.vhs && player.tech_.vhs.playlists) {
            const bandwidth = player.tech_.vhs.playlists.media()?.attributes?.BANDWIDTH;
            if (bandwidth) {
                bitrate = (bandwidth / 1000000).toFixed(2);
            }
        }

        // Try DASH
        if (bitrate === '--' && player.dash && player.dash.mediaPlayer) {
            try {
                const mediaPlayer = player.dash.mediaPlayer;
                if (typeof mediaPlayer.getBitrateInfoListFor === 'function' && typeof mediaPlayer.getQualityFor === 'function') {
                    const bitrateList = mediaPlayer.getBitrateInfoListFor('video');
                    const currentIndex = mediaPlayer.getQualityFor('video');

                    if (bitrateList && bitrateList.length > 0 && currentIndex >= 0 && bitrateList[currentIndex]) {
                        bitrate = (bitrateList[currentIndex].bitrate / 1000000).toFixed(2);
                    }
                }
            } catch (dashError) {
                // DASH metrics not available
                console.warn('DASH bitrate read error:', dashError);
            }
        }

        // Fallback: estimate from video element
        if (bitrate === '--') {
            const videoEl = player.el().querySelector('video');
            if (videoEl && videoEl.webkitVideoDecodedByteCount) {
                const bytes = videoEl.webkitVideoDecodedByteCount;
                const time = videoEl.currentTime;
                if (time > 0) {
                    bitrate = ((bytes * 8) / time / 1000000).toFixed(2);
                }
            }
        }

        // Get buffer health
        let buffer = '--';

        // Try to get DASH specific buffer level first
        if (player.dash && player.dash.mediaPlayer) {
            // Method 1: direct MediaPlayer getter (most reliable for dash.js > 3.0)
            if (typeof player.dash.mediaPlayer.getBufferLength === 'function') {
                const bufferLevel = player.dash.mediaPlayer.getBufferLength('video');
                if (bufferLevel !== undefined && !isNaN(bufferLevel) && bufferLevel > 0) {
                    buffer = bufferLevel.toFixed(1);
                }
            }

            // Method 2: Metrics fallback
            if (buffer === '--') {
                const dashMetrics = player.dash.mediaPlayer.getDashMetrics();
                if (dashMetrics && typeof dashMetrics.getCurrentBufferLevel === 'function') {
                    const bufferLevel = dashMetrics.getCurrentBufferLevel('video');
                    if (bufferLevel !== undefined && !isNaN(bufferLevel) && bufferLevel > 0) {
                        buffer = bufferLevel.toFixed(1);
                    }
                }
            }
        }

        // Fallback to standard HTML5 buffered calculation
        if (buffer === '--') {
            const buffered = player.buffered();
            if (buffered.length > 0) {
                const currentTime = player.currentTime();

                // For live streams, the buffered ranges can be disjoint or shifted
                // We find the range that currently encompasses currentTime
                let currentRangeEnd = 0;
                let foundRange = false;

                for (let i = 0; i < buffered.length; i++) {
                    if (currentTime >= buffered.start(i) && currentTime <= buffered.end(i)) {
                        currentRangeEnd = buffered.end(i);
                        foundRange = true;
                        break;
                    }
                }

                // If we aren't inside a range, just take the End of the last range (less accurate for live)
                if (!foundRange) {
                    currentRangeEnd = buffered.end(buffered.length - 1);
                }

                const calculatedBuffer = currentRangeEnd - currentTime;

                // Ensure we don't display negative buffer (happens with live stream time-drifts)
                buffer = Math.max(0, calculatedBuffer).toFixed(1);
            }
        }

        // Get resolution
        let resolution = '--';
        const videoWidth = player.videoWidth();
        const videoHeight = player.videoHeight();
        if (videoWidth && videoHeight) {
            resolution = `${videoWidth}×${videoHeight}`;
        }

        // Get FPS - improved detection
        let fps = '--';
        const videoEl = player.el().querySelector('video');

        // Try getVideoPlaybackQuality API (most accurate)
        if (videoEl && videoEl.getVideoPlaybackQuality) {
            const quality = videoEl.getVideoPlaybackQuality();
            const currentTime = videoEl.currentTime;

            // Store previous values for calculation
            if (!player._fpsData) {
                player._fpsData = {
                    lastFrames: quality.totalVideoFrames,
                    lastTime: currentTime
                };
            } else {
                const frameDiff = quality.totalVideoFrames - player._fpsData.lastFrames;
                const timeDiff = currentTime - player._fpsData.lastTime;

                if (timeDiff > 0 && frameDiff > 0) {
                    fps = Math.round(frameDiff / timeDiff);

                    // Update stored values
                    player._fpsData.lastFrames = quality.totalVideoFrames;
                    player._fpsData.lastTime = currentTime;
                }
            }
        }

        // Fallback: estimate based on common stream types
        if (fps === '--' && player.tech_ && (player.tech_.vhs || player.tech_.dashjs)) {
            fps = '~30'; // Most streams are 25-30 fps
        }

        // Update DOM
        const bitrateEl = healthOverlay.querySelector('[data-stat="bitrate"]');
        const bufferEl = healthOverlay.querySelector('[data-stat="buffer"]');
        const resolutionEl = healthOverlay.querySelector('[data-stat="resolution"]');
        const fpsEl = healthOverlay.querySelector('[data-stat="fps"]');

        if (bitrateEl) {
            bitrateEl.textContent = bitrate !== '--' ? `${bitrate} Mbps` : '--';
            bitrateEl.className = 'value';
            if (bitrate !== '--' && parseFloat(bitrate) > 1) {
                bitrateEl.classList.add('good');
            }
        }

        if (bufferEl) {
            bufferEl.textContent = buffer !== '--' ? `${buffer} s` : '--';
            bufferEl.className = 'value';
            if (buffer !== '--') {
                const bufferNum = parseFloat(buffer);
                if (bufferNum > 2) {
                    bufferEl.classList.add('good');
                } else if (bufferNum > 1) {
                    bufferEl.classList.add('warning');
                } else {
                    bufferEl.classList.add('error');
                }
            }
        }

        if (resolutionEl) {
            resolutionEl.textContent = resolution;
            resolutionEl.className = 'value';
        }

        if (fpsEl) {
            fpsEl.textContent = fps;
            fpsEl.className = 'value';
        }

    } catch (e) {
        console.warn(`Health stats error for channel ${channelId}:`, e);
    }
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ignore if typing in an input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
    }

    // M - Mute/Unmute all
    if (e.key === 'm' || e.key === 'M') {
        document.getElementById('muteAllBtn').click();
    }

    // S - Stop/Play all
    if (e.key === 's' || e.key === 'S') {
        document.getElementById('stopAllBtn').click();
    }

    // R - Reload all
    if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        document.getElementById('reloadAllBtn').click();
    }

    // C - Toggle config
    if (e.key === 'c' || e.key === 'C') {
        document.getElementById('toggleConfigBtn').click();
    }

    // H - Switch to HLS
    if (e.key === 'h' || e.key === 'H') {
        if (currentProtocol !== 'hls') {
            document.querySelector('[data-protocol="hls"]').click();
        }
    }

    // D - Switch to DASH
    if (e.key === 'd' || e.key === 'D') {
        if (currentProtocol !== 'dash') {
            document.querySelector('[data-protocol="dash"]').click();
        }
    }
});

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    players.forEach(player => {
        if (player) {
            player.dispose();
        }
    });
});
