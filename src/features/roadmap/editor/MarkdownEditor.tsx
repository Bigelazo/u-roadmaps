import { useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { FileUp } from 'lucide-react';
import Prism from 'prismjs';
import 'prismjs/components/prism-markdown';
import { Textarea } from '@/shared/ui/textarea';
import { ConfirmationDialog } from '@/shared/ui/confirmation-dialog';
import { FieldError } from '@/shared/ui/field';
import { cn } from 'cn';
import { mayHoldSingleMarkdownFile, useMarkdownFileDrag } from './use-markdown-file-drag';

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
        <span key={index} className={`token token-${token.type}`}>
          {renderTokens(token.content)}
        </span>
      ),
    );
  }
  return renderTokens([content]);
}

function MarkdownDropTarget({ isFileOver }: { isFileOver: boolean }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 rounded-lg bg-card font-sans motion-safe:animate-in motion-safe:duration-150 motion-safe:fade-in"
    >
      <div
        className={cn(
          'flex size-full flex-col items-center justify-center rounded-lg border border-dashed px-4 py-5 text-center transition-colors',
          isFileOver ? 'border-primary bg-primary/10' : 'border-primary/40 bg-primary/5',
        )}
      >
        <div className="sticky inset-y-6 flex flex-col items-center">
          <FileUp className="mb-2 size-5 text-primary" />
          <span className="text-sm font-semibold">Suelta el archivo Markdown aquí</span>
          <span className="mt-1 text-xs text-muted-foreground">
            Reemplazará el texto actual, previa confirmación
          </span>
        </div>
      </div>
    </div>
  );
}

export function MarkdownEditor({
  value,
  onValueChange,
  className,
  disabled,
  readOnly,
  onDragOver,
  onDragLeave,
  onDrop,
  ...props
}: Props) {
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [isFileOver, setIsFileOver] = useState(false);
  const isMarkdownFileDragged = useMarkdownFileDrag(
    !disabled && !readOnly && !pendingFile && !isReading,
  );
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
            setIsFileOver(mayHoldSingleMarkdownFile(event.dataTransfer));
          }}
          onDragLeave={(event) => {
            onDragLeave?.(event);
            setIsFileOver(false);
          }}
          onDrop={(event) => {
            onDrop?.(event);
            setIsFileOver(false);
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
        {isMarkdownFileDragged ? <MarkdownDropTarget isFileOver={isFileOver} /> : null}
      </div>
      <FieldError>{importError}</FieldError>
      <ConfirmationDialog
        confirmation={
          pendingFile
            ? {
                title: '¿Reemplazar el texto con el archivo Markdown?',
                description: (
                  <>
                    Todo el texto actual se reemplazará por el contenido de{' '}
                    <span className="font-medium break-all text-foreground">
                      {pendingFile.name}
                    </span>
                    . El cambio quedará en el borrador hasta que lo guardes.
                  </>
                ),
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
