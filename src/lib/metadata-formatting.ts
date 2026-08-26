import {InputFormat} from './input-format-spec'

export enum MetadataFormatting {
  FULL,
  ABBREVIATED,
  SHORT,
  MINIMAL,
}

export function getFrameFullName(frameInfo: InputFormat.FrameInfo): string {
  return `${frameInfo.file ?? ''}!${frameInfo.name}`
}

export function formatTypeMetadata(type: InputFormat.TypeMetadata, formatting: MetadataFormatting): string {
  if (formatting === MetadataFormatting.FULL) {
    return type.namespace ? `${type.namespace}.${type.name}` : type.name
  }

  if (formatting !== MetadataFormatting.ABBREVIATED || !type.namespace) {
    return type.name
  }

  return `${type.namespace.split('.').map(part => part[0]).join('')}.${type.name}`
}

export function formatParameterMetadata(parameter: InputFormat.ParameterMetadata, formatting: MetadataFormatting): string {
  const modifier =
    parameter.modifier === InputFormat.ParameterModifier.REF
      ? 'ref '
      : parameter.modifier === InputFormat.ParameterModifier.OUT
        ? 'out '
        : parameter.modifier === InputFormat.ParameterModifier.IN
          ? 'in '
          : ''
  return modifier + formatTypeMetadata(parameter.type, formatting)
}

export function formatMethodMetadata(method: InputFormat.MethodMetadata, formatting: MetadataFormatting): string {
  let formatted = formatting === MetadataFormatting.MINIMAL ? '' : `${formatTypeMetadata(method.declaringType, formatting)}.`
  formatted += method.name
  formatted += `(${method.parameters
    .map(parameter => formatParameterMetadata(parameter, formatting))
    .join(', ')})`

  if (formatting === MetadataFormatting.FULL && method.returnType != null) {
    formatted += ` : ${formatTypeMetadata(method.returnType, formatting)}`
  }

  return formatted
}
