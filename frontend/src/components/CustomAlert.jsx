import React, { useState, useEffect } from 'react';

// 全局弹窗回调队列
let alertQueue = [];
let setGlobalShow = null;

export function showAlert(message, onCloseCallback) {
  alertQueue.push({ message, onCloseCallback });
  // 如果弹窗没打开，触发打开第一个
  if (setGlobalShow) {
    setGlobalShow(true);
  }
}

export default function CustomAlert() {
  const [show, setShow] = useState(false);
  const [currentMessage, setCurrentMessage] = useState('');
  const [currentOnClose, setCurrentOnClose] = useState(null);

  setGlobalShow = setShow;

  // 监听队列，当关闭时弹出下一个
  const handleClose = () => {
    setShow(false);
    if (currentOnClose) {
      currentOnClose();
    }
    // 弹出下一个
    alertQueue.shift();
    if (alertQueue.length > 0) {
      setTimeout(() => {
        const next = alertQueue[0];
        setCurrentMessage(next.message);
        setCurrentOnClose(next.onCloseCallback);
        setShow(true);
      }, 200);
    } else {
      setCurrentMessage('');
      setCurrentOnClose(null);
    }
  };

  // 初始化显示第一个
  useEffect(() => {
    if (!show && alertQueue.length > 0 && !currentMessage) {
      const first = alertQueue[0];
      setCurrentMessage(first.message);
      setCurrentOnClose(first.onCloseCallback);
      setShow(true);
    }
  }, [show, currentMessage]);

  if (!show) return null;

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
          <h3 className="text-xl font-black text-center tracking-tight">Message</h3>
        </div>

        <div className="mb-8">
          <p className="text-sm font-bold text-gray-700 whitespace-pre-line text-center">
            {currentMessage}
          </p>
        </div>

        <button
          onClick={handleClose}
          className="w-full bg-black text-yellow-400 py-4 font-black tracking-widest hover:bg-yellow-400 hover:text-black transition-colors shadow-[4px_4px_0_0_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1"
        >
          OK
        </button>
      </div>
    </div>
  );
}
