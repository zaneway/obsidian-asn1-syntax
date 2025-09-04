// Mock CodeMirror
export function defineMode(name: string, factory: Function) {
  // Mock implementation
}

export function getMode(config: any, mode: string) {
  return {
    name: mode,
    startState: () => ({}),
    copyState: (state: any) => ({ ...state }),
    token: () => null
  };
}

export function startState(mode: any) {
  return {};
}

export function copyState(mode: any, state: any) {
  return { ...state };
}