import { useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-markdown';
import { Textarea } from '@/shared/ui/textarea';
import { ConfirmationDialog } from '@/shared/ui/confirmation-dialog';
import { FieldError } from '@/shared/ui/field';
import { cn } from 'cn';

type Props = Omit<
  ComponentProps<'textarea'>,
  'value' | 'defaultValue' | 'onChange' | 'children'
> & {
  value: string;
  onValueChange: (value: string) => void;
};

function renderTokens(content: string | Prism.Token | (string | Prism.Token)[]): ReactNode {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((token, index) =>
      typeof token === 'string' ? (
        token
      ) : (
        <span key={index} className={cn('token', token.type)}>
          {renderTokens(token.content)}
        </span>
      ),
    );
  }
  return renderTokens([content]);
}

export function MarkdownEditor({
  value,
  onValueChange,
  className,
  disabled,
  readOnly,
  onDragOver,
  onDrop,
  ...props
}: Props) {
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const readerRef = useRef<FileReader | null>(null);
  useEffect(() => () => readerRef.current?.abort(), []);
  const highlighted = useMemo(
    () => renderTokens(Prism.tokenize(value, Prism.languages.markdown)),
    [value],
  );

  function importFile() {
    if (!pendingFile || isReading || disabled || readOnly) return;
    const reader = new FileReader();
    readerRef.current = reader;
    setIsReading(true);
    reader.onload = () => {
      onValueChange(reader.result as string);
      setPendingFile(null);
      setIsReading(false);
    };
    reader.onerror = () => {
      setImportError('No se pudo leer el archivo. Intenta arrastrarlo nuevamente.');
      setPendingFile(null);
      setIsReading(false);
    };
    reader.readAsText(pendingFile);
  }

  return (
    <>
      <div className="markdown-editor">
        <pre aria-hidden="true">
          {highlighted}
          {'\n'}
        </pre>
        <Textarea
          {...props}
          disabled={disabled}
          readOnly={readOnly}
          className={cn('markdown-editor-input', className)}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          onDragOver={(event) => {
            onDragOver?.(event);
            if (event.defaultPrevented || !event.dataTransfer.types.includes('Files')) return;
            event.preventDefault();
            event.stopPropagation();
            event.dataTransfer.dropEffect = disabled || readOnly ? 'none' : 'copy';
          }}
          onDrop={(event) => {
            onDrop?.(event);
            if (event.defaultPrevented || !event.dataTransfer.types.includes('Files')) return;
            event.preventDefault();
            event.stopPropagation();
            if (disabled || readOnly || isReading) return;
            setImportError(null);
            const files = event.dataTransfer.files;
            if (files.length !== 1 || !/\.(md|markdown)$/i.test(files[0].name)) {
              setImportError('Arrastra un solo archivo Markdown (.md o .markdown).');
              return;
            }
            event.currentTarget.focus();
            setPendingFile(files[0]);
          }}
        />
      </div>
      <FieldError>{importError}</FieldError>
      <ConfirmationDialog
        confirmation={
          pendingFile
            ? {
                title: 'Reemplazar texto con Markdown',
                description: `Se reemplazará todo el texto actual por el contenido de «${pendingFile.name}». Los cambios quedarán en el borrador hasta que los guardes.`,
                intent: 'warning',
                actions: [{ id: 'replace', label: 'Reemplazar texto' }],
              }
            : null
        }
        pendingActionId={isReading ? 'replace' : undefined}
        onCancel={() => setPendingFile(null)}
        onAction={importFile}
      />
    </>
  );
}
