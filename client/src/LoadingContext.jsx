import { createContext, useContext, useState, useCallback } from "react";

const LoadingContext = createContext(null);

export function LoadingProvider({ children }) {
  const [visible, setVisible] = useState(false);

  const runWithLoading = useCallback(async (fn, minMs = 350) => {
    setVisible(true);
    const start = Date.now();
    try {
      await fn();
    } finally {
      const elapsed = Date.now() - start;
      const wait = Math.max(0, minMs - elapsed);
      setTimeout(() => setVisible(false), wait);
    }
  }, []);

  return (
    <LoadingContext.Provider value={{ runWithLoading }}>
      {children}
      {visible && (
        <div className="modal-overlay">
          <div className="modal-box spinner-modal">
            <div className="spinner" />
            <div>...جار التحميل</div>
          </div>
        </div>
      )}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  return useContext(LoadingContext);
}
