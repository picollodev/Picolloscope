import { lastOf } from '../utils'
import { ValueFormatter, RawValueFormatter } from '../value-formatters'
import { InputFormat } from '../input-format-spec'
import { ProfileFrame, CallTreeNode } from './types'
import { enableSampledTimeline } from '../features'

export class Profile {
  name: string = ''
  valueFormatter: ValueFormatter = new RawValueFormatter()

  // TODO This should be a projection from grouped tree
  totalWeight: number

  // Profiles store two call-trees.
  //
  // The "append order" call tree is the one in which nodes are ordered in
  // whatever order they were appended to their parent.
  //
  // The "grouped" call tree is one in which each node has at most one child per
  // frame. Nodes are ordered in decreasing order of weight
  readonly appendOrderCalltreeRoot = new CallTreeNode(ProfileFrame.root, null)
  readonly groupedCalltreeRoot = new CallTreeNode(ProfileFrame.root, null)

  // List of references to CallTreeNodes at the top of the
  // stack at the time of the sample.
  readonly samples: CallTreeNode[] = []
  readonly weights: number[] = []

  private framesMap = new Map<number, ProfileFrame>()
  private sampleCount: number = 0;

  constructor(
    readonly tid: string,
    readonly metadata: InputFormat.Metadata,
    totalWeight: number = 0) {
    this.totalWeight = totalWeight
  }

  get displayName(): string {
    return `${this.name} (TID: ${this.tid})`
  }

  getOrCreateProfileFrame(frameIdx: number) {
    const map = this.framesMap
    const existing = map.get(frameIdx)
    if (existing) return existing
    const newFrame = new ProfileFrame(frameIdx, this.metadata.frames[frameIdx])
    map.set(frameIdx, newFrame)
    return newFrame
  }

  shallowClone(): Profile {
    const profile = new Profile(this.tid, this.metadata, this.totalWeight)
    Object.assign(profile, this)
    return profile
  }

  formatValue(v: number) {
    return this.valueFormatter.format(v)
  }

  setValueFormatter(f: ValueFormatter) {
    this.valueFormatter = f
  }

  getWeightUnit(): InputFormat.ValueUnit {
    return this.valueFormatter.unit
  }

  getTotalWeight() {
    return this.totalWeight
  }

  private totalNonIdleWeight: number | null = null
  private baseTotalNonIdleWeight?: number

  get hasBaseProfile(): boolean {
    return this.baseTotalNonIdleWeight !== undefined
  }

  getBaseTotalNonIdleWeight(): number | undefined {
    return this.baseTotalNonIdleWeight
  }

  setBaseTotalNonIdleWeight(weight: number): void {
    this.baseTotalNonIdleWeight = weight
  }

  getTotalNonIdleWeight() {
    if (this.totalNonIdleWeight === null) {
      this.totalNonIdleWeight = this.groupedCalltreeRoot.children.reduce((n, c) => n + c.totalWeight, 0)
    }
    return this.totalNonIdleWeight
  }

  getWeightShareBasisPointDelta(weight: number, baseWeight: number): number {
    if (this.baseTotalNonIdleWeight === undefined) return 0

    const totalNonIdleWeight = this.getTotalNonIdleWeight()
    return (
      Math.round(
        10000 *
          ((totalNonIdleWeight === 0 ? 0 : weight / totalNonIdleWeight) -
            (this.baseTotalNonIdleWeight === 0 ? 0 : baseWeight / this.baseTotalNonIdleWeight)),
      ) || 0
    )
  }

  sortGroupedCallTree() {
    function visit(node: CallTreeNode) {
      node.children.sort((a, b) => -(a.totalWeight - b.totalWeight))
      node.children.forEach(visit)
    }
    visit(this.groupedCalltreeRoot)
  }

  forEachCallGrouped(openFrame: (node: CallTreeNode, value: number) => void, closeFrame: (node: CallTreeNode, value: number) => void) {
    function visit(node: CallTreeNode, start: number) {
      if (node.frame !== ProfileFrame.root) {
        openFrame(node, start)
      }

      let childTime = 0

      node.children.forEach(function (child) {
        visit(child, start + childTime)
        childTime += child.totalWeight
      })

      if (node.frame !== ProfileFrame.root) {
        closeFrame(node, start + node.totalWeight)
      }
    }
    visit(this.groupedCalltreeRoot, 0)
  }

