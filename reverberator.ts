import { irr } from './irr';

export class reverberator {
    context: AudioContext;
    input: BiquadFilterNode;
    output: GainNode;
    dry: GainNode;
    wet: GainNode;
    irrArrayBuffer: ArrayBuffer;
    convolver: ConvolverNode;

    constructor(context: AudioContext) {
        this.context = context;
        this.input = context.createBiquadFilter();
        this.input.type = 'lowpass';
        this.input.frequency.setTargetAtTime(18000, 0, 0.0001);
        this.output = context.createGain();
        this.dry = context.createGain();
        this.dry.gain.setTargetAtTime(0.9, 0, 0.0001);
        this.dry.connect(this.output);
        this.wet = context.createGain();
        this.wet.gain.setTargetAtTime(0.5, 0, 0.0001);
        this.input.connect(this.dry);
        this.input.connect(this.wet);
        const datalen = irr.length / 2;
        this.irrArrayBuffer = new ArrayBuffer(datalen);
        const view = new Uint8Array(this.irrArrayBuffer);
        const decoded = atob(irr);
        for (let i = 0; i < decoded.length; i++) {
            view[i] = decoded.charCodeAt(i);
        }
        context.decodeAudioData(this.irrArrayBuffer, buf => {
            this.convolver = context.createConvolver();
            this.convolver.buffer = buf;
            this.wet.connect(this.convolver);
            this.convolver.connect(this.output);
        });
    }
}