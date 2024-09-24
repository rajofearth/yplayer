class Playlist {
  constructor() {
    this.playlists = new Map();
  }

  createPlaylist(name) {
    if (!this.playlists.has(name)) {
      this.playlists.set(name, []);
      return true;
    }
    return false;
  }

  addToPlaylist(name, track) {
    if (this.playlists.has(name)) {
      this.playlists.get(name).push(track);
      return true;
    }
    return false;
  }

  removeFromPlaylist(name, index) {
    if (this.playlists.has(name) && index >= 0 && index < this.playlists.get(name).length) {
      this.playlists.get(name).splice(index, 1);
      return true;
    }
    return false;
  }

  getPlaylist(name) {
    return this.playlists.get(name) || [];
  }
}

export default Playlist;