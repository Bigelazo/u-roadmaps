import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { Annotation, Compartment, EditorState, Transaction } from '@codemirror/state';
import {
  EditorView,
  keymap,
  placeholder as placeholderText,
  type ViewUpdate,
} from '@codemirror/view';
import { GFM } from '@lezer/markdown';
import { FileUp } from 'lucide-react';
import { ConfirmationDialog } from '@/shared/ui/confirmation-dialog';
import { FieldError } from '@/shared/ui/field';
import { cn } from 'cn';
import { markdownIndentation } from './markdown-indentation';
import { markdownLivePreview } from './markdown-live-preview';
import { mayHoldSingleMarkdownFile, useMarkdownFileDrag } from './use-markdown-file-drag';

type Props = {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
};

const externalValue = Annotation.define<boolean>();

function withUnixLineBreaks(text: string) {
  return text.replace(/\r\n?/g, '\n');
}

function definedAttributes(attributes: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(attributes).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
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
  id,
  value,
  onValueChange,
  placeholder,
  disabled = false,
  readOnly = false,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
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
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [configuration] = useState(() => ({
    editability: new Compartment(),
    attributes: new Compartment(),
    placeholder: new Compartment(),
  }));

  const reportEdit = useEffectEvent((update: ViewUpdate) => {
    if (!update.docChanged) return;
    if (update.transactions.some((transaction) => transaction.annotation(externalValue))) return;
    onValueChange(update.state.doc.toString());
  });

  const followFileDrag = useEffectEvent((event: DragEvent) => {
    if (!event.dataTransfer?.types.includes('Files')) return false;
    event.stopPropagation();
    event.dataTransfer.dropEffect = disabled || readOnly ? 'none' : 'copy';
    setIsFileOver(mayHoldSingleMarkdownFile(event.dataTransfer));
    return true;
  });

  const receiveFileDrop = useEffectEvent((event: DragEvent, view: EditorView) => {
    setIsFileOver(false);
    if (!event.dataTransfer?.types.includes('Files')) return false;
    event.stopPropagation();
    if (disabled || readOnly || isReading) return true;
    setImportError(null);
    const files = event.dataTransfer.files;
    if (files.length !== 1 || !/\.(md|markdown)$/i.test(files[0].name)) {
      setImportError('Arrastra un solo archivo Markdown (.md o .markdown).');
      return true;
    }
    view.focus();
    setPendingFile(files[0]);
    return true;
  });

  useEffect(() => {
    if (!hostRef.current) return;
    const view = new EditorView({
      parent: hostRef.current,
      extensions: [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        markdown({ extensions: GFM }),
        markdownIndentation,
        markdownLivePreview,
        EditorView.lineWrapping,
        configuration.editability.of([]),
        configuration.attributes.of([]),
        configuration.placeholder.of([]),
        EditorView.updateListener.of((update) => reportEdit(update)),
        EditorView.domEventHandlers({
          dragover: (event) => followFileDrag(event),
          dragleave: () => setIsFileOver(false),
          drop: (event, target) => receiveFileDrop(event, target),
        }),
      ],
    });
    viewRef.current = view;
    return () => {
      viewRef.current = null;
      view.destroy();
    };
  }, [configuration]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const text = withUnixLineBreaks(value);
    if (text === view.state.doc.toString()) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: text },
      annotations: [externalValue.of(true), Transaction.addToHistory.of(false)],
    });
  }, [value]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: [
        configuration.editability.reconfigure([
          EditorState.readOnly.of(disabled || readOnly),
          EditorView.editable.of(!disabled),
        ]),
        configuration.attributes.reconfigure(
          EditorView.contentAttributes.of(
            definedAttributes({
              id,
              spellcheck: 'true',
              'aria-label': ariaLabel,
              'aria-labelledby': ariaLabelledBy,
              'aria-describedby': ariaDescribedBy,
              'aria-disabled': disabled ? 'true' : undefined,
              'aria-readonly': readOnly ? 'true' : undefined,
            }),
          ),
        ),
        configuration.placeholder.reconfigure(placeholder ? placeholderText(placeholder) : []),
      ],
    });
  }, [
    configuration,
    id,
    placeholder,
    disabled,
    readOnly,
    ariaLabel,
    ariaLabelledBy,
    ariaDescribedBy,
  ]);

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
      <div
        data-disabled={disabled ? true : undefined}
        className={cn(
          'markdown-editor rounded-lg border border-input transition-colors',
          'focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50',
          'data-disabled:cursor-not-allowed data-disabled:bg-input/50 data-disabled:opacity-50',
        )}
      >
        <div className="markdown-editor-surface">
          <div ref={hostRef} />
          {isMarkdownFileDragged ? <MarkdownDropTarget isFileOver={isFileOver} /> : null}
        </div>
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
