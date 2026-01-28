/**
 * useUndoableDelete Tests
 *
 * Validates undo behavior and commit timing.
 */

jest.mock(
  'react-native-toast-message',
  () => ({
    __esModule: true,
    default: {
      show: jest.fn(),
      hide: jest.fn(),
    },
  }),
  { virtual: true }
);

import { renderHook, act } from '@/test/utils/render';
import { useUndoableDelete } from '../useUndoableDelete';

describe('useUndoableDelete', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('undoes a pending deletion', () => {
    const onRestore = jest.fn();
    const onConfirm = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useUndoableDelete<{ id: string }>((item) => item.id, { onRestore, duration: 5000 })
    );

    act(() => {
      result.current.queueDeletion({ id: 'item-1' }, onConfirm, 'Item 1');
    });

    act(() => {
      result.current.undoDeletion('item-1');
    });

    expect(onRestore).toHaveBeenCalledWith({ id: 'item-1' });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('commits deletion after timeout', async () => {
    const onCommit = jest.fn();
    const onConfirm = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useUndoableDelete<{ id: string }>((item) => item.id, { onCommit, duration: 3000 })
    );

    act(() => {
      result.current.queueDeletion({ id: 'item-2' }, onConfirm, 'Item 2');
    });

    await act(async () => {
      jest.advanceTimersByTime(3000);
    });

    expect(onConfirm).toHaveBeenCalled();
    expect(onCommit).toHaveBeenCalledWith({ id: 'item-2' });
  });
});
