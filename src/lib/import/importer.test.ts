import * as fs from 'fs'
import {File} from 'buffer'
import { importProfilesFromFile } from '.'
import { ProfileGroup } from '../profile'

export async function importProfilesFromFilePath(filepath: string): Promise<ProfileGroup | null> {
  const buffer = fs.readFileSync(filepath)
  const file = new File([buffer], filepath)
  return await importProfilesFromFile(file as any);
}

export async function expectImportFailure(filepath: string) {
  try {
    await importProfilesFromFilePath(filepath)
    fail('Expected import to fail but it succeeded')
  } catch (error) {
    expect((error as Error).message).toContain('Tried to')
  }
}

describe('importSpeedscopeProfiles', () => {

  test('invalid due to out of order events', async () => {
    // See: https://github.com/jlfwong/speedscope/issues/272
    await expectImportFailure('./sample/profiles/speedscope/invalid/out-of-order-events.json')
  })

  test('invalid due to incomplete trace', async () => {
    await expectImportFailure('./sample/profiles/speedscope/invalid/incomplete-trace.json')
  })
})
