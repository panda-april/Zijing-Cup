import React, { createContext, useReducer, useCallback, useRef, useEffect } from 'react';

const AlertContext = createContext(null);

function alertReducer(state, action) {
  switch (action.type) {
    case 'PUSH':
      return { ...state, queue: [...state.queue, action.item] };
    case 'SHIFT':
      return { ...state, queue: state.queue.slice(1), current: null };
    case 'SET_CURRENT':
      return { ...state, current: action.item };
    case 'CLOSE_CURRENT':
      return { ...state, current: null };
    default:
      return state;
  }
}

let alertIdCounter = 0;

function createAlertItem(type, message, defaultValue, resolve, reject) {
  return { id: ++alertIdCounter, type, message, defaultValue, resolve, reject };
}

export function AlertProvider({ children }) {
  const [state, dispatch] = useReducer(alertReducer, { queue: [], current: null });
  const processingRef = useRef(false);

  const processNext = useCallback(() => {
    processingRef.current = false;
    if (state.queue.length === 0) return;
    processingRef.current = true;
    const next = state.queue[0];
    dispatch({ type: 'SET_CURRENT', item: next });
  }, [state.queue.length]);

  useEffect(() => {
    if (!state.current && state.queue.length > 0 && !processingRef.current) {
      processNext();
    }
  }, [state.queue.length, state.current, processNext]);

  const makeShowFn = useCallback((type) => {
    return (message, defaultValue = '') => {
      return new Promise((resolve, reject) => {
        dispatch({
          type: 'PUSH',
          item: createAlertItem(
            type,
            message,
            defaultValue,
            (value) => {
              dispatch({ type: 'SHIFT' });
              resolve(value);
            },
            () => {
              dispatch({ type: 'SHIFT' });
              reject(new Error('cancelled'));
            }
          ),
        });
      });
    };
  }, []);

  const showAlert = useCallback((message) => {
    const fn = makeShowFn('alert');
    return fn(message).catch(() => {});
  }, [makeShowFn]);

  const showConfirm = useCallback((message) => {
    const fn = makeShowFn('confirm');
    return fn(message).then(
      () => true,
      () => false
    );
  }, [makeShowFn]);

  const showPrompt = useCallback((message, defaultValue) => {
    const fn = makeShowFn('prompt');
    return fn(message, defaultValue).then(
      (value) => value,
      () => null
    );
  }, [makeShowFn]);

  const handleConfirm = useCallback((value) => {
    if (state.current) {
      const { resolve } = state.current;
      dispatch({ type: 'CLOSE_CURRENT' });
      resolve(value);
    }
  }, [state.current]);

  const handleCancel = useCallback(() => {
    if (state.current) {
      const { reject } = state.current;
      dispatch({ type: 'CLOSE_CURRENT' });
      reject(new Error('cancelled'));
    }
  }, [state.current]);

  const value = {
    showAlert,
    showConfirm,
    showPrompt,
    current: state.current,
    handleConfirm,
    handleCancel,
  };

  return (
    <AlertContext.Provider value={value}>
      {children}
    </AlertContext.Provider>
  );
}

export default AlertContext;
