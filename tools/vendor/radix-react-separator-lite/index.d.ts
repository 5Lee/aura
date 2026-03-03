import * as React from "react"

export interface SeparatorRootProps
  extends React.HTMLAttributes<HTMLDivElement> {
  decorative?: boolean
  orientation?: "horizontal" | "vertical"
}

export const Root: React.ForwardRefExoticComponent<
  SeparatorRootProps & React.RefAttributes<HTMLDivElement>
>
