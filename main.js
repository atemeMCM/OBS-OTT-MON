// Application State
let players = [];
let currentProtocol = 'hls';
let channelConfig = [...CHANNELS]; // Clone from config.js

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
    loadSavedConfig();

    // Load saved protocol preference
    const savedProtocol = localStorage.getItem('currentProtocol');
    if (savedProtocol) {
        currentProtocol = savedProtocol;
        updateProtocolButtons();
    }

    createVideoPlayers();
    createConfigPanel();
    setupEventListeners();
    loadAllStreams();
}

// Create video player elements
function createVideoPlayers() {
    const grid = document.getElementById('videoGrid');
    grid.innerHTML = '';

    channelConfig.forEach((channel, index) => {
        const container = document.createElement('div');
        container.className = 'video-container';
        container.innerHTML = `
      <div class="channel-label">${channel.name}</div>
      <div class="status-indicator" id="status-${channel.id}"></div>
      <video
        id="player-${channel.id}"
        class="video-js vjs-default-skin"
        controls
        preload="auto"
        muted
        playsinline
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

            // Initialize Video.js player
            const player = videojs(playerId, {
                ...PLAYER_CONFIG,
                sources: [{
                    src: streamUrl,
                    type: currentProtocol === 'hls' ? 'application/x-mpegURL' : 'application/dash+xml'
                }]
            });

            // Update status indicator
            const statusIndicator = document.getElementById(statusId);

            // Event listeners for status
            player.on('loadstart', () => {
                statusIndicator.className = 'status-indicator loading';
            });

            player.on('playing', () => {
                statusIndicator.className = 'status-indicator playing';
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
    }, 100); // 100ms delay to ensure DOM is ready
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

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
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
