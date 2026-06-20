import type { ObjectFieldTemplateProps } from '@rjsf/utils';

export function ObjectFieldTemplate({ title, properties }: ObjectFieldTemplateProps) {
  // Root object has no title — render flat. Nested named objects get a left-accent indent.
  return (
    <div style={title ? {
      borderLeft: '2px solid #f0f0f0',
      paddingLeft: 14,
      marginTop: 2,
    } : undefined}>
      {properties.map((p) => p.content)}
    </div>
  );
}