class App {
  constructor(player, playlist, library, search) {
    this.player = player;
    this.playlist = playlist;
    this.library = library;
    this.search = search;
    this.currentPlaylist = [];

    // Override the library's onTrackAdded method
    this.library.onTrackAdded = this.onTrackAdded.bind(this);

    setInterval(() => this.updateProgressBar(), 1000);
  }

  render() {
    return `
      <div id="music-player-app">
        <div id="library-view">${this.renderLibrary()}</div>
        <div id="player-view">
          ${this.renderPlayerControls()}
          ${this.renderPlaylist()}
        </div>
      </div>
    `;
  }

  renderLibrary() {
    const tracks = this.library.getAllTracks();
    return `
      <h2>Library</h2>
      <input type="text" id="search-input" placeholder="Search...">
      <ul id="library-list">
        ${tracks.map((track, index) => this.renderTrack(track, index)).join('')}
      </ul>
    `;
  }

  renderTrack(track, index) {
    return `
      <li data-index="${index}">
        <img src="${track.albumArt || 'path/to/default-album-art.png'}" alt="Album Art" width="50" height="50">
        <span>${track.title} - ${track.artist}</span>
      </li>
    `;
  }

  renderPlayerControls() {
    return `
      <div id="player-controls">
        <button id="prev-button">Previous</button>
        <button id="play-pause-button">Play</button>
        <button id="next-button">Next</button>
        <input type="range" id="volume-slider" min="0" max="1" step="0.1" value="1">
        <button id="shuffle-button">Shuffle</button>
      </div>
      <div id="now-playing"></div>
      <div id="progress-bar-container">
        <div id="progress-bar"></div>
      </div>
    `;
  }

  renderPlaylist() {
    return `
      <h2>Current Playlist</h2>
      <ul id="playlist-view">
        ${this.currentPlaylist.map((track, index) => `
          <li data-index="${index}">${track.title} - ${track.artist}</li>
        `).join('')}
      </ul>
    `;
  }

  bindEvents() {
    document.getElementById('search-input').addEventListener('input', this.handleSearch.bind(this));
    document.getElementById('library-list').addEventListener('click', this.handleLibraryClick.bind(this));
    document.getElementById('playlist-view').addEventListener('click', this.handlePlaylistClick.bind(this));
    document.getElementById('prev-button').addEventListener('click', () => this.player.previous());
    document.getElementById('play-pause-button').addEventListener('click', this.handlePlayPause.bind(this));
    document.getElementById('next-button').addEventListener('click', () => this.player.next());
    document.getElementById('volume-slider').addEventListener('input', this.handleVolumeChange.bind(this));
    document.getElementById('shuffle-button').addEventListener('click', () => this.player.shuffle());
    this.bindKeyboardShortcuts();

    const fileInput = document.getElementById('file-input');
    fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
  }

  handleFileUpload(event) {
    const files = event.target.files;
    this.library.uploadTracks(files);
  }

  onTrackAdded(track) {
    const libraryList = document.getElementById('library-list');
    const trackElement = document.createElement('li');
    trackElement.dataset.index = this.library.getAllTracks().length - 1;
    trackElement.innerHTML = this.renderTrack(track, trackElement.dataset.index);
    libraryList.appendChild(trackElement);
  }

  bindKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
      switch (event.key) {
        case ' ':
          event.preventDefault();
          this.handlePlayPause();
          break;
        case 'ArrowLeft':
          this.player.previous();
          break;
        case 'ArrowRight':
          this.player.next();
          break;
      }
    });
  }

  handleSearch(event) {
    const query = event.target.value;
    const results = this.search.search(query);
    this.updateLibraryView(results);
  }

  handleLibraryClick(event) {
    if (event.target.tagName === 'LI') {
      const index = parseInt(event.target.dataset.index);
      const track = this.library.getAllTracks()[index];
      this.currentPlaylist.push(track);
      this.player.playlist = this.currentPlaylist;
      this.player.loadTrack(this.currentPlaylist.length - 1);
      this.player.play();
      this.updatePlaylistView();
      this.updateNowPlaying();
    }
  }

  handlePlaylistClick(event) {
    if (event.target.tagName === 'LI') {
      const index = parseInt(event.target.dataset.index);
      this.player.loadTrack(index);
      this.player.play();
      this.updateNowPlaying();
    }
  }

  handlePlayPause() {
    if (this.player.audio.paused) {
      this.player.play();
      document.getElementById('play-pause-button').textContent = 'Pause';
    } else {
      this.player.pause();
      document.getElementById('play-pause-button').textContent = 'Play';
    }
  }

  handleVolumeChange(event) {
    const volume = parseFloat(event.target.value);
    this.player.setVolume(volume);
  }

  updateLibraryView(tracks) {
    const libraryList = document.getElementById('library-list');
    libraryList.innerHTML = tracks.map((track, index) => `
      <li data-index="${index}">${track.title} - ${track.artist}</li>
    `).join('');
  }

  updatePlaylistView() {
    const playlistView = document.getElementById('playlist-view');
    playlistView.innerHTML = this.currentPlaylist.map((track, index) => `
      <li data-index="${index}">${track.title} - ${track.artist}</li>
    `).join('');
  }

  updateNowPlaying() {
    const nowPlaying = document.getElementById('now-playing');
    const currentTrack = this.currentPlaylist[this.player.currentIndex];
    nowPlaying.textContent = currentTrack ? `Now Playing: ${currentTrack.title} - ${currentTrack.artist}` : '';
  }

  updateProgressBar() {
    const progressBar = document.getElementById('progress-bar');
    const { currentTime, duration } = this.player.audio;
    const progress = (currentTime / duration) * 100 || 0;
    progressBar.style.width = `${progress}%`;
  }
}

export default App;