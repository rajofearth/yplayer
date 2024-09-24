import Player from './player.js';
import Playlist from './playlist.js';
import Library from './library.js';
import Search from './search.js';
import App from './ui/app.js';

class MusicPlayerApp {
  constructor() {
    this.player = new Player();
    this.playlist = new Playlist();
    this.library = new Library();
    this.search = new Search(this.library);
    this.app = new App(this.player, this.playlist, this.library, this.search);
  }

  init() {
    // Bind events
    this.app.bindEvents();

    // Connect the audio processor
    this.player.audioProcessor.connectSource(this.player.audio);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new MusicPlayerApp();
  app.init();
});