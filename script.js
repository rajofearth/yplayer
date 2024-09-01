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
    }

    setupEventListeners() {
        const playPauseBtn = document.getElementById('play-pause-btn');
        const nextBtn = document.getElementById('next-btn');
        const prevBtn = document.getElementById('prev-btn');
        const volumeControl = document.getElementById('volume-control');
        const progressBarContainer = document.getElementById('progress-bar').parentElement;
        const searchInput = document.getElementById('search-input');

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
    }
    uploadSongs(files) {
        const fileArray = Array.from(files);
        const totalFiles = fileArray.length;

        if (totalFiles > 0) {
            this.showUploadProgress();
        }

        const promises = fileArray.map((file, index) => {
            return new Promise((resolve) => {
                setTimeout(() => {
                    this.addToQueue(file);
                    this.updateUploadProgress(index + 1, totalFiles);
                    resolve();
                }, 100);
            });
        });

        Promise.all(promises).then(() => {
            this.hideUploadProgress();
            if (!this.songsDisplayed) {
                this.updateQueueDisplay();
                this.songsDisplayed = true;

                if (this.queue.length > 0) {
                    this.play();
                }
            }
        });
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
        if (this.currentTrackIndex < this.queue.length - 1) {
            this.currentTrackIndex++;
            this.isResuming = false;
            this.play();
            this.updateMediaSessionMetadata();
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
        // Convert the volume to a float between 0 and 1
        const volumeFloat = parseFloat(volume);
        this.audioElement.volume = volumeFloat;
        
        // Update the volume slider value
        const volumeControl = document.getElementById('volume-control');
        if (volumeControl) {
            volumeControl.value = volume;
        }

        // Update system volume (if supported)
        if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
            navigator.mediaSession.setPositionState({
                duration: this.audioElement.duration,
                playbackRate: this.audioElement.playbackRate,
                position: this.audioElement.currentTime
            });
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

    // Function to create queue items and set up click events
// Function to create queue items and set up click events
updateQueueDisplay(filteredTracks = this.queue) {
    const queueContainer = document.querySelector('.queue-container');
    queueContainer.innerHTML = '';

    filteredTracks.forEach((track, index) => {
        const isCurrentTrack = index === this.currentTrackIndex;
        const trackElement = document.createElement('div');
        trackElement.className = `bg-[#001122] p-4 rounded-xl flex items-center justify-between ${isCurrentTrack ? 'border-2 border-[#00ff00]' : ''}`;
        trackElement.innerHTML = `
            <div class="flex items-center space-x-4">
                <img src="${track.image}" alt="Album art" class="w-12 h-12 object-cover rounded" data-image="${track.image}">
                <div>
                    <p class="font-medium text-[#00ff00]">${track.name}</p>
                    <p class="text-sm text-[#00ff00]/70">${track.artist}</p>
                </div>
            </div>
            <button class="play-track-btn bg-[#00ff00] hover:bg-[#00ff00]/80 text-[#001122] rounded-full p-2" data-index="${index}">
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
            this.updateQueueDisplay(); // Refresh display to update buttons correctly
        });
    });
}

// Utility function to get play SVG
getPlayIcon() {
    return `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        </svg>
    `;
}

// Utility function to get pause SVG
getPauseIcon() {
    return `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
        button.innerHTML = this.isPlaying
            ? '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>'
            : '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>';
        button.className = 'bg-[#00ff00] hover:bg-[#00ff00]/80 text-[#001122] rounded-full p-2 sm:p-3';
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
            queueContainer.innerHTML = '<p class="text-center text-[#00ff00]/70 mt-4">No matching tracks found</p>';
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
}

const player = new AudioPlayer();
// Set up drag and drop functionality
document.body.addEventListener('dragover', (e) => {
    e.preventDefault();
    document.body.classList.add('bg-[#00ff00]/10');
});

document.body.addEventListener('dragleave', () => {
    document.body.classList.remove('bg-[#00ff00]/10');
});

document.body.addEventListener('drop', (e) => {
    e.preventDefault();
    document.body.classList.remove('bg-[#00ff00]/10');
    player.uploadSongs(e.dataTransfer.files);
});

// Set up file input functionality
const fileInput = document.getElementById('file-input');
if (fileInput) {
    fileInput.addEventListener('change', (e) => player.uploadSongs(e.target.files));
}