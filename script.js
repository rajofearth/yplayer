class AudioPlayer {
    constructor() {
        this.audioElement = new Audio();
        this.queue = [];
        this.currentTrackIndex = 0;
        this.isPlaying = false;
        this.songsDisplayed = false;  // Flag to track if songs have been displayed
        this.currentTime = 0;
        this.isResuming = false;
        this.audioElement.addEventListener('ended', () => this.playNext());
        this.audioElement.addEventListener('timeupdate', () => this.updateProgressBar());
        this.audioElement.addEventListener('loadedmetadata', () => this.updateTotalTime());
        this.audioElement.addEventListener('ended', () => this.nextTrack());
        this.setupEventListeners();

        // Set up Media Session API
        if ('mediaSession' in navigator) {
            navigator.mediaSession.setActionHandler('play', () => this.play());
            navigator.mediaSession.setActionHandler('pause', () => this.pause());
            navigator.mediaSession.setActionHandler('previoustrack', () => this.playPrevious());
            navigator.mediaSession.setActionHandler('nexttrack', () => this.playNext());
        }
    }

    setupEventListeners() {
        document.getElementById('play-pause-btn').addEventListener('click', () => this.togglePlayPause());
        document.getElementById('next-btn').addEventListener('click', () => this.playNext());
        document.getElementById('prev-btn').addEventListener('click', () => this.playPrevious());
        document.getElementById('volume-control').addEventListener('input', (e) => this.setVolume(e.target.value));
        document.getElementById('progress-bar').parentElement.addEventListener('click', (e) => this.seek(e));
        document.getElementById('search-input').addEventListener('input', (e) => this.searchTracks(e.target.value));
        document.addEventListener("DOMContentLoaded", function () {
            // Select the necessary elements
            const albumArt = document.getElementById("now-playing-img");
            const modal = document.getElementById("album-art-modal");
            const modalImg = document.getElementById("modal-img");
            const closeModalBtn = document.getElementById("close-modal");
        
            // Show the modal when the album art is clicked
            albumArt.addEventListener("click", () => {
                modalImg.src = albumArt.src; // Set the modal image to the album art source
                modal.classList.remove("hidden"); // Show the modal
            });
        
            // Hide the modal when the close button is clicked
            closeModalBtn.addEventListener("click", () => {
                modal.classList.add("hidden"); // Hide the modal
            });
        
            // Optional: Hide the modal when clicking outside the modal content
            modal.addEventListener("click", (e) => {
                if (e.target === modal) {
                    modal.classList.add("hidden");
                }
            });
        });
        
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
                this.songsDisplayed = true;  // Set flag to true after displaying songs

                if (this.queue.length > 0) {
                    this.play();  // Automatically start playing if songs are available
                }
            }
        });
    }
    showUploadProgress() {
        document.getElementById('upload-progress').classList.remove('hidden');
        document.getElementById('upload-progress').classList.add('show');
    }

    hideUploadProgress() {
        document.getElementById('upload-progress').classList.add('hidden');
        document.getElementById('upload-progress').classList.remove('show');
    }

    updateUploadProgress(current, total) {
        const progressPercentage = Math.round((current / total) * 100);
        document.getElementById('upload-progress-text').textContent = `${progressPercentage}%`;
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

        // Check if the audio is paused and the current track is already loaded
        if (this.isPaused && this.audioElement.src === URL.createObjectURL(currentTrack.file)) {
            // If paused, just resume playback
            this.audioElement.play()
                .then(() => {
                    this.isPlaying = true;
                    this.isPaused = false;
                    this.updateNowPlaying();
                    this.updatePlayPauseButton();
                    this.updateQueueDisplay();

                    if ('mediaSession' in navigator) {
                        this.updateMediaSessionMetadata();
                        navigator.mediaSession.playbackState = 'playing';
                    }
                })
                .catch(error => {
                    console.error("Error resuming audio:", error);
                    this.isPlaying = false;
                    this.updatePlayPauseButton();
                });
        } else {
            // If not paused, start a new track
            this.audioElement.src = URL.createObjectURL(currentTrack.file);
            this.audioElement.currentTime = 0;
            
            // Play the audio
            this.audioElement.play()
                .then(() => {
                    this.isPlaying = true;
                    this.isPaused = false;
                    this.updateNowPlaying();
                    this.updatePlayPauseButton();
                    this.updateQueueDisplay();

                    if ('mediaSession' in navigator) {
                        this.updateMediaSessionMetadata();
                        navigator.mediaSession.playbackState = 'playing';
                    }
                })
                .catch(error => {
                    console.error("Error playing audio:", error);
                    this.isPlaying = false;
                    this.updatePlayPauseButton();
                });
        }
    }
}

    pause() {
        this.audioElement.pause();
        this.isPlaying = false;
        this.isPaused = true;
        this.currentTime = this.audioElement.currentTime; // Store the current playback position
        this.updatePlayPauseButton();
        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'paused';
        }
    }

    togglePlayPause() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.isResuming = true;
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
        this.audioElement.volume = volume;
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

    // Function to create queue items and set up click event
    updateQueueDisplay(filteredTracks = this.queue) {
        const queueContainer = document.querySelector('.queue-container');
        queueContainer.innerHTML = '';
        filteredTracks.forEach((track, index) => {
            const trackElement = document.createElement('div');
            trackElement.className = `bg-[#001122] p-4 rounded-xl flex items-center justify-between ${index === this.currentTrackIndex ? 'border-2 border-[#00ff00]' : ''}`;
            trackElement.innerHTML = `
                <div class="flex items-center space-x-4">
                    <img src="${track.image}" alt="Album art" class="w-12 h-12 object-cover rounded" data-image="${track.image}">
                    <div>
                        <p class="font-medium text-[#00ff00]">${track.name}</p>
                        <p class="text-sm text-[#00ff00]/70">${track.artist}</p>
                    </div>
                </div>
                <button class="play-track-btn bg-[#00ff00] hover:bg-[#00ff00]/80 text-[#001122] rounded-full p-2" id="current-playing-s-play-btn" data-index="${index}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    </svg>
                </button>
            `;
            queueContainer.appendChild(trackElement);
            updatePlayPauseButtonListed();
            
            // Add click event to track image
            const imgElement = trackElement.querySelector('img');
            imgElement.addEventListener('click', () => {
                showModal(track.image);
            });
        });

        document.querySelectorAll('.play-track-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.index);
                this.currentTrackIndex = index;
                updatePlayPauseButtonListed();
                this.play();
            });
        });
    }
    updatePlayPauseButtonListed() {
        const button = document.getElementById('current-playing-s-play-btn');
        button.innerHTML = this.isPlaying
            ? '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>'
            : '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>';
        button.className = 'play-track-btn bg-[#00ff00] hover:bg-[#00ff00]/80 text-[#001122] rounded-full p-2';
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
document.addEventListener('DOMContentLoaded', () => {
    player;
    // Add drag and drop functionality
    const dropZone = document.body;
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('bg-[#00ff00]/10');
    });
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('bg-[#00ff00]/10');
    });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('bg-[#00ff00]/10');
        player.uploadSongs(e.dataTransfer.files);
    });
});
document.getElementById('file-input').addEventListener('change', (e) => player.uploadSongs(e.target.files));