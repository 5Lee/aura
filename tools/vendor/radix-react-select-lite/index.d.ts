import * as React from "react"

export interface SelectRootProps {
  children?: React.ReactNode
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  disabled?: boolean
  name?: string
}

type DivProps = React.HTMLAttributes<HTMLDivElement>
type SpanProps = React.HTMLAttributes<HTMLSpanElement>
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>

export const Root: React.FC<SelectRootProps>

export const Group: React.ForwardRefExoticComponent<
  DivProps & React.RefAttributes<HTMLDivElement>
>

export interface SelectValueProps extends SpanProps {
  placeholder?: React.ReactNode
}

export const Value: React.ForwardRefExoticComponent<
  SelectValueProps & React.RefAttributes<HTMLSpanElement>
>

export const Trigger: React.ForwardRefExoticComponent<
  ButtonProps & React.RefAttributes<HTMLButtonElement>
>

export interface SelectIconProps extends SpanProps {
  asChild?: boolean
}

export const Icon: React.FC<SelectIconProps>

export const ScrollUpButton: React.ForwardRefExoticComponent<
  ButtonProps & React.RefAttributes<HTMLButtonElement>
>

export const ScrollDownButton: React.ForwardRefExoticComponent<
  ButtonProps & React.RefAttributes<HTMLButtonElement>
>

export const Portal: React.FC<{ children?: React.ReactNode }>

export interface SelectContentProps extends DivProps {
  position?: "popper" | "item-aligned" | string
  side?: "top" | "right" | "bottom" | "left" | string
}

export const Content: React.ForwardRefExoticComponent<
  SelectContentProps & React.RefAttributes<HTMLDivElement>
>

export const Viewport: React.ForwardRefExoticComponent<
  DivProps & React.RefAttributes<HTMLDivElement>
>

export const Label: React.ForwardRefExoticComponent<
  DivProps & React.RefAttributes<HTMLDivElement>
>

export interface SelectItemProps extends DivProps {
  value?: string
  disabled?: boolean
}

export const Item: React.ForwardRefExoticComponent<
  SelectItemProps & React.RefAttributes<HTMLDivElement>
>

export const ItemIndicator: React.ForwardRefExoticComponent<
  SpanProps & React.RefAttributes<HTMLSpanElement>
>

export const ItemText: React.ForwardRefExoticComponent<
  SpanProps & React.RefAttributes<HTMLSpanElement>
>

export const Separator: React.ForwardRefExoticComponent<
  DivProps & React.RefAttributes<HTMLDivElement>
>
