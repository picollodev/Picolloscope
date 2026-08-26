// This file contains types which specify the speedscope file format.

export namespace InputFormat {
  export type Profile = EventedProfile | SampledProfile

  export interface InputChunk {
    $schema: 'https://picollo.dev/picolloscope/input-format-schema.json'

    /**
     * Metadata shared between profiles
     */
    metadata: Metadata

    /**
     * Profile group
     */
    profiles: Profile[]

    /**
     * The name of the contained profile group. If omitted, will use the name of the file itself.
     */
    name?: string

    /**
     * The index into the `profiles` array that should be displayed upon file load.
     * If omitted, will default to displaying the first profile in the file.
     */
    activeProfileIndex?: number
  }

  export interface Metadata {
    /**
     * Frames seen by a profiler.
     */
    frames: FrameInfo[],

    /**
     * Frame types, e.g. managed/native/kernel or narrower specific types defined by a profiler.
     */
    frameTypes?: string[] | null
  }

  export interface FrameInfo {

    /**
     * Canonical name of a frame
     *
     */
    name: string

    /**
     * A file or module/assembly name.
     */
    file?: string

    /**
     * A numeric value that indexes the Metadata.frameTypes array
     */
    type?: number

    /**
     * Managed module version ID.
     */
    moduleMvid?: string

    /**
     * Managed MethodDef token.
     */
    methodToken?: number

    /**
     * Structured metadata for a managed method.
     */
    methodMetadata?: MethodMetadata

    line?: number
    col?: number
  }

  export interface TypeMetadata {
    namespace: string
    name: string
  }

  export enum ParameterModifier {
    NONE = 0,
    REF = 1,
    OUT = 2,
    IN = 3,
  }

  export interface ParameterMetadata {
    type: TypeMetadata
    modifier: ParameterModifier
  }

  export interface MethodMetadata {
    declaringType: TypeMetadata
    name: string
    returnType: TypeMetadata | null
    parameters: ParameterMetadata[]
  }

  export enum ProfileType {
    EVENTED = 'evented',
    SAMPLED = 'sampled',
  }

  export interface IProfile {
    /**
     * Type of profile. This will future proof the file format to allow many
     * different kinds of profiles to be contained and each type to be part of
     * a discriminated union.
     */
    type: ProfileType

    /**
     * Name of the profile. Typically, a thread name. Use for matching a base profile if the later is present.
     */
    name: string

    /**
     * OS Thread ID, used to identify a profile with an import file and accross its chunks.
     */
    tid: string

    /**
     * Unit which all value are specified using in the profile.
     */
    unit?: ValueUnit

    /**
     * The starting value of the profile.
     * This will typically be a timestamp. All event values will be displayed relative to this startValue.
     */
    startValue: number

    /**
     * The final value of the profile. This will typically be a timestamp.
     * This must be greater than or equal to the startValue.
     * This is useful in situations where the recorded profile extends past
     * the end of the recorded events, which may happen if nothing was happening at the end of the profile.
     */
    endValue: number
  }

  export interface EventedProfile extends IProfile {
    type: ProfileType.EVENTED

    /**
     * List of events that occured as part of this profile.
     * The "at" field of every event must be in non-decreasing order.
     */
    events: (OpenFrameEvent | CloseFrameEvent)[]
  }

  /**
   * List of indices into the frame array
   */
  export type SampledStack = number[]

  export type FlatSamples = {stacks: number[], ends: number[]}

  export interface SampledProfile extends IProfile {
    type: ProfileType.SAMPLED

    /**
     * List of stacks
     */
    samples?: SampledStack[]

    /**
     * Flat representation of stacks
     */
    flatSamples?: FlatSamples

    /**
     * The weight of the sample at the given index.
     * If provided as a non-empty array, should have
     * either the same length as the samples array
     * or a single element shared for all samples.
     * The single element shoudl normally be equal to 1/frequency converted to units.
     */
    weights?: number[] | null

    /**
     * Event times since startValue in units.
     * The time is assumed as centered time (middle of a sample)
     */
    times?: number[] | null
  }

  export type ValueUnit = 'none' | 'nanoseconds' | 'microseconds' | 'milliseconds' | 'seconds' | 'bytes'

  export enum EventType {
    OPEN_FRAME = 'O',
    CLOSE_FRAME = 'C',
  }

  interface IEvent {
    type: EventType
    at: number
    /**
     * An index into the frames array in the shared data within the profile
     */
    frame: number
  }

  /**
   * Indicates a stack frame opened.
   * Every opened stack frame must have a corresponding close frame event,
   * and the ordering must be balanced.
   */
  interface OpenFrameEvent extends IEvent {
    type: EventType.OPEN_FRAME
  }

  interface CloseFrameEvent extends IEvent {
    type: EventType.CLOSE_FRAME
  }
}
