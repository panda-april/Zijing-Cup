import React, { useState, useEffect } from 'react';
import { useAlerts } from '../hooks/useAlerts';

export default function CustomAlert() {
  const { current, handleConfirm, handleCancel } = useAlerts();
  const [visible, setVisible] = useState(false);
  const [promptValue, setPromptValue] = useState('');

  useEffect(() => {
    if (current) {
      setPromptValue(current.defaultValue || '');
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [current]);

  if (!current) return null;

  const type = current.type;

  const onConfirm = () => {
    setVisible(false);
    setTimeout(() => {
      if (type === 'prompt') {
        handleConfirm(promptValue);
      } else {
        handleConfirm(undefined);
      }
    }, 150);
  };

  const onCancel = () => {
    setVisible(false);
    setTimeout(() => handleCancel(), 150);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/90 backdrop-blur-sm animate-fade-in">
      <div className="bg-white border-2 border-black w-full max-w-md p-8 shadow-[8px_8px_0_0_#000] relative animate-slide-in">
        <div className="mb-6">
          <div className="w-12 h-12 bg-yellow-400 border-2 border-black flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
              <path strokeLinecap="square" d="M12 9v4m0 4h.01"></path>
              <circle cx="12" cy="12" r="9" stroke="currentColor"></circle>
            </svg>
          </div>
          <h3 className="text-xl font-black text-center tracking-tight">
            {type === 'alert' ? 'Message' : type === 'confirm' ? 'Confirmation' : 'Input Required'}
          </h3>
        </div>

        <div className="mb-6">
          <p className="text-sm font-bold text-gray-700 whitespace-pre-line text-center">
            {current.message}
          </p>
        </div>

        {type === 'prompt' && (
          <div className="mb-6">
            <input
              type="text"
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              className="w-full border-2 border-black px-4 py-3 text-sm font-bold outline-none focus:border-yellow-400 transition-colors"
              autoFocus
            />
          </div>
        )}

        <div className="flex flex-col gap-3">
          {type === 'alert' && (
            <button
              onClick={onConfirm}
              className="w-full bg-black text-yellow-400 py-4 font-black tracking-widest hover:bg-yellow-400 hover:text-black transition-colors shadow-[4px_4px_0_0_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1"
            >
              OK
            </button>
          )}
          {(type === 'confirm' || type === 'prompt') && (
            <>
              <button
                onClick={onConfirm}
                className="w-full bg-red-600 text-white border-2 border-red-600 py-3 font-black tracking-widest hover:bg-red-700 transition-colors shadow-[4px_4px_0_0_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1"
              >
                CONFIRM
              </button>
              <button
                onClick={onCancel}
                className="w-full bg-black text-yellow-400 py-3 font-black tracking-widest hover:bg-yellow-400 hover:text-black transition-colors shadow-[4px_4px_0_0_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1"
              >
                CANCEL
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
