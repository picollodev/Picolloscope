import { InputFormat } from "../input-format-spec";
import {formatMethodMetadata, getFrameFullName, MetadataFormatting} from '../metadata-formatting'
import { createValueFormatter } from "../value-formatters";
import { Profile } from "./profile";

function normalizeProfileName(name: string, tid: string): string {
  const trimmedName = name.trimEnd()
  if (!trimmedName.endsWith(')')) return name

  const openParenIndex = trimmedName.lastIndexOf('(')
  if (openParenIndex === -1) return name

  const parenthesizedSuffix = trimmedName.slice(openParenIndex + 1, -1)
  if (!parenthesizedSuffix.includes(tid)) return name

  return trimmedName.slice(0, openParenIndex).trimEnd()
}

export class ProfileGroup {
  // A reference to metadata passed into profiles, so inside arrays can be replaced or pushed into
  readonly metadata: InputFormat.Metadata = { frames: [] }
  readonly profiles: Profile[] = []
  indexToView: number = 0;

  constructor(public name: string,) {
  }

  updateMetadata(newMetadata: InputFormat.Metadata) {
    if (newMetadata.frames.length > 0) {
      if (this.metadata.frames.length == 0) {
        this.metadata.frames = newMetadata.frames;
      } else if (newMetadata.frames.length < this.metadata.frames.length) {
        // Frames cannot disappear, a new chunk has incremental frames
        this.metadata.frames.push(...newMetadata.frames)
      } else {
        if (getFrameFullName(newMetadata.frames[0]) == getFrameFullName(this.metadata.frames[0])) {
          // Replace frames with new ones, they are not incremental
          if (newMetadata.frames.length > this.metadata.frames.length)
            this.metadata.frames = newMetadata.frames;
        } else {
          this.metadata.frames.push(...newMetadata.frames)
        }
      }
    }

    // types are fixed and must be set at the start
    if (!this.metadata.frameTypes && newMetadata.frameTypes) {
      this.metadata.frameTypes = newMetadata.frameTypes;
    }
  }

  getOrCreateProfile(inputChunkProfile: InputFormat.IProfile): Profile {
    const {tid} = inputChunkProfile
    let profile = this.profiles.find(x => x.tid == tid)
    if (!profile) {
      profile = new Profile(tid, this.metadata)
      this.profiles.push(profile)
    }
    profile.name = normalizeProfileName(inputChunkProfile.name, tid)
    profile.setValueFormatter(createValueFormatter(inputChunkProfile.unit))
    return profile;
  }
}

export class HasWeights {
  private _selfWeight = 0;
  private _totalWeight = 0;
  private _baseSelfWeight?: number;
  private _baseTotalWeight?: number;

  get selfWeight() {
    return this._selfWeight;
  }

  get totalWeight() {
    return this._totalWeight;
  }

  get hasBaseWeights() {
    return this._baseSelfWeight !== undefined;
  }

  get baseSelfWeight() {
    return this._baseSelfWeight;
  }

  get baseTotalWeight() {
    return this._baseTotalWeight;
  }

  get selfWeightDelta() {
    return this._baseSelfWeight === undefined ? undefined : this._selfWeight - this._baseSelfWeight;
  }

  get totalWeightDelta() {
    return this._baseTotalWeight === undefined ? undefined : this._totalWeight - this._baseTotalWeight;
  }

  addToTotalWeight(delta: number) {
    this._totalWeight += delta;
  }
  addToSelfWeight(delta: number) {
    this._selfWeight += delta;
  }

  setBaseWeights(selfWeight: number, totalWeight: number) {
    this._baseSelfWeight = selfWeight;
    this._baseTotalWeight = totalWeight;
  }

  overwriteWeightWith(other: HasWeights) {
    this._selfWeight = other._selfWeight;
    this._totalWeight = other._totalWeight;
  }
}

export type FrameComparisonStatus = 'matched' | 'new' | 'out'

export class ProfileFrame extends HasWeights {
  static root = new ProfileFrame(0, { name: '(root)' }); // TODO Use NaN or anotehr invalid marker

  /**
   * Used as a marker to avoid weight increment for recursive frames.
   * Equals to Profile.sampleCount.
   */
  importVersion: number = 0;

  frameInfo: InputFormat.FrameInfo;

  comparisonStatus?: FrameComparisonStatus

  readonly groupedNodes: CallTreeNode[] = []

  public constructor(readonly key: number, info: InputFormat.FrameInfo) {
    super();
    this.frameInfo = info;
  }

  get name(): string {
    return this.frameInfo.name
  }

  getDisplayName(formatting: MetadataFormatting): string {
    const methodMetadata = this.frameInfo.methodMetadata
    return methodMetadata == null ? this.frameInfo.name : formatMethodMetadata(methodMetadata, formatting)
  }

  get file(): string {
    return this.frameInfo.file ?? '';
  }

  get line(): number | undefined {
    return this.frameInfo.line;
  }

  get col(): number | undefined {
    return this.frameInfo.col;
  }
}

export class CallTreeNode extends HasWeights {

  readonly children: CallTreeNode[] = [];
  private frozen = false;

  get isRoot() {
    return this.frame === ProfileFrame.root;
  }

  // If a node is "frozen", it means it should no longer be mutated.
  get isFrozen() {
    return this.frozen;
  }

  freeze() {
    this.frozen = true;
  }

  constructor(readonly frame: ProfileFrame, readonly parent: CallTreeNode | null) {
    super();
  }
}
