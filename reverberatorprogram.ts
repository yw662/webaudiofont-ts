export class WebAudioFontReverberator {
    context: AudioContext;
    input: BiquadFilterNode;
    output: GainNode;
    decay: GainNode;
    roomSize: DelayNode;
    delay1: DelayNode;
    delay2: DelayNode;
    delay3: DelayNode;
    delay4: DelayNode;
    dry: GainNode;
    wet: GainNode;
    constructor(context: AudioContext) {
        this.context = context;
        this.input = context.createBiquadFilter();
        this.input.type = 'lowpass';
        this.input.frequency.setTargetAtTime(18000, 0, 0.0001);
        this.output = context.createGain();
        this.decay = context.createGain();
        this.decay.gain.setTargetAtTime(0.5, 0, 0.0001);
        this.roomSize = context.createDelay(0.34);
        this.delay1 = context.createDelay(0.031);
        this.delay2 = context.createDelay(0.075);
        this.delay3 = context.createDelay(0.113);
        this.delay4 = context.createDelay(0.196);
        this.dry = context.createGain();
        this.dry.gain.setTargetAtTime(0.9, 0, 0.0001);
        this.dry.connect(this.output);
        this.wet = context.createGain();
        this.wet.gain.setTargetAtTime(0.5, 0, 0.0001);
        this.input.connect(this.roomSize);
        this.roomSize.connect(this.delay1);
        this.roomSize.connect(this.delay2);
        this.roomSize.connect(this.delay3);
        this.roomSize.connect(this.delay4);
        this.delay1.connect(this.decay);
        this.delay2.connect(this.decay);
        this.delay3.connect(this.decay);
        this.delay4.connect(this.decay);
        this.decay.connect(this.roomSize);
        this.delay1.connect(this.wet);
        this.delay2.connect(this.wet);
        this.delay3.connect(this.wet);
        this.delay4.connect(this.wet);
        this.wet.connect(this.output);
        this.input.connect(this.dry);
    }
}