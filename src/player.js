import { AudioProcessor } from './audio-processor.js';

class Player {
  constructor() {
    this.audio = new Audio();
    this.playlist = [];
    this.currentIndex = 0;
    this.audioProcessor = new AudioProcessor();
    this.audio.addEventListener('error', this.handleError.bind(this));
  }

  loadTrack(index) {
    if (index >= 0 && index < this.playlist.length) {
      this.currentIndex = index;
      const track = this.playlist[index];
      if (track.file) {
        this.audio.src = URL.createObjectURL(track.file);
      } else {
        this.audio.src = track.url;
      }
      this.audio.load();
    }
  }

  play() {
    this.audio.play();
  }

  pause() {
    this.audio.pause();
  }

  next() {
    this.loadTrack((this.currentIndex + 1) % this.playlist.length);
    this.play();
  }

  previous() {
    this.loadTrack((this.currentIndex - 1 + this.playlist.length) % this.playlist.length);
    this.play();
  }

  setVolume(volume) {
    this.audio.volume = volume;
  }

  // Improved shuffle algorithm using Fisher-Yates shuffle
  shuffle() {
    for (let i = this.playlist.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.playlist[i], this.playlist[j]] = [this.playlist[j], this.playlist[i]];
    }
    this.loadTrack(0);
  }

  handleError() {
    console.error('Error loading track:', this.audio.error);
    this.next(); // Skip to the next track if there's an error
  }
}

export default Player;