  forEachCall(openFrame: (node: CallTreeNode, value: number) => void, closeFrame: (node: CallTreeNode, value: number) => void) {
    let prevStack: CallTreeNode[] = []
    let value = 0

    let sampleIndex = 0
    for (let stackTop of this.samples) {
      // Find lowest common ancestor of the current stack and the previous one
      let lca: CallTreeNode | null = null

      // This is O(n^2), but n should be relatively small here (stack height),
      // so hopefully this isn't much of a problem
      for (lca = stackTop; lca && lca.frame != ProfileFrame.root && prevStack.indexOf(lca) === -1; lca = lca.parent) { }

      // Close frames that are no longer open
      while (prevStack.length > 0 && lastOf(prevStack) != lca) {
        const node = prevStack.pop()!
        closeFrame(node, value)
      }

      // Open frames that are now becoming open
      const toOpen: CallTreeNode[] = []
      for (let node: CallTreeNode | null = stackTop; node && node.frame != ProfileFrame.root && node != lca; node = node.parent) {
        toOpen.push(node)
      }
      toOpen.reverse()

      for (let node of toOpen) {
        openFrame(node, value)
      }

      prevStack = prevStack.concat(toOpen)
      value += this.weights[sampleIndex++]
    }

    // Close frames that are open at the end of the trace
    for (let i = prevStack.length - 1; i >= 0; i--) {
      closeFrame(prevStack[i], value)
    }
  }

  forEachFrame(fn: (frame: ProfileFrame) => void) {
    this.framesMap.forEach(fn)
  }

  appendInputChunk(chunk: InputFormat.Profile, trimUnknownLeafs = false, trimUnknownRoots = false) {

    if (this.tid != chunk.tid)
      throw new Error(`Chunk TID ${chunk.tid} does not match profile TID ${this.tid}`)

    if (this.valueFormatter.unit != (chunk.unit ?? 'none'))
      throw new Error('Chunk unit does not match profile unit')

    if (chunk.startValue > chunk.endValue || chunk.startValue < 0)
      throw new Error('Chunk startValue/endValue are incorrect') // TODO better check

    switch (chunk.type) {
      case InputFormat.ProfileType.SAMPLED:
        this.appendSampledProfile(chunk, trimUnknownLeafs, trimUnknownRoots)
        break;
      case InputFormat.ProfileType.EVENTED:
        this.appendEventedProfile(chunk)
        break;
      default:
        throw new Error('Unknown Profile type');
    }

    this.totalNonIdleWeight = null;
    this.sortGroupedCallTree();
  }

  private insertOrderedSample(stack: InputFormat.SampledStack, start: number, endExclusive: number, weight: number) {
    let node = this.appendOrderCalltreeRoot;

    for (let i = start; i < endExclusive; i++) {
      const frameIdx = stack[i]
      const frame = this.getOrCreateProfileFrame(frameIdx);
      const last = lastOf(node.children);
      if (last && !last.isFrozen && last.frame == frame) {
        node = last;
      } else {
        const parent = node;
        node = new CallTreeNode(frame, node);
        parent.children.push(node);
      }
      node.addToTotalWeight(weight);
    }
    node.addToSelfWeight(weight);

    for (let child of node.children) {
      child.freeze();
    }

    if (node === lastOf(this.samples)) {
      this.weights[this.weights.length - 1] += weight;
    } else {
      this.samples.push(node);
      this.weights.push(weight);
    }
  }

  private insertGroupedSample(stack: InputFormat.SampledStack, start: number, endExclusive: number, weight: number) {
    let node = this.groupedCalltreeRoot;
    const sampleCount = ++this.sampleCount

    for (let i = start; i < endExclusive; i++) {
      const frameIdx = stack[i]
      const frame = this.getOrCreateProfileFrame(frameIdx);
      const existing = node.children.find(c => c.frame === frame);
      if (existing) {
        node = existing;
      } else {
        const parent = node;
        node = new CallTreeNode(frame, node);
        parent.children.push(node);
        frame.groupedNodes.push(node);
      }
      node.addToTotalWeight(weight);

      // Recursive stacks can contain the same frame more than once. Frame-level
      // totals count one sample once, while node totals keep call-path context.
      // Using generation markers (sampleCount vs importVersion) is 25-30% faster
      // than using a Set, as was done originally.
      if (frame.importVersion !== sampleCount) {
        frame.importVersion = sampleCount
        frame.addToTotalWeight(weight)
      }
    }

    node.frame.addToSelfWeight(weight);

    node.addToSelfWeight(weight);
  }

