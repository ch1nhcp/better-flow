import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Icon } from '../../app/Icon';
import type { CreateRoadmapRequest } from '../roadmap-editor/api';
import {
  maxRoadmapTitleLength,
  roadmapPayloadTooLarge,
  validateRoadmapTitle,
} from '../roadmap-editor/validation';

interface SaveRoadmapDialogProps {
  roadmap: CreateRoadmapRequest;
  isSaving: boolean;
  saveError: string | null;
  onClose: () => void;
  onSave: (roadmap: CreateRoadmapRequest) => void;
}

export function SaveRoadmapDialog({
  roadmap,
  isSaving,
  saveError,
  onClose,
  onSave,
}: SaveRoadmapDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const inputId = useId();
  const errorId = useId();
  const descriptionId = useId();
  const [title, setTitle] = useState(roadmap.title);
  const [titleError, setTitleError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    inputRef.current?.focus();
    return () => dialog?.close();
  }, []);

  function close() {
    if (isSaving) return;
    dialogRef.current?.close();
    onClose();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;

    const payload = { ...roadmap, title: title.trim() };
    const error =
      validateRoadmapTitle(title) ??
      (roadmapPayloadTooLarge(payload) ? 'Dữ liệu lưu roadmap vượt quá giới hạn 1 MiB.' : null);
    if (error) {
      setTitleError(error);
      inputRef.current?.focus();
      return;
    }
    onSave(payload);
  }

  return (
    <dialog
      className="playground-save-dialog"
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <form className="playground-save-form" onSubmit={submit} noValidate>
        <header className="playground-save-heading">
          <div>
            <h2 id={titleId}>Lưu thành Roadmap</h2>
            <p id={descriptionId}>Chuyển sơ đồ từ Markdown vào danh sách lộ trình của bạn.</p>
          </div>
          <button type="button" aria-label="Đóng" disabled={isSaving} onClick={close}>
            <Icon name="close" />
          </button>
        </header>
        <div className="playground-save-field">
          <div className="playground-save-label">
            <label htmlFor={inputId}>
              Tên roadmap <span aria-hidden="true">*</span>
            </label>
            <span>
              {[...title].length} / {maxRoadmapTitleLength}
            </span>
          </div>
          <input
            id={inputId}
            ref={inputRef}
            value={title}
            required
            readOnly={isSaving}
            aria-invalid={Boolean(titleError)}
            aria-describedby={titleError ? errorId : undefined}
            onChange={(event) => {
              setTitle(event.currentTarget.value);
              setTitleError(null);
            }}
          />
          {titleError && (
            <p className="playground-save-error" id={errorId} role="alert">
              {titleError}
            </p>
          )}
        </div>
        <p className="playground-save-summary">
          Bao gồm <strong>{roadmap.nodes.length} bước</strong> và{' '}
          <strong>{roadmap.edges.length} liên kết</strong> đã được tự động sắp xếp.
        </p>
        {saveError && !titleError && (
          <p className="playground-save-error" role="alert">
            {saveError}
          </p>
        )}
        <footer className="playground-save-actions">
          <button className="secondary-button" type="button" disabled={isSaving} onClick={close}>
            Hủy
          </button>
          <button className="button" type="submit" disabled={isSaving}>
            {isSaving ? 'Đang lưu…' : 'Lưu và mở Canvas'}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
