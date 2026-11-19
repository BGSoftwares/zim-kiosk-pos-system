// React 19 moved JSX types to React.JSX; @react-three/fiber v8 only augments
// the global JSX namespace, so register the three.js elements here as well.
import type { ThreeElements } from '@react-three/fiber';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}