  private appendSampledProfile(
    sampledInputProfile: InputFormat.SampledProfile,
    trimUnknownLeafs: boolean,
    trimUnknownRoots: boolean,
  ) {
    let { samples, flatSamples, weights, startValue, endValue } = sampledInputProfile

    const trimUnknownFrames = trimUnknownLeafs || trimUnknownRoots
    const unknownFrameType = trimUnknownFrames ? this.metadata.frameTypes?.indexOf('unknown') ?? -1 : -1
    const managedFrameType = trimUnknownFrames ? this.metadata.frameTypes?.indexOf('managed') ?? -1 : -1

    const trimmedStart = (stack: InputFormat.SampledStack, start: number, endExclusive: number): number => {
      if (!trimUnknownRoots || unknownFrameType < 0 || managedFrameType < 0 || endExclusive <= start) return start
      if (this.metadata.frames[stack[start]].type !== unknownFrameType) return start

      for (let i = start + 1; i < endExclusive; i++) {
        if (this.metadata.frames[stack[i]].type === managedFrameType) return i
      }
      return start
    }

    const trimmedEnd = (stack: InputFormat.SampledStack, start: number, endExclusive: number): number => {
      if (!trimUnknownLeafs || unknownFrameType < 0 || managedFrameType < 0 || endExclusive <= start) return endExclusive
      if (this.metadata.frames[stack[endExclusive - 1]].type !== unknownFrameType) return endExclusive

      for (let i = endExclusive - 2; i >= start; i--) {
        if (this.metadata.frames[stack[i]].type === managedFrameType) return i + 1
      }
      return endExclusive
    }

    if ((samples == null) === (flatSamples == null))
      throw new Error('Expected exactly one of samples and flatSamples')

    const sampleLength = samples?.length ?? flatSamples!.ends.length

    let sharedWeight: number | null = null;

    if (weights == null || weights.length <= 1) {
      sharedWeight = weights?.length === 1 ? weights[0] : 1;
      weights = [];
    }

    if (sharedWeight == null && sampleLength !== weights.length)
      throw new Error(`Expected weights.length (${weights.length}) to equal samples.length (${sampleLength})`)

    if (samples != null) {
      for (let i = 0; i < samples.length; i++) {
        const stack = samples[i]
        const weight = sharedWeight ?? weights[i]

        if (!(weight > 0)) // Inludes NaN check
          continue; // Samples with invalid weight have no effect, ignore them

        const start = trimmedStart(stack, 0, stack.length)
        const endExclusive = trimmedEnd(stack, 0, stack.length)

        if (enableSampledTimeline)
          this.insertOrderedSample(stack, start, endExclusive, weight);

        this.insertGroupedSample(stack, start, endExclusive, weight);
      }
    } else {
      const { stacks, ends } = flatSamples!
      let start = 0
      let sampleIndex = 0

      for (const endExclusive of ends) {
        const weight = sharedWeight ?? weights[sampleIndex++]

        if (!(weight > 0)) { // Inludes NaN check
          start = endExclusive
          continue; // Samples with invalid weight have no effect, ignore them
        }

        const trimmedStartIndex = trimmedStart(stacks, start, endExclusive)
        const trimmedEndExclusive = trimmedEnd(stacks, start, endExclusive)

        if (enableSampledTimeline)
          this.insertOrderedSample(stacks, trimmedStartIndex, trimmedEndExclusive, weight);

        this.insertGroupedSample(stacks, trimmedStartIndex, trimmedEndExclusive, weight);
        start = endExclusive
      }
    }

    const groupedTotalWeight = this.groupedCalltreeRoot.children.reduce((total, child) => total + child.totalWeight, 0)
    this.totalWeight = Math.max(this.totalWeight + endValue - startValue, groupedTotalWeight);
  }

