
import React, { useState, useEffect, useMemo } from 'react';

// Helper to get the actual initial value if it's a function
const resolveInitialValue = <T,>(initialValue: T | (() => T)): T => {
  return initialValue instanceof Function ? initialValue() : initialValue;
};

function getValue<T,>(key: string, initialValueProp: T | (() => T)): T {
  const actualInitialValue = resolveInitialValue(initialValueProp);
  const savedValue = localStorage.getItem(key);

  if (savedValue !== null) {
    try {
      const parsedValue = JSON.parse(savedValue);

      // Scenario 1: Parsed value is null
      if (parsedValue === null) {
        // If initial value was also null, then null is acceptable.
        if (actualInitialValue === null) {
          return parsedValue as T;
        } else {
          // If initial value was NOT null (e.g., [], {}), then stored "null" is problematic.
          // Remove the "null" string from storage and use the actual initial value.
          localStorage.removeItem(key);
          console.warn(`LocalStorage key "${key}": Stored value was "null", but a non-null initial value was expected. Using initial value and removing stored "null".`);
          return actualInitialValue;
        }
      }

      // Scenario 2: Type mismatch (e.g., expected array, got object, or vice-versa)
      const initialValueType = typeof actualInitialValue;
      const parsedValueType = typeof parsedValue;

      if (initialValueType !== parsedValueType && actualInitialValue !== null) {
          const initialIsArray = Array.isArray(actualInitialValue);
          const parsedIsArray = Array.isArray(parsedValue);

          if (initialIsArray !== parsedIsArray) {
            localStorage.removeItem(key);
            console.warn(`LocalStorage key "${key}": Type mismatch (array vs non-array). Expected ${initialIsArray ? 'array' : 'non-array'}, got ${parsedIsArray ? 'array' : 'non-array'}. Using initial value.`);
            return actualInitialValue;
          }
          if (!initialIsArray && initialValueType === 'object' && parsedValueType !== 'object') {
             localStorage.removeItem(key);
             console.warn(`LocalStorage key "${key}": Type mismatch. Expected object, got ${parsedValueType}. Using initial value.`);
             return actualInitialValue;
          }
      }
      if (Array.isArray(actualInitialValue) && !Array.isArray(parsedValue)) {
        localStorage.removeItem(key);
        console.warn(`LocalStorage key "${key}": Expected an array, got ${typeof parsedValue}. Using initial value and removing stored item.`);
        return actualInitialValue;
      }


      return parsedValue as T;
    } catch (error) {
      console.error(`Error parsing localStorage key "${key}":`, error);
      localStorage.removeItem(key); // Remove corrupted data
    }
  }
  return actualInitialValue;
}

export function useLocalStorage<T,>(key: string, initialValueProp: T | (() => T)): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => getValue(key, initialValueProp));

  const resolvedInitialValue = useMemo(() => resolveInitialValue(initialValueProp), [initialValueProp]);

  useEffect(() => {
    if (value === undefined) {
      localStorage.removeItem(key);
    } else if (value === null && resolvedInitialValue !== null) {
      localStorage.removeItem(key);
    }
    else {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        console.error(`Error stringifying value for localStorage key "${key}" during save:`, error, { valueToStore: value });
        // Not removing the key here by default, as it might be better to keep the last known good value
        // if 'value' is temporarily non-serializable. The error log will indicate the problem.
      }
    }
  }, [key, value, resolvedInitialValue]);

  return [value, setValue];
}