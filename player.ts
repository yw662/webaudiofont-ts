import { loader } from './loader';
import { channel } from './channel';
import { reverberator } from './reverberator';

declare interface Zone {
    keyRangeHigh: number;
    keyRangeLow: number;
    buffer: AudioBuffer;
    originalPitch: number;
    sustain: number;
    coarseTune: number;
    fineTune: number;
    sampleRate: number;
    loopStart: number;
    loopEnd: number;
    delay: number;
    ahdsr: { duration: number; volume: number }[];

    sample?: string;
    file?: string;
};
declare interface Preset {
    zones: Zone[]
};
declare interface Envelope extends GainNode {
    source?: AudioBufferSourceNode;
    when?: number;
    duration?: number;
    pitch?: number;
    preset?: Preset;
    target?: AudioNode;
    cancel?: () => void
};
declare interface Slide { pitch: number; when: number };

export class player {
    loader: loader;
    nearZero: number;
    afterTime: number;
    envelopes: Envelope[];
    createChannel(context: AudioContext) {
        return new channel(context);
    }
    createReverberator(context: AudioContext) {
        return new reverberator(context);
    }
    limitVolume(volume: number) {
        return volume ? volume : 0.5;
    }
    queueChord(context: AudioContext, target: AudioNode, preset: Preset, when: number, pitches: number[], duration: number, volume: number, slides?: Slide[]) {
        volume = this.limitVolume(volume);
        for (const p of pitches) {
            this.queueWaveTable(context, target, preset, when, p, duration, volume - Math.random() * 0.01, slides);
        }
    }
    queueStrumUp(context: AudioContext, target: AudioNode, preset: Preset, when: number, pitches: number[], duration: number, volume: number, slides?: Slide[]) {
        pitches.sort((a, b) => b - a);
        this.queueStrum(context, target, preset, when, pitches, duration, volume, slides);
    }
    queueStrumDown(context: AudioContext, target: AudioNode, preset: Preset, when: number, pitches: number[], duration: number, volume: number, slides?: Slide[]) {
        pitches.sort((a, b) => a - b);
        this.queueStrum(context, target, preset, when, pitches, duration, volume, slides);
    }
    queueStrum(context: AudioContext, target: AudioNode, preset: Preset, when: number, pitches: number[], duration: number, volume: number, slides?: Slide[]) {
        volume = this.limitVolume(volume);
        if (when < context.currentTime) when = context.currentTime;
        for (const p of pitches) {
            this.queueWaveTable(context, target, preset, when, p, duration, volume - Math.random() * 0.01, slides);
            volume = 0.9 * volume;
            when = when + 0.01;
        }
    }
    queueSnap(context: AudioContext, target: AudioNode, preset: Preset, when: number, pitches: number[], duration: number, volume: number, slides?: Slide[]) {
        volume = 1.5 * this.limitVolume(volume);
        duration = 0.05;
        this.queueChord(context, target, preset, when, pitches, duration, volume, slides);
    }
    queueWaveTable(context: AudioContext, target: AudioNode, preset: Preset, when: number, pitch: number, duration: number, volume: number, slides?: Slide[]) {
        volume = this.limitVolume(volume);
        const zone = this.findZone(context, preset, pitch);
        if (!zone.buffer) return;
        const baseDetune = zone.originalPitch - 100.0 * zone.coarseTune - zone.fineTune;
        const playbackRate = 1.0 * Math.pow(2, (100.0 * pitch - baseDetune) / 1200.0);
        const sampleRatio = zone.sampleRate / context.sampleRate;
        const startWhen = when < context.currentTime ? context.currentTime : when;
        const loop = zone.loopStart > 1 && zone.loopStart <= zone.loopEnd;
        const waveDuration = loop ? duration + this.afterTime : Math.min(zone.buffer.duration / playbackRate, duration + this.afterTime);
        const envelope = this.findEnvelope(context, target, startWhen, waveDuration);
        this.setupEnvelope(context, envelope, zone, volume, startWhen, waveDuration, duration);
        envelope.source = context.createBufferSource();
        envelope.source.playbackRate.setValueAtTime(playbackRate, 0);
        if (slides && slides.length > 0) {
            envelope.source.playbackRate.setValueAtTime(playbackRate, when);
            for (const slide of slides) {
                const newPlaybackRate = 1.0 * Math.pow(2, (100.0 * slide.pitch - baseDetune) / 1200.0);
                const newWhen = when + slide.when;
                envelope.source.playbackRate.linearRampToValueAtTime(newPlaybackRate, newWhen);
            }
        }
        envelope.source.buffer = zone.buffer;
        if (loop) {
            envelope.source.loop = true;
            envelope.source.loopStart = zone.loopStart / zone.sampleRate + zone.delay;
            envelope.source.loopEnd = zone.loopEnd / zone.sampleRate + zone.delay;
        } else {
            envelope.source.loop = false;
        }
        envelope.source.connect(envelope);
        envelope.source.start(startWhen, zone.delay);
        envelope.source.stop(startWhen + waveDuration);
        envelope.when = startWhen;
        envelope.duration = waveDuration;
        envelope.pitch = pitch;
        envelope.preset = preset;
        return envelope;
    }
    noZeroVolume(n: number) {
        return Math.max(n, this.nearZero);
    }
    setupEnvelope(context: AudioContext, envelope: Envelope, zone: Zone, volume: number, when: number, sampleDuration: number, noteDuration: number) {
        envelope.gain.setValueAtTime(this.noZeroVolume(0), context.currentTime);
        let lastTime = 0;
        let lastVolume = 0;
        const duration = Math.min(noteDuration, sampleDuration - this.afterTime);
        const ahdsr = zone.ahdsr ?
            zone.ahdsr.length > 0 ?
                zone.ahdsr :
                [{ duration: 0, volume: 1 }, { duration: 0.5, volume: 1 }, { duration: 1.5, volume: 0.5 }, { duration: 3, volume: 0 }] :
            [{ duration: 0, volume: 1 }, { duration: 0, volume: 1 }];
        envelope.gain.cancelScheduledValues(when);
        envelope.gain.setValueAtTime(this.noZeroVolume(ahdsr[0].volume * volume), when);
        for (const a of ahdsr) {
            if (a.duration > 0) {
                if (a.duration + lastTime > duration) {
                    const r = 1 - (a.duration + lastTime - duration) / a.duration;
                    const n = lastVolume - r * (lastVolume - a.volume);
                    envelope.gain.linearRampToValueAtTime(this.noZeroVolume(volume * n), when + duration);
                    break;
                }
                lastTime = lastTime + a.duration;
                lastVolume = a.volume;
                envelope.gain.linearRampToValueAtTime(this.noZeroVolume(volume * lastVolume), when + lastTime);
            }
        }
        envelope.gain.linearRampToValueAtTime(this.noZeroVolume(0), when + duration + this.afterTime);
    }
    numValue(aValue: number, defValue: number) {
        return typeof aValue === 'number' ? aValue : defValue;
    }
    findEnvelope(context: AudioContext, target: AudioNode, when: number, duration: number): Envelope {
        let envelope: Envelope;
        for (const e of this.envelopes) {
            if (e.target === target && context.currentTime > e.when + e.duration + 0.001) {
                try {
                    e.source.disconnect();
                    e.source.stop(0);
                    e.source = undefined;
                } catch (x) { }
                envelope = e;
                break;
            }
        }
        if (!envelope) {
            envelope = context.createGain();
            envelope.target = target;
            envelope.when = when;
            envelope.duration = duration;
            envelope.cancel = () => {
                if (envelope.when + envelope.duration > context.currentTime) {
                    envelope.gain.cancelScheduledValues(0);
                    envelope.gain.setTargetAtTime(0.00001, context.currentTime, 0.1);
                    envelope.when = context.currentTime + 0.00001;
                    envelope.duration = 0;
                }
            };
            envelope.connect(target);
            this.envelopes.push(envelope);
        }
        return envelope;
    }
    adjustPreset(context: AudioContext, preset: Preset) {
        for (const z of preset.zones) {
            this.adjustZone(context, z);
        }
    }
    adjustZone(context: AudioContext, zone: Zone) {
        if (!zone.buffer) {
            zone.delay = 0;
            if (zone.sample) {
                const decoded = atob(zone.sample);
                zone.buffer = context.createBuffer(1, decoded.length / 2, zone.sampleRate);
                const arr = zone.buffer.getChannelData(0);
                for (let i = 0; i < decoded.length / 2; i++) {
                    let b1 = decoded.charCodeAt(i * 2);
                    let b2 = decoded.charCodeAt(i * 2 + 1);
                    b1 += b1 < 0 ? 256 : 0;
                    b2 += b2 < 0 ? 256 : 0;
                    let n = b2 * 256 + b1;
                    n -= n >= 65536 / 2 ? 65536 : 0;
                    arr[i] = n / 65536.0;
                }
            } else if (zone.file) {
                const datalen = zone.file.length;
                const ab = new ArrayBuffer(datalen);
                const view = new Uint8Array(ab);
                const decoded = atob(zone.file);
                for (let i = 0; i < decoded.length; i++) {
                    view[i] = decoded.charCodeAt(i);
                }
                context.decodeAudioData(ab, buf => zone.buffer = buf);
            }
        }
        zone.loopStart = this.numValue(zone.loopStart, 0);
        zone.loopEnd = this.numValue(zone.loopEnd, 0);
        zone.coarseTune = this.numValue(zone.coarseTune, 0);
        zone.fineTune = this.numValue(zone.fineTune, 0);
        zone.originalPitch = this.numValue(zone.originalPitch, 6000);
        zone.sampleRate = this.numValue(zone.sampleRate, 6000);
        zone.sustain = this.numValue(zone.originalPitch, 0);
    }
    findZone(context: AudioContext, preset: Preset, pitch: number): Zone {
        let zone: Zone;
        for (let i = preset.zones.length - 1; i >= 0; i--) {
            zone = preset.zones[i];
            if (zone.keyRangeLow <= pitch && zone.keyRangeHigh + 1 >= pitch) {
                break;
            }
        }
        try {
            this.adjustZone(context, zone);
        } catch (x) { }
        return zone;
    }
    cancelQueue(context: AudioContext): this {
        for (const e of this.envelopes) {
            e.gain.cancelScheduledValues(0);
            e.gain.setValueAtTime(this.nearZero, context.currentTime);
            e.when = -1;
            try {
                e.source.disconnect();
            } catch (x) { }
        }
        return this;
    }
    constructor() {
        this.envelopes = [];
        this.loader = new loader(this);
        this.afterTime = 0.05;
        this.nearZero = 0.000001;
    }
}