  private appendEventedProfile(chunk: InputFormat.EventedProfile) {

    const appendOrderStack: CallTreeNode[] = [this.appendOrderCalltreeRoot];
    const groupedOrderStack: CallTreeNode[] = [this.groupedCalltreeRoot];
    const framesInStack = new Map<ProfileFrame, number>();
    const stack: ProfileFrame[] = [];
    let lastValue: number = 0;

    const addWeightsToFrames = (value: number) => {
      const delta = value - lastValue;
      for (let frame of framesInStack.keys()) {
        frame.addToTotalWeight(delta);
      }
      const stackTop = lastOf(stack);
      if (stackTop) {
        stackTop.addToSelfWeight(delta);
      }
    }

    const addWeightsToNodes = (value: number, stack: CallTreeNode[]) => {
      const delta = value - lastValue;
      for (let node of stack) {
        node.addToTotalWeight(delta);
      }
      const stackTop = lastOf(stack);
      if (stackTop) {
        stackTop.addToSelfWeight(delta);
      }
    }

    const enterFrame = (frameIdx: number, value: number) => {
      const pushOrderedFrame = (frame: ProfileFrame, value: number) => {
        addWeightsToNodes(value, appendOrderStack);

        const prevTop = lastOf(appendOrderStack);
        if (prevTop) {
          const delta = value - lastValue;
          if (delta > 0) {
            this.samples.push(prevTop);
            this.weights.push(value - lastValue);
          } else if (delta < 0) {
            throw new Error(
              `Samples must be provided in increasing order of cumulative value. Last sample was ${lastValue}, this sample was ${value}`
            );
          }

          const last = lastOf(prevTop.children);
          let node: CallTreeNode;
          if (last && !last.isFrozen && last.frame == frame) {
            node = last;
          } else {
            node = new CallTreeNode(frame, prevTop);
            prevTop.children.push(node);
          }
          appendOrderStack.push(node);
        }
      }

      const pushGroupedFrame = (frame: ProfileFrame, value: number) => {
        addWeightsToNodes(value, groupedOrderStack);

        const prevTop = lastOf(groupedOrderStack);
        if (prevTop) {
          const existing = prevTop.children.find(c => c.frame === frame);
          let node: CallTreeNode;
          if (existing) {
            node = existing;
          } else {
            node = new CallTreeNode(frame, prevTop);
            prevTop.children.push(node);
            frame.groupedNodes.push(node);
          }
          groupedOrderStack.push(node);
        }
      }

      const frame = this.getOrCreateProfileFrame(frameIdx);
      addWeightsToFrames(value);
      pushOrderedFrame(frame, value);
      pushGroupedFrame(frame, value);

      stack.push(frame);
      const frameCount = framesInStack.get(frame) || 0;
      framesInStack.set(frame, frameCount + 1);
      lastValue = value;
      this.totalWeight = Math.max(this.totalWeight, lastValue);
    }

    const leaveFrame = (frameIdx: number, value: number) => {
      const popOrderedFrame = (frame: ProfileFrame, value: number) => {
        addWeightsToNodes(value, appendOrderStack);

        const leavingStackTop = appendOrderStack.pop();
        if (leavingStackTop == null) {
          throw new Error(`Trying to leave ${frame.key} when stack is empty`);
        }
        if (lastValue == null)
          throw new Error(`Trying to leave a ${frame.key} before any have been entered`);

        leavingStackTop.freeze();

        if (leavingStackTop.frame.key !== frame.key) {
          throw new Error(`Tried to leave frame "${frame.name}" while frame "${leavingStackTop.frame.name}" was at the top at ${value}`);
        }

        const delta = value - lastValue;
        if (delta > 0) {
          this.samples.push(leavingStackTop);
          this.weights.push(value - lastValue);
        } else if (delta < 0) {
          throw new Error(
            `Samples must be provided in increasing order of cumulative value. Last sample was ${lastValue!}, this sample was ${value}`
          );
        }
      }

      const popGroupedFrame = (value: number) => {
        addWeightsToNodes(value, groupedOrderStack);
        groupedOrderStack.pop();
      }

      const frame = this.getOrCreateProfileFrame(frameIdx);
      addWeightsToFrames(value);

      popOrderedFrame(frame, value);
      popGroupedFrame(value);

      stack.pop();
      const frameCount = framesInStack.get(frame);
      if (frameCount == null) return;
      if (frameCount === 1) {
        framesInStack.delete(frame);
      } else {
        framesInStack.set(frame, frameCount - 1);
      }
      lastValue = value;

      this.totalWeight = Math.max(this.totalWeight, lastValue);
    }

    const { startValue, events } = chunk
    for (let ev of events) {
      switch (ev.type) {
        case InputFormat.EventType.OPEN_FRAME: {
          enterFrame(ev.frame, ev.at - startValue)
          break
        }
        case InputFormat.EventType.CLOSE_FRAME: {
          leaveFrame(ev.frame, ev.at - startValue)
          break
        }
      }
    }

    if (appendOrderStack.length > 1 || groupedOrderStack.length > 1) {
      throw new Error('Tried to complete profile construction with a non-empty stack');
    }
  }


