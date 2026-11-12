import { useEffect, useId, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Icon } from '../app/Icon';
import { updateRoadmapShare } from '../features/roadmap-editor/api';
import type { RoadmapDetail, RoadmapShareStatus } from '../features/roadmap-editor/api';
import type { RoadmapItem } from '../features/workspace/api';
import { ApiError } from '../lib/api';
import './share-roadmap-dialog.css';

interface ShareRoadmapDialogProps {
  roadmapId: number | null;
  roadmapTitle: string;
  isPublic: boolean;
  shareCode: string | null;
  onShareUpdated?: (next: RoadmapShareStatus) => void;
  onClose: () => void;
}

export function ShareRoadmapDialog({
  roadmapId,
  roadmapTitle,
  isPublic,
  shareCode,
  onShareUpdated,
  onClose,
}: ShareRoadmapDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const copyTimerRef = useRef<number | null>(null);
  const titleId = useId();
  const toggleId = useId();
  const toggleDescId = useId();
  const linkInputId = useId();
  const queryClient = useQueryClient();

  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const shareMutation = useMutation({
    mutationFn: ({ id, nextPublic }: { id: number; nextPublic: boolean }) =>
      updateRoadmapShare(id, nextPublic),
    onMutate: () => {
      setErrorMessage('');
    },
    onSuccess: (next) => {
      queryClient.setQueriesData<RoadmapItem[]>({ queryKey: ['private', 'roadmaps'] }, (current) =>
        current?.map((item) =>
          item.id === next.id
            ? { ...item, shared: next.isPublic, shareCode: next.shareCode }
            : item,
        ),
      );
      queryClient.setQueriesData<RoadmapDetail>(
        { queryKey: ['private', 'roadmap', next.id] },
        (current) =>
          current ? { ...current, isPublic: next.isPublic, shareCode: next.shareCode } : current,
      );
      void queryClient.invalidateQueries({ queryKey: ['private', 'roadmaps'] });
      onShareUpdated?.(next);
    },
    onError: (error) => {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : 'Không thể cập nhật trạng thái chia sẻ. Vui lòng thử lại.',
      );
    },
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();

    const needsLightDismissFallback = !('closedBy' in HTMLDialogElement.prototype);
    let pressedOutside = false;

    const isOutside = (event: PointerEvent) => {
      const rect = dialog.getBoundingClientRect();
      return (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      );
    };

    const handlePointerDown = (event: PointerEvent) => {
      pressedOutside = isOutside(event);
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (pressedOutside && isOutside(event)) {
        dialog.close();
        onClose();
      }
      pressedOutside = false;
    };

    if (needsLightDismissFallback) {
      dialog.addEventListener('pointerdown', handlePointerDown);
      dialog.addEventListener('pointerup', handlePointerUp);
    }

    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      if (needsLightDismissFallback) {
        dialog.removeEventListener('pointerdown', handlePointerDown);
        dialog.removeEventListener('pointerup', handlePointerUp);
      }
      if (dialog.open) {
        dialog.close();
      }
    };
  }, [onClose]);

  const shareUrl =
    isPublic && shareCode && typeof window !== 'undefined'
      ? `${window.location.origin}/share/${shareCode}`
      : null;

  function closeDialog() {
    dialogRef.current?.close();
    onClose();
  }

  function handleToggle(nextPublic: boolean) {
    if (roadmapId === null || shareMutation.isPending) return;
    setCopied(false);
    shareMutation.mutate({ id: roadmapId, nextPublic });
  }

  async function handleCopy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setErrorMessage('');
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      setErrorMessage('Không thể sao chép tự động. Vui lòng thử lại.');
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="share-dialog"
      aria-labelledby={titleId}
      {...({ closedby: 'any' } as Record<string, string>)}
      onCancel={(event) => {
        event.preventDefault();
        closeDialog();
      }}
    >
      <header className="share-dialog-header">
        <div>
          <h2 id={titleId}>Chia sẻ roadmap</h2>
          <p className="share-dialog-subtitle">{roadmapTitle || 'Roadmap chưa đặt tên'}</p>
        </div>
        <button
          type="button"
          className="share-dialog-close"
          aria-label="Đóng"
          onClick={closeDialog}
        >
          <Icon name="close" />
        </button>
      </header>

      <div className="share-dialog-toggle-card">
        <div className="share-dialog-toggle-copy">
          <label htmlFor={toggleId}>Chia sẻ bằng liên kết</label>
          <p id={toggleDescId}>
            {roadmapId === null
              ? 'Hãy lưu roadmap trước khi bật chia sẻ liên kết.'
              : isPublic
                ? 'Bất kỳ ai có liên kết đều có thể xem.'
                : 'Chỉ mình bạn có thể xem roadmap này.'}
          </p>
        </div>
        <input
          id={toggleId}
          type="checkbox"
          className="share-toggle-input"
          checked={isPublic}
          disabled={roadmapId === null || shareMutation.isPending}
          aria-describedby={toggleDescId}
          {...({ switch: '' } as Record<string, string>)}
          onChange={(event) => handleToggle(event.currentTarget.checked)}
        />
      </div>

      <div className="share-dialog-link-section">
        <label className="share-dialog-link-label" htmlFor={linkInputId}>
          Liên kết chỉ xem
        </label>
        {shareUrl ? (
          <div className="share-dialog-link-row">
            <input
              id={linkInputId}
              type="text"
              className="share-dialog-link-input"
              value={shareUrl}
              readOnly
              onFocus={(event) => event.currentTarget.select()}
            />
            <button
              type="button"
              className="share-dialog-copy-inline"
              onClick={() => void handleCopy()}
            >
              <Icon name={copied ? 'check' : 'share'} />
              {copied ? 'Đã chép' : 'Sao chép'}
            </button>
          </div>
        ) : (
          <p id={linkInputId} className="share-dialog-empty-link">
            {shareCode === null
              ? 'Chưa có liên kết chia sẻ. Bật chia sẻ để tạo liên kết.'
              : 'Liên kết đang tắt. Bật chia sẻ để kích hoạt lại liên kết.'}
          </p>
        )}
      </div>

      {errorMessage && (
        <p className="share-dialog-status" role="alert">
          {errorMessage}
        </p>
      )}

      <footer className="share-dialog-footer">
        <button
          type="button"
          className="button"
          disabled={!shareUrl}
          onClick={() => void handleCopy()}
        >
          {copied ? 'Đã sao chép liên kết' : 'Sao chép liên kết'}
        </button>
        <button type="button" className="secondary-button" onClick={closeDialog}>
          Đóng
        </button>
      </footer>
    </dialog>
  );
}
