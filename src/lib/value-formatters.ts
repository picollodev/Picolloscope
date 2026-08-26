import { InputFormat } from './input-format-spec'

export function createValueFormatter(unit: InputFormat.ValueUnit | undefined) {
  switch (unit) {
    case 'nanoseconds':
    case 'microseconds':
    case 'milliseconds':
    case 'seconds':
      return new TimeFormatter(unit);
    case 'bytes':
      return new ByteFormatter();
    case 'none':
    default:
      return new RawValueFormatter();
  }
}

export interface ValueFormatter {
  unit: InputFormat.ValueUnit
  format(v: number): string
}

export class RawValueFormatter implements ValueFormatter {
  unit: InputFormat.ValueUnit = 'none'
  format(v: number) {
    return v.toLocaleString()
  }
}

export class TimeFormatter implements ValueFormatter {
  private multiplier: number

  constructor(public unit: 'nanoseconds' | 'microseconds' | 'milliseconds' | 'seconds') {
    if (unit === 'nanoseconds') this.multiplier = 1e-9
    else if (unit === 'microseconds') this.multiplier = 1e-6
    else if (unit === 'milliseconds') this.multiplier = 1e-3
    else this.multiplier = 1
  }

  private formatUnsigned(v: number) {
    const s = v * this.multiplier

    if (s >= 0.1) return `${s.toFixed(2)}s`
    if (s / 1e-3 >= 1) return `${(s / 1e-3).toFixed(0)}m`
    if (s / 1e-6 >= 1) return `${(s / 1e-6).toFixed(0)}µ`
    else return `${(s / 1e-9).toFixed(0)}n`
  }

  format(v: number) {
    var abs = Math.abs(v);
    if(abs < 0.0000000001)
      return '0';

    return `${v < 0 ? '-' : ''}${this.formatUnsigned(abs)}`
  }
}

export class ByteFormatter implements ValueFormatter {
  unit: InputFormat.ValueUnit = 'bytes'

  format(v: number) {
    if (v < 1024) return `${v.toFixed(0)} B`
    v /= 1024
    if (v < 1024) return `${v.toFixed(2)} KB`
    v /= 1024
    if (v < 1024) return `${v.toFixed(2)} MB`
    v /= 1024
    return `${v.toFixed(2)} GB`
  }
}
