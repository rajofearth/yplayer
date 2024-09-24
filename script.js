class AudioPlayer {
    constructor() {
        this.audioElement = new Audio();
        this.queue = [];
        this.currentTrackIndex = 0;
        this.resumed = false;
        this.isPlaying = false;
        this.isPaused = false;
        this.songsDisplayed = false;
        this.currentTime = 0;

        // Add theme-related properties
        this.currentTheme = localStorage.getItem('theme') || 'dark';
        this.updateThemeColors();

        this.volume = parseFloat(localStorage.getItem('volume')) || 1;

        this.audioElement.addEventListener('ended', () => this.playNext());
        this.audioElement.addEventListener('timeupdate', () => this.updateProgressBar());
        this.audioElement.addEventListener('loadedmetadata', () => this.updateTotalTime());

        document.addEventListener('DOMContentLoaded', () => {
            this.setupEventListeners();
        });

        // Set up Media Session API
        if ('mediaSession' in navigator) {
            navigator.mediaSession.setActionHandler('play', () => this.play());
            navigator.mediaSession.setActionHandler('pause', () => this.pause());
            navigator.mediaSession.setActionHandler('previoustrack', () => this.playPrevious());
            navigator.mediaSession.setActionHandler('nexttrack', () => this.playNext());
        }

        this.folderName = localStorage.getItem('selectedFolder') || 'Select Folder';
        this.updateFolderLabel();

        this.progressBarContainer = document.querySelector('.progress-container');
        this.progressBar = document.getElementById('progress-bar');
        this.isDragging = false;

        this.setupProgressBarEvents();

        this.isShuffled = false;
        this.repeatMode = 'off'; // 'off', 'all', 'one'

        this.setupRepeatShuffleButtons();
    }

    setupEventListeners() {
        const playPauseBtn = document.getElementById('play-pause-btn');
        const nextBtn = document.getElementById('next-btn');
        const prevBtn = document.getElementById('prev-btn');
        const volumeControl = document.getElementById('volume-control');
        const progressBarContainer = document.getElementById('progress-bar').parentElement;
        const searchInput = document.getElementById('search-input');
        const folderInput = document.getElementById('folder-input');

        if (playPauseBtn) playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        if (nextBtn) nextBtn.addEventListener('click', () => this.playNext());
        if (prevBtn) prevBtn.addEventListener('click', () => this.playPrevious());
        if (volumeControl) {
            volumeControl.addEventListener('input', (e) => this.setVolume(e.target.value));
            // Set initial volume
            this.setVolume(volumeControl.value);
        }
        if (progressBarContainer) progressBarContainer.addEventListener('click', (e) => this.seek(e));
        if (searchInput) searchInput.addEventListener('input', (e) => this.searchTracks(e.target.value));
        if (folderInput) folderInput.addEventListener('change', (e) => this.handleFolderSelection(e));

        // Add keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
                e.preventDefault();
                this.togglePlayPause();
            } else if (e.code === 'ArrowRight' && e.ctrlKey) {
                this.playNext();
            } else if (e.code === 'ArrowLeft' && e.ctrlKey) {
                this.playPrevious();
            }
        });

        const volumeSlider = document.getElementById('volume-slider');
        if (volumeSlider) {
            volumeSlider.value = this.volume * 100;
            if (this.audioElement) {
                this.audioElement.volume = this.volume; // Set initial volume without updating MediaSession
            }
            volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value / 100));
        }
    }
    
    updateThemeColors() {
        const root = document.documentElement;
        const bgColor = getComputedStyle(root).getPropertyValue('--bg-color').trim();
        const textColor = getComputedStyle(root).getPropertyValue('--text-color').trim();
        const accentColor = getComputedStyle(root).getPropertyValue('--accent-color').trim();
        const hoverColor = getComputedStyle(root).getPropertyValue('--hover-color').trim();

        // Update color references in the class
        this.bgColor = bgColor;
        this.textColor = textColor;
        this.accentColor = accentColor;
        this.hoverColor = hoverColor;
    }

    handleFolderSelection(event) {
        const files = event.target.files;
        if (files.length > 0) {
            this.folderName = files[0].webkitRelativePath.split('/')[0];
            localStorage.setItem('selectedFolder', this.folderName);
            this.updateFolderLabel();
            this.uploadSongs(files);
        }
    }

    updateFolderLabel() {
        const folderLabel = document.getElementById('folder-label');
        if (folderLabel) {
            const labelText = folderLabel.querySelector('span');
            if (labelText) {
                labelText.textContent = this.folderName;
            }
        }
    }

    uploadSongs(files) {
        const audioFiles = Array.from(files).filter(file => file.type.startsWith('audio/'));
        const totalFiles = audioFiles.length;
    
        if (totalFiles > 0) {
            this.showUploadProgress();
        }
    
        let processedFiles = 0;
        const processFile = (index) => {
            if (index >= audioFiles.length) {
                this.hideUploadProgress();
                if (!this.songsDisplayed) {
                    this.updateQueueDisplay();
                    this.songsDisplayed = true;
                    if (this.queue.length > 0) {
                        this.play();
                    }
                }
                return;
            }
    
            const file = audioFiles[index];
            this.addToQueue(file).then(() => {
                processedFiles++;
                this.updateUploadProgress(processedFiles, totalFiles);
                this.updateQueueDisplay();
                processFile(index + 1);
            }).catch(error => {
                console.error('Error processing file:', error);
                processFile(index + 1);
            });
        };
    
        processFile(0);
    }
    
    showUploadProgress() {
        const uploadProgress = document.getElementById('upload-progress');
        if (uploadProgress) {
            uploadProgress.classList.remove('hidden');
            uploadProgress.classList.add('show');
        }
    }

    hideUploadProgress() {
        const uploadProgress = document.getElementById('upload-progress');
        if (uploadProgress) {
            uploadProgress.classList.add('hidden');
            uploadProgress.classList.remove('show');
        }
    }

    updateUploadProgress(current, total) {
        const progressPercentage = Math.round((current / total) * 100);
        const uploadProgressText = document.getElementById('upload-progress-text');
        if (uploadProgressText) {
            uploadProgressText.textContent = `${progressPercentage}%`;
        }
    }

    addToQueue(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                jsmediatags.read(file, {
                    onSuccess: (tag) => {
                        const picture = tag.tags.picture;
                        const image = picture ? `data:${picture.format};base64,${this.arrayBufferToBase64(picture.data)}` : 'https://via.placeholder.com/150';
                        const track = {
                            file: file,
                            name: tag.tags.title || file.name.replace(/\.[^/.]+$/, ""),
                            artist: tag.tags.artist || "Unknown Artist",
                            duration: null,
                            image: image
                        };
                        this.queue.push(track);
                        resolve();
                    },
                    onError: (error) => {
                        console.error("Error reading metadata:", error);
                        const track = {
                            file: file,
                            name: file.name.replace(/\.[^/.]+$/, ""),
                            artist: "Unknown Artist",
                            duration: null,
                            image: 'https://via.placeholder.com/150'
                        };
                        this.queue.push(track);
                        resolve();
                    }
                });
            };
            reader.readAsArrayBuffer(file);
        });
    }

    arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const chunkSize = 8192; // Use a smaller chunk size if needed to avoid stack overflow.

    // Process the buffer in chunks
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }

    return window.btoa(binary);
}


    play() {
        if (this.queue.length > 0) {
            const currentTrack = this.queue[this.currentTrackIndex];
            const trackUrl = URL.createObjectURL(currentTrack.file);

            // Check if the same track is currently playing
            if (this.audioElement.src === trackUrl && this.isPaused) {
                // Resume playback
                this.audioElement.currentTime = this.currentTime;
                this.audioElement.play()
                    .then(() => {
                        this.isPlaying = true;
                        this.isPaused = false;
                    this.updateNowPlaying();
                    this.updatePlayPauseButton();
                    this.updateQueueDisplay();
                    this.updatePlayPauseButtonListed();

                    if ('mediaSession' in navigator) {
                        this.updateMediaSessionMetadata();
                        navigator.mediaSession.playbackState = 'playing';
                    }
                })
                .catch(error => {
                        console.error("Error resuming audio:", error);
                        this.isPlaying = false;
                        this.updatePlayPauseButtonListed();
                        this.updatePlayPauseButton();
                    });
            } else {
                // Start a new track or reset current time for the same track
                this.audioElement.src = trackUrl;
                this.audioElement.currentTime = 0;
                this.audioElement.currentTime = this.currentTime;
                this.currentTime = 0;
                
                this.audioElement.play()
                    .then(() => {
                        this.isPlaying = true;
                        this.isPaused = false;
                        this.resumed = false; // Reset resumed flag
                        this.updateNowPlaying();
                        this.updatePlayPauseButton();
                        this.updateQueueDisplay();
                        this.updatePlayPauseButtonListed();

                        if ('mediaSession' in navigator) {
                            this.updateMediaSessionMetadata();
                            navigator.mediaSession.playbackState = 'playing';
                        }
                    })
                    .catch(error => {
                        console.error("Error playing audio:", error);
                        this.isPlaying = false;
                        this.updatePlayPauseButton();
                        this.updatePlayPauseButtonListed();
                    });
            }
        }
    }



pause() {
    this.audioElement.pause();
    this.isPlaying = false;
    this.isPaused = true;
    this.isPlaying = false;
    this.currentTime = this.audioElement.currentTime; // Save current time
    this.updatePlayPauseButton();
    if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
    }
    this.updatePlayPauseButtonListed();
}



togglePlayPause() {
    if (this.isPlaying) {
        this.pause();
    } else {
        this.play();
    }
}


    playNext() {
        if (this.repeatMode === 'one') {
            this.audioElement.currentTime = 0;
            this.play();
        } else {
            this.currentTrackIndex = (this.currentTrackIndex + 1) % this.queue.length;
            if (this.currentTrackIndex === 0 && this.repeatMode === 'off') {
                this.pause();
            } else {
                this.play();
            }
        }
    }

    playPrevious() {
        if (this.currentTrackIndex > 0) {
            this.currentTrackIndex--;
            this.play();
            this.updateMediaSessionMetadata();
        }
    }

    setVolume(volume) {
        if (this.audioElement) {
            this.audioElement.volume = volume;
            localStorage.setItem('volume', volume);
            
            // Only set position state if the audio is loaded and has a valid duration
            if (!isNaN(this.audioElement.duration)) {
                navigator.mediaSession.setPositionState({
                    duration: this.audioElement.duration,
                    playbackRate: this.audioElement.playbackRate,
                    position: this.audioElement.currentTime
                });
            }
        }
    }

    seek(event) {
        const progressBar = document.getElementById('progress-bar').parentElement;
        const percent = event.offsetX / progressBar.offsetWidth;
        this.audioElement.currentTime = percent * this.audioElement.duration;
    }

    updateProgressBar() {
        if (isNaN(this.audioElement.duration) || this.audioElement.duration <= 0) {
            return; // Exit if duration is not a valid number
        }
        
        const progress = (this.audioElement.currentTime / this.audioElement.duration) * 100;
        document.getElementById('progress-bar').style.width = `${progress}%`;
        document.getElementById('current-time').textContent = this.formatTime(this.audioElement.currentTime);

         // Update media session position state
        if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
            navigator.mediaSession.setPositionState({
                duration: this.audioElement.duration,
                playbackRate: this.audioElement.playbackRate,
                position: this.audioElement.currentTime
            });
        }
    }

    updateTotalTime() {
        document.getElementById('total-time').textContent = this.formatTime(this.audioElement.duration);
    }

    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    updateNowPlaying() {
        const currentTrack = this.queue[this.currentTrackIndex];
        document.getElementById('now-playing-title').textContent = currentTrack.name;
        document.getElementById('now-playing-artist').textContent = currentTrack.artist;
        document.getElementById('now-playing-img').src = currentTrack.image;
    }

    updateQueueDisplay(filteredTracks = this.queue) {
        const queueContainer = document.querySelector('.queue-container');
        queueContainer.innerHTML = '';

        filteredTracks.forEach((track, index) => {
            const isCurrentTrack = index === this.currentTrackIndex;
            const trackElement = document.createElement('div');
            trackElement.className = `bg-[var(--queue-track-bg-color)] p-4 rounded-xl flex items-center justify-between ${isCurrentTrack ? 'border-2 border-[var(--accent-color)]' : ''}`;
            trackElement.innerHTML = `
                <div class="flex items-center space-x-4">
                    <img src="${track.image}" alt="Album art" class="w-12 h-12 object-cover rounded" data-image="${track.image}">
                    <div>
                        <p class="font-medium text-[var(--text-color)]">${track.name}</p>
                        <p class="text-sm text-[var(--text-color)]/70">${track.artist}</p>
                    </div>
                </div>
                <button class="play-track-btn bg-[var(--accent-color)] hover:bg-[var(--hover-color)] text-[var(--bg-color)] rounded-full p-2" data-index="${index}">
                    ${isCurrentTrack && this.isPlaying ? this.getPauseIcon() : this.getPlayIcon()}
                </button>
            `;
            queueContainer.appendChild(trackElement);

            // Click event for showing the modal
            const imgElement = trackElement.querySelector('img');
            imgElement.addEventListener('click', () => {
                showModal(track.image);
            });

            // Click event to play the selected track
            const playButton = trackElement.querySelector('.play-track-btn');
            playButton.addEventListener('click', () => {
                this.currentTrackIndex = index;
                this.play();
                this.updatePlayPauseButtonListed();
                this.updateQueueDisplay(); // Refresh display to update buttons correctly
            });
        });
    }

    // Utility function to get play SVG
    getPlayIcon() {
        return `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
        `;
    }

    // Utility function to get pause SVG
    getPauseIcon() {
        return `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        `;
    }

    // Updating play/pause button state
    updatePlayPauseButtonListed() {
        document.querySelectorAll('.play-track-btn').forEach((button, index) => {
            // Check if the button corresponds to the current track and update accordingly
            button.innerHTML = index === this.currentTrackIndex && this.isPlaying
                ? this.getPauseIcon()
                : this.getPlayIcon();
        });
    }

    updatePlayPauseButton() {
        const button = document.getElementById('play-pause-btn');
        button.innerHTML = this.isPlaying ? this.getPauseIcon() : this.getPlayIcon();
        button.className = 'bg-[var(--accent-color)] hover:bg-[var(--hover-color)] text-[var(--bg-color)] rounded-full p-2 sm:p-3';
    }

    searchTracks(query) {
        if (query.trim() === '') {
            this.updateQueueDisplay();
            return;
        }

        const filteredTracks = this.queue.filter(track => 
            track.name.toLowerCase().includes(query.toLowerCase()) || 
            track.artist.toLowerCase().includes(query.toLowerCase())
        );

        if (filteredTracks.length === 0) {
            const queueContainer = document.querySelector('.queue-container');
            queueContainer.innerHTML = '<p class="text-center text-[var(--text-color)]/70 mt-4">No matching tracks found</p>';
        } else {
            this.updateQueueDisplay(filteredTracks);
        }
    }
    updateMediaSessionMetadata() {
        if ('mediaSession' in navigator) {
            const currentTrack = this.queue[this.currentTrackIndex];
            navigator.mediaSession.metadata = new MediaMetadata({
                title: currentTrack.name,
                artist: currentTrack.artist,
                album: currentTrack.album || 'Unknown Album',
                artwork: [
                    { src: currentTrack.image, sizes: '96x96', type: 'image/png' },
                    { src: currentTrack.image, sizes: '128x128', type: 'image/png' },
                    { src: currentTrack.image, sizes: '192x192', type: 'image/png' },
                    { src: currentTrack.image, sizes: '256x256', type: 'image/png' },
                    { src: currentTrack.image, sizes: '384x384', type: 'image/png' },
                    { src: currentTrack.image, sizes: '512x512', type: 'image/png' },
                ]
            });
        }
    }

    setupProgressBarEvents() {
        this.progressBarContainer.addEventListener('mousedown', this.startDrag.bind(this));
        this.progressBarContainer.addEventListener('touchstart', this.startDrag.bind(this));
        document.addEventListener('mousemove', this.drag.bind(this));
        document.addEventListener('touchmove', this.drag.bind(this));
        document.addEventListener('mouseup', this.endDrag.bind(this));
        document.addEventListener('touchend', this.endDrag.bind(this));
    }

    startDrag(e) {
        this.isDragging = true;
        this.drag(e);
    }

    drag(e) {
        if (!this.isDragging) return;
        const rect = this.progressBarContainer.getBoundingClientRect();
        const x = (e.clientX || e.touches[0].clientX) - rect.left;
        const percent = Math.min(Math.max(x / rect.width, 0), 1);
        this.progressBar.style.width = `${percent * 100}%`;
        this.audioElement.currentTime = percent * this.audioElement.duration;
    }

    endDrag() {
        this.isDragging = false;
    }

    setupRepeatShuffleButtons() {
        const shuffleBtn = document.getElementById('shuffle-btn');
        const repeatBtn = document.getElementById('repeat-btn');
        
        shuffleBtn.addEventListener('click', this.toggleShuffle.bind(this));
        repeatBtn.addEventListener('click', this.toggleRepeat.bind(this));
    }
    
    toggleShuffle() {
        this.isShuffled = !this.isShuffled;
        const shuffleBtn = document.getElementById('shuffle-btn');
        shuffleBtn.classList.toggle('active', this.isShuffled);
        shuffleBtn.setAttribute('title', this.isShuffled ? 'Shuffle: On' : 'Shuffle: Off');
        
        if (this.isShuffled) {
            this.shuffleQueue();
        } else {
            this.unshuffleQueue();
        }
    }
    
    shuffleQueue() {
        const currentTrack = this.queue[this.currentTrackIndex];
        const remainingTracks = this.queue.slice(this.currentTrackIndex + 1);
        for (let i = remainingTracks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [remainingTracks[i], remainingTracks[j]] = [remainingTracks[j], remainingTracks[i]];
        }
        this.queue = [currentTrack, ...remainingTracks];
        this.currentTrackIndex = 0;
        this.updateQueueDisplay();
    }
    
    unshuffleQueue() {
        // Implement logic to restore original queue order
    }
    
    toggleRepeat() {
        const modes = ['off', 'all', 'one'];
        const currentIndex = modes.indexOf(this.repeatMode);
        this.repeatMode = modes[(currentIndex + 1) % modes.length];
        const repeatBtn = document.getElementById('repeat-btn');
        
        repeatBtn.classList.toggle('active', this.repeatMode !== 'off');
        repeatBtn.classList.toggle('repeat-one', this.repeatMode === 'one');
        
        let title;
        switch (this.repeatMode) {
            case 'off':
                title = 'Repeat: Off';
                break;
            case 'all':
                title = 'Repeat: All';
                break;
            case 'one':
                title = 'Repeat: One';
                break;
        }
        repeatBtn.setAttribute('title', title);
    }
}

const player = new AudioPlayer();

// Set up drag and drop functionality
document.body.addEventListener('dragover', (e) => {
    e.preventDefault();
    document.body.classList.add('bg-[var(--accent-color)]/10');
});

document.body.addEventListener('dragleave', () => {
    document.body.classList.remove('bg-[var(--accent-color)]/10');
});

document.body.addEventListener('drop', (e) => {
    e.preventDefault();
    document.body.classList.remove('bg-[var(--accent-color)]/10');
    player.uploadSongs(e.dataTransfer.files);
});

// Set up file input functionality
const fileInput = document.getElementById('file-input');
if (fileInput) {
    fileInput.addEventListener('change', (e) => player.uploadSongs(e.target.files));
}

// Add theme change listener
themeToggle = document.getElementById('theme-toggle');
if (themeToggle) {
    themeToggle.addEventListener('change', () => {
        player.currentTheme = themeToggle.checked ? 'light' : 'dark';
        player.updateThemeColors();
        player.updateQueueDisplay();
    });
}