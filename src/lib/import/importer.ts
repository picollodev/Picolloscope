import { readObjectsFromFile, readObjectsFromUrl } from './reader'
import { InputFormat } from '../input-format-spec'
import {Profile, ProfileFrame, ProfileGroup} from '../profile'
import {getFrameFullName} from '../metadata-formatting'

export interface ImportOptions {
  trimUnknownLeafs?: boolean
  trimUnknownRoots?: boolean
}

export async function importProfilesFromFile(file: File, options: ImportOptions = {}): Promise<ProfileGroup | null> {
  return importProfilesFromChunks(readObjectsFromFile(file), file.name, options);
}

export async function importProfilesFromUrl(
  url: string,
  baseProfileURL?: string,
  options: ImportOptions = {},
): Promise<ProfileGroup | null> {
  let fileName = new URL(url, window.location.href).pathname
  if (fileName.includes('/')) {
    fileName = fileName.slice(fileName.lastIndexOf('/') + 1)
  }

  const profileGroup = await importProfilesFromChunks(readObjectsFromUrl(url), fileName, options)
  if (!baseProfileURL || profileGroup == null) return profileGroup

  const baseProfileGroup = await importProfilesFromUrl(baseProfileURL, undefined, options)
  if (baseProfileGroup == null || baseProfileGroup.profiles.length === 0) {
    throw new Error(`Base profile URL did not contain any profiles: ${baseProfileURL}`)
  }

  attachMatchingBaseProfiles(profileGroup, baseProfileGroup)
  return profileGroup
}

function attachMatchingBaseProfiles(profileGroup: ProfileGroup, baseProfileGroup: ProfileGroup): void {
  const profilesByName = new Map<string, Profile[]>()
  const baseProfilesByName = new Map<string, Profile[]>()
  const frameIndexByJoinKey = new Map<string, number>()

  for (let frameIndex = 0; frameIndex < profileGroup.metadata.frames.length; frameIndex++) {
    const frameInfo = profileGroup.metadata.frames[frameIndex]
    const frameJoinKey = getFrameFullName(frameInfo)
    frameIndexByJoinKey.set(frameJoinKey, frameIndex)
  }

  for (const profile of profileGroup.profiles) {
    const matches = profilesByName.get(profile.name)
    if (matches) matches.push(profile)
    else profilesByName.set(profile.name, [profile])
  }

  for (const profile of baseProfileGroup.profiles) {
    const matches = baseProfilesByName.get(profile.name)
    if (matches) matches.push(profile)
    else baseProfilesByName.set(profile.name, [profile])
  }

  for (const [name, profiles] of profilesByName) {
    const baseProfiles = baseProfilesByName.get(name)
    if (profiles.length === 1 && baseProfiles?.length === 1) {
      attachBaseProfile(profiles[0], baseProfiles[0], frameIndexByJoinKey)
      console.log(`Attached base profile "${baseProfiles[0].displayName}" to profile "${profiles[0].displayName}"`)
    }
  }
}

function attachBaseProfile(profile: Profile, baseProfile: Profile, frameIndexByJoinKey: Map<string, number>): void {
  if (profile.getWeightUnit() !== baseProfile.getWeightUnit()) {
    throw new Error(
      `Cannot compare profile "${profile.name}" with base profile using different weight unit: ` +
        `${profile.getWeightUnit()} !== ${baseProfile.getWeightUnit()}`,
    )
  }

  profile.setBaseTotalNonIdleWeight(baseProfile.getTotalNonIdleWeight())
  const currentFrameJoinKeys = new Set<string>()
  profile.forEachFrame(frame => {
    currentFrameJoinKeys.add(getFrameFullName(frame.frameInfo))
    frame.setBaseWeights(0, 0)
    frame.comparisonStatus = 'new'
  })

  const baseFramesByJoinKey = new Map<string, ProfileFrame>()
  baseProfile.forEachFrame(baseFrame => {
    const frameJoinKey = getFrameFullName(baseFrame.frameInfo)
    baseFramesByJoinKey.set(frameJoinKey, baseFrame)
  })

  for (const [frameJoinKey, baseFrame] of baseFramesByJoinKey) {
    let frameIndex = frameIndexByJoinKey.get(frameJoinKey)
    if (frameIndex === undefined) {
      frameIndex = profile.metadata.frames.length
      profile.metadata.frames.push({...baseFrame.frameInfo})
      frameIndexByJoinKey.set(frameJoinKey, frameIndex)
    }

    const frame = profile.getOrCreateProfileFrame(frameIndex)
    frame.setBaseWeights(baseFrame.selfWeight, baseFrame.totalWeight)
    frame.comparisonStatus = currentFrameJoinKeys.has(frameJoinKey) ? 'matched' : 'out'
  }
}

async function importProfilesFromChunks(
  chunks: AsyncIterable<InputFormat.InputChunk>,
  fileName: string | null = null,
  options: ImportOptions = {},
): Promise<ProfileGroup | null> {
  let profileGroup: ProfileGroup | null = null;

  for await (const chunk of chunks) {

    if (profileGroup == null) {
      profileGroup = new ProfileGroup(chunk.name ?? fileName ?? 'Profile')
    }

    profileGroup.indexToView = chunk.activeProfileIndex ?? profileGroup.indexToView;
    profileGroup.updateMetadata(chunk.metadata);

    for (const inputProfile of chunk.profiles) {
      var profile = profileGroup.getOrCreateProfile(inputProfile);
      profile.appendInputChunk(inputProfile, options.trimUnknownLeafs, options.trimUnknownRoots)
    }
    // TODO Report progress
  }

  return profileGroup;
}
