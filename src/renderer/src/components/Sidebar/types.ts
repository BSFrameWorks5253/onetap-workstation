import type React from 'react'

export interface SubmenuOption {
  id: string
  label: string
  badge?: string
  subLabel?: string
  icon?: string
  active?: boolean
  onClick: (e?: React.MouseEvent) => void
}
