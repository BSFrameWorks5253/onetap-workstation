import React from 'react'
import { CursorType } from './cursorTypes'

export interface CursorAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  cursor: CursorType
  as?: React.ElementType
  children: React.ReactNode
}

/**
 * Reusable wrapper that sets a specific cursor state over its area.
 * Zero layout distortion, completely accessible.
 */
export const CursorArea: React.FC<CursorAreaProps> = ({
  cursor,
  as: Component = 'div',
  className = '',
  children,
  ...rest
}) => {
  return (
    <Component data-cursor={cursor} className={className} {...rest}>
      {children}
    </Component>
  )
}
