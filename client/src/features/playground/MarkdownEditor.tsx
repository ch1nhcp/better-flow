import { useRef } from 'react';
import type { UIEvent } from 'react';
import { Icon } from '../../app/Icon';
import { markdownLineKind } from './markdown';
import type { PlaygroundIssue } from './markdown';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  issues: PlaygroundIssue[];
  isSample: boolean;
  readOnly: boolean;
}

export function MarkdownEditor({
  value,
  onChange,
  issues,
  isSample,
  readOnly,
}: MarkdownEditorProps) {
  const gutter = useRef<HTMLPreElement>(null);
  const highlighting = useRef<HTMLPreElement>(null);
  const lines = value.split('\n');
  const errorLines = new Set(issues.map(({ line }) => line));

  function syncScroll(event: UIEvent<HTMLTextAreaElement>) {
    const { scrollTop, scrollLeft } = event.currentTarget;
    if (gutter.current) gutter.current.scrollTop = scrollTop;
    if (highlighting.current) {
      highlighting.current.scrollTop = scrollTop;
      highlighting.current.scrollLeft = scrollLeft;
    }
  }

  return (
    <section className="playground-panel" aria-labelledby="playground-markdown-label">
      <div className="playground-panel-bar">
        <h2 id="playground-markdown-label">Markdown</h2>
        <div className="playground-editor-meta">
          {isSample && <span>Ví dụ mẫu</span>}
          <details className="playground-syntax">
            <summary>
              <Icon name="book" /> Hướng dẫn cú pháp
            </summary>
            <div>
              <dl>
                <dt>
                  <code># Tiêu đề</code>
                </dt>
                <dd>Đặt tên cho roadmap.</dd>
                <dt>
                  <code>## [html] HTML</code>
                </dt>
                <dd>Khai báo node. Thêm mô tả ở dòng nội dung kế tiếp.</dd>
                <dt>
                  <code>html -&gt; css</code>
                </dt>
                <dd>
                  Nối hai node theo ID. Có thể thêm <code>[animated]</code> hoặc{' '}
                  <code>[type=default]</code>.
                </dd>
              </dl>
            </div>
          </details>
        </div>
      </div>
      <div className="playground-editor">
        <pre className="playground-gutter" ref={gutter} aria-hidden="true">
          {lines.map((_, index) => (
            <span
              key={index}
              className={errorLines.has(index + 1) ? 'playground-line-error' : undefined}
            >
              {String(index + 1).padStart(2, '0')}
            </span>
          ))}
        </pre>
        <div className="playground-editor-field">
          <pre className="playground-highlight" ref={highlighting} aria-hidden="true">
            {lines.map((line, index) => (
              <span key={index} data-kind={markdownLineKind(line)}>
                {line || '\u00a0'}
              </span>
            ))}
          </pre>
          <textarea
            aria-labelledby="playground-markdown-label"
            aria-invalid={issues.length > 0}
            aria-describedby={issues.length ? 'playground-errors' : undefined}
            className="playground-textarea"
            value={value}
            readOnly={readOnly}
            onChange={(event) => onChange(event.currentTarget.value)}
            onScroll={syncScroll}
            wrap="off"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
        </div>
      </div>
      {issues.length > 0 && (
        <ul className="playground-errors" id="playground-errors" aria-live="polite">
          {issues.map(({ line, column, code, message }) => (
            <li key={`${line}:${column}:${code}`}>
              Dòng {line}, cột {column} · {message}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