  getProfileWithRecursionFlattened(): Profile {
    // TODO Decide what to do with runtime recursion switch. Disable temporarily
    return this.shallowClone();

    // const profile = new Profile(this.tid, this.metadata)
    // profile.name = this.name;
    // profile.valueFormatter = this.valueFormatter;

    // const stack: (CallTreeNode | null)[] = []
    // const framesInStack = new Set<ProfileFrame>()

    // function openFrame(node: CallTreeNode, value: number) {
    //   if (framesInStack.has(node.frame)) {
    //     stack.push(null)
    //   } else {
    //     framesInStack.add(node.frame)
    //     stack.push(node)
    //     profile.enterFrame(node.frame, value)
    //   }
    // }
    // function closeFrame(node: CallTreeNode, value: number) {
    //   const stackTop = stack.pop()
    //   if (stackTop) {
    //     framesInStack.delete(stackTop.frame)
    //     builder.leaveFrame(stackTop.frame, value)
    //   }
    // }

    // profile.forEachCall(openFrame, closeFrame)

    // // When constructing a profile with recursion flattened,
    // // counter-intuitive things can happen to "self time" measurements
    // // for functions.
    // // For example, given the following list of stacks w/ weights:
    // //
    // // a 1
    // // a;b;a 1
    // // a;b;a;b;a 1
    // // a;b;a 1
    // //
    // // The resulting profile with recursion flattened out will look like this:
    // //
    // // a 1
    // // a;b 3
    // //
    // // Which is useful to view, but it's counter-intuitive to move self-time
    // // for frames around, since analyzing the self-time of functions is an important
    // // thing to be able to do accurately, and we don't want this to change when recursion
    // // is flattened. To work around that, we'll just copy the weights directly from the
    // // un-flattened profile.
    // this.forEachFrame(f => {
    //   profile.getOrAdd(f.frameInfo).overwriteWeightWith(f)
    // })

    // return profile
  }

  getInvertedProfileForCallersOf(focalFrame: ProfileFrame): Profile {

    const profile = new Profile(this.tid, this.metadata)
    profile.name = this.name;
    profile.valueFormatter = this.valueFormatter;

    for (let node of focalFrame.groupedNodes) {
      const stack: InputFormat.SampledStack = []
      for (let n: CallTreeNode | null = node; n != null && n.frame !== ProfileFrame.root; n = n.parent) {
        stack.push(n.frame.key)
      }
      profile.insertGroupedSample(stack, 0, stack.length, node.totalWeight)
    }

    profile.sortGroupedCallTree();

    return profile
  }

  getProfileForCalleesOf(focalFrame: ProfileFrame): Profile {

    const profile = new Profile(this.tid, this.metadata)
    profile.name = this.name;
    profile.valueFormatter = this.valueFormatter;

    function recordSubtree(focalFrameNode: CallTreeNode) {
      const stack: InputFormat.SampledStack = []

      function visit(node: CallTreeNode) {
        stack.push(node.frame.key)
        profile.insertGroupedSample(stack, 0, stack.length, node.selfWeight)
        for (let child of node.children) {
          visit(child)
        }
        stack.pop()
      }

      visit(focalFrameNode)
    }

    for (let node of focalFrame.groupedNodes) {
      recordSubtree(node)
    }

    profile.sortGroupedCallTree();

    return profile;
  }
}
