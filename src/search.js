class Search {
  constructor(library) {
    this.library = library;
  }

  search(query) {
    const lowercaseQuery = query.toLowerCase();
    return this.library.getAllTracks().filter(track => 
      track.title.toLowerCase().includes(lowercaseQuery) ||
      track.artist.toLowerCase().includes(lowercaseQuery) ||
      track.album.toLowerCase().includes(lowercaseQuery)
    );
  }
}

export default Search;