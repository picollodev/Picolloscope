// import { Profile } from "./profile"
// import { CallTreeNode, ProfileFrame } from "./types"

// export function getProfileWithRecursionFlattened(profile: Profile): Profile {
//   const builder = new CallTreeProfileBuilder()

//   const stack: (CallTreeNode | null)[] = []
//   const framesInStack = new Set<ProfileFrame>()

//   function openFrame(node: CallTreeNode, value: number) {
//     if (framesInStack.has(node.frame)) {
//       stack.push(null)
//     } else {
//       framesInStack.add(node.frame)
//       stack.push(node)
//       builder.enterFrame(node.frame, value)
//     }
//   }
//   function closeFrame(node: CallTreeNode, value: number) {
//     const stackTop = stack.pop()
//     if (stackTop) {
//       framesInStack.delete(stackTop.frame)
//       builder.leaveFrame(stackTop.frame, value)
//     }
//   }

//   profile.forEachCall(openFrame, closeFrame)

//   const flattenedProfile = builder.build()
//   flattenedProfile.name = profile.name
//   flattenedProfile.valueFormatter = profile.valueFormatter

//   // When constructing a profile with recursion flattened,
//   // counter-intuitive things can happen to "self time" measurements
//   // for functions.
//   // For example, given the following list of stacks w/ weights:
//   //
//   // a 1
//   // a;b;a 1
//   // a;b;a;b;a 1
//   // a;b;a 1
//   //
//   // The resulting profile with recursion flattened out will look like this:
//   //
//   // a 1
//   // a;b 3
//   //
//   // Which is useful to view, but it's counter-intuitive to move self-time
//   // for frames around, since analyzing the self-time of functions is an important
//   // thing to be able to do accurately, and we don't want this to change when recursion
//   // is flattened. To work around that, we'll just copy the weights directly from the
//   // un-flattened profile.
//   profile.forEachFrame(f => {
//     flattenedProfile.getOrAdd(f.frameInfo).overwriteWeightWith(f)
//   })

//   return flattenedProfile
// }

// export function getInvertedProfileForCallersOf(profile: Profile, frameInfo: FrameInfoWithKey): Profile {
//   const focalFrame = profile.getOrAdd(frameInfo)
//   const builder = new StackListProfileBuilder()

//   // TODO(jlfwong): Could construct this at profile
//   // construction time rather than on demand.
//   const nodes: CallTreeNode[] = []

//   function visit(node: CallTreeNode) {
//     if (node.frame === focalFrame) {
//       nodes.push(node)
//     } else {
//       for (let child of node.children) {
//         visit(child)
//       }
//     }
//   }

//   visit(profile.appendOrderCalltreeRoot)

//   for (let node of nodes) {
//     const stack: FrameInfoWithKey[] = []
//     for (let n: CallTreeNode | null = node; n != null && n.frame !== ProfileFrame.root; n = n.parent) {
//       stack.push(n.frame)
//     }
//     builder.appendSampleWithWeight(stack, node.totalWeight)
//   }

//   const ret = builder.build()
//   ret.name = profile.name
//   ret.valueFormatter = profile.valueFormatter
//   return ret
// }

// export function getProfileForCalleesOf(profile: Profile, frameInfo: FrameInfoWithKey): Profile {
//   const focalFrame = profile.getOrAdd(frameInfo)
//   const builder = new StackListProfileBuilder()

//   function recordSubtree(focalFrameNode: CallTreeNode) {
//     const stack: FrameInfoWithKey[] = []

//     function visit(node: CallTreeNode) {
//       stack.push(node.frame)
//       builder.appendSampleWithWeight(stack, node.selfWeight)
//       for (let child of node.children) {
//         visit(child)
//       }
//       stack.pop()
//     }

//     visit(focalFrameNode)
//   }

//   function findCalls(node: CallTreeNode) {
//     if (node.frame === focalFrame) {
//       recordSubtree(node)
//     } else {
//       for (let child of node.children) {
//         findCalls(child)
//       }
//     }
//   }

//   findCalls(profile.appendOrderCalltreeRoot)

//   const ret = builder.build()
//   ret.name = profile.name
//   ret.valueFormatter = profile.valueFormatter
//   return ret
// }
