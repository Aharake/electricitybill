import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "./api";

const RateContext = createContext(null);

export function RateProvider({ children }) {
  const [rate, setRate] = useState(89000);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.settings.get().then((s) => {
      setRate(s.exchangeRate);
      setLoaded(true);
    });
  }, []);

  const updateRate = useCallback(async (newRate) => {
    setRate(newRate);
    await api.settings.update(newRate);
  }, []);

  return (
    <RateContext.Provider value={{ rate, setRate: updateRate, loaded }}>
      {children}
    </RateContext.Provider>
  );
}

export function useRate() {
  return useContext(RateContext);
}
