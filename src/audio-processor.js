class AudioProcessor {
  constructor() {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.sourceNode = null;
    this.gainNode = this.audioContext.createGain();
    this.analyserNode = this.audioContext.createAnalyser();
    this.equalizer = this.createEqualizer();
    
    this.gainNode.connect(this.equalizer.input);
    this.equalizer.output.connect(this.analyserNode);
    this.analyserNode.connect(this.audioContext.destination);
  }

  createEqualizer() {
    const bands = [60, 170, 350, 1000, 3500, 10000];
    const equalizer = {
      input: this.audioContext.createGain(),
      output: this.audioContext.createGain(),
      bands: []
    };

    bands.forEach(frequency => {
      const filter = this.audioContext.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = frequency;
      filter.Q.value = 1;
      filter.gain.value = 0;

      equalizer.bands.push(filter);

      if (equalizer.bands.length === 1) {
        equalizer.input.connect(filter);
      } else {
        equalizer.bands[equalizer.bands.length - 2].connect(filter);
      }
    });

    equalizer.bands[equalizer.bands.length - 1].connect(equalizer.output);
    return equalizer;
  }

  setEqualizerBand(index, gain) {
    if (index >= 0 && index < this.equalizer.bands.length) {
      this.equalizer.bands[index].gain.value = gain;
    }
  }

  connectSource(audioElement) {
    this.sourceNode = this.audioContext.createMediaElementSource(audioElement);
    this.sourceNode.connect(this.gainNode);

    audioElement.addEventListener('timeupdate', () => {
      if (this.crossfadeDuration && audioElement.duration > 0) {
        const timeLeft = audioElement.duration - audioElement.currentTime;
        if (timeLeft <= this.crossfadeDuration) {
          const gain = timeLeft / this.crossfadeDuration;
          this.gainNode.gain.setValueAtTime(gain, this.audioContext.currentTime);
        }
      }
    });
  }

  setCrossfade(duration) {
    this.crossfadeDuration = duration;
  }
}

export default AudioProcessor;