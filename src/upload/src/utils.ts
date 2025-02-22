import { isBrowser } from '../../_utils'
import type { FileAndEntry, ShouldUseThumbnailUrl } from './interface'
import type { UploadFileInfo, UploadSettledFileInfo } from './public-types'

export function isImageFileType(type: string): boolean {
  return type.includes('image/')
}

function getExtname(url: string = ''): string {
  const temp = url.split('/')
  const filename = temp[temp.length - 1]
  const filenameWithoutSuffix = filename.split(/#|\?/)[0]
  return (/\.[^./\\]*$/.exec(filenameWithoutSuffix) || [''])[0]
}

const imageExtensionRegex = /(webp|svg|png|gif|jpg|jpeg|jfif|bmp|dpg|ico)$/i

// Do not need File object
export const isImageFile: ShouldUseThumbnailUrl = (file) => {
  if (file.type) {
    return isImageFileType(file.type)
  }
  const fileNameExtension = getExtname(file.name || '')
  if (imageExtensionRegex.test(fileNameExtension)) {
    return true
  }
  const url: string = file.thumbnailUrl || file.url || ''
  const urlExtension = getExtname(url)
  if (/^data:image\//.test(url) || imageExtensionRegex.test(urlExtension)) {
    return true
  }
  return false
}

export async function createImageDataUrl(file: File): Promise<string> {
  return await new Promise((resolve) => {
    if (!file.type || !isImageFileType(file.type)) {
      resolve('')
      return
    }
    resolve(window.URL.createObjectURL(file))
  })
}

export const environmentSupportFile
  = isBrowser && window.FileReader && window.File

export function isFileSystemDirectoryEntry(
  item: FileSystemEntry | FileSystemFileEntry | FileSystemDirectoryEntry
): item is FileSystemDirectoryEntry {
  return item.isDirectory
}

export function isFileSystemFileEntry(
  item: FileSystemEntry | FileSystemFileEntry | FileSystemDirectoryEntry
): item is FileSystemFileEntry {
  return item.isFile
}

export async function getFilesFromEntries(
  entries: readonly FileSystemEntry[] | Array<FileSystemEntry | null>,
  directory: boolean
): Promise<FileAndEntry[]> {
  const fileAndEntries: FileAndEntry[] = []

  async function _getFilesFromEntries(
    entries: readonly FileSystemEntry[] | Array<FileSystemEntry | null>
  ): Promise<void> {
    for (const entry of entries) {
      if (!entry)
        continue
      if (directory && isFileSystemDirectoryEntry(entry)) {
        const directoryReader = entry.createReader()
        try {
          const entries = await new Promise<readonly FileSystemEntry[]>(
            (resolve, reject) => {
              directoryReader.readEntries(resolve, reject)
            }
          )
          await _getFilesFromEntries(entries)
        }
        catch {}
      }
      else if (isFileSystemFileEntry(entry)) {
        try {
          const file = await new Promise<File>((resolve, reject) => {
            entry.file(resolve, reject)
          })
          fileAndEntries.push({ file, entry, source: 'dnd' })
        }
        catch {}
      }
    }
  }

  await _getFilesFromEntries(entries)

  return fileAndEntries
}

export function createSettledFileInfo(
  fileInfo: UploadFileInfo
): UploadSettledFileInfo {
  const {
    id,
    name,
    percentage,
    status,
    url,
    file,
    thumbnailUrl,
    type,
    fullPath,
    batchId
  } = fileInfo
  return {
    id,
    name,
    percentage: percentage ?? null,
    status,
    url: url ?? null,
    file: file ?? null,
    thumbnailUrl: thumbnailUrl ?? null,
    type: type ?? null,
    fullPath: fullPath ?? null,
    batchId: batchId ?? null
  }
}

/**
 * This is a rather simple version. I may fix it later to make it more accurate.
 * I've looked at https://github.com/broofa/mime, however it doesn't has a esm
 * version, so I can't simply use it.
 */
export function matchType(
  name: string,
  mimeType: string,
  accept: string
): boolean {
  name = name.toLowerCase()
  mimeType = mimeType.toLocaleLowerCase()
  accept = accept.toLocaleLowerCase()
  const acceptAtoms = accept
    .split(',')
    .map(acceptAtom => acceptAtom.trim())
    .filter(Boolean)
  return acceptAtoms.some((acceptAtom) => {
    if (acceptAtom.startsWith('.')) {
      // suffix
      if (name.endsWith(acceptAtom))
        return true
    }
    else if (acceptAtom.includes('/')) {
      // mime type
      const [type, subtype] = mimeType.split('/')
      const [acceptType, acceptSubtype] = acceptAtom.split('/')
      if (acceptType === '*' || (type && acceptType && acceptType === type)) {
        if (
          acceptSubtype === '*'
          || (subtype && acceptSubtype && acceptSubtype === subtype)
        ) {
          return true
        }
      }
    }
    else {
      // invalid type
      return true
    }
    return false
  })
}
