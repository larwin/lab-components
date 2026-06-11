import type { ItemDescriptor } from './types';

export interface JSXDescriptor extends ItemDescriptor {
  jsx: unknown;
}

export function isJSXDescriptor(descriptor: ItemDescriptor): descriptor is JSXDescriptor {
  return Object.prototype.hasOwnProperty.call(descriptor, 'jsx');
}
