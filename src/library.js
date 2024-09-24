class Library {
  constructor() {
    this.tracks = [];
  }

  addTrack(track) {
    this.tracks.push(track);
  }

  removeTrack(index) {
    if (index >= 0 && index < this.tracks.length) {
      this.tracks.splice(index, 1);
      return true;
    }
    return false;
  }

  getAllTracks() {
    return this.tracks;
  }

  uploadTracks(files) {
    Array.from(files).forEach(file => {
      this.extractMetadata(file);
    });
  }

  extractMetadata(file) {
    jsmediatags.read(file, {
      onSuccess: (tag) => {
        const { title, artist, album } = tag.tags;
        const albumArt = tag.tags.picture ? this.getAlbumArtUrl(tag.tags.picture) : null;
        
        const track = {
          title: title || file.name,
          artist: artist || 'Unknown Artist',
          album: album || 'Unknown Album',
          albumArt: albumArt,
          file: file
        };
        
        this.addTrack(track);
        this.onTrackAdded(track);
      },
      onError: (error) => {
        console.error('Error reading tags:', error);
        const track = {
          title: file.name,
          artist: 'Unknown Artist',
          album: 'Unknown Album',
          albumArt: null,
          file: file
        };
        this.addTrack(track);
        this.onTrackAdded(track);
      }
    });
  }

  getAlbumArtUrl(picture) {
    const { data, format } = picture;
    const base64String = btoa(String.fromCharCode.apply(null, data));
    return `data:${format};base64,${base64String}`;
  }

  onTrackAdded(track) {
    // This method will be overridden to update the UI when a track is added
  }
}

export default Library;