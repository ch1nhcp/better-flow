import { useEffect, useId, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Icon } from '../../app/Icon';
import { ApiError } from '../../lib/api';
import { exportRoadmap } from './api';
import type { RoadmapExportFormat } from './api';

interface RoadmapDownloadDialogProps {
  roadmapId: number | null;
  hasUnsavedChanges: boolean;
  onClose: () => void;
}

interface DownloadRequest {
  id: number;
  format: RoadmapExportFormat;
  signal: AbortSignal;
}

async function downloadFile({ id, format, signal }: DownloadRequest) {
  const { blob, filename } = await exportRoadmap(id, format, signal);
  signal.throwIfAborted();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function RoadmapDownloadDialog({
  roadmapId,
  hasUnsavedChanges,
  onClose,
}: RoadmapDownloadDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const requestRef = useRef<AbortController>(null);
  const titleId = useId();
  const notesId = useId();
  const download = useMutation({ mutationFn: downloadFile });
  const pendingFormat = download.isPending ? download.variables.format : null;
  const disableOptions = roadmapId === null || download.isPending;

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => {
      requestRef.current?.abort();
      dialog?.close();
    };
  }, []);

  function close() {
    requestRef.current?.abort();
    dialogRef.current?.close();
    onClose();
  }

  function selectFormat(format: RoadmapExportFormat) {
    if (roadmapId === null || requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    download.mutate(
      { id: roadmapId, format, signal: controller.signal },
      {
        onSettled: () => {
          requestRef.current = null;
        },
      },
    );
  }

  return (
    <dialog
      ref={dialogRef}
      className="editor-dialog editor-download-dialog"
      aria-labelledby={titleId}
      aria-describedby={notesId}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <header className="editor-download-heading">
        <h2 id={titleId}>Tải xuống</h2>
        <button type="button" className="editor-close-btn" aria-label="Đóng" onClick={close}>
          <Icon name="close" />
        </button>
      </header>

      <div className="editor-download-options">
        <button
          type="button"
          className="secondary-button editor-download-option"
          disabled={disableOptions}
          aria-busy={pendingFormat === 'png'}
          onClick={() => selectFormat('png')}
        >
          {pendingFormat === 'png' ? (
            <span className="editor-download-spinner" aria-hidden="true" />
          ) : (
            <Icon name="image" />
          )}
          Ảnh PNG
        </button>
        <button
          type="button"
          className="secondary-button editor-download-option"
          disabled={disableOptions}
          aria-busy={pendingFormat === 'markdown'}
          onClick={() => selectFormat('markdown')}
        >
          {pendingFormat === 'markdown' ? (
            <span className="editor-download-spinner" aria-hidden="true" />
          ) : (
            <Icon name="code" />
          )}
          Markdown (.md)
        </button>
      </div>

      <div className="editor-download-notes" id={notesId}>
        <p>
          <strong>PNG</strong> lưu toàn bộ sơ đồ, kể cả phần ngoài khung nhìn.
        </p>
        <p>
          <strong>Markdown</strong> giữ các bước và đường nối. Playground tự sắp xếp lại khi mở.
        </p>
        <p>Tên file theo tên roadmap.</p>
      </div>

      {roadmapId === null ? (
        <p className="editor-download-status">Lưu roadmap để tải xuống.</p>
      ) : hasUnsavedChanges ? (
        <p className="editor-download-status">File dùng bản roadmap đã lưu gần nhất.</p>
      ) : null}

      {pendingFormat && (
        <p className="editor-download-status" role="status">
          {pendingFormat === 'png' ? 'Đang chuẩn bị ảnh PNG…' : 'Đang chuẩn bị file Markdown…'}
        </p>
      )}
      {download.isSuccess && (
        <p className="editor-download-status" role="status">
          Đã bắt đầu tải file.
        </p>
      )}
      {download.isError && (
        <p className="editor-download-status error" role="alert">
          {download.error instanceof ApiError
            ? download.error.message
            : 'Không thể tải roadmap. Vui lòng thử lại.'}
        </p>
      )}
    </dialog>
  );
}
