export class channel {
    context: AudioContext;
    input: DynamicsCompressorNode;
    band32: BiquadFilterNode;
    band64: BiquadFilterNode;
    band128: BiquadFilterNode;
    band256: BiquadFilterNode;
    band512: BiquadFilterNode;
    band1k: BiquadFilterNode;
    band2k: BiquadFilterNode;
    band4k: BiquadFilterNode;
    band8k: BiquadFilterNode;
    band16k: BiquadFilterNode;
    output: GainNode;
    
    bandEqualizer(from: AudioNode, freq: number) {
        let filter = this.context.createBiquadFilter();
        filter.frequency.setTargetAtTime(freq, 0, 0.0001);
        filter.type = "peaking";
        filter.gain.setTargetAtTime(0, 0, 0.0001);
        filter.Q.setTargetAtTime(1.0, 0, 0.0001);
        from.connect(filter);
        return filter;
    }
    constructor(context: AudioContext) {
        this.context = context;
        this.input = context.createDynamicsCompressor();
        this.input.threshold.setValueAtTime(-3,0);// = -3; //-50
        this.input.knee.setValueAtTime(30,0); //40
        this.input.ratio.setValueAtTime(12,0); //12
        //this.input.reduction.value = -20; //-20
        this.input.attack.setValueAtTime(0.05,0); //0
        this.input.release.setValueAtTime(0.08,0); //0.25
        this.band32 = this.bandEqualizer(this.input, 32);
        this.band64 = this.bandEqualizer(this.band32, 64);
        this.band128 = this.bandEqualizer(this.band64, 128);
        this.band256 = this.bandEqualizer(this.band128, 256);
        this.band512 = this.bandEqualizer(this.band256, 512);
        this.band1k = this.bandEqualizer(this.band512, 1024);
        this.band2k = this.bandEqualizer(this.band1k, 2048);
        this.band4k = this.bandEqualizer(this.band2k, 4096);
        this.band8k = this.bandEqualizer(this.band4k, 8192);
        this.band16k = this.bandEqualizer(this.band8k, 16384);
        this.output = context.createGain();
        this.band16k.connect(this.output);
        return this;
    }